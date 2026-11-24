import type {
  AgentAnalysisReport,
  AgentComparisonReport,
  AlternativeSearchResult,
  FamilyMemberRecord,
  FamilyRecord,
  MonthlyBudgetRecord,
  ProductData,
  PurchaseRecord,
} from '../../server/types.ts';

export type {
  AgentAnalysisReport,
  AgentComparisonReport,
  AlternativeRecommendation,
  AlternativeSearchResult,
  AgentToolLog,
  CompatibilityConflict,
  FamilyCompatibilityResult,
  FamilyMemberRecord,
  FamilyRecord,
  IngredientAnalysisResult,
  MonthlyBudgetRecord,
  NutrientObservation,
  NutritionalAnalysisResult,
  ProductComparisonItem,
  ProductData,
  ProductNutriments,
  ProductSource,
  PurchaseRecord,
} from '../../server/types.ts';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  currency: string;
  createdAt?: string;
}

export interface BudgetSummaryResponse {
  month: string;
  currency: string;
  budgetLimit: number | null;
  totalSpent: number;
  remainingBudget: number | null;
  purchaseCount: number;
  categoryBreakdown: Array<{ category: string; amount: number }>;
  monthlyTrend: Array<{ month: string; spent: number; budgetLimit: number | null }>;
  budgets: MonthlyBudgetRecord[];
}

export interface HealthResponse {
  ok: boolean;
  storageMode: 'mongodb' | 'local_fallback';
  storageNotice: string;
  geminiConfigured: boolean;
  externalFoodApi: string;
}

// Keep JWT strictly in memory (never localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (inMemoryToken) {
    headers['Authorization'] = `Bearer ${inMemoryToken}`;
  }

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const api = {
  health: () => apiRequest<HealthResponse>('/api/health'),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    familyName?: string;
    currency?: string;
  }) =>
    apiRequest<{ token: string; user: AuthUser; defaultFamily: FamilyRecord }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => apiRequest<{ user: AuthUser }>('/api/auth/me'),

  updateProfile: (payload: { name?: string; currency?: string }) =>
    apiRequest<{ user: AuthUser }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updatePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ ok: boolean; message: string }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  listFamilies: () => apiRequest<{ families: FamilyRecord[] }>('/api/families'),

  createFamily: (name: string) =>
    apiRequest<{ family: FamilyRecord }>('/api/families', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateFamily: (id: string, name: string) =>
    apiRequest<{ family: FamilyRecord }>(`/api/families/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  deleteFamily: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/families/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listMembers: (familyId?: string) =>
    apiRequest<{ members: FamilyMemberRecord[] }>(
      `/api/family-members${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`
    ),

  createMember: (payload: {
    familyId: string;
    name: string;
    age: number | null;
    allergies: string[];
    dietaryRestrictions: string[];
    foodsToAvoid: string[];
    nutritionalPreferences: string[];
  }) =>
    apiRequest<{ member: FamilyMemberRecord }>('/api/family-members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMember: (
    id: string,
    payload: {
      name: string;
      age: number | null;
      allergies: string[];
      dietaryRestrictions: string[];
      foodsToAvoid: string[];
      nutritionalPreferences: string[];
    }
  ) =>
    apiRequest<{ member: FamilyMemberRecord }>(`/api/family-members/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteMember: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/family-members/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  lookupBarcode: (barcode: string) =>
    apiRequest<{ found: boolean; product: ProductData | null; error?: string }>(
      `/api/products/barcode/${encodeURIComponent(barcode)}`
    ),

  searchProducts: (query: string) =>
    apiRequest<{ products: ProductData[]; queryUsed: string; error?: string }>(
      `/api/products/search?q=${encodeURIComponent(query)}`
    ),

  analyzeWithAgent: (payload: {
    taskType: 'barcode_analysis' | 'ocr_analysis' | 'manual_analysis';
    barcode?: string;
    product?: Partial<ProductData>;
    familyMemberId?: string | null;
    requestAlternatives?: boolean;
  }) =>
    apiRequest<{ report: AgentAnalysisReport }>('/api/agent/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAlternatives: (payload: {
    product: ProductData;
    familyMemberId?: string | null;
    query?: string;
  }) =>
    apiRequest<{ alternatives: AlternativeSearchResult; error: string | null }>('/api/agent/alternatives', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  compareProducts: (payload: { products: ProductData[]; familyMemberId?: string | null }) =>
    apiRequest<{ comparison: AgentComparisonReport }>('/api/agent/compare', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listPurchases: (familyId?: string) =>
    apiRequest<{ purchases: PurchaseRecord[] }>(
      `/api/purchases${familyId ? `?familyId=${encodeURIComponent(familyId)}` : ''}`
    ),

  createPurchase: (payload: {
    familyId: string;
    familyMemberId?: string | null;
    barcode?: string | null;
    productName: string;
    brand?: string | null;
    category?: string | null;
    source: 'open_food_facts' | 'ocr_verified' | 'manual_entry';
    quantity: number;
    unitPrice: number;
    nutriScore?: string | null;
    purchasedAt?: string;
  }) =>
    apiRequest<{ purchase: PurchaseRecord }>('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePurchase: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/purchases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getBudgetSummary: (familyId: string, month: string) =>
    apiRequest<BudgetSummaryResponse>(
      `/api/budgets/summary?familyId=${encodeURIComponent(familyId)}&month=${encodeURIComponent(month)}`
    ),

  upsertBudget: (payload: { familyId: string; month: string; budgetLimit: number; currency?: string }) =>
    apiRequest<{ budget: MonthlyBudgetRecord }>('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
