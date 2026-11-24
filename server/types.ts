export type ProductSource = 'open_food_facts' | 'ocr_verified' | 'manual_entry';

export interface ProductNutriments {
  energyKcal: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  protein: number | null;
  fat: number | null;
  saturatedFat: number | null;
  sodium: number | null; // grams per 100g
  salt: number | null; // grams per 100g
  fiber: number | null;
}

export interface ProductData {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  categoriesTags: string[];
  ingredientsText: string | null;
  allergensTags: string[];
  additivesTags: string[];
  nutriScore: string | null;
  imageUrl: string | null;
  quantity: string | null;
  nutriments: ProductNutriments;
  source: ProductSource;
  verifiedByUser?: boolean;
  userPrice?: number | null;
  missingFields: string[];
  offUrl?: string | null;
}

export interface IngredientAnalysisResult {
  ingredientsAvailable: boolean;
  parsedIngredients: string[];
  detectedAllergens: string[];
  detectedAdditives: string[];
  incompleteWarning: string | null;
  notes: string[];
}

export interface NutrientObservation {
  nutrient: string;
  value: number | null;
  unit: string;
  level: 'low' | 'moderate' | 'high' | 'unavailable';
  observation: string;
}

export interface NutritionalAnalysisResult {
  hasAnyNutritionData: boolean;
  observations: NutrientObservation[];
  concerns: string[];
  missingNutrients: string[];
  disclaimer: string;
}

export interface CompatibilityConflict {
  type: 'allergy' | 'dietary_restriction' | 'food_to_avoid' | 'nutritional_preference';
  severity: 'high' | 'moderate';
  ruleTriggered: string;
  matchedEvidence: string;
  explanation: string;
}

export interface FamilyCompatibilityResult {
  memberId: string;
  memberName: string;
  status: 'CONFLICT' | 'CAUTION_INCOMPLETE_DATA' | 'NO_KNOWN_CONFLICTS_FOUND';
  compatible: boolean;
  conflicts: CompatibilityConflict[];
  warnings: string[];
  checkedAgainst: {
    allergiesCount: number;
    restrictionsCount: number;
    avoidedFoodsCount: number;
    preferencesCount: number;
  };
  safetyNotice: string;
}

export interface AlternativeRecommendation {
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  nutriScore: string | null;
  ingredientsText: string | null;
  ingredientsAvailable: boolean;
  nutriments: ProductNutriments;
  userPrice?: number | null;
  rankScore: number;
  reasons: string[];
  missingDataWarnings: string[];
  compatibilityNote: string;
  offUrl?: string | null;
}

export interface AlternativeSearchResult {
  queryUsed: string;
  candidatesEvaluated: number;
  excludedDueToConflict: number;
  flaggedIncompleteIngredients: number;
  recommendations: AlternativeRecommendation[];
  safetyDisclaimer: string;
}

export interface AgentToolLog {
  step: number;
  toolName: string;
  reason: string;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  durationMs: number;
  status: 'success' | 'warning' | 'error';
}

export interface AgentAnalysisReport {
  taskType: 'barcode_analysis' | 'ocr_analysis' | 'manual_analysis';
  orchestrationMode: 'gemini_agent' | 'deterministic_fallback';
  modelUsed: string | null;
  geminiUnavailableReason?: string | null;
  productFound: boolean;
  product: ProductData | null;
  ingredientAnalysis: IngredientAnalysisResult | null;
  nutritionalAnalysis: NutritionalAnalysisResult | null;
  familyCompatibility: FamilyCompatibilityResult | null;
  alternatives: AlternativeSearchResult | null;
  needsOcrOrManualFallback: boolean;
  needsManualCorrection: boolean;
  missingInformationWarnings: string[];
  agentSummary: string;
  executionLogs: AgentToolLog[];
  timestamp: string;
}

export interface ProductComparisonItem {
  product: ProductData;
  ingredientAnalysis: IngredientAnalysisResult;
  nutritionalAnalysis: NutritionalAnalysisResult;
  familyCompatibility: FamilyCompatibilityResult | null;
}

export interface AgentComparisonReport {
  orchestrationMode: 'gemini_agent' | 'deterministic_fallback';
  modelUsed: string | null;
  geminiUnavailableReason?: string | null;
  memberId: string | null;
  memberName: string | null;
  items: ProductComparisonItem[];
  keyDifferences: string[];
  agentSummary: string;
  executionLogs: AgentToolLog[];
  timestamp: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMemberRecord {
  id: string;
  familyId: string;
  userId: string;
  name: string;
  age: number | null;
  allergies: string[];
  dietaryRestrictions: string[];
  foodsToAvoid: string[];
  nutritionalPreferences: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRecord {
  id: string;
  userId: string;
  familyId: string;
  familyMemberId: string | null;
  familyMemberName: string | null;
  barcode: string | null;
  productName: string;
  brand: string | null;
  category: string;
  source: ProductSource;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  nutriScore: string | null;
  purchasedAt: string;
  createdAt: string;
}

export interface MonthlyBudgetRecord {
  id: string;
  userId: string;
  familyId: string;
  month: string; // YYYY-MM
  budgetLimit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
