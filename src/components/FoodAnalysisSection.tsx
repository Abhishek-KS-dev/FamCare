import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileSearch,
  Scale,
  ScanBarcode,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  api,
  type AgentAnalysisReport,
  type FamilyMemberRecord,
  type ProductData,
} from '../services/api.ts';
import { formatCurrency, formatSourceLabel } from '../utils/format.ts';
import type { NavSection } from './OverviewSection.tsx';
import { ProductThumbnail } from './ProductThumbnail.tsx';

interface FoodAnalysisSectionProps {
  report: AgentAnalysisReport | null;
  activeFamilyId: string;
  members: FamilyMemberRecord[];
  selectedMember: FamilyMemberRecord | null;
  currency: string;
  onNavigate: (section: NavSection) => void;
  onAddToComparison: (product: ProductData) => void;
  onPurchaseSaved: () => Promise<void>;
  onReanalyzeForMember: (product: ProductData) => Promise<void>;
}

export function FoodAnalysisSection({
  report,
  activeFamilyId,
  members,
  selectedMember,
  currency,
  onNavigate,
  onAddToComparison,
  onPurchaseSaved,
  onReanalyzeForMember,
}: FoodAnalysisSectionProps) {
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseMemberId, setPurchaseMemberId] = useState<string>(selectedMember?.id || '');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [addedToCompare, setAddedToCompare] = useState(false);

  if (!report) {
    return (
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-10 text-center max-w-2xl mx-auto space-y-4">
        <ScanBarcode className="w-10 h-10 text-[#15803D] mx-auto" strokeWidth={1.5} />
        <h1 className="font-display text-xl font-bold text-[#111C16]">No Food Analysis Report Yet</h1>
        <p className="text-sm text-[#4B5E53]">
          Scan a packaged product barcode via Open Food Facts, extract a package label via OCR, or log an unpackaged food item manually to run the central Food Intelligence Agent.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('scan')}
            className="px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            Scan Barcode
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ocr')}
            className="px-4 py-2.5 bg-white border border-[#D4DFD8] hover:bg-[#F8FAF9] text-[#111C16] text-sm font-medium rounded-lg cursor-pointer"
          >
            OCR Label Scanner
          </button>
          <button
            type="button"
            onClick={() => onNavigate('manual')}
            className="px-4 py-2.5 bg-white border border-[#D4DFD8] hover:bg-[#F8FAF9] text-[#111C16] text-sm font-medium rounded-lg cursor-pointer"
          >
            Manual Food Entry
          </button>
        </div>
      </div>
    );
  }

  if (!report.productFound || !report.product) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#FDE68A] rounded-xl p-8 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h1 className="font-display text-xl font-bold text-[#111C16]">
                Product Unavailable in Open Food Facts
              </h1>
              <p className="text-sm text-[#4B5E53]">{report.agentSummary}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('ocr')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#15803D] text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  <FileSearch className="w-4 h-4" />
                  <span>Scan Package Label with OCR</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('manual')}
                  className="px-4 py-2 bg-white border border-[#D4DFD8] text-[#111C16] text-xs font-medium rounded-lg cursor-pointer"
                >
                  Manual Food Entry
                </button>
              </div>
            </div>
          </div>
        </div>
        <ExecutionTraceCard report={report} />
      </div>
    );
  }

  const product = report.product;
  const compat = report.familyCompatibility;
  const ing = report.ingredientAnalysis;
  const nut = report.nutritionalAnalysis;

  const macroLabels = ['Carbs', 'Sugars', 'Protein', 'Total Fat', 'Sat. Fat', 'Fiber'];
  const macroValues = [
    product.nutriments.carbohydrates ?? 0,
    product.nutriments.sugars ?? 0,
    product.nutriments.protein ?? 0,
    product.nutriments.fat ?? 0,
    product.nutriments.saturatedFat ?? 0,
    product.nutriments.fiber ?? 0,
  ];
  const hasMacroValues = [
    product.nutriments.carbohydrates,
    product.nutriments.sugars,
    product.nutriments.protein,
    product.nutriments.fat,
    product.nutriments.saturatedFat,
    product.nutriments.fiber,
  ].some((v) => v !== null);

  const handleSavePurchase = async (e: FormEvent) => {
    e.preventDefault();
    setPurchaseError(null);
    setPurchaseNotice(null);

    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      setPurchaseError('Enter a valid quantity (> 0) and unit price (>= 0).');
      return;
    }

    setSavingPurchase(true);
    try {
      await api.createPurchase({
        familyId: activeFamilyId,
        familyMemberId: purchaseMemberId || selectedMember?.id || null,
        barcode: product.barcode,
        productName: product.name,
        brand: product.brand,
        category: product.category || 'Uncategorized',
        source: product.source,
        quantity: qty,
        unitPrice: price,
        nutriScore: product.nutriScore,
      });
      await onPurchaseSaved();
      setPurchaseNotice(
        `Saved ${qty} × ${product.name} (${formatCurrency(qty * price, currency)}) to Purchase History.`
      );
      setShowPurchaseForm(false);
      setUnitPrice('');
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Unable to save purchase.');
    } finally {
      setSavingPurchase(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Identity & Actions Header */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <ProductThumbnail src={product.imageUrl} alt={product.name} size="lg" />
            <div className="space-y-2">
              <div className="text-xs text-[#5A6E62] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{formatSourceLabel(product.source)}</span>
                {product.barcode && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">Barcode {product.barcode}</span>
                  </>
                )}
                {product.nutriScore && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#111C16]">Nutri-Score {product.nutriScore}</span>
                  </>
                )}
              </div>

              <h1 className="font-display text-2xl font-bold text-[#111C16] [text-wrap:balance]">
                {product.name}
              </h1>

              <p className="text-sm text-[#4B5E53]">
                {product.brand || 'Brand unavailable'}
                {product.category && ` · ${product.category}`}
                {product.quantity && ` · ${product.quantity}`}
              </p>

              {product.offUrl && (
                <a
                  href={product.offUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D] hover:underline"
                >
                  <span>View record on Open Food Facts</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowPurchaseForm((v) => !v);
                setPurchaseNotice(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Save as Purchase</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddToComparison(product);
                setAddedToCompare(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#D4DFD8] hover:bg-[#F8FAF9] text-[#111C16] text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
            >
              <Scale className="w-4 h-4 text-[#4B5E53]" />
              <span>{addedToCompare ? 'Added to Compare' : 'Add to Compare'}</span>
            </button>

            {selectedMember && compat?.memberId !== selectedMember.id && (
              <button
                type="button"
                onClick={() => void onReanalyzeForMember(product)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2F6F3] hover:bg-[#E4EAE6] text-[#111C16] text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
              >
                <span>Re-check for {selectedMember.name}</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Save Purchase Drawer */}
        {showPurchaseForm && (
          <form
            onSubmit={(e) => void handleSavePurchase(e)}
            className="mt-5 pt-5 border-t border-[#E4EAE6] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Associated Member</label>
              <select
                value={purchaseMemberId}
                onChange={(e) => setPurchaseMemberId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg bg-white"
              >
                <option value="">Shared Household</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Quantity</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">
                Unit Price ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g. 4.50"
                className="w-full px-3 py-2 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={savingPurchase}
              className="py-2 px-4 bg-[#111C16] hover:bg-[#1F2E26] disabled:opacity-50 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              {savingPurchase ? 'Saving...' : 'Confirm Purchase'}
            </button>
            {purchaseError && (
              <p className="sm:col-span-4 text-xs text-[#B91C1C]">{purchaseError}</p>
            )}
          </form>
        )}

        {purchaseNotice && (
          <div className="mt-4 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#166534]">
            {purchaseNotice}
          </div>
        )}
      </div>

      {/* Missing Data Warnings */}
      {report.missingInformationWarnings.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-[#92400E] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Missing or Unverified Information Notice</span>
          </p>
          <ul className="list-disc pl-5 text-xs text-[#92400E] space-y-1">
            {report.missingInformationWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {report.needsManualCorrection && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('ocr')}
                className="text-xs font-semibold text-[#92400E] underline cursor-pointer"
              >
                Use OCR Label Scanner to supply missing ingredients
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deterministic Family Health Compatibility Verdict */}
      {compat ? (
        <div
          className={`rounded-xl border p-6 space-y-4 ${
            compat.status === 'CONFLICT'
              ? 'bg-[#FEF2F2] border-[#FECACA]'
              : compat.status === 'CAUTION_INCOMPLETE_DATA'
                ? 'bg-[#FFFBEB] border-[#FDE68A]'
                : 'bg-[#F0FDF4] border-[#BBF7D0]'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {compat.status === 'CONFLICT' ? (
                <ShieldAlert className="w-6 h-6 text-[#B91C1C] shrink-0 mt-0.5" />
              ) : compat.status === 'CAUTION_INCOMPLETE_DATA' ? (
                <AlertTriangle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-[#15803D] shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-xs font-medium text-[#4B5E53]">
                  Deterministic Family Compatibility Check · {compat.memberName}
                </p>
                <h2
                  className={`font-display text-lg font-bold mt-0.5 ${
                    compat.status === 'CONFLICT'
                      ? 'text-[#991B1B]'
                      : compat.status === 'CAUTION_INCOMPLETE_DATA'
                        ? 'text-[#92400E]'
                        : 'text-[#166534]'
                  }`}
                >
                  {compat.status === 'CONFLICT'
                    ? `Potential Conflict Detected (${compat.conflicts.length} rule${compat.conflicts.length > 1 ? 's' : ''} triggered)`
                    : compat.status === 'CAUTION_INCOMPLETE_DATA'
                      ? 'Incomplete Ingredients — Manual Packaging Check Required'
                      : `No Known Conflicts Found in Listed Ingredients for ${compat.memberName}`}
                </h2>
              </div>
            </div>

            {report.alternatives && (
              <button
                type="button"
                onClick={() => onNavigate('alternatives')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111C16] hover:bg-[#1F2E26] text-white text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
              >
                <span>
                  View {report.alternatives.recommendations.length} Alternative(s)
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {compat.conflicts.length > 0 && (
            <div className="divide-y divide-[#FECACA] bg-white/85 rounded-lg border border-[#FECACA]">
              {compat.conflicts.map((c, idx) => (
                <div key={idx} className="p-3.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#991B1B]">
                    <span>{c.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                    <span aria-hidden="true">·</span>
                    <span>Profile rule: {c.ruleTriggered}</span>
                    <span aria-hidden="true">·</span>
                    <span>{c.matchedEvidence}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#7F1D1D]">{c.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {compat.warnings.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-[#92400E] space-y-1">
              {compat.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <p className="text-xs text-[#4B5E53]">{compat.safetyNotice}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E4EAE6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#4B5E53]">
          <span>No family member profile was selected for this analysis. Select a member to run allergy and dietary screening.</span>
          <button
            type="button"
            onClick={() => onNavigate('family')}
            className="font-medium text-[#15803D] hover:underline whitespace-nowrap cursor-pointer"
          >
            Select Family Profile
          </button>
        </div>
      )}

      {/* Agent Consolidated Summary */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-[#111C16] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#15803D]" />
            <span>Food Intelligence Agent Consolidated Summary</span>
          </h2>
          <span className="text-xs text-[#5A6E62]">
            {report.orchestrationMode === 'gemini_agent'
              ? `Orchestrated by Gemini (${report.modelUsed}) · Deterministic Safety Rules`
              : 'Deterministic Backend Orchestration'}
          </span>
        </div>
        <p className="text-sm text-[#33463B] leading-relaxed">{report.agentSummary}</p>
        {report.geminiUnavailableReason && (
          <p className="text-xs text-[#5A6E62] pt-1">
            Note: {report.geminiUnavailableReason}
          </p>
        )}
      </div>

      {/* Ingredients & Nutritional Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Nutritional Table & Macro Chart */}
        <div className="lg:col-span-7 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-[#111C16]">
              Nutritional Analysis (per 100g)
            </h2>
            <p className="text-xs text-[#5A6E62] mt-0.5">
              Evaluated against transparent reference thresholds (UK/WHO traffic-light ranges).
            </p>
          </div>

          {nut && nut.concerns.length > 0 && (
            <div className="p-3.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
              <p className="text-xs font-semibold text-[#92400E]">Nutritional Observations to Watch</p>
              <ul className="list-disc pl-5 text-xs text-[#92400E] space-y-0.5">
                {nut.concerns.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {nut && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E4EAE6] text-xs font-medium text-[#5A6E62]">
                    <th className="py-2 pr-4">Nutrient</th>
                    <th className="py-2 px-3 text-right">Per 100g</th>
                    <th className="py-2 px-3">Threshold</th>
                    <th className="py-2 pl-3">Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2EE] text-xs">
                  {nut.observations.map((obs) => (
                    <tr key={obs.nutrient}>
                      <td className="py-2.5 pr-4 font-medium text-[#111C16]">{obs.nutrient}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#111C16]">
                        {obs.value !== null ? `${obs.value} ${obs.unit}` : 'Unavailable'}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        <span
                          className={
                            obs.level === 'high'
                              ? 'text-[#B91C1C]'
                              : obs.level === 'moderate'
                                ? 'text-[#B45309]'
                                : obs.level === 'low'
                                  ? 'text-[#15803D]'
                                  : 'text-[#5A6E62]'
                          }
                        >
                          {obs.level === 'unavailable'
                            ? 'Unavailable'
                            : obs.level.charAt(0).toUpperCase() + obs.level.slice(1)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-[#4B5E53]">{obs.observation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMacroValues && (
            <div className="pt-4 border-t border-[#EDF2EE]">
              <p className="text-xs font-medium text-[#5A6E62] mb-3">
                Macronutrient Composition Chart (grams per 100g)
              </p>
              <div className="h-52">
                <Bar
                  data={{
                    labels: macroLabels,
                    datasets: [
                      {
                        label: 'g per 100g',
                        data: macroValues,
                        backgroundColor: ['#15803D', '#D97706', '#0F766E', '#64748B', '#DC2626', '#16A34A'],
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, grid: { color: '#EDF2EE' } },
                      x: { grid: { display: false } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {nut && <p className="text-[11px] text-[#5A6E62]">{nut.disclaimer}</p>}
        </div>

        {/* Ingredients, Allergens & Additives */}
        <div className="lg:col-span-5 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#111C16]">
            Ingredients & Allergen Analysis
          </h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-[#5A6E62] mb-1">Declared / Detected Allergens</p>
              {ing && ing.detectedAllergens.length > 0 ? (
                <p className="text-sm font-semibold text-[#991B1B]">
                  {ing.detectedAllergens.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(' · ')}
                </p>
              ) : (
                <p className="text-xs text-[#5A6E62]">
                  {ing?.ingredientsAvailable
                    ? 'None matched from standard allergen list (verify packaging for trace/may-contain notices).'
                    : 'Unavailable — ingredients missing.'}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#EDF2EE]">
              <p className="text-xs font-medium text-[#5A6E62] mb-1">Additives (E-Numbers)</p>
              <p className="font-mono text-xs text-[#111C16]">
                {ing && ing.detectedAdditives.length > 0 ? ing.detectedAdditives.join(', ') : 'None listed'}
              </p>
            </div>

            <div className="pt-3 border-t border-[#EDF2EE]">
              <p className="text-xs font-medium text-[#5A6E62] mb-1.5">Ingredient Text</p>
              {product.ingredientsText ? (
                <p className="text-xs text-[#33463B] leading-relaxed bg-[#F8FAF9] border border-[#E4EAE6] rounded-lg p-3.5">
                  {product.ingredientsText}
                </p>
              ) : (
                <p className="text-xs text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3">
                  Ingredients list is unavailable for this item.
                </p>
              )}
            </div>

            {ing && ing.notes.length > 0 && (
              <div className="pt-3 border-t border-[#EDF2EE] space-y-1">
                {ing.notes.map((n, i) => (
                  <p key={i} className="text-xs text-[#4B5E53]">
                    {n}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Autonomous Agent Execution Trace */}
      <ExecutionTraceCard report={report} />
    </div>
  );
}

function ExecutionTraceCard({ report }: { report: AgentAnalysisReport }) {
  return (
    <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-[#111C16] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#15803D]" />
            <span>Food Intelligence Agent Execution Trace</span>
          </h2>
          <p className="text-xs text-[#5A6E62] mt-0.5">
            Transparent step-by-step log of backend tools autonomously selected and invoked for this request (privacy barrier active: family profiles never leave the backend).
          </p>
        </div>
        <span className="font-mono tabular-nums text-xs text-[#4B5E53]">
          {report.executionLogs.length} tool call(s)
        </span>
      </div>

      <div className="divide-y divide-[#EDF2EE] border border-[#E4EAE6] rounded-lg overflow-hidden">
        {report.executionLogs.map((log) => (
          <div key={log.step} className="p-3.5 bg-[#FCFEFD] flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums text-[#5A6E62]">Step {log.step}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[#111C16]">{log.toolName}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    log.status === 'success'
                      ? 'text-[#15803D] font-medium'
                      : log.status === 'warning'
                        ? 'text-[#B45309] font-medium'
                        : 'text-[#B91C1C] font-medium'
                  }
                >
                  {log.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5" />}
                  {log.status}
                </span>
              </div>
              <p className="text-[#4B5E53]">{log.reason}</p>
            </div>
            <span className="font-mono tabular-nums text-[#5A6E62] shrink-0">{log.durationMs} ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
