import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
  ScanBarcode,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  api,
  type AgentAnalysisReport,
  type AlternativeRecommendation,
  type AlternativeSearchResult,
  type FamilyMemberRecord,
  type ProductData,
} from '../services/api.ts';
import type { NavSection } from './OverviewSection.tsx';
import { ProductThumbnail } from './ProductThumbnail.tsx';

interface AlternativesSectionProps {
  report: AgentAnalysisReport | null;
  selectedMember: FamilyMemberRecord | null;
  onUpdateAlternatives: (alternatives: AlternativeSearchResult) => void;
  onAddToComparison: (product: ProductData) => void;
  onInspectBarcode: (barcode: string) => Promise<void>;
  onNavigate: (section: NavSection) => void;
}

export function AlternativesSection({
  report,
  selectedMember,
  onUpdateAlternatives,
  onAddToComparison,
  onInspectBarcode,
  onNavigate,
}: AlternativesSectionProps) {
  const [customQuery, setCustomQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseProduct = report?.product ?? null;
  const alternatives = report?.alternatives ?? null;

  const fetchAlternatives = async (queryOverride?: string) => {
    if (!baseProduct) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.getAlternatives({
        product: baseProduct,
        familyMemberId: selectedMember?.id ?? null,
        query: queryOverride?.trim() || undefined,
      });
      if (res.error && res.alternatives.recommendations.length === 0) {
        setError(res.error);
      }
      onUpdateAlternatives(res.alternatives);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to search alternatives.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefineSearch = (e: FormEvent) => {
    e.preventDefault();
    void fetchAlternatives(customQuery);
  };

  const toProductData = (alt: AlternativeRecommendation): ProductData => ({
    id: alt.barcode ? `off-${alt.barcode}` : `alt-${alt.name}`,
    barcode: alt.barcode,
    name: alt.name,
    brand: alt.brand,
    category: alt.category,
    categoriesTags: alt.category ? [alt.category.toLowerCase()] : [],
    ingredientsText: alt.ingredientsText,
    allergensTags: [],
    additivesTags: [],
    nutriScore: alt.nutriScore,
    imageUrl: alt.imageUrl,
    quantity: null,
    nutriments: alt.nutriments,
    source: 'open_food_facts',
    missingFields: alt.missingDataWarnings,
    offUrl: alt.offUrl,
  });

  if (!baseProduct) {
    return (
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-10 text-center max-w-2xl mx-auto space-y-4">
        <Search className="w-10 h-10 text-[#15803D] mx-auto" strokeWidth={1.5} />
        <h1 className="font-display text-xl font-bold text-[#111C16]">
          Smart Alternative Recommendations
        </h1>
        <p className="text-sm text-[#4B5E53]">
          Analyze a food product first to discover Open Food Facts alternatives filtered deterministically against your selected family member's allergies and dietary restrictions.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('scan')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-sm font-medium rounded-lg cursor-pointer"
        >
          <ScanBarcode className="w-4 h-4" />
          <span>Scan a Product First</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4B5E53] mb-1">
            Tool 5 · Open Food Facts Live Filtering
          </p>
          <h1 className="font-display text-2xl font-bold text-[#111C16]">
            Alternative Product Recommendations
          </h1>
          <p className="mt-1 text-sm text-[#4B5E53]">
            Alternatives for <span className="font-semibold text-[#111C16]">{baseProduct.name}</span>
            {selectedMember
              ? ` · Filtered for ${selectedMember.name}`
              : ' · General nutritional comparison'}
          </p>
        </div>

        <form onSubmit={handleRefineSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="Refine category (e.g. oat biscuits)"
            className="px-3 py-2 text-xs bg-white border border-[#D4DFD8] rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{alternatives ? 'Search Again' : 'Find Alternatives'}</span>
          </button>
        </form>
      </div>

      {/* Mandatory Safety Disclaimer */}
      <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold">Safety Reminder:</span> Alternatives are retrieved live from Open Food Facts and screened using deterministic rules. Products with conflicting ingredients are excluded, and items missing ingredient listings are explicitly flagged. Absence of an allergen in Open Food Facts does NOT guarantee a product is allergen-free—always check physical packaging.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
          {error}
        </div>
      )}

      {!alternatives ? (
        <div className="bg-white border border-[#E4EAE6] rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-[#4B5E53]">
            The Food Intelligence Agent did not automatically run an alternative search for this product (for example, no conflict was detected). You can search Open Food Facts for alternatives now.
          </p>
          <button
            type="button"
            onClick={() => void fetchAlternatives()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium rounded-lg cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search Open Food Facts Alternatives</span>
          </button>
        </div>
      ) : (
        <>
          {/* Filtering Telemetry Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-4">
              <p className="text-xs text-[#5A6E62]">Query Used</p>
              <p className="mt-1 text-sm font-semibold text-[#111C16] truncate">
                {alternatives.queryUsed || 'Category search'}
              </p>
            </div>
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-4">
              <p className="text-xs text-[#5A6E62]">Candidates Evaluated</p>
              <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-[#111C16]">
                {alternatives.candidatesEvaluated}
              </p>
            </div>
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-4">
              <p className="text-xs text-[#5A6E62]">Excluded (Profile Conflict)</p>
              <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-[#B91C1C]">
                {alternatives.excludedDueToConflict}
              </p>
            </div>
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-4">
              <p className="text-xs text-[#5A6E62]">Flagged Missing Ingredients</p>
              <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-[#B45309]">
                {alternatives.flaggedIncompleteIngredients}
              </p>
            </div>
          </div>

          {alternatives.recommendations.length === 0 ? (
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[#111C16]">
                No suitable alternatives matched the current Open Food Facts query.
              </p>
              <p className="text-xs text-[#5A6E62]">
                Try entering a broader food category above (e.g. "biscuits", "granola", "oat milk", or "dark chocolate").
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {alternatives.recommendations.map((alt, idx) => (
                <div
                  key={`${alt.barcode || alt.name}-${idx}`}
                  className="bg-white border border-[#E4EAE6] rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <ProductThumbnail src={alt.imageUrl} alt={alt.name} size="md" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs text-[#5A6E62] flex flex-wrap items-center gap-x-2">
                          <span className="font-mono tabular-nums font-semibold text-[#15803D]">
                            Rank #{idx + 1}
                          </span>
                          {alt.nutriScore && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-[#111C16]">Nutri-Score {alt.nutriScore}</span>
                            </>
                          )}
                          {alt.barcode && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{alt.barcode}</span>
                            </>
                          )}
                        </div>

                        <h3 className="font-display text-base font-semibold text-[#111C16] leading-snug">
                          {alt.name}
                        </h3>
                        <p className="text-xs text-[#4B5E53]">
                          {alt.brand || 'Brand unavailable'}
                          {alt.category ? ` · ${alt.category}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Compatibility Note */}
                    <p
                      className={`text-xs flex items-start gap-1.5 ${
                        alt.ingredientsAvailable ? 'text-[#166534]' : 'text-[#92400E]'
                      }`}
                    >
                      {alt.ingredientsAvailable ? (
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <span>{alt.compatibilityNote}</span>
                    </p>

                    {/* Nutritional Comparison Row */}
                    <div className="grid grid-cols-4 gap-2 py-2.5 border-y border-[#EDF2EE] text-center">
                      <div>
                        <p className="text-[11px] text-[#5A6E62]">Energy</p>
                        <p className="font-mono tabular-nums text-xs font-semibold text-[#111C16]">
                          {alt.nutriments.energyKcal !== null ? `${alt.nutriments.energyKcal} kcal` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#5A6E62]">Sugar</p>
                        <p className="font-mono tabular-nums text-xs font-semibold text-[#111C16]">
                          {alt.nutriments.sugars !== null ? `${alt.nutriments.sugars}g` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#5A6E62]">Protein</p>
                        <p className="font-mono tabular-nums text-xs font-semibold text-[#111C16]">
                          {alt.nutriments.protein !== null ? `${alt.nutriments.protein}g` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#5A6E62]">Sodium</p>
                        <p className="font-mono tabular-nums text-xs font-semibold text-[#111C16]">
                          {alt.nutriments.sodium !== null ? `${alt.nutriments.sodium}g` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Reasons for Recommendation */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#111C16]">Why this alternative was ranked</p>
                      <ul className="list-disc pl-4 text-xs text-[#4B5E53] space-y-0.5">
                        {alt.reasons.map((r, rIdx) => (
                          <li key={rIdx}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Ingredients Snippet */}
                    <div className="text-xs">
                      <span className="font-medium text-[#111C16]">Ingredients: </span>
                      <span className="text-[#4B5E53]">
                        {alt.ingredientsText
                          ? alt.ingredientsText.slice(0, 220) + (alt.ingredientsText.length > 220 ? '…' : '')
                          : 'Unavailable in Open Food Facts'}
                      </span>
                    </div>

                    {/* Missing Data Warnings */}
                    {alt.missingDataWarnings.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#92400E] space-y-0.5">
                        {alt.missingDataWarnings.map((w, wIdx) => (
                          <p key={wIdx}>• {w}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-3 border-t border-[#EDF2EE] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {alt.barcode && (
                        <button
                          type="button"
                          onClick={() => void onInspectBarcode(alt.barcode!)}
                          className="px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium rounded-md cursor-pointer"
                        >
                          Full Analysis
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onAddToComparison(toProductData(alt));
                          onNavigate('compare');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#D4DFD8] hover:bg-[#F8FAF9] text-[#111C16] text-xs font-medium rounded-md cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5 text-[#4B5E53]" />
                        <span>Compare</span>
                      </button>
                    </div>
                    {alt.offUrl && (
                      <a
                        href={alt.offUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#5A6E62] hover:text-[#15803D]"
                      >
                        <span>Open Food Facts</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
