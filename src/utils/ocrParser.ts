import type { ProductNutriments } from '../services/api.ts';

export interface ParsedOcrDraft {
  ingredientsText: string;
  allergensTags: string[];
  additivesTags: string[];
  nutriments: ProductNutriments;
}

function extractNumberAfterPattern(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match || !match[1]) return null;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

export function parseOcrLabelText(rawText: string): ParsedOcrDraft {
  const cleaned = rawText.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();

  // Extract Ingredients block if labeled
  let ingredientsText = '';
  const ingMatch = cleaned.match(
    /ingredients?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:nutrition|nutritional|allergen|contains|may contain|storage|best before|manufactured|net weight|$))/i
  );
  if (ingMatch && ingMatch[1]) {
    ingredientsText = ingMatch[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    // Fallback: if text looks like a comma-separated list, preserve cleaned text for user correction
    ingredientsText = cleaned.replace(/\n+/g, ' ').trim();
  }

  // Extract explicit "Contains:" allergens
  const allergensSet = new Set<string>();
  const containsMatch = cleaned.match(/(?:allergens?|contains)\s*[:\-]\s*([^\n.]+)/i);
  if (containsMatch && containsMatch[1]) {
    for (const part of containsMatch[1].split(/[,;]+/)) {
      const a = part.replace(/\band\b/gi, '').trim().toLowerCase();
      if (a.length >= 2 && a.length <= 40) allergensSet.add(a);
    }
  }

  // Scan common allergen keywords
  const commonAllergens = [
    'milk',
    'peanut',
    'peanuts',
    'almond',
    'hazelnut',
    'walnut',
    'cashew',
    'wheat',
    'gluten',
    'soy',
    'soya',
    'egg',
    'eggs',
    'fish',
    'shellfish',
    'sesame',
    'mustard',
  ];
  const lower = cleaned.toLowerCase();
  for (const kw of commonAllergens) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      allergensSet.add(kw);
    }
  }

  // Extract E-number additives
  const additivesSet = new Set<string>();
  const eMatches = cleaned.match(/\bE\s?\d{3}[a-z]?\b/gi) || [];
  for (const m of eMatches) {
    additivesSet.add(m.replace(/\s+/g, '').toUpperCase());
  }

  // Extract nutritional values (prefer per 100g / explicit numeric labels)
  const energyKcal = extractNumberAfterPattern(
    cleaned,
    /(?:energy|calories?)\s*[:\-]?\s*(?:\d+\s*kJ\s*\/?\s*)?(\d+(?:[.,]\d+)?)\s*kcal/i
  ) ?? extractNumberAfterPattern(cleaned, /calories?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);

  const fat = extractNumberAfterPattern(
    cleaned,
    /(?:total\s+)?fat\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i
  );

  const saturatedFat = extractNumberAfterPattern(
    cleaned,
    /(?:saturated\s+fat|saturates|of which saturates)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i
  );

  const carbohydrates = extractNumberAfterPattern(
    cleaned,
    /(?:total\s+)?carbohydrate?s?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i
  );

  const sugars = extractNumberAfterPattern(
    cleaned,
    /(?:of which\s+)?sugars?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i
  );

  const fiber = extractNumberAfterPattern(
    cleaned,
    /(?:dietary\s+)?fib(?:er|re)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i
  );

  const protein = extractNumberAfterPattern(
    cleaned,
    /proteins?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i
  );

  let sodium: number | null = null;
  const sodiumMg = extractNumberAfterPattern(cleaned, /sodium\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*mg/i);
  if (sodiumMg !== null) {
    sodium = Math.round((sodiumMg / 1000) * 1000) / 1000;
  } else {
    sodium = extractNumberAfterPattern(cleaned, /sodium\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i);
  }

  let salt = extractNumberAfterPattern(cleaned, /salt\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i);
  if (sodium === null && salt !== null) {
    sodium = Math.round((salt / 2.5) * 1000) / 1000;
  } else if (salt === null && sodium !== null) {
    salt = Math.round(sodium * 2.5 * 1000) / 1000;
  }

  return {
    ingredientsText,
    allergensTags: Array.from(allergensSet),
    additivesTags: Array.from(additivesSet),
    nutriments: {
      energyKcal,
      carbohydrates,
      sugars,
      protein,
      fat,
      saturatedFat,
      sodium,
      salt,
      fiber,
    },
  };
}
