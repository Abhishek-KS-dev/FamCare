import {
  AlertTriangle,
  Loader2,
  Plus,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  api,
  type AgentComparisonReport,
  type FamilyMemberRecord,
  type ProductData,
} from '../services/api.ts';
import { formatCurrency } from '../utils/format.ts';
import { ProductThumbnail } from './ProductThumbnail.tsx';

interface ComparisonSectionProps {
  products: ProductData[];
  members: FamilyMemberRecord[];
  selectedMemberId: string | null;
  currency: string;
  onAddProduct: (product: ProductData) => void;
  onRemoveProduct: (id: string) => void;
  onUpdateProductPrice: (id: string, price: number | null) => void;
  onSelectMember: (id: string | null) => void;
}

export function ComparisonSection({
  products,
  members,
  selectedMemberId,
  currency,
  onAddProduct,
  onRemoveProduct,
  onUpdateProductPrice,
  onSelectMember,
}: ComparisonSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductData[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<AgentComparisonReport | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q.length < 2) return;
    setSearchError(null);
    setSearching(true);
    try {
      // If numeric barcode, do direct barcode lookup; otherwise search Open Food Facts
      if (/^[0-9]{4,20}$/.test(q)) {
        const res = await api.lookupBarcode(q);
        if (res.found && res.product) {
          setSearchResults([res.product]);
        } else {
          setSearchResults([]);
          setSearchError(res.error || 'Barcode not found in Open Food Facts.');
        }
      } else {
        const res = await api.searchProducts(q);
        setSearchResults(res.products);
        if (res.products.length === 0) {
          setSearchError(res.error || 'No products found in Open Food Facts for that query.');
        }
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Open Food Facts search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleRunComparison = async () => {
    if (products.length < 2) {
      setCompareError('Add at least 2 products to compare.');
      return;
    }
    setCompareError(null);
    setComparing(true);
    try {
      const { comparison: result } = await api.compareProducts({
        products,
        familyMemberId: selectedMemberId,
      });
      setComparison(result);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Comparison failed.');
    } finally {
      setComparing(false);
    }
  };

  const chartColors = ['#15803D', '#0F766E', '#D97706', '#475569'];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">
          Multi-Product Evaluation · Open Food Facts & Agent Comparison
        </p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">Product Comparison</h1>
        <p className="mt-1 text-sm text-[#4B5E53] max-w-2xl">
          Select 2 to 4 products to compare ingredients, allergens, per-100g nutrition, optional store prices, and compatibility for a chosen family member.
        </p>
      </div>

      {/* Add Products via Live Open Food Facts Search */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-[#111C16]">
            1. Add Products to Compare ({products.length}/4)
          </h2>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="compare-member" className="text-[#5A6E62] whitespace-nowrap">
              Family member:
            </label>
            <select
              id="compare-member"
              value={selectedMemberId || ''}
              onChange={(e) => onSelectMember(e.target.value || null)}
              className="px-3 py-1.5 border border-[#D4DFD8] rounded-lg bg-white text-xs text-[#111C16]"
            >
              <option value="">None (Nutrition & Ingredients Only)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={(e) => void handleSearch(e)} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Open Food Facts by product name or barcode (e.g. chocolate biscuits, oat milk)"
            className="flex-1 px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
          />
          <button
            type="submit"
            disabled={searching || products.length >= 4}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#111C16] hover:bg-[#1F2E26] disabled:opacity-50 text-white text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search Open Food Facts</span>
          </button>
        </form>

        {searchError && (
          <p className="text-xs text-[#B91C1C]">{searchError}</p>
        )}

        {searchResults.length > 0 && (
          <div className="divide-y divide-[#EDF2EE] border border-[#E4EAE6] rounded-lg max-h-60 overflow-y-auto">
            {searchResults.map((item) => {
              const alreadyAdded = products.some(
                (p) => (p.barcode && item.barcode && p.barcode === item.barcode) || p.id === item.id
              );
              return (
                <div
                  key={item.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-[#F8FAF9]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumbnail src={item.imageUrl} alt={item.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111C16] truncate">{item.name}</p>
                      <p className="text-xs text-[#5A6E62] truncate">
                        {item.brand || 'Brand unavailable'}
                        {item.nutriScore ? ` · Nutri-Score ${item.nutriScore}` : ''}
                        {item.barcode ? ` · ${item.barcode}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={alreadyAdded || products.length >= 4}
                    onClick={() => onAddProduct(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-medium rounded-md whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{alreadyAdded ? 'Added' : 'Add'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Comparison Tray */}
        {products.length > 0 && (
          <div className="pt-4 border-t border-[#EDF2EE] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-lg bg-[#F8FAF9] border border-[#E4EAE6] flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111C16] truncate">{p.name}</p>
                      <p className="text-xs text-[#5A6E62] truncate">{p.brand || 'No brand listed'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(p.id)}
                      aria-label={`Remove ${p.name}`}
                      className="text-[#5A6E62] hover:text-[#B91C1C] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#5A6E62] mb-1">
                      Optional Price ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.userPrice ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        onUpdateProductPrice(p.id, v === '' ? null : Number(v));
                      }}
                      placeholder="Not entered"
                      className="w-full px-2.5 py-1 bg-white font-mono tabular-nums text-xs border border-[#D4DFD8] rounded-md"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[#5A6E62]">
                {products.length < 2
                  ? 'Add at least 1 more product to run the comparison agent.'
                  : 'Ready to run side-by-side analysis.'}
              </p>
              <button
                type="button"
                disabled={products.length < 2 || comparing}
                onClick={() => void handleRunComparison()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-sm font-medium rounded-lg whitespace-nowrap cursor-pointer"
              >
                {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                <span>{comparing ? 'Comparing...' : 'Run Agent Comparison'}</span>
              </button>
            </div>
          </div>
        )}

        {compareError && (
          <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
            {compareError}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Summary & Highlighted Differences */}
          <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-[#111C16]">
                Comparison Summary & Key Differences
              </h2>
              <span className="text-xs text-[#5A6E62]">
                {comparison.memberName
                  ? `Screened for ${comparison.memberName}`
                  : 'No family profile selected'}
              </span>
            </div>

            <p className="text-sm text-[#33463B] leading-relaxed">{comparison.agentSummary}</p>

            {comparison.keyDifferences.length > 0 && (
              <div className="pt-3 border-t border-[#EDF2EE]">
                <p className="text-xs font-semibold text-[#111C16] mb-2">Highlighted Differences</p>
                <ul className="list-disc pl-5 text-xs text-[#4B5E53] space-y-1">
                  {comparison.keyDifferences.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Side-by-Side Comparison Matrix */}
          <div className="bg-white border border-[#E4EAE6] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E4EAE6] bg-[#F8FAF9]">
                    <th className="py-3.5 px-5 text-xs font-semibold text-[#5A6E62] w-44">Attribute</th>
                    {comparison.items.map((it) => (
                      <th key={it.product.id} className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <ProductThumbnail src={it.product.imageUrl} alt={it.product.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#111C16] truncate">{it.product.name}</p>
                            <p className="text-xs font-normal text-[#5A6E62] truncate">
                              {it.product.brand || 'Brand unavailable'}
                            </p>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2EE] text-xs">
                  {comparison.memberName && (
                    <tr>
                      <td className="py-3 px-5 font-medium text-[#111C16]">
                        Compatibility ({comparison.memberName})
                      </td>
                      {comparison.items.map((it) => {
                        const c = it.familyCompatibility;
                        return (
                          <td key={it.product.id} className="py-3 px-4">
                            {c?.status === 'CONFLICT' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                <span>{c.conflicts.length} Conflict(s)</span>
                              </span>
                            ) : c?.status === 'CAUTION_INCOMPLETE_DATA' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#B45309]">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>Missing Ingredients</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#15803D]">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <span>No Known Conflicts</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  <tr>
                    <td className="py-3 px-5 font-medium text-[#111C16]">Nutri-Score</td>
                    {comparison.items.map((it) => (
                      <td key={it.product.id} className="py-3 px-4 font-mono font-semibold text-[#111C16]">
                        {it.product.nutriScore || 'Unavailable'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-5 font-medium text-[#111C16]">Price (Entered)</td>
                    {comparison.items.map((it) => (
                      <td key={it.product.id} className="py-3 px-4 font-mono tabular-nums text-[#111C16]">
                        {it.product.userPrice !== null && it.product.userPrice !== undefined
                          ? formatCurrency(it.product.userPrice, currency)
                          : 'Not entered'}
                      </td>
                    ))}
                  </tr>
                  {[
                    { label: 'Calories (kcal / 100g)', fn: (p: ProductData) => p.nutriments.energyKcal, unit: ' kcal' },
                    { label: 'Sugar (g / 100g)', fn: (p: ProductData) => p.nutriments.sugars, unit: ' g' },
                    { label: 'Protein (g / 100g)', fn: (p: ProductData) => p.nutriments.protein, unit: ' g' },
                    { label: 'Total Fat (g / 100g)', fn: (p: ProductData) => p.nutriments.fat, unit: ' g' },
                    { label: 'Saturated Fat (g / 100g)', fn: (p: ProductData) => p.nutriments.saturatedFat, unit: ' g' },
                    { label: 'Sodium (g / 100g)', fn: (p: ProductData) => p.nutriments.sodium, unit: ' g' },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 px-5 font-medium text-[#111C16]">{row.label}</td>
                      {comparison.items.map((it) => {
                        const val = row.fn(it.product);
                        return (
                          <td key={it.product.id} className="py-3 px-4 font-mono tabular-nums text-[#111C16]">
                            {val !== null ? `${val}${row.unit}` : 'Unavailable'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="py-3 px-5 font-medium text-[#111C16]">Detected Allergens</td>
                    {comparison.items.map((it) => (
                      <td key={it.product.id} className="py-3 px-4 text-[#4B5E53]">
                        {it.ingredientAnalysis.detectedAllergens.length > 0
                          ? it.ingredientAnalysis.detectedAllergens.join(', ')
                          : it.ingredientAnalysis.ingredientsAvailable
                            ? 'None matched'
                            : 'Unavailable'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 px-5 font-medium text-[#111C16] align-top">Ingredients</td>
                    {comparison.items.map((it) => (
                      <td key={it.product.id} className="py-3 px-4 text-[#4B5E53] align-top leading-relaxed">
                        {it.product.ingredientsText
                          ? it.product.ingredientsText.slice(0, 180) +
                            (it.product.ingredientsText.length > 180 ? '…' : '')
                          : 'Unavailable'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart.js Grouped Nutrient Comparison */}
          <div className="bg-white border border-[#E4EAE6] rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-[#111C16] mb-4">
              Nutritional Comparison Chart (g per 100g)
            </h3>
            <div className="h-64">
              <Bar
                data={{
                  labels: ['Sugars (g)', 'Protein (g)', 'Total Fat (g)', 'Sat. Fat (g)', 'Fiber (g)'],
                  datasets: comparison.items.map((it, idx) => ({
                    label: it.product.name.slice(0, 28),
                    data: [
                      it.product.nutriments.sugars ?? 0,
                      it.product.nutriments.protein ?? 0,
                      it.product.nutriments.fat ?? 0,
                      it.product.nutriments.saturatedFat ?? 0,
                      it.product.nutriments.fiber ?? 0,
                    ],
                    backgroundColor: chartColors[idx % chartColors.length],
                    borderRadius: 4,
                  })),
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                  },
                  scales: {
                    y: { beginAtZero: true, grid: { color: '#EDF2EE' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
