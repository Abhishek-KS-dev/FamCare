import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import { db, getStorageStatus } from '../db/store.ts';
import {
  requireAuth,
  sanitizeOptionalNumber,
  sanitizeString,
  sanitizeStringArray,
  signToken,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  deriveAlternativeSearchTerms,
  evaluateAlternativeCandidates,
} from '../services/deterministicRules.ts';
import {
  getGeminiClient,
  runFoodComparisonAgent,
  runFoodIntelligenceAgent,
  withTimeout,
} from '../services/foodIntelligenceAgent.ts';
import {
  fetchProductByBarcode,
  searchOpenFoodFactsProducts,
} from '../services/openFoodFacts.ts';
import { searchIFCT, type IFCTSearchResult } from '../services/ifct.ts';
import type { ProductData, ProductNutriments } from '../types.ts';

export const apiRouter = Router();

function buildProductFromClientPayload(
  body: Record<string, unknown>,
  source: 'ocr_verified' | 'manual_entry' | 'open_food_facts' | 'ifct_2017' | 'prepared_dish_db'
): ProductData | null {
  const name = sanitizeString(body.name, 160);
  if (!name) return null;

  const rawNutriments =
    body.nutriments && typeof body.nutriments === 'object'
      ? (body.nutriments as Record<string, unknown>)
      : {};

  const nutriments: ProductNutriments = {
    energyKcal: sanitizeOptionalNumber(rawNutriments.energyKcal, 0, 10000),
    carbohydrates: sanitizeOptionalNumber(rawNutriments.carbohydrates, 0, 1000),
    sugars: sanitizeOptionalNumber(rawNutriments.sugars, 0, 1000),
    protein: sanitizeOptionalNumber(rawNutriments.protein, 0, 1000),
    fat: sanitizeOptionalNumber(rawNutriments.fat, 0, 1000),
    saturatedFat: sanitizeOptionalNumber(rawNutriments.saturatedFat, 0, 1000),
    sodium: sanitizeOptionalNumber(rawNutriments.sodium, 0, 1000),
    salt: sanitizeOptionalNumber(rawNutriments.salt, 0, 1000),
    fiber: sanitizeOptionalNumber(rawNutriments.fiber, 0, 1000),
  };

  if (nutriments.sodium === null && nutriments.salt !== null) {
    nutriments.sodium = Math.round((nutriments.salt / 2.5) * 1000) / 1000;
  } else if (nutriments.salt === null && nutriments.sodium !== null) {
    nutriments.salt = Math.round(nutriments.sodium * 2.5 * 1000) / 1000;
  }

  const brand = sanitizeString(body.brand, 120) || null;
  const category = sanitizeString(body.category, 120) || null;
  const ingredientsText = sanitizeString(body.ingredientsText, 4000) || null;
  const barcodeRaw = sanitizeString(body.barcode, 24);
  const barcode = /^[0-9]{4,20}$/.test(barcodeRaw) ? barcodeRaw : null;
  const allergensTags = sanitizeStringArray(body.allergensTags, 25, 50).map((a) => a.toLowerCase());
  const additivesTags = sanitizeStringArray(body.additivesTags, 30, 20).map((a) => a.toUpperCase());
  const nutriScoreRaw = sanitizeString(body.nutriScore, 2).toUpperCase();
  const nutriScore = ['A', 'B', 'C', 'D', 'E'].includes(nutriScoreRaw) ? nutriScoreRaw : null;
  const userPrice = sanitizeOptionalNumber(body.userPrice, 0, 100000);

  let imageUrl: string | null = null;
  if (typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    try {
      const u = new URL(body.imageUrl.trim());
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        imageUrl = u.toString();
      }
    } catch {
      imageUrl = null;
    }
  }

  const missingFields: string[] = [];
  if (!brand && source !== 'manual_entry') missingFields.push('Brand');
  if (!ingredientsText) missingFields.push('Ingredients List');
  if (nutriments.energyKcal === null) missingFields.push('Energy (kcal)');
  if (nutriments.sugars === null) missingFields.push('Sugars');
  if (nutriments.protein === null) missingFields.push('Protein');
  if (nutriments.fat === null) missingFields.push('Total Fat');
  if (nutriments.saturatedFat === null) missingFields.push('Saturated Fat');
  if (nutriments.carbohydrates === null) missingFields.push('Carbohydrates');
  if (nutriments.sodium === null) missingFields.push('Sodium');
  if (nutriments.fiber === null) missingFields.push('Fiber');

  return {
    id: sanitizeString(body.id, 60) || `${source}-${Date.now()}`,
    barcode,
    name,
    brand,
    category,
    categoriesTags: category ? [category.toLowerCase()] : [],
    ingredientsText,
    allergensTags,
    additivesTags,
    nutriScore,
    imageUrl,
    quantity: sanitizeString(body.quantity, 40) || null,
    nutriments,
    source,
    verifiedByUser: source === 'ocr_verified' ? Boolean(body.verifiedByUser) : undefined,
    userPrice,
    missingFields,
    offUrl: source === 'open_food_facts' && barcode ? `https://world.openfoodfacts.org/product/${barcode}` : null,
  };
}

// ==========================================
// System Health (Non-sensitive)
// ==========================================
apiRouter.get('/health', (_req, res: Response) => {
  const storage = getStorageStatus();
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  res.json({
    ok: true,
    storageMode: storage.mode,
    storageNotice: storage.notice,
    geminiConfigured,
    externalFoodApi: 'Open Food Facts (world.openfoodfacts.org)',
  });
});

// ==========================================
// Authentication & User Profile
// ==========================================
apiRouter.post('/auth/register', async (req, res: Response) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    const email = sanitizeString(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const familyName = sanitizeString(req.body?.familyName, 100) || `${name}'s Household`;
    const currency = sanitizeString(req.body?.currency, 10).toUpperCase() || 'USD';

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const existing = await db.users.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.users.create({ name, email, passwordHash, currency });
    const defaultFamily = await db.families.create(user.id, familyName);

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, currency: user.currency },
      defaultFamily,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Unable to complete registration. Please try again.' });
  }
});

apiRouter.post('/auth/login', async (req, res: Response) => {
  try {
    const email = sanitizeString(req.body?.email, 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, currency: user.currency },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to sign in. Please try again.' });
  }
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.users.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency,
        createdAt: user.createdAt,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

apiRouter.put('/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    const currency = sanitizeString(req.body?.currency, 10).toUpperCase();
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];

    const updates: { name?: string; currency?: string } = {};
    if (name && name.length >= 2) updates.name = name;
    if (currency && allowedCurrencies.includes(currency)) updates.currency = currency;

    const updated = await db.users.update(req.user!.userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({
      user: { id: updated.id, name: updated.name, email: updated.email, currency: updated.currency },
    });
  } catch {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

apiRouter.put('/auth/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const user = await db.users.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.users.update(user.id, { passwordHash });
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// ==========================================
// Family Groups (Protected & Owned)
// ==========================================
apiRouter.get('/families', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let families = await db.families.listByUser(req.user!.userId);
    if (families.length === 0) {
      const user = await db.users.findById(req.user!.userId);
      const created = await db.families.create(req.user!.userId, `${user?.name || 'My'} Household`);
      families = [created];
    }
    res.json({ families });
  } catch {
    res.status(500).json({ error: 'Failed to load family groups.' });
  }
});

apiRouter.post('/families', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Family group name must be at least 2 characters.' });
      return;
    }
    const family = await db.families.create(req.user!.userId, name);
    res.status(201).json({ family });
  } catch {
    res.status(500).json({ error: 'Failed to create family group.' });
  }
});

apiRouter.put('/families/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Family group name must be at least 2 characters.' });
      return;
    }
    const updated = await db.families.updateOwned(req.params.id, req.user!.userId, name);
    if (!updated) {
      res.status(404).json({ error: 'Family group not found.' });
      return;
    }
    res.json({ family: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update family group.' });
  }
});

apiRouter.delete('/families/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const families = await db.families.listByUser(req.user!.userId);
    if (families.length <= 1) {
      res.status(400).json({ error: 'You must keep at least one family group.' });
      return;
    }
    const deleted = await db.families.deleteOwned(req.params.id, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ error: 'Family group not found.' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete family group.' });
  }
});

// ==========================================
// Family Members (Protected & Owned)
// ==========================================
apiRouter.get('/family-members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const familyId = typeof req.query.familyId === 'string' ? sanitizeString(req.query.familyId, 40) : undefined;
    const members = await db.familyMembers.listByUser(req.user!.userId, familyId);
    res.json({ members });
  } catch {
    res.status(500).json({ error: 'Failed to load family member profiles.' });
  }
});

apiRouter.post('/family-members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const familyId = sanitizeString(req.body?.familyId, 40);
    const name = sanitizeString(req.body?.name, 80);
    const age = sanitizeOptionalNumber(req.body?.age, 0, 130);
    const allergies = sanitizeStringArray(req.body?.allergies);
    const dietaryRestrictions = sanitizeStringArray(req.body?.dietaryRestrictions);
    const foodsToAvoid = sanitizeStringArray(req.body?.foodsToAvoid);
    const nutritionalPreferences = sanitizeStringArray(req.body?.nutritionalPreferences);

    if (!name || name.length < 1) {
      res.status(400).json({ error: 'Family member name is required.' });
      return;
    }

    const ownedFamily = await db.families.findOwnedById(familyId, req.user!.userId);
    if (!ownedFamily) {
      res.status(403).json({ error: 'Invalid or unauthorized family group.' });
      return;
    }

    const member = await db.familyMembers.create({
      familyId: ownedFamily.id,
      userId: req.user!.userId,
      name,
      age: age !== null ? Math.round(age) : null,
      allergies,
      dietaryRestrictions,
      foodsToAvoid,
      nutritionalPreferences,
    });

    res.status(201).json({ member });
  } catch {
    res.status(500).json({ error: 'Failed to add family member.' });
  }
});

apiRouter.put('/family-members/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = sanitizeString(req.body?.name, 80);
    if (!name) {
      res.status(400).json({ error: 'Family member name is required.' });
      return;
    }

    const age = sanitizeOptionalNumber(req.body?.age, 0, 130);
    const updates = {
      name,
      age: age !== null ? Math.round(age) : null,
      allergies: sanitizeStringArray(req.body?.allergies),
      dietaryRestrictions: sanitizeStringArray(req.body?.dietaryRestrictions),
      foodsToAvoid: sanitizeStringArray(req.body?.foodsToAvoid),
      nutritionalPreferences: sanitizeStringArray(req.body?.nutritionalPreferences),
    };

    const updated = await db.familyMembers.updateOwned(req.params.id, req.user!.userId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Family member profile not found.' });
      return;
    }

    res.json({ member: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update family member profile.' });
  }
});

apiRouter.delete('/family-members/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await db.familyMembers.deleteOwned(req.params.id, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ error: 'Family member profile not found.' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete family member profile.' });
  }
});

// ==========================================
// Open Food Facts Product Lookups (Protected)
// ==========================================
apiRouter.get('/products/barcode/:barcode', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const barcode = sanitizeString(req.params.barcode, 24);
    const result = await fetchProductByBarcode(barcode);
    res.json(result);
  } catch {
    res.status(500).json({ found: false, product: null, error: 'Failed to query Open Food Facts.' });
  }
});

apiRouter.get('/products/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = sanitizeString(req.query.q, 80);
    if (!q || q.length < 2) {
      res.status(400).json({ error: 'Please provide at least 2 characters to search Open Food Facts.' });
      return;
    }
    const result = await searchOpenFoodFactsProducts(q, { pageSize: 12 });
    res.json(result);
  } catch {
    res.status(500).json({ products: [], queryUsed: '', error: 'Failed to search Open Food Facts.' });
  }
});

apiRouter.get('/products/ifct-search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = sanitizeString(req.query.q, 80);
    if (!q || q.length < 2) {
      res.status(400).json({ error: 'Please provide at least 2 characters to search IFCT.' });
      return;
    }
    const results = searchIFCT(q, 5);
    res.json({ results, queryUsed: q });
  } catch (err) {
    console.error('IFCT search error:', err);
    res.status(500).json({ results: [], queryUsed: '', error: 'Failed to search IFCT 2017 database.' });
  }
});

// ==========================================
// Gemini Vision OCR Extraction Route
// ==========================================
apiRouter.post('/ocr/extract', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawMime = req.body?.mimeType;
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (typeof rawMime !== 'string' || !allowedMimes.includes(rawMime)) {
      res.status(400).json({ error: 'Invalid mimeType. Must be image/jpeg, image/png, or image/webp.' });
      return;
    }
    const mimeType = rawMime as 'image/jpeg' | 'image/png' | 'image/webp';

    const rawBase64 = req.body?.imageBase64;
    if (typeof rawBase64 !== 'string' || !rawBase64.trim()) {
      res.status(400).json({ error: 'Missing imageBase64 payload.' });
      return;
    }

    // Strip data URL prefix if sent
    const base64Data = rawBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();
    // Validate decoded size <= ~1.5 MB (1.5 * 1024 * 1024 = 1,572,864 bytes)
    const approxDecodedBytes = (base64Data.length * 3) / 4;
    if (approxDecodedBytes > 1.6 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size exceeds the 1.5 MB limit. Please resize before uploading.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API client is not configured on the server.' });
      return;
    }

    const visionModel = process.env.GEMINI_VISION_MODEL?.trim() || process.env.GEMINI_AGENT_MODEL?.trim() || 'gemini-4-hydrogen';
    const visionPrompt = `You transcribe food packaging labels. Transcribe ONLY text that is actually visible. Never guess, infer, or complete missing text. If part of a word, number, or ingredient list is cut off, hidden, blurred or unreadable, write [unreadable] in its place. Do not add allergens or ingredients that are not printed. For nutrition, use the PER 100 g / PER 100 ml column, not the per-serving column. Return null for any value you cannot read. Return JSON only: {productName, brand, ingredientsText, allergensText, additivesText, servingSize, servingsPerPack, per100: {energyKcal, protein, carbohydrates, sugars, addedSugars, fat, saturatedFat, transFat, sodiumMg, fiber}, unitBasis ('100 g' | '100 ml' | null), unreadableParts: string[], confidence: 'high' | 'medium' | 'low'}.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: visionModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
              {
                text: visionPrompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      }),
      25000,
      'Gemini Vision Extraction'
    );

    const rawText = (response.text || '').trim();
    if (!rawText) {
      res.status(500).json({ error: 'Gemini vision model returned an empty response.' });
      return;
    }

    // Clean code fences if any
    const cleanedJsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleanedJsonText);
    } catch {
      res.status(500).json({ error: 'Failed to parse JSON response from Gemini vision model.' });
      return;
    }

    // Coerce and sanitize parsed structure
    const parseNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'string') {
        const cleaned = v.replace(/[^0-9.-]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
      }
      const num = Number(v);
      return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : null;
    };

    const parseStr = (v: unknown, maxLen = 3000): string | null => {
      if (typeof v !== 'string' || !v.trim()) return null;
      return v.trim().slice(0, maxLen);
    };

    const rawPer100 = (parsed.per100 && typeof parsed.per100 === 'object')
      ? (parsed.per100 as Record<string, unknown>)
      : {};

    const per100 = {
      energyKcal: parseNum(rawPer100.energyKcal),
      protein: parseNum(rawPer100.protein),
      carbohydrates: parseNum(rawPer100.carbohydrates),
      sugars: parseNum(rawPer100.sugars),
      addedSugars: parseNum(rawPer100.addedSugars),
      fat: parseNum(rawPer100.fat),
      saturatedFat: parseNum(rawPer100.saturatedFat),
      transFat: parseNum(rawPer100.transFat),
      sodiumMg: parseNum(rawPer100.sodiumMg),
      fiber: parseNum(rawPer100.fiber),
    };

    const rawUnreadable = Array.isArray(parsed.unreadableParts)
      ? parsed.unreadableParts.map((u) => parseStr(u, 200)).filter(Boolean) as string[]
      : [];

    const rawUnit = typeof parsed.unitBasis === 'string' ? parsed.unitBasis.trim().toLowerCase() : '';
    const unitBasis: '100 g' | '100 ml' | null =
      rawUnit.includes('ml') ? '100 ml' : rawUnit.includes('g') ? '100 g' : null;

    const rawConfidence = typeof parsed.confidence === 'string' ? parsed.confidence.trim().toLowerCase() : 'medium';
    const confidence: 'high' | 'medium' | 'low' =
      rawConfidence === 'high' || rawConfidence === 'low' ? rawConfidence : 'medium';

    const extraction = {
      productName: parseStr(parsed.productName, 200),
      brand: parseStr(parsed.brand, 150),
      ingredientsText: parseStr(parsed.ingredientsText, 4000),
      allergensText: parseStr(parsed.allergensText, 500),
      additivesText: parseStr(parsed.additivesText, 500),
      servingSize: parseStr(parsed.servingSize, 100),
      servingsPerPack: parseStr(parsed.servingsPerPack, 50),
      per100,
      unitBasis,
      unreadableParts: rawUnreadable,
      confidence,
    };

    res.json({ extraction });
  } catch (err) {
    console.error('OCR extract error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to extract label via Gemini Vision.';
    res.status(500).json({ error: msg });
  }
});

// ==========================================
// Central Food Intelligence Agent Routes
// ==========================================
apiRouter.post('/agent/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskType = req.body?.taskType;
    if (taskType !== 'barcode_analysis' && taskType !== 'ocr_analysis' && taskType !== 'manual_analysis') {
      res.status(400).json({ error: 'Invalid analysis taskType.' });
      return;
    }

    const familyMemberId = sanitizeString(req.body?.familyMemberId, 40);
    let familyMember = null;
    if (familyMemberId) {
      familyMember = await db.familyMembers.findOwnedById(familyMemberId, req.user!.userId);
      if (!familyMember) {
        res.status(403).json({ error: 'Selected family member is not authorized for this account.' });
        return;
      }
    }

    const requestAlternatives = Boolean(req.body?.requestAlternatives);

    if (taskType === 'barcode_analysis') {
      const barcode = sanitizeString(req.body?.barcode, 24);
      if (!/^[0-9]{4,20}$/.test(barcode)) {
        res.status(400).json({ error: 'Please provide a valid numeric barcode (4 to 20 digits).' });
        return;
      }

      const report = await runFoodIntelligenceAgent({
        taskType: 'barcode_analysis',
        barcode,
        familyMember,
        requestAlternatives,
      });
      res.json({ report });
      return;
    }

    if (taskType === 'ocr_analysis') {
      if (!req.body?.product || typeof req.body.product !== 'object') {
        res.status(400).json({ error: 'OCR product payload is required.' });
        return;
      }
      if (!req.body.product.verifiedByUser) {
        res.status(400).json({
          error: 'Please review and confirm verification of OCR-extracted text before running analysis.',
        });
        return;
      }
      const product = buildProductFromClientPayload(req.body.product, 'ocr_verified');
      if (!product) {
        res.status(400).json({ error: 'Product name is required for OCR analysis.' });
        return;
      }

      const report = await runFoodIntelligenceAgent({
        taskType: 'ocr_analysis',
        providedProduct: product,
        familyMember,
        requestAlternatives,
      });
      res.json({ report });
      return;
    }

    // manual_analysis
    const rawEntryText = sanitizeString(req.body?.rawEntryText, 500) || null;
    if (!req.body?.product || typeof req.body.product !== 'object') {
      res.status(400).json({ error: 'Manual food entry payload is required.' });
      return;
    }
    const product = buildProductFromClientPayload(req.body.product, 'manual_entry');
    if (!product) {
      res.status(400).json({ error: 'Food name is required for manual analysis.' });
      return;
    }

    const report = await runFoodIntelligenceAgent({
      taskType: 'manual_analysis',
      providedProduct: product,
      familyMember,
      requestAlternatives,
      rawEntryText,
    });
    res.json({ report });
  } catch (err) {
    console.error('Agent analyze error:', err);
    res.status(500).json({ error: 'Food Intelligence Agent encountered an error while analyzing the product.' });
  }
});

apiRouter.post('/agent/alternatives', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.body?.product || typeof req.body.product !== 'object') {
      res.status(400).json({ error: 'Base product data is required to find alternatives.' });
      return;
    }

    const rawSource = req.body.product.source;
    const source: 'open_food_facts' | 'ocr_verified' | 'manual_entry' | 'ifct_2017' | 'prepared_dish_db' =
      rawSource === 'ocr_verified' || rawSource === 'manual_entry' || rawSource === 'ifct_2017' || rawSource === 'prepared_dish_db' ? rawSource : 'open_food_facts';

    const product = buildProductFromClientPayload(req.body.product, source);
    if (!product) {
      res.status(400).json({ error: 'Valid product name is required.' });
      return;
    }

    const familyMemberId = sanitizeString(req.body?.familyMemberId, 40);
    let familyMember = null;
    if (familyMemberId) {
      familyMember = await db.familyMembers.findOwnedById(familyMemberId, req.user!.userId);
      if (!familyMember) {
        res.status(403).json({ error: 'Unauthorized family member selection.' });
        return;
      }
    }

    const customQuery = sanitizeString(req.body?.query, 80);
    const query = customQuery.length >= 2 ? customQuery : deriveAlternativeSearchTerms(product);
    const searchRes = await searchOpenFoodFactsProducts(query, {
      categoryTag: product.category,
      pageSize: 24,
    });

    const alternatives = evaluateAlternativeCandidates(
      product,
      searchRes.products,
      familyMember,
      searchRes.queryUsed
    );

    res.json({ alternatives, error: searchRes.error || null });
  } catch {
    res.status(500).json({ error: 'Unable to retrieve alternative recommendations.' });
  }
});

apiRouter.post('/agent/compare', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawProducts = req.body?.products;
    if (!Array.isArray(rawProducts) || rawProducts.length < 2 || rawProducts.length > 4) {
      res.status(400).json({ error: 'Please provide between 2 and 4 products to compare.' });
      return;
    }

    const products: ProductData[] = [];
    for (const item of rawProducts) {
      if (!item || typeof item !== 'object') continue;
      const src =
        item.source === 'ocr_verified' || item.source === 'manual_entry' ? item.source : 'open_food_facts';
      const parsed = buildProductFromClientPayload(item as Record<string, unknown>, src);
      if (parsed) products.push(parsed);
    }

    if (products.length < 2) {
      res.status(400).json({ error: 'At least 2 valid products are required for comparison.' });
      return;
    }

    const familyMemberId = sanitizeString(req.body?.familyMemberId, 40);
    let familyMember = null;
    if (familyMemberId) {
      familyMember = await db.familyMembers.findOwnedById(familyMemberId, req.user!.userId);
      if (!familyMember) {
        res.status(403).json({ error: 'Unauthorized family member selection.' });
        return;
      }
    }

    const comparison = await runFoodComparisonAgent(products, familyMember);
    res.json({ comparison });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ error: 'Failed to compare selected products.' });
  }
});

// ==========================================
// Purchase History (Protected & Owned)
// ==========================================
apiRouter.get('/purchases', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const familyId = typeof req.query.familyId === 'string' ? sanitizeString(req.query.familyId, 40) : undefined;
    const purchases = await db.purchases.listByUser(req.user!.userId, familyId);
    res.json({ purchases });
  } catch {
    res.status(500).json({ error: 'Failed to load purchase history.' });
  }
});

apiRouter.post('/purchases', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const familyId = sanitizeString(req.body?.familyId, 40);
    const productName = sanitizeString(req.body?.productName, 200);
    const brand = sanitizeString(req.body?.brand, 120) || null;
    const category = sanitizeString(req.body?.category, 120) || 'Uncategorized';
    const barcodeRaw = sanitizeString(req.body?.barcode, 24);
    const barcode = /^[0-9]{4,20}$/.test(barcodeRaw) ? barcodeRaw : null;
    const sourceRaw = req.body?.source;
    const source: 'open_food_facts' | 'ocr_verified' | 'manual_entry' | 'ifct_2017' | 'prepared_dish_db' =
      sourceRaw === 'ocr_verified' || sourceRaw === 'manual_entry' || sourceRaw === 'ifct_2017' || sourceRaw === 'prepared_dish_db' ? sourceRaw : 'open_food_facts';
    const quantity = sanitizeOptionalNumber(req.body?.quantity, 0.01, 10000);
    const unitPrice = sanitizeOptionalNumber(req.body?.unitPrice, 0, 100000);
    const nutriScoreRaw = sanitizeString(req.body?.nutriScore, 2).toUpperCase();
    const nutriScore = ['A', 'B', 'C', 'D', 'E'].includes(nutriScoreRaw) ? nutriScoreRaw : null;

    if (!productName) {
      res.status(400).json({ error: 'Product name is required.' });
      return;
    }
    if (quantity === null || unitPrice === null) {
      res.status(400).json({ error: 'Valid quantity and unit price are required.' });
      return;
    }

    const ownedFamily = await db.families.findOwnedById(familyId, req.user!.userId);
    if (!ownedFamily) {
      res.status(403).json({ error: 'Invalid or unauthorized family group.' });
      return;
    }

    let familyMemberId: string | null = null;
    let familyMemberName: string | null = null;
    const reqMemberId = sanitizeString(req.body?.familyMemberId, 40);
    if (reqMemberId) {
      const member = await db.familyMembers.findOwnedById(reqMemberId, req.user!.userId);
      if (member) {
        familyMemberId = member.id;
        familyMemberName = member.name;
      }
    }

    let purchasedAt = new Date().toISOString();
    if (typeof req.body?.purchasedAt === 'string' && req.body.purchasedAt.trim()) {
      const d = new Date(req.body.purchasedAt);
      if (!Number.isNaN(d.getTime())) {
        purchasedAt = d.toISOString();
      }
    }

    const totalPrice = Math.round(quantity * unitPrice * 100) / 100;

    const purchase = await db.purchases.create({
      userId: req.user!.userId,
      familyId: ownedFamily.id,
      familyMemberId,
      familyMemberName,
      barcode,
      productName,
      brand,
      category,
      source,
      quantity,
      unitPrice,
      totalPrice,
      nutriScore,
      purchasedAt,
    });

    res.status(201).json({ purchase });
  } catch {
    res.status(500).json({ error: 'Failed to save purchase record.' });
  }
});

apiRouter.delete('/purchases/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await db.purchases.deleteOwned(req.params.id, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ error: 'Purchase record not found.' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete purchase record.' });
  }
});

// ==========================================
// Monthly Budget Tracking (Protected & Owned)
// ==========================================
apiRouter.get('/budgets/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const familyId = sanitizeString(req.query.familyId, 40);
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthParam = sanitizeString(req.query.month, 10);
    const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : defaultMonth;

    const ownedFamily = await db.families.findOwnedById(familyId, req.user!.userId);
    if (!ownedFamily) {
      res.status(403).json({ error: 'Invalid or unauthorized family group.' });
      return;
    }

    const [budgets, purchases, user] = await Promise.all([
      db.budgets.listByUser(req.user!.userId, ownedFamily.id),
      db.purchases.listByUser(req.user!.userId, ownedFamily.id),
      db.users.findById(req.user!.userId),
    ]);

    const currentBudget = budgets.find((b) => b.month === month) ?? null;

    const monthPurchases = purchases.filter((p) => p.purchasedAt.slice(0, 7) === month);
    const totalSpent =
      Math.round(monthPurchases.reduce((acc, p) => acc + p.totalPrice, 0) * 100) / 100;
    const budgetLimit = currentBudget?.budgetLimit ?? null;
    const remainingBudget =
      budgetLimit !== null ? Math.round((budgetLimit - totalSpent) * 100) / 100 : null;

    // Category breakdown for the selected month
    const categoryMap = new Map<string, number>();
    for (const p of monthPurchases) {
      const cat = p.category || 'Uncategorized';
      categoryMap.set(cat, Math.round(((categoryMap.get(cat) ?? 0) + p.totalPrice) * 100) / 100);
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // 6-month trend ending at selected month
    const [yrStr, moStr] = month.split('-');
    const baseYear = Number(yrStr);
    const baseMonthIdx = Number(moStr) - 1;
    const monthlyTrend: Array<{ month: string; spent: number; budgetLimit: number | null }> = [];

    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(baseYear, baseMonthIdx - offset, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const spent =
        Math.round(
          purchases
            .filter((p) => p.purchasedAt.slice(0, 7) === mKey)
            .reduce((acc, p) => acc + p.totalPrice, 0) * 100
        ) / 100;
      const bRec = budgets.find((b) => b.month === mKey);
      monthlyTrend.push({ month: mKey, spent, budgetLimit: bRec?.budgetLimit ?? null });
    }

    res.json({
      month,
      currency: currentBudget?.currency || user?.currency || 'USD',
      budgetLimit,
      totalSpent,
      remainingBudget,
      purchaseCount: monthPurchases.length,
      categoryBreakdown,
      monthlyTrend,
      budgets,
    });
  } catch {
    res.status(500).json({ error: 'Failed to calculate monthly budget summary.' });
  }
});

apiRouter.post('/budgets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const familyId = sanitizeString(req.body?.familyId, 40);
    const month = sanitizeString(req.body?.month, 10);
    const budgetLimit = sanitizeOptionalNumber(req.body?.budgetLimit, 0, 10000000);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Month must use YYYY-MM format.' });
      return;
    }
    if (budgetLimit === null) {
      res.status(400).json({ error: 'Please enter a valid non-negative monthly budget limit.' });
      return;
    }

    const ownedFamily = await db.families.findOwnedById(familyId, req.user!.userId);
    if (!ownedFamily) {
      res.status(403).json({ error: 'Invalid or unauthorized family group.' });
      return;
    }

    const user = await db.users.findById(req.user!.userId);
    const currency = sanitizeString(req.body?.currency, 10).toUpperCase() || user?.currency || 'USD';

    const budget = await db.budgets.upsert({
      userId: req.user!.userId,
      familyId: ownedFamily.id,
      month,
      budgetLimit,
      currency,
    });

    res.json({ budget });
  } catch {
    res.status(500).json({ error: 'Failed to save monthly budget.' });
  }
});
