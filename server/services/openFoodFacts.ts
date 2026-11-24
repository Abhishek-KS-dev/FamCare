import type { ProductData, ProductNutriments } from '../types.ts';

const OFF_BASE_URL = 'https://world.openfoodfacts.org';
const OFF_USER_AGENT = 'FamCare-Academic-Project/1.0 (+https://world.openfoodfacts.org)';

interface RawOffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  ingredients_text?: string;
  ingredients_text_en?: string;
  allergens_tags?: string[];
  allergens?: string;
  additives_tags?: string[];
  nutriscore_grade?: string;
  nutrition_grades?: string;
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  nutriments?: Record<string, unknown>;
}

function parseFiniteNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

function cleanOffTag(tag: string): string {
  return tag
    .replace(/^[a-z]{2}:/i, '')
    .replace(/-/g, ' ')
    .trim();
}

function sanitizeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeOpenFoodFactsProduct(raw: RawOffProduct, fallbackBarcode?: string): ProductData {
  const n = raw.nutriments || {};

  // Energy: prefer energy-kcal_100g, otherwise convert kJ if present
  let energyKcal = parseFiniteNum(n['energy-kcal_100g'] ?? n['energy-kcal']);
  if (energyKcal === null) {
    const kj = parseFiniteNum(n['energy-kj_100g'] ?? n['energy_100g']);
    if (kj !== null) {
      energyKcal = Math.round((kj / 4.184) * 10) / 10;
    }
  }

  let sodium = parseFiniteNum(n['sodium_100g']);
  let salt = parseFiniteNum(n['salt_100g']);
  if (sodium === null && salt !== null) {
    sodium = Math.round((salt / 2.5) * 1000) / 1000;
  } else if (salt === null && sodium !== null) {
    salt = Math.round(sodium * 2.5 * 1000) / 1000;
  }

  const nutriments: ProductNutriments = {
    energyKcal,
    carbohydrates: parseFiniteNum(n['carbohydrates_100g']),
    sugars: parseFiniteNum(n['sugars_100g']),
    protein: parseFiniteNum(n['proteins_100g']),
    fat: parseFiniteNum(n['fat_100g']),
    saturatedFat: parseFiniteNum(n['saturated-fat_100g']),
    sodium,
    salt,
    fiber: parseFiniteNum(n['fiber_100g']),
  };

  const barcode = (raw.code || fallbackBarcode || '').trim() || null;
  const name = (raw.product_name_en || raw.product_name || '').trim() || 'Unnamed Product';
  const brand = (raw.brands || '').trim() || null;
  const categoriesList = (raw.categories || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const category = categoriesList[categoriesList.length - 1] || categoriesList[0] || null;
  const categoriesTags = Array.isArray(raw.categories_tags)
    ? raw.categories_tags.map(cleanOffTag).filter(Boolean)
    : [];

  const ingredientsText = (raw.ingredients_text_en || raw.ingredients_text || '').trim() || null;

  const allergensSet = new Set<string>();
  if (Array.isArray(raw.allergens_tags)) {
    for (const tag of raw.allergens_tags) {
      const cleaned = cleanOffTag(tag);
      if (cleaned) allergensSet.add(cleaned.toLowerCase());
    }
  }
  if (typeof raw.allergens === 'string' && raw.allergens.trim()) {
    for (const part of raw.allergens.split(',')) {
      const cleaned = cleanOffTag(part);
      if (cleaned) allergensSet.add(cleaned.toLowerCase());
    }
  }

  const additivesTags = Array.isArray(raw.additives_tags)
    ? raw.additives_tags.map((t) => cleanOffTag(t).toUpperCase()).filter(Boolean)
    : [];

  const rawGrade = (raw.nutriscore_grade || raw.nutrition_grades || '').trim().toLowerCase();
  const nutriScore = ['a', 'b', 'c', 'd', 'e'].includes(rawGrade) ? rawGrade.toUpperCase() : null;

  const missingFields: string[] = [];
  if (!name || name === 'Unnamed Product') missingFields.push('Product Name');
  if (!brand) missingFields.push('Brand');
  if (!ingredientsText) missingFields.push('Ingredients List');
  if (allergensSet.size === 0) missingFields.push('Declared Allergens');
  if (nutriments.energyKcal === null) missingFields.push('Energy (kcal)');
  if (nutriments.sugars === null) missingFields.push('Sugars');
  if (nutriments.protein === null) missingFields.push('Protein');
  if (nutriments.fat === null) missingFields.push('Total Fat');
  if (nutriments.saturatedFat === null) missingFields.push('Saturated Fat');
  if (nutriments.carbohydrates === null) missingFields.push('Carbohydrates');
  if (nutriments.sodium === null) missingFields.push('Sodium');
  if (nutriments.fiber === null) missingFields.push('Fiber');
  if (!nutriScore) missingFields.push('Nutri-Score');

  return {
    id: barcode ? `off-${barcode}` : `off-${Date.now()}`,
    barcode,
    name,
    brand,
    category,
    categoriesTags,
    ingredientsText,
    allergensTags: Array.from(allergensSet),
    additivesTags,
    nutriScore,
    imageUrl: sanitizeHttpsUrl(raw.image_front_url || raw.image_url),
    quantity: (raw.quantity || '').trim() || null,
    nutriments,
    source: 'open_food_facts',
    missingFields,
    offUrl: barcode ? `${OFF_BASE_URL}/product/${encodeURIComponent(barcode)}` : null,
  };
}

export async function fetchProductByBarcode(barcodeInput: string): Promise<{
  found: boolean;
  product: ProductData | null;
  error?: string;
}> {
  const barcode = barcodeInput.replace(/\s+/g, '').trim();
  if (!/^[0-9]{4,20}$/.test(barcode)) {
    return {
      found: false,
      product: null,
      error: 'Invalid barcode format. Please provide 4 to 20 numeric digits.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_en,brands,categories,categories_tags,ingredients_text,ingredients_text_en,allergens_tags,allergens,additives_tags,nutriscore_grade,nutrition_grades,image_front_url,image_url,quantity,nutriments`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      return { found: false, product: null };
    }
    if (!res.ok) {
      return {
        found: false,
        product: null,
        error: `Open Food Facts returned status ${res.status}.`,
      };
    }

    const data = (await res.json()) as { status?: number; product?: RawOffProduct };
    if (data.status !== 1 || !data.product) {
      return { found: false, product: null };
    }

    return {
      found: true,
      product: normalizeOpenFoodFactsProduct(data.product, barcode),
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'Open Food Facts request timed out.'
        : 'Unable to reach Open Food Facts right now.';
    return { found: false, product: null, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchOpenFoodFactsProducts(
  query: string,
  options?: { categoryTag?: string | null; pageSize?: number }
): Promise<{ products: ProductData[]; queryUsed: string; error?: string }> {
  const cleanQuery = query.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const pageSize = Math.min(Math.max(options?.pageSize ?? 20, 5), 30);

  if (!cleanQuery && !options?.categoryTag) {
    return { products: [], queryUsed: '', error: 'Search query is empty.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const params = new URLSearchParams({
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: String(pageSize),
      fields:
        'code,product_name,product_name_en,brands,categories,categories_tags,ingredients_text,ingredients_text_en,allergens_tags,allergens,additives_tags,nutriscore_grade,nutrition_grades,image_front_url,image_url,quantity,nutriments',
    });

    if (cleanQuery) {
      params.set('search_terms', cleanQuery);
    }
    if (options?.categoryTag && !cleanQuery) {
      params.set('tagtype_0', 'categories');
      params.set('tag_contains_0', 'contains');
      params.set('tag_0', options.categoryTag.replace(/\s+/g, '-').toLowerCase());
    }

    const url = `${OFF_BASE_URL}/cgi/search.pl?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        products: [],
        queryUsed: cleanQuery || options?.categoryTag || '',
        error: `Open Food Facts search returned status ${res.status}.`,
      };
    }

    const data = (await res.json()) as { products?: RawOffProduct[] };
    const rawList = Array.isArray(data.products) ? data.products : [];

    const normalized = rawList
      .filter((p) => (p.product_name_en || p.product_name || '').trim().length > 0)
      .map((p) => normalizeOpenFoodFactsProduct(p));

    return {
      products: normalized,
      queryUsed: cleanQuery || options?.categoryTag || '',
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'Open Food Facts search timed out.'
        : 'Unable to reach Open Food Facts search service.';
    return { products: [], queryUsed: cleanQuery || options?.categoryTag || '', error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
