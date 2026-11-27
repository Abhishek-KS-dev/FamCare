import {
  AlertTriangle,
  ArrowRight,
  FileSearch,
  Scale,
  ScanBarcode,
  ShieldCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import type {
  AgentAnalysisReport,
  BudgetSummaryResponse,
  FamilyMemberRecord,
  PurchaseRecord,
} from '../services/api.ts';
import { formatCurrency, formatDateShort } from '../utils/format.ts';

export type NavSection =
  | 'overview'
  | 'scan'
  | 'ocr'
  | 'manual'
  | 'family'
  | 'analysis'
  | 'alternatives'
  | 'compare'
  | 'purchases'
  | 'budget'
  | 'settings';

interface OverviewSectionProps {
  familyName: string;
  members: FamilyMemberRecord[];
  selectedMember: FamilyMemberRecord | null;
  purchases: PurchaseRecord[];
  budgetSummary: BudgetSummaryResponse | null;
  latestReport: AgentAnalysisReport | null;
  currency: string;
  onNavigate: (section: NavSection) => void;
}

export function OverviewSection({
  familyName,
  members,
  selectedMember,
  purchases,
  budgetSummary,
  latestReport,
  currency,
  onNavigate,
}: OverviewSectionProps) {
  const spent = budgetSummary?.totalSpent ?? 0;
  const limit = budgetSummary?.budgetLimit ?? null;
  const remaining = budgetSummary?.remainingBudget ?? null;
  const overBudget = remaining !== null && remaining < 0;

  const trendLabels = budgetSummary?.monthlyTrend.map((m) => m.month) ?? [];
  const trendSpent = budgetSummary?.monthlyTrend.map((m) => m.spent) ?? [];
  const trendBudget = budgetSummary?.monthlyTrend.map((m) => m.budgetLimit ?? 0) ?? [];

  const chartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Monthly Spent',
        data: trendSpent,
        backgroundColor: '#15803D',
        borderRadius: 4,
      },
      {
        label: 'Budget Limit',
        data: trendBudget,
        backgroundColor: '#D4DFD8',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, color: '#4B5E53', font: { size: 12 } },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#EDF2EE' },
        ticks: { color: '#5A6E62', font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#5A6E62', font: { size: 11 } },
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4B5E53] mb-1">{familyName} · Household Overview</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111C16] [text-wrap:balance]">
            Food Intelligence & Family Health Workspace
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('scan')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ScanBarcode className="w-4 h-4" />
          <span>Scan Barcode</span>
        </button>
      </div>

      {/* 4 KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">Active Family Profiles</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-[#111C16]">
            {members.length}
          </p>
          <p className="mt-1.5 text-xs text-[#4B5E53] truncate">
            {selectedMember ? `Screening for ${selectedMember.name}` : 'No member selected yet'}
          </p>
        </div>

        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">
            Monthly Food Spend ({budgetSummary?.month ?? 'Current'})
          </p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-[#111C16]">
            {formatCurrency(spent, currency)}
          </p>
          <p className="mt-1.5 text-xs text-[#4B5E53] tabular-nums">
            {budgetSummary?.purchaseCount ?? 0} purchase(s) recorded this month
          </p>
        </div>

        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">Remaining Budget</p>
          <p
            className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
              overBudget ? 'text-[#B91C1C]' : 'text-[#111C16]'
            }`}
          >
            {remaining !== null ? formatCurrency(remaining, currency) : 'Not set'}
          </p>
          <p className="mt-1.5 text-xs text-[#4B5E53] tabular-nums">
            {limit !== null
              ? `Limit: ${formatCurrency(limit, currency)}${overBudget ? ' · Over budget' : ''}`
              : 'Configure a monthly limit in Budget Management'}
          </p>
        </div>

        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">Total Recorded Purchases</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-[#111C16]">
            {purchases.length}
          </p>
          <p className="mt-1.5 text-xs text-[#4B5E53]">
            {latestReport?.product
              ? `Last analyzed: ${latestReport.product.name}`
              : 'No product analyzed in this session'}
          </p>
        </div>
      </div>

      {/* Product Identification Workflows */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold text-[#111C16] mb-1">
          Identify & Analyze a Food Product
        </h2>
        <p className="text-sm text-[#4B5E53] mb-5">
          Choose how you want to capture product information. All paths route through the central Food Intelligence Agent.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('scan')}
            className="text-left p-4 rounded-lg border border-[#E4EAE6] hover:border-[#15803D] hover:bg-[#F8FAF9] transition-colors cursor-pointer group"
          >
            <ScanBarcode className="w-5 h-5 text-[#15803D] mb-3" />
            <p className="font-display text-sm font-semibold text-[#111C16] flex items-center justify-between">
              <span>Barcode Scanner (Open Food Facts)</span>
              <ArrowRight className="w-4 h-4 text-[#5A6E62] group-hover:text-[#15803D]" />
            </p>
            <p className="mt-1.5 text-xs text-[#4B5E53] leading-relaxed">
              Use your camera with ZXing or enter a barcode to retrieve verified packaged product data from Open Food Facts.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ocr')}
            className="text-left p-4 rounded-lg border border-[#E4EAE6] hover:border-[#15803D] hover:bg-[#F8FAF9] transition-colors cursor-pointer group"
          >
            <FileSearch className="w-5 h-5 text-[#15803D] mb-3" />
            <p className="font-display text-sm font-semibold text-[#111C16] flex items-center justify-between">
              <span>OCR Label Scanner</span>
              <ArrowRight className="w-4 h-4 text-[#5A6E62] group-hover:text-[#15803D]" />
            </p>
            <p className="mt-1.5 text-xs text-[#4B5E53] leading-relaxed">
              Upload or photograph ingredient and nutrition labels with Tesseract.js, then verify extracted text before analysis.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('manual')}
            className="text-left p-4 rounded-lg border border-[#E4EAE6] hover:border-[#15803D] hover:bg-[#F8FAF9] transition-colors cursor-pointer group"
          >
            <Utensils className="w-5 h-5 text-[#15803D] mb-3" />
            <p className="font-display text-sm font-semibold text-[#111C16] flex items-center justify-between">
              <span>Manual Unpackaged Entry</span>
              <ArrowRight className="w-4 h-4 text-[#5A6E62] group-hover:text-[#15803D]" />
            </p>
            <p className="mt-1.5 text-xs text-[#4B5E53] leading-relaxed">
              Log unpackaged staples such as rice, vegetables, fruits, meat, fish, or sugar for dietary checks and budget tracking.
            </p>
          </button>
        </div>
      </div>

      {/* Two-Column Analytics & Latest Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Budget Trend */}
        <div className="lg:col-span-7 bg-white border border-[#E4EAE6] rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#111C16]">
                6-Month Expenditure vs Budget
              </h2>
              <p className="text-xs text-[#5A6E62]">
                Aggregated from your household purchase history
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budget')}
              className="text-xs font-medium text-[#15803D] hover:underline whitespace-nowrap cursor-pointer"
            >
              Manage Budget
            </button>
          </div>
          <div className="h-60 flex-1">
            {trendLabels.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#5A6E62]">
                Record purchases or set a monthly budget to see spending trends.
              </div>
            )}
          </div>
        </div>

        {/* Active Family Screening & Latest Analysis */}
        <div className="lg:col-span-5 bg-white border border-[#E4EAE6] rounded-xl p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-[#111C16]">
                Active Screening Profile
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('family')}
                className="text-xs font-medium text-[#15803D] hover:underline whitespace-nowrap cursor-pointer"
              >
                Manage Profiles
              </button>
            </div>

            {selectedMember ? (
              <div className="space-y-2.5 text-sm">
                <p className="font-semibold text-[#111C16]">
                  {selectedMember.name}
                  {selectedMember.age !== null && (
                    <span className="font-normal text-[#5A6E62]"> · Age {selectedMember.age}</span>
                  )}
                </p>
                <div className="space-y-1 text-xs text-[#4B5E53]">
                  <p>
                    <span className="font-medium text-[#111C16]">Allergies:</span>{' '}
                    {selectedMember.allergies.length > 0 ? selectedMember.allergies.join(', ') : 'None listed'}
                  </p>
                  <p>
                    <span className="font-medium text-[#111C16]">Dietary restrictions:</span>{' '}
                    {selectedMember.dietaryRestrictions.length > 0
                      ? selectedMember.dietaryRestrictions.join(', ')
                      : 'None listed'}
                  </p>
                  <p>
                    <span className="font-medium text-[#111C16]">Nutritional preferences:</span>{' '}
                    {selectedMember.nutritionalPreferences.length > 0
                      ? selectedMember.nutritionalPreferences.join(', ')
                      : 'None listed'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#F8FAF9] border border-[#E4EAE6] text-xs text-[#4B5E53] space-y-2.5">
                <p>No family member profile created yet. Add allergies and dietary preferences to enable automatic compatibility screening.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('family')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D] hover:underline cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Add First Family Member</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-[#E4EAE6]">
            <h3 className="font-display text-sm font-semibold text-[#111C16] mb-2">
              Latest Food Intelligence Report
            </h3>
            {latestReport && latestReport.product ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#111C16] truncate">
                  {latestReport.product.name}
                  {latestReport.product.brand && (
                    <span className="font-normal text-[#5A6E62]"> · {latestReport.product.brand}</span>
                  )}
                </p>
                {latestReport.familyCompatibility && (
                  <p
                    className={`text-xs font-medium flex items-center gap-1.5 ${
                      latestReport.familyCompatibility.status === 'CONFLICT'
                        ? 'text-[#B91C1C]'
                        : latestReport.familyCompatibility.status === 'CAUTION_INCOMPLETE_DATA'
                          ? 'text-[#B45309]'
                          : 'text-[#15803D]'
                    }`}
                  >
                    {latestReport.familyCompatibility.status === 'CONFLICT' ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {latestReport.familyCompatibility.status === 'CONFLICT'
                        ? `${latestReport.familyCompatibility.conflicts.length} conflict(s) for ${latestReport.familyCompatibility.memberName}`
                        : latestReport.familyCompatibility.status === 'CAUTION_INCOMPLETE_DATA'
                          ? `Incomplete ingredients — verify packaging for ${latestReport.familyCompatibility.memberName}`
                          : `No known conflicts for ${latestReport.familyCompatibility.memberName}`}
                    </span>
                  </p>
                )}
                <div className="flex items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('analysis')}
                    className="text-xs font-medium text-[#15803D] hover:underline cursor-pointer"
                  >
                    Open Full Report
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('compare')}
                    className="text-xs font-medium text-[#4B5E53] hover:text-[#111C16] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Compare Products</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5A6E62]">
                Scan a barcode, run OCR on a label, or log a manual item to see the agent analysis summary here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchases Table */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4EAE6] flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#111C16]">Recent Purchases</h2>
          <button
            type="button"
            onClick={() => onNavigate('purchases')}
            className="text-xs font-medium text-[#15803D] hover:underline whitespace-nowrap cursor-pointer"
          >
            View All Purchases
          </button>
        </div>

        {purchases.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#5A6E62]">
            No purchases recorded yet. Analyze a product and save it to track household spending.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4EAE6] bg-[#F8FAF9] text-xs font-medium text-[#5A6E62]">
                  <th className="py-2.5 px-6">Product</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EE] text-sm">
                {purchases.slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAF9] transition-colors">
                    <td className="py-3 px-6 font-medium text-[#111C16]">
                      {p.productName}
                      {p.brand && <span className="font-normal text-[#5A6E62]"> · {p.brand}</span>}
                    </td>
                    <td className="py-3 px-4 text-[#4B5E53]">{p.category}</td>
                    <td className="py-3 px-4 text-[#4B5E53]">{p.familyMemberName || 'Household'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4B5E53]">
                      {p.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-[#111C16]">
                      {formatCurrency(p.totalPrice, currency)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-[#5A6E62]">
                      {formatDateShort(p.purchasedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
