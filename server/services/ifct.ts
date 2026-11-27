import Fuse, { type IFuseOptions } from 'fuse.js';
import ifctDataRaw from '../data/ifct2017.json' with { type: 'json' };
import indianDishesRaw from '../data/indianDishes.json' with { type: 'json' };
import type { ProductData, ProductNutriments } from '../types.ts';

export interface IFCTFoodItem {
  id: string;
  name: string;
  aliases: string[];
  group: string;
  dataset?: 'ifct_2017' | 'indian_dishes' | string;
  preparation?: string;
  reliability?: 'ok' | 'low';
  reliabilityFlags?: string[];
  per100g: {
    energyKcal: number | null;
    carbohydrates: number | null;
    sugars: number | null;
    protein: number | null;
    fat: number | null;
    saturatedFat: number | null;
    sodium: number | null; // in grams per 100g
    fiber: number | null;
  };
}

export interface IFCTSearchResult {
  item: IFCTFoodItem;
  score: number; // Fuse.js score (0 = perfect match, 1 = mismatch)
  product: ProductData;
}

export interface SearchIFCTOptions {
  datasets?: string[];
  excludeLowReliability?: boolean;
}

// Tag every ifct2017 item with dataset 'ifct_2017' and reliability 'ok' at load time
const ifctItems: IFCTFoodItem[] = (ifctDataRaw as IFCTFoodItem[]).map((item) => ({
  ...item,
  dataset: 'ifct_2017',
  reliability: 'ok',
  reliabilityFlags: item.reliabilityFlags || [],
}));

const dishesItems: IFCTFoodItem[] = indianDishesRaw as IFCTFoodItem[];

const combinedItems: IFCTFoodItem[] = [...ifctItems, ...dishesItems];

const fuseOptions: IFuseOptions<IFCTFoodItem> = {
  includeScore: true,
  threshold: 0.45,
  ignoreLocation: true,
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'aliases', weight: 0.4 },
  ],
};

const fuse = new Fuse(combinedItems, fuseOptions);

export function convertIFCTItemToProduct(item: IFCTFoodItem): ProductData {
  const isDish = item.dataset !== 'ifct_2017';
  const brand = isDish ? 'Indian dishes dataset' : 'IFCT 2017';
  const source: ProductData['source'] = isDish ? 'prepared_dish_db' : 'ifct_2017';

  const nutriments: ProductNutriments = {
    energyKcal: item.per100g.energyKcal,
    carbohydrates: item.per100g.carbohydrates,
    sugars: item.per100g.sugars,
    protein: item.per100g.protein,
    fat: item.per100g.fat,
    saturatedFat: item.per100g.saturatedFat,
    sodium: item.per100g.sodium,
    salt: item.per100g.sodium !== null ? Math.round(item.per100g.sodium * 2.5 * 1000) / 1000 : null,
    fiber: item.per100g.fiber,
  };

  const missingFields: string[] = [];
  if (nutriments.energyKcal === null) missingFields.push('Energy (kcal)');
  if (nutriments.sugars === null) missingFields.push('Sugars');
  if (nutriments.protein === null) missingFields.push('Protein');
  if (nutriments.fat === null) missingFields.push('Total Fat');
  if (nutriments.saturatedFat === null) missingFields.push('Saturated Fat');
  if (nutriments.carbohydrates === null) missingFields.push('Carbohydrates');
  if (nutriments.sodium === null) missingFields.push('Sodium');
  if (nutriments.fiber === null) missingFields.push('Fiber');

  return {
    id: `${isDish ? 'indb' : 'ifct'}-${item.id}`,
    barcode: null,
    name: item.name,
    brand,
    category: item.group,
    categoriesTags: [item.group.toLowerCase()],
    ingredientsText: item.name,
    allergensTags: [],
    additivesTags: [],
    nutriScore: null,
    imageUrl: null,
    quantity: '100 g',
    nutriments,
    source,
    missingFields,
  };
}

/**
 * Fuzzy searches IFCT and Indian dishes dataset over name + aliases.
 * Filters by datasets and reliability options.
 * Adds +0.05 ranking penalty for prepared dishes so raw IFCT items win near-ties.
 * Returns up to `limit` per dataset, with IFCT items returned first.
 */
export function searchIFCT(
  query: string,
  limit = 5,
  options?: SearchIFCTOptions
): IFCTSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const rawResults = fuse.search(trimmed);

  // Filter results by options
  const filtered = rawResults.filter((r) => {
    const item = r.item;
    const itemDataset = item.dataset || 'ifct_2017';

    if (options?.datasets && options.datasets.length > 0) {
      const allowedDatasets = options.datasets;
      // Allow matching if explicit dataset matches or if checking 'indian_dishes' for any dish dataset
      const matchesDataset = allowedDatasets.some((ds) => {
        if (ds === itemDataset) return true;
        if (ds === 'indian_dishes' && itemDataset !== 'ifct_2017') return true;
        return false;
      });
      if (!matchesDataset) return false;
    }

    if (options?.excludeLowReliability && item.reliability === 'low') {
      return false;
    }

    return true;
  });

  // Separate into IFCT items and prepared dish items
  const ifctResults: IFCTSearchResult[] = [];
  const dishResults: { item: IFCTFoodItem; rawScore: number; sortScore: number }[] = [];

  for (const r of filtered) {
    const rawScore = r.score ?? 0;
    const isDish = r.item.dataset !== 'ifct_2017';

    if (!isDish) {
      ifctResults.push({
        item: r.item,
        score: rawScore,
        product: convertIFCTItemToProduct(r.item),
      });
    } else {
      // Add +0.05 ranking penalty for prepared dish items
      dishResults.push({
        item: r.item,
        rawScore,
        sortScore: rawScore + 0.05,
      });
    }
  }

  // Sort IFCT results by rawScore (ascending: 0 is best)
  ifctResults.sort((a, b) => a.score - b.score);

  // Sort dish results by adjusted sortScore
  dishResults.sort((a, b) => a.sortScore - b.sortScore);

  const topIfct = ifctResults.slice(0, limit);
  const topDishes: IFCTSearchResult[] = dishResults.slice(0, limit).map((d) => ({
    item: d.item,
    score: d.rawScore,
    product: convertIFCTItemToProduct(d.item),
  }));

  // Return up to `limit` per dataset, IFCT items first
  return [...topIfct, ...topDishes];
}
