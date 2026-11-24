import { AlertCircle, Loader2, Utensils } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, type AgentAnalysisReport, type FamilyMemberRecord } from '../services/api.ts';

interface ManualEntrySectionProps {
  selectedMember: FamilyMemberRecord | null;
  onAnalysisComplete: (report: AgentAnalysisReport) => void;
}

const UNPACKAGED_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains & Rice',
  'Meat & Poultry',
  'Fish & Seafood',
  'Dairy & Eggs',
  'Sugar & Sweeteners',
  'Legumes & Pulses',
  'Nuts & Seeds',
  'Herbs & Spices',
  'Other Unpackaged Food',
];

const QUICK_EXAMPLES = [
  { name: 'White Rice (Uncooked)', category: 'Grains & Rice', ingredients: 'White rice' },
  { name: 'Fresh Spinach', category: 'Vegetables', ingredients: 'Fresh spinach leaves' },
  { name: 'Refined White Sugar', category: 'Sugar & Sweeteners', ingredients: 'Sucrose (white sugar)' },
  { name: 'Fresh Atlantic Salmon Fillet', category: 'Fish & Seafood', ingredients: 'Salmon fish' },
  { name: 'Fresh Chicken Breast', category: 'Meat & Poultry', ingredients: 'Chicken breast meat' },
  { name: 'Fresh Green Apples', category: 'Fruits', ingredients: 'Apples' },
];

export function ManualEntrySection({ selectedMember, onAnalysisComplete }: ManualEntrySectionProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [quantity, setQuantity] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [energyKcal, setEnergyKcal] = useState('');
  const [carbohydrates, setCarbohydrates] = useState('');
  const [sugars, setSugars] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [fiber, setFiber] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toOptNum = (v: string): number | null => {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter a food item name.');
      return;
    }

    setAnalyzing(true);
    try {
      const { report } = await api.analyzeWithAgent({
        taskType: 'manual_analysis',
        familyMemberId: selectedMember?.id ?? null,
        requestAlternatives: false,
        product: {
          name: name.trim(),
          brand: null,
          category,
          quantity: quantity.trim() || null,
          ingredientsText: ingredientsText.trim() || name.trim(),
          nutriments: {
            energyKcal: toOptNum(energyKcal),
            carbohydrates: toOptNum(carbohydrates),
            sugars: toOptNum(sugars),
            protein: toOptNum(protein),
            fat: toOptNum(fat),
            saturatedFat: toOptNum(saturatedFat),
            sodium: toOptNum(sodium),
            salt: null,
            fiber: toOptNum(fiber),
          },
          source: 'manual_entry',
        },
      });
      onAnalysisComplete(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze manual entry.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">
          Product Identification · Unpackaged Foods
        </p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">Manual Food Entry</h1>
        <p className="mt-1 text-sm text-[#4B5E53] max-w-2xl">
          Enter fresh or unpackaged food items such as rice, vegetables, fruits, meat, fish, or bulk sugar. Manually entered items are clearly marked as user-entered and not verified through Open Food Facts.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Manual entries are NOT sourced from Open Food Facts. Leave any unknown nutritional fields empty—FamCare will clearly display unavailable nutrients instead of inventing values.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="lg:col-span-8 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">Food Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Basmati Rice"
                className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              >
                {UNPACKAGED_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
                Quantity / Weight (Optional)
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1 kg"
                className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1.5">
              Ingredients / Composition (Defaults to food name if single ingredient)
            </label>
            <textarea
              rows={2}
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="e.g. Fresh salmon fillet, or homemade sauce ingredients..."
              className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-[#4B5E53] mb-2">
              Optional Nutritional Values per 100g (only enter values you know)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Energy (kcal)', val: energyKcal, set: setEnergyKcal },
                { label: 'Sugars (g)', val: sugars, set: setSugars },
                { label: 'Protein (g)', val: protein, set: setProtein },
                { label: 'Total Fat (g)', val: fat, set: setFat },
                { label: 'Sat. Fat (g)', val: saturatedFat, set: setSaturatedFat },
                { label: 'Carbs (g)', val: carbohydrates, set: setCarbohydrates },
                { label: 'Sodium (g)', val: sodium, set: setSodium },
                { label: 'Fiber (g)', val: fiber, set: setFiber },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-[11px] text-[#5A6E62] mb-1">{f.label}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder="Unavailable"
                    className="w-full px-2.5 py-1.5 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={analyzing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Manual Entry...</span>
              </>
            ) : (
              <>
                <Utensils className="w-4 h-4" />
                <span>Analyze Unpackaged Food</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Unpackaged Templates (Only sets name/category/ingredient text—never fabricates nutrition!) */}
        <div className="lg:col-span-4 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-3">
          <h2 className="font-display text-sm font-semibold text-[#111C16]">
            Common Unpackaged Items
          </h2>
          <p className="text-xs text-[#5A6E62]">
            Pre-fill basic food names and categories quickly (nutritional fields remain blank unless entered by you):
          </p>
          <div className="divide-y divide-[#EDF2EE]">
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                type="button"
                onClick={() => {
                  setName(ex.name);
                  setCategory(ex.category);
                  setIngredientsText(ex.ingredients);
                }}
                className="w-full py-2.5 text-left hover:bg-[#F8FAF9] px-2 -mx-2 rounded-md transition-colors cursor-pointer"
              >
                <p className="text-sm font-medium text-[#111C16]">{ex.name}</p>
                <p className="text-xs text-[#5A6E62]">{ex.category}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
