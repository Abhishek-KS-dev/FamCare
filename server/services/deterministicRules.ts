import type {
  AlternativeRecommendation,
  AlternativeSearchResult,
  CompatibilityConflict,
  FamilyCompatibilityResult,
  FamilyMemberRecord,
  IngredientAnalysisResult,
  NutrientObservation,
  NutritionalAnalysisResult,
  ProductData,
} from '../types.ts';

// Comprehensive deterministic synonym dictionaries for allergen & dietary rule checks.
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanut: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'arachis', 'monkey nut'],
  'tree nuts': [
    'almond',
    'almonds',
    'hazelnut',
    'hazelnuts',
    'walnut',
    'walnuts',
    'cashew',
    'cashews',
    'pecan',
    'pecans',
    'pistachio',
    'pistachios',
    'macadamia',
    'brazil nut',
    'pine nut',
    'tree nut',
    'tree nuts',
    'praline',
    'marzipan',
    'nougat',
  ],
  milk: [
    'milk',
    'dairy',
    'whey',
    'casein',
    'caseinate',
    'lactose',
    'cream',
    'butter',
    'buttermilk',
    'ghee',
    'cheese',
    'yogurt',
    'yoghurt',
    'skimmed milk',
    'milk powder',
    'milkfat',
    'curd',
  ],
  lactose: ['lactose', 'milk', 'whey', 'cream', 'buttermilk', 'milk powder', 'yogurt', 'yoghurt', 'cheese', 'dairy'],
  egg: ['egg', 'eggs', 'albumen', 'albumin', 'ovalbumin', 'mayonnaise', 'meringue', 'lysozyme'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'edamame', 'miso', 'tempeh', 'soy lecithin', 'soya lecithin'],
  wheat: ['wheat', 'durum', 'semolina', 'spelt', 'kamut', 'bulgur', 'couscous', 'farina', 'wheat flour'],
  gluten: ['gluten', 'wheat', 'barley', 'rye', 'spelt', 'malt', 'triticale', 'semolina', 'durum', 'farro'],
  fish: ['fish', 'anchovy', 'anchovies', 'cod', 'salmon', 'tuna', 'sardine', 'mackerel', 'haddock', 'tilapia', 'pollock', 'fish sauce'],
  shellfish: ['shellfish', 'shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish', 'crustacean', 'crustaceans', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari'],
  sesame: ['sesame', 'tahini', 'sesame seed', 'sesame oil', 'benne'],
  mustard: ['mustard', 'mustard seed', 'mustard flour'],
  celery: ['celery', 'celeriac', 'celery salt'],
  lupin: ['lupin', 'lupine'],
  sulfites: ['sulfite', 'sulfites', 'sulphite', 'sulphites', 'sulfur dioxide', 'sulphur dioxide', 'e220', 'e221', 'e222', 'e223', 'e224', 'e228'],
};

const DIETARY_RESTRICTION_FORBIDDEN: Record<string, string[]> = {
  vegetarian: [
    'beef',
    'pork',
    'chicken',
    'turkey',
    'lamb',
    'mutton',
    'bacon',
    'ham',
    'sausage',
    'meat',
    'poultry',
    'veal',
    'gelatin',
    'gelatine',
    'lard',
    'tallow',
    'suet',
    'fish',
    'anchovy',
    'anchovies',
    'salmon',
    'tuna',
    'shrimp',
    'prawn',
    'crab',
    'lobster',
    'shellfish',
    'carmine',
    'e120',
    'rennet',
  ],
  vegan: [
    'beef',
    'pork',
    'chicken',
    'turkey',
    'lamb',
    'bacon',
    'ham',
    'meat',
    'gelatin',
    'gelatine',
    'lard',
    'fish',
    'anchovy',
    'salmon',
    'tuna',
    'shrimp',
    'milk',
    'dairy',
    'whey',
    'casein',
    'lactose',
    'cream',
    'butter',
    'ghee',
    'cheese',
    'yogurt',
    'egg',
    'eggs',
    'albumen',
    'honey',
    'beeswax',
    'e901',
    'carmine',
    'e120',
    'shellac',
  ],
  'gluten-free': ALLERGEN_SYNONYMS.gluten,
  'gluten restriction': ALLERGEN_SYNONYMS.gluten,
  'dairy-free': ALLERGEN_SYNONYMS.milk,
  'lactose-free': ALLERGEN_SYNONYMS.lactose,
  'lactose intolerance': ALLERGEN_SYNONYMS.lactose,
  halal: ['pork', 'bacon', 'ham', 'lard', 'gelatin', 'gelatine', 'alcohol', 'wine', 'beer', 'rum', 'brandy', 'whisky', 'whiskey'],
  kosher: ['pork', 'bacon', 'ham', 'lard', 'shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'oyster', 'mussel'],
  'nut-free': [...ALLERGEN_SYNONYMS.peanut, ...ALLERGEN_SYNONYMS['tree nuts']],
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(haystack: string, term: string): boolean {
  const clean = term.trim().toLowerCase();
  if (!clean) return false;
  const regex = new RegExp(`(^|[^a-z0-9])${escapeRegExp(clean)}([^a-z0-9]|$)`, 'i');
  return regex.test(haystack);
}

function expandProfileTerm(rawTerm: string): string[] {
  const normalized = rawTerm.trim().toLowerCase();
  const terms = new Set<string>([normalized]);

  // Strip helper words like "allergy", "intolerance", "restriction", "free", "preference"
  const stripped = normalized
    .replace(/\b(allergy|allergies|intolerance|restriction|restricted|sensitivity|free|avoid|no)\b/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped && stripped.length >= 2) {
    terms.add(stripped);
  }

  for (const [key, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
    if (
      normalized.includes(key) ||
      (stripped && (key.includes(stripped) || stripped.includes(key))) ||
      synonyms.some((s) => s === stripped || s === normalized)
    ) {
      for (const s of synonyms) terms.add(s);
    }
  }

  return Array.from(terms);
}

// TOOL 2: Deterministic Ingredient & Allergen Analysis
export function analyzeIngredientsAndAllergens(product: ProductData): IngredientAnalysisResult {
  const rawText = (product.ingredientsText || '').trim();
  const ingredientsAvailable = rawText.length > 0;

  const parsedIngredients = ingredientsAvailable
    ? rawText
        .split(/[,;]+/)
        .map((s) => s.replace(/[_*]/g, '').trim())
        .filter((s) => s.length > 0)
        .slice(0, 60)
    : [];

  const detectedAllergens = new Set<string>();

  for (const tag of product.allergensTags) {
    const clean = tag.trim().toLowerCase();
    if (clean) detectedAllergens.add(clean);
  }

  if (ingredientsAvailable) {
    const lowerText = rawText.toLowerCase();
    for (const [allergenGroup, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
      if (synonyms.some((syn) => containsTerm(lowerText, syn))) {
        detectedAllergens.add(allergenGroup);
      }
    }
  }

  const additivesSet = new Set<string>(product.additivesTags.map((a) => a.toUpperCase()));
  if (ingredientsAvailable) {
    const eNumberMatches = rawText.match(/\bE\s?\d{3}[a-z]?\b/gi) || [];
    for (const match of eNumberMatches) {
      additivesSet.add(match.replace(/\s+/g, '').toUpperCase());
    }
  }

  const notes: string[] = [];
  let incompleteWarning: string | null = null;

  if (!ingredientsAvailable) {
    incompleteWarning =
      'Ingredient list is unavailable for this product. Allergen and dietary detection cannot be considered complete without verified packaging ingredients.';
  } else if (parsedIngredients.length <= 1 && rawText.length < 12) {
    incompleteWarning =
      'Ingredient list appears unusually short or incomplete. Please verify against the physical product packaging.';
  }

  if (detectedAllergens.size > 0) {
    notes.push(`Detected ${detectedAllergens.size} known allergen group(s) from available label/Open Food Facts data.`);
  } else if (ingredientsAvailable) {
    notes.push(
      'No major standard allergens matched in the available ingredient text. Cross-contamination warnings on physical packaging should still be checked.'
    );
  }

  if (additivesSet.size > 0) {
    notes.push(`Identified ${additivesSet.size} food additive code(s): ${Array.from(additivesSet).slice(0, 8).join(', ')}.`);
  }

  return {
    ingredientsAvailable,
    parsedIngredients,
    detectedAllergens: Array.from(detectedAllergens).sort(),
    detectedAdditives: Array.from(additivesSet).sort(),
    incompleteWarning,
    notes,
  };
}

// TOOL 3: Deterministic Nutritional Analysis (transparent WHO / UK Traffic Light per-100g rules)
export function analyzeNutrition(product: ProductData): NutritionalAnalysisResult {
  const n = product.nutriments;
  const observations: NutrientObservation[] = [];
  const concerns: string[] = [];
  const missingNutrients: string[] = [];

  const checkField = (
    nutrient: string,
    value: number | null,
    unit: string,
    classifier: (v: number) => { level: 'low' | 'moderate' | 'high'; observation: string; concern?: string }
  ) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      missingNutrients.push(nutrient);
      observations.push({
        nutrient,
        value: null,
        unit,
        level: 'unavailable',
        observation: `${nutrient} data is unavailable for this product.`,
      });
      return;
    }
    const result = classifier(value);
    observations.push({
      nutrient,
      value,
      unit,
      level: result.level,
      observation: result.observation,
    });
    if (result.concern) {
      concerns.push(result.concern);
    }
  };

  checkField('Energy', n.energyKcal, 'kcal', (v) => {
    if (v >= 400) {
      return {
        level: 'high',
        observation: `Energy-dense at ${v} kcal per 100g (>= 400 kcal threshold).`,
        concern: `High energy density (${v} kcal/100g). Consider portion size.`,
      };
    }
    if (v >= 200) {
      return { level: 'moderate', observation: `Moderate energy density at ${v} kcal per 100g.` };
    }
    return { level: 'low', observation: `Lower energy density at ${v} kcal per 100g.` };
  });

  checkField('Sugars', n.sugars, 'g', (v) => {
    if (v > 22.5) {
      return {
        level: 'high',
        observation: `High sugar content at ${v}g per 100g (> 22.5g high threshold).`,
        concern: `High sugar content (${v}g per 100g).`,
      };
    }
    if (v > 5) {
      return { level: 'moderate', observation: `Moderate sugar content at ${v}g per 100g (5g–22.5g range).` };
    }
    return { level: 'low', observation: `Low sugar content at ${v}g per 100g (<= 5g threshold).` };
  });

  checkField('Total Fat', n.fat, 'g', (v) => {
    if (v > 17.5) {
      return {
        level: 'high',
        observation: `High total fat at ${v}g per 100g (> 17.5g high threshold).`,
        concern: `High total fat (${v}g per 100g).`,
      };
    }
    if (v > 3) {
      return { level: 'moderate', observation: `Moderate total fat at ${v}g per 100g (3g–17.5g range).` };
    }
    return { level: 'low', observation: `Low total fat at ${v}g per 100g (<= 3g threshold).` };
  });

  checkField('Saturated Fat', n.saturatedFat, 'g', (v) => {
    if (v > 5) {
      return {
        level: 'high',
        observation: `High saturated fat at ${v}g per 100g (> 5g high threshold).`,
        concern: `High saturated fat (${v}g per 100g).`,
      };
    }
    if (v > 1.5) {
      return { level: 'moderate', observation: `Moderate saturated fat at ${v}g per 100g (1.5g–5g range).` };
    }
    return { level: 'low', observation: `Low saturated fat at ${v}g per 100g (<= 1.5g threshold).` };
  });

  checkField('Sodium', n.sodium, 'g', (v) => {
    if (v > 0.6) {
      return {
        level: 'high',
        observation: `High sodium at ${v}g per 100g (> 0.6g sodium / 1.5g salt threshold).`,
        concern: `High sodium content (${v}g per 100g).`,
      };
    }
    if (v > 0.12) {
      return { level: 'moderate', observation: `Moderate sodium at ${v}g per 100g (0.12g–0.6g range).` };
    }
    return { level: 'low', observation: `Low sodium at ${v}g per 100g (<= 0.12g threshold).` };
  });

  checkField('Protein', n.protein, 'g', (v) => {
    if (v >= 12) {
      return { level: 'high', observation: `Good protein source at ${v}g per 100g (>= 12g).` };
    }
    if (v >= 5) {
      return { level: 'moderate', observation: `Moderate protein at ${v}g per 100g.` };
    }
    return { level: 'low', observation: `Low protein at ${v}g per 100g.` };
  });

  checkField('Carbohydrates', n.carbohydrates, 'g', (v) => {
    if (v >= 50) {
      return { level: 'high', observation: `Carbohydrate-rich at ${v}g per 100g.` };
    }
    if (v >= 15) {
      return { level: 'moderate', observation: `Moderate carbohydrates at ${v}g per 100g.` };
    }
    return { level: 'low', observation: `Low carbohydrates at ${v}g per 100g.` };
  });

  checkField('Fiber', n.fiber, 'g', (v) => {
    if (v >= 6) {
      return { level: 'high', observation: `High dietary fiber at ${v}g per 100g (>= 6g).` };
    }
    if (v >= 3) {
      return { level: 'moderate', observation: `Source of dietary fiber at ${v}g per 100g.` };
    }
    return { level: 'low', observation: `Low dietary fiber at ${v}g per 100g.` };
  });

  const hasAnyNutritionData = observations.some((o) => o.level !== 'unavailable');

  return {
    hasAnyNutritionData,
    observations,
    concerns,
    missingNutrients,
    disclaimer:
      'Nutritional observations are calculated per 100g using transparent reference thresholds (UK/WHO traffic-light guidelines) and are informational only—not medical advice or diagnosis.',
  };
}

// TOOL 4: Deterministic Family Health Compatibility Checker
// IMPORTANT: Runs strictly on the backend. Gemini NEVER overrides these results.
export function checkFamilyCompatibilityDeterministic(
  product: ProductData,
  member: FamilyMemberRecord
): FamilyCompatibilityResult {
  const ingredientText = (product.ingredientsText || '').toLowerCase();
  const allergenTagText = product.allergensTags.join(', ').toLowerCase();
  const productTitleText = `${product.name} ${product.category || ''}`.toLowerCase();
  const combinedEvidenceText = `${ingredientText} , ${allergenTagText}`.trim();
  const hasIngredients = Boolean(product.ingredientsText && product.ingredientsText.trim().length > 0);

  const conflicts: CompatibilityConflict[] = [];
  const warnings: string[] = [];

  if (!hasIngredients) {
    warnings.push(
      'Ingredient list is missing for this product. Allergen and restriction screening could only check limited metadata and cannot confirm absence of restricted ingredients.'
    );
  }

 // 1. Check Registered Food Allergies (HIGH severity)

// Only compare allergens against the selected member's
// registered allergy profile.

for (const allergy of member.allergies) {
  const terms = expandProfileTerm(allergy);

  const matchedInIngredients = terms.find((term) =>
    containsTerm(ingredientText, term)
  );

  const matchedInAllergenTags = terms.find((term) =>
    containsTerm(allergenTagText, term)
  );

  const matchedInTitle = terms.find((term) =>
    containsTerm(productTitleText, term)
  );

  const matched =
    matchedInIngredients ||
    matchedInAllergenTags ||
    matchedInTitle;

  if (matched) {
    const evidenceSource = matchedInIngredients
      ? `Matched "${matchedInIngredients}" in product ingredients`
      : matchedInAllergenTags
        ? `Matched "${matchedInAllergenTags}" in product allergen information`
        : `Matched "${matchedInTitle}" in product name/category`;

    conflicts.push({
      type: 'allergy',
      severity: 'high',
      ruleTriggered: allergy,
      matchedEvidence: evidenceSource,
      explanation:
        `Potential allergy conflict with registered allergy "${allergy}". ${evidenceSource}.`,
    });
  }
}

  // 2. Check Dietary Restrictions
  for (const restriction of member.dietaryRestrictions) {
    const norm = restriction.trim().toLowerCase();
    let forbiddenTerms: string[] = [];

    for (const [dietKey, list] of Object.entries(DIETARY_RESTRICTION_FORBIDDEN)) {
      if (norm.includes(dietKey) || dietKey.includes(norm)) {
        forbiddenTerms = [...forbiddenTerms, ...list];
      }
    }
    if (forbiddenTerms.length === 0) {
      forbiddenTerms = expandProfileTerm(restriction);
    }

    const matched = forbiddenTerms.find(
      (t) => containsTerm(combinedEvidenceText, t) || containsTerm(productTitleText, t)
    );
    if (matched) {
      conflicts.push({
        type: 'dietary_restriction',
        severity: 'high',
        ruleTriggered: restriction,
        matchedEvidence: `Matched "${matched}"`,
        explanation: `Conflicts with registered dietary restriction "${restriction}" (found "${matched}").`,
      });
    }
  }

  // 3. Check Foods to Avoid
  for (const avoidItem of member.foodsToAvoid) {
    const terms = expandProfileTerm(avoidItem);
    const matched = terms.find(
      (t) => containsTerm(combinedEvidenceText, t) || containsTerm(productTitleText, t)
    );
    if (matched) {
      conflicts.push({
        type: 'food_to_avoid',
        severity: 'moderate',
        ruleTriggered: avoidItem,
        matchedEvidence: `Matched "${matched}"`,
        explanation: `Contains "${matched}", which matches "${avoidItem}" in ${member.name}'s foods-to-avoid list.`,
      });
    }
  }

  // 4. Check Nutritional Preferences
  const n = product.nutriments;
  for (const pref of member.nutritionalPreferences) {
    const p = pref.trim().toLowerCase();
    if (p.includes('low-sugar') || p.includes('low sugar') || p.includes('sugar')) {
      if (n.sugars === null) {
        warnings.push(`Cannot verify "${pref}" preference because sugar values are unavailable.`);
      } else if (n.sugars > 12.5) {
        conflicts.push({
          type: 'nutritional_preference',
          severity: 'moderate',
          ruleTriggered: pref,
          matchedEvidence: `Sugars: ${n.sugars}g / 100g`,
          explanation: `Sugar content (${n.sugars}g per 100g) exceeds the low-sugar preference threshold (<= 12.5g/100g).`,
        });
      }
    } else if (p.includes('low-sodium') || p.includes('low sodium') || p.includes('low-salt') || p.includes('low salt')) {
      if (n.sodium === null) {
        warnings.push(`Cannot verify "${pref}" preference because sodium values are unavailable.`);
      } else if (n.sodium > 0.4) {
        conflicts.push({
          type: 'nutritional_preference',
          severity: 'moderate',
          ruleTriggered: pref,
          matchedEvidence: `Sodium: ${n.sodium}g / 100g`,
          explanation: `Sodium content (${n.sodium}g per 100g) exceeds the low-sodium preference threshold (<= 0.4g/100g).`,
        });
      }
    } else if (p.includes('low-fat') || p.includes('low fat')) {
      if (n.fat === null) {
        warnings.push(`Cannot verify "${pref}" preference because fat values are unavailable.`);
      } else if (n.fat > 10) {
        conflicts.push({
          type: 'nutritional_preference',
          severity: 'moderate',
          ruleTriggered: pref,
          matchedEvidence: `Total Fat: ${n.fat}g / 100g`,
          explanation: `Total fat (${n.fat}g per 100g) exceeds the low-fat preference threshold (<= 10g/100g).`,
        });
      }
    } else if (p.includes('low-calorie') || p.includes('low calorie')) {
      if (n.energyKcal === null) {
        warnings.push(`Cannot verify "${pref}" preference because energy values are unavailable.`);
      } else if (n.energyKcal > 250) {
        conflicts.push({
          type: 'nutritional_preference',
          severity: 'moderate',
          ruleTriggered: pref,
          matchedEvidence: `Energy: ${n.energyKcal} kcal / 100g`,
          explanation: `Energy (${n.energyKcal} kcal per 100g) exceeds the low-calorie preference threshold (<= 250 kcal/100g).`,
        });
      }
    } else if (p.includes('high-protein') || p.includes('high protein')) {
      if (n.protein === null) {
        warnings.push(`Cannot verify "${pref}" preference because protein values are unavailable.`);
      } else if (n.protein < 8) {
        warnings.push(`Product has ${n.protein}g protein/100g, which is below typical high-protein preference (>= 8g/100g).`);
      }
    } else if (p.includes('high-fiber') || p.includes('high fiber') || p.includes('high-fibre')) {
      if (n.fiber === null) {
        warnings.push(`Cannot verify "${pref}" preference because fiber values are unavailable.`);
      } else if (n.fiber < 4) {
        warnings.push(`Product has ${n.fiber}g fiber/100g, which is below typical high-fiber preference (>= 4g/100g).`);
      }
    }
  }

  let status: FamilyCompatibilityResult['status'];
  if (conflicts.length > 0) {
    status = 'CONFLICT';
  } else if (!hasIngredients) {
    status = 'CAUTION_INCOMPLETE_DATA';
  } else {
    status = 'NO_KNOWN_CONFLICTS_FOUND';
  }

  return {
    memberId: member.id,
    memberName: member.name,
    status,
    compatible: conflicts.length === 0 && hasIngredients,
    conflicts,
    warnings,
    checkedAgainst: {
      allergiesCount: member.allergies.length,
      restrictionsCount: member.dietaryRestrictions.length,
      avoidedFoodsCount: member.foodsToAvoid.length,
      preferencesCount: member.nutritionalPreferences.length,
    },
    safetyNotice:
      'Compatibility checks use deterministic rules on available product data. Always read physical packaging for cross-contamination and manufacturer recipe updates.',
  };
}

// TOOL 5 Helper: Filter, Compare, and Rank Real Open Food Facts Alternative Candidates
export function evaluateAlternativeCandidates(
  sourceProduct: ProductData,
  candidates: ProductData[],
  member: FamilyMemberRecord | null,
  queryUsed: string
): AlternativeSearchResult {
  let excludedDueToConflict = 0;
  let flaggedIncompleteIngredients = 0;
  const recommendations: AlternativeRecommendation[] = [];
  const seenBarcodes = new Set<string>();
  if (sourceProduct.barcode) seenBarcodes.add(sourceProduct.barcode);

  for (const candidate of candidates) {
    if (candidate.barcode && seenBarcodes.has(candidate.barcode)) continue;
    if (candidate.name.toLowerCase() === sourceProduct.name.toLowerCase()) continue;
    if (candidate.barcode) seenBarcodes.add(candidate.barcode);

    const hasIngredients = Boolean(candidate.ingredientsText && candidate.ingredientsText.trim().length > 0);
    const missingDataWarnings: string[] = [];

    if (!hasIngredients) {
      flaggedIncompleteIngredients++;
      missingDataWarnings.push(
        'Ingredient list unavailable in Open Food Facts — cannot verify absence of allergens or restricted ingredients.'
      );
    }

    let compatibilityNote = 'No family profile selected; evaluated on general nutritional comparison.';
    if (member) {
      const check = checkFamilyCompatibilityDeterministic(candidate, member);
      if (check.conflicts.length > 0) {
        excludedDueToConflict++;
        continue; // Strictly exclude candidates with detected conflicts
      }
      if (!hasIngredients) {
        compatibilityNote = `Flagged for review: no conflicts detected in metadata for ${member.name}, but ingredient list is missing.`;
      } else {
        compatibilityNote = `No registered conflicts found in listed ingredients for ${member.name} (verify physical label before consumption).`;
      }
    }

    const reasons: string[] = [];
    let score = 50;

    // Strongly prefer candidates WITH listed ingredients over those missing ingredients
    if (hasIngredients) {
      score += 20;
      reasons.push('Includes listed ingredient information for screening.');
    } else {
      score -= 20;
    }

    // Compare nutritional composition against source product
    const srcN = sourceProduct.nutriments;
    const altN = candidate.nutriments;

    if (altN.sugars !== null && srcN.sugars !== null && altN.sugars < srcN.sugars) {
      const diff = Math.round((srcN.sugars - altN.sugars) * 10) / 10;
      score += Math.min(diff * 0.8, 12);
      reasons.push(`${diff}g less sugar per 100g than the scanned item.`);
    }
    if (altN.saturatedFat !== null && srcN.saturatedFat !== null && altN.saturatedFat < srcN.saturatedFat) {
      const diff = Math.round((srcN.saturatedFat - altN.saturatedFat) * 10) / 10;
      score += Math.min(diff * 1.5, 10);
      reasons.push(`${diff}g less saturated fat per 100g.`);
    }
    if (altN.sodium !== null && srcN.sodium !== null && altN.sodium < srcN.sodium) {
      const diff = Math.round((srcN.sodium - altN.sodium) * 100) / 100;
      score += Math.min(diff * 15, 8);
      reasons.push(`Lower sodium (${altN.sodium}g vs ${srcN.sodium}g per 100g).`);
    }
    if (altN.protein !== null && srcN.protein !== null && altN.protein > srcN.protein) {
      const diff = Math.round((altN.protein - srcN.protein) * 10) / 10;
      score += Math.min(diff * 1.2, 8);
      reasons.push(`${diff}g more protein per 100g.`);
    }
    if (altN.fiber !== null && srcN.fiber !== null && altN.fiber > srcN.fiber) {
      const diff = Math.round((altN.fiber - srcN.fiber) * 10) / 10;
      score += Math.min(diff * 1.5, 8);
      reasons.push(`${diff}g more dietary fiber per 100g.`);
    }
    if (altN.energyKcal !== null && srcN.energyKcal !== null && altN.energyKcal < srcN.energyKcal) {
      score += 4;
    }

    // Nutri-Score bonus when available
    if (candidate.nutriScore) {
      const gradeMap: Record<string, number> = { A: 12, B: 8, C: 3, D: -3, E: -6 };
      score += gradeMap[candidate.nutriScore] ?? 0;
      if (candidate.nutriScore === 'A' || candidate.nutriScore === 'B') {
        reasons.push(`Nutri-Score ${candidate.nutriScore} rating in Open Food Facts.`);
      }
    }

    if (altN.energyKcal === null && altN.sugars === null && altN.fat === null) {
      missingDataWarnings.push('Nutritional values are unavailable in Open Food Facts.');
      score -= 10;
    }

    if (reasons.length === 0) {
      reasons.push('Similar product category found in Open Food Facts without detected profile conflicts.');
    }

    recommendations.push({
      barcode: candidate.barcode,
      name: candidate.name,
      brand: candidate.brand,
      category: candidate.category,
      imageUrl: candidate.imageUrl,
      nutriScore: candidate.nutriScore,
      ingredientsText: candidate.ingredientsText,
      ingredientsAvailable: hasIngredients,
      nutriments: candidate.nutriments,
      rankScore: Math.round(Math.max(0, Math.min(100, score))),
      reasons,
      missingDataWarnings,
      compatibilityNote,
      offUrl: candidate.offUrl,
    });
  }

  // Sort: verified ingredients first, then highest rankScore
  recommendations.sort((a, b) => {
    if (a.ingredientsAvailable !== b.ingredientsAvailable) {
      return a.ingredientsAvailable ? -1 : 1;
    }
    return b.rankScore - a.rankScore;
  });

  return {
    queryUsed,
    candidatesEvaluated: candidates.length,
    excludedDueToConflict,
    flaggedIncompleteIngredients,
    recommendations: recommendations.slice(0, 6),
    safetyDisclaimer:
      'Alternatives are retrieved live from Open Food Facts and filtered using available ingredient listings. Absence of an allergen in Open Food Facts data does NOT guarantee a product is allergen-free. Always inspect physical packaging before purchase.',
  };
}

export function deriveAlternativeSearchTerms(product: ProductData): string {
  // Prefer clean category keywords, falling back to product name tokens
  if (product.category) {
    const cleanCat = product.category
      .replace(/^en:/i, '')
      .replace(/[^\w\s-]/g, ' ')
      .trim();
    if (cleanCat.length >= 3 && cleanCat.length <= 45) {
      return cleanCat;
    }
  }
  const stopWords = new Set(['with', 'and', 'the', 'for', 'original', 'classic', 'pack', 'family', 'size']);
  const tokens = product.name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  return tokens.slice(0, 3).join(' ') || product.name.slice(0, 30);
}
