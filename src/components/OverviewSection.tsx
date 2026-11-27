import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  DollarSign,
  FileSearch,
  Plus,
  Scale,
  ScanBarcode,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Utensils,
  Wallet,
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
  const budgetPercent = limit !== null && limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : null;

  const trendLabels = budgetSummary?.monthlyTrend.map((m) => m.month) ?? [];
  const trendSpent = budgetSummary?.monthlyTrend.map((m) => m.spent) ?? [];
  const trendBudget = budgetSummary?.monthlyTrend.map((m) => m.budgetLimit ?? 0) ?? [];

  const chartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Monthly Spent',
        data: trendSpent,
        backgroundColor: '#047857',
        borderRadius: 6,
        hoverBackgroundColor: '#065F46',
      },
      {
        label: 'Budget Limit',
        data: trendBudget,
        backgroundColor: '#E3EAE5',
        borderRadius: 6,
        hoverBackgroundColor: '#D0DCD4',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, color: '#3D5246', font: { size: 12, weight: 500 } },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#EDF2EE' },
        ticks: { color: '#5A7364', font: { size: 11 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#5A7364', font: { size: 11 } },
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Friendly Hero Banner with Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#047857] via-[#059669] to-[#10B981] p-6 sm:p-8 text-white shadow-card">
        {/* Subtle Decorative Elements */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-8 w-48 h-48 rounded-full bg-black/5 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-semibold tracking-wide uppercase text-white/95">
              <span>{familyName} Household</span>
              <span className="w-1 h-1 rounded-full bg-white/60" />
              <span>Workspace</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Good food, protected health.
            </h1>
            <p className="text-sm text-emerald-50/90 leading-relaxed font-normal">
              Active screening is configured for{' '}
              <span className="font-semibold text-white underline decoration-white/40 underline-offset-2">
                {selectedMember ? selectedMember.name : 'all family members'}
              </span>
              . Every barcode, label photo, or unpackaged item runs through personalized safety checks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('scan')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#065F46] hover:bg-emerald-50 text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 cursor-pointer active:scale-98"
            >
              <ScanBarcode className="w-4 h-4 text-[#047857]" />
              <span>Scan Barcode</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('manual')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-800/40 hover:bg-emerald-800/60 text-white text-sm font-medium rounded-xl border border-white/20 transition-all cursor-pointer"
            >
              <Utensils className="w-4 h-4" />
              <span>Manual Entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Interactive Dashboard Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Stat 1: Family Screening */}
        <div
          onClick={() => onNavigate('family')}
          className="ui-card-hover p-5 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#5A7364]">Active Profiles</p>
              <p className="mt-2 font-mono tabular-nums text-3xl font-bold text-[#111C16]">
                {members.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E3EAE5] flex items-center justify-between text-xs text-[#3D5246]">
            <span className="truncate">
              {selectedMember ? `Screening: ${selectedMember.name}` : 'Tap to select member'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#5A7364] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Stat 2: Monthly Food Spend */}
        <div
          onClick={() => onNavigate('budget')}
          className="ui-card-hover p-5 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#5A7364]">
                Monthly Spend ({budgetSummary?.month ?? 'Current'})
              </p>
              <p className="mt-2 font-mono tabular-nums text-3xl font-bold text-[#111C16]">
                {formatCurrency(spent, currency)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] text-[#B45309] flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E3EAE5] flex items-center justify-between text-xs text-[#3D5246]">
            <span>{budgetSummary?.purchaseCount ?? 0} item(s) logged</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#5A7364] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Stat 3: Remaining Budget with Progress Ring/Bar */}
        <div
          onClick={() => onNavigate('budget')}
          className="ui-card-hover p-5 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#5A7364]">Remaining Budget</p>
              <p
                className={`mt-2 font-mono tabular-nums text-3xl font-bold truncate ${
                  overBudget ? 'text-[#DC2626]' : 'text-[#111C16]'
                }`}
              >
                {remaining !== null ? formatCurrency(remaining, currency) : 'Not Set'}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
                overBudget ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F0FDF4] text-[#16A34A]'
              }`}
            >
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E3EAE5] space-y-1.5">
            {limit !== null ? (
              <>
                <div className="flex items-center justify-between text-[11px] text-[#5A7364]">
                  <span>{budgetPercent}% spent</span>
                  <span>Limit: {formatCurrency(limit, currency)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#E3EAE5] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      overBudget ? 'bg-[#DC2626]' : 'bg-[#059669]'
                    }`}
                    style={{ width: `${budgetPercent}%` }}
                  />
                </div>
              </>
            ) : (
              <span className="text-xs text-[#5A7364]">Tap to set a monthly limit</span>
            )}
          </div>
        </div>

        {/* Stat 4: Total Recorded Purchases */}
        <div
          onClick={() => onNavigate('purchases')}
          className="ui-card-hover p-5 flex flex-col justify-between cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#5A7364]">Total Purchases</p>
              <p className="mt-2 font-mono tabular-nums text-3xl font-bold text-[#111C16]">
                {purchases.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#F0F4F1] text-[#3D5246] flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E3EAE5] flex items-center justify-between text-xs text-[#3D5246]">
            <span className="truncate">
              {latestReport?.product ? `Last: ${latestReport.product.name}` : 'No recent analysis'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#5A7364] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Product Capture Workflows */}
      <div className="ui-card p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#047857]">Workflows</p>
          <h2 className="font-display text-lg font-bold text-[#111C16]">
            Capture & Analyze a Food Product
          </h2>
          <p className="text-sm text-[#3D5246] mt-0.5">
            Choose how you want to input nutrition data. All three paths connect to the personalized Family Health Agent.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('scan')}
            className="text-left p-5 rounded-xl border border-[#E3EAE5] hover:border-[#047857] hover:bg-[#F8FAF9] transition-all cursor-pointer group shadow-xs hover:shadow-card"
          >
            <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#047857] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold text-[#111C16]">Barcode Scanner</p>
              <ArrowRight className="w-4 h-4 text-[#5A7364] group-hover:text-[#047857] group-hover:translate-x-1 transition-all" />
            </div>
            <p className="mt-2 text-xs text-[#3D5246] leading-relaxed">
              Scan packaged food directly with your camera to pull verified facts from Open Food Facts.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ocr')}
            className="text-left p-5 rounded-xl border border-[#E3EAE5] hover:border-[#047857] hover:bg-[#F8FAF9] transition-all cursor-pointer group shadow-xs hover:shadow-card"
          >
            <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#047857] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileSearch className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold text-[#111C16]">AI Label Scanner</p>
              <ArrowRight className="w-4 h-4 text-[#5A7364] group-hover:text-[#047857] group-hover:translate-x-1 transition-all" />
            </div>
            <p className="mt-2 text-xs text-[#3D5246] leading-relaxed">
              Photograph packaging labels with Gemini Vision & OCR extraction, then review before saving.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('manual')}
            className="text-left p-5 rounded-xl border border-[#E3EAE5] hover:border-[#047857] hover:bg-[#F8FAF9] transition-all cursor-pointer group shadow-xs hover:shadow-card"
          >
            <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#047857] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold text-[#111C16]">Manual & Quick Entry</p>
              <ArrowRight className="w-4 h-4 text-[#5A7364] group-hover:text-[#047857] group-hover:translate-x-1 transition-all" />
            </div>
            <p className="mt-2 text-xs text-[#3D5246] leading-relaxed">
              Log fresh produce, meat, grains, or bulk items using natural language or IFCT 2017 search.
            </p>
          </button>
        </div>
      </div>

      {/* Two-Column Analytics & Latest Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Budget Trend */}
        <div className="lg:col-span-7 ui-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#111C16]">
                6-Month Expenditure vs Budget
              </h2>
              <p className="text-xs text-[#5A7364]">
                Aggregated from your household purchase records
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budget')}
              className="text-xs font-semibold text-[#047857] hover:underline whitespace-nowrap cursor-pointer"
            >
              Manage Budget
            </button>
          </div>
          <div className="h-64 flex-1">
            {trendLabels.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-sm text-[#5A7364]">
                <ShoppingBag className="w-8 h-8 text-[#9BB1A3] mb-2" />
                <p>Record purchases or set a monthly budget to see spending trends.</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Family Screening & Latest Analysis */}
        <div className="lg:col-span-5 ui-card p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-bold text-[#111C16]">
                Active Screening Profile
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('family')}
                className="text-xs font-semibold text-[#047857] hover:underline whitespace-nowrap cursor-pointer"
              >
                Manage Profiles
              </button>
            </div>

            {selectedMember ? (
              <div className="p-4 rounded-xl bg-[#F8FAF9] border border-[#E3EAE5] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#ECFDF5] text-[#047857] font-bold text-sm flex items-center justify-center">
                      {selectedMember.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#111C16]">{selectedMember.name}</p>
                      <p className="text-[11px] text-[#5A7364]">
                        {selectedMember.age !== null ? `Age ${selectedMember.age}` : 'Family member'}
                      </p>
                    </div>
                  </div>
                  <span className="ui-badge ui-badge-success">Active</span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#E3EAE5] text-xs text-[#3D5246]">
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
              <div className="ui-empty-state py-6">
                <div className="icon-wrapper mb-2">
                  <Users className="w-5 h-5 text-[#5A7364]" />
                </div>
                <p className="text-xs font-medium text-[#111C16]">No active profile selected</p>
                <p className="text-[11px] text-[#5A7364] max-w-xs mt-1">
                  Select or add a family member to screen ingredients against allergies and medical dietary needs.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('family')}
                  className="mt-3 ui-btn-primary text-xs py-1.5 px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure Profiles</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-[#E3EAE5]">
            <h3 className="font-display text-sm font-bold text-[#111C16] mb-2.5">
              Latest Food Intelligence Report
            </h3>
            {latestReport && latestReport.product ? (
              <div className="p-3.5 rounded-xl bg-[#F8FAF9] border border-[#E3EAE5] space-y-2">
                <p className="text-sm font-semibold text-[#111C16] truncate">
                  {latestReport.product.name}
                  {latestReport.product.brand && (
                    <span className="font-normal text-[#5A7364]"> · {latestReport.product.brand}</span>
                  )}
                </p>
                {latestReport.familyCompatibility && (
                  <p
                    className={`text-xs font-medium flex items-center gap-1.5 ${
                      latestReport.familyCompatibility.status === 'CONFLICT'
                        ? 'text-[#B91C1C]'
                        : latestReport.familyCompatibility.status === 'CAUTION_INCOMPLETE_DATA'
                          ? 'text-[#B45309]'
                          : 'text-[#047857]'
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
                    className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
                  >
                    Open Full Report →
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('compare')}
                    className="text-xs font-medium text-[#3D5246] hover:text-[#111C16] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Compare</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5A7364]">
                Scan a barcode, run OCR on a label, or log an unpackaged item to see the agent analysis summary here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchases Table */}
      <div className="ui-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E3EAE5] flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-[#111C16]">Recent Purchases</h2>
            <p className="text-xs text-[#5A7364]">Latest items saved to your family grocery history</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('purchases')}
            className="text-xs font-semibold text-[#047857] hover:underline whitespace-nowrap cursor-pointer"
          >
            View All Purchases
          </button>
        </div>

        {purchases.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#5A7364]">
            No purchases recorded yet. Analyze a product and save it to track household spending.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E3EAE5] bg-[#F8FAF9] text-xs font-semibold text-[#5A7364]">
                  <th className="py-3 px-6">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EE] text-sm">
                {purchases.slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAF9] transition-colors">
                    <td className="py-3 px-6 font-semibold text-[#111C16]">
                      {p.productName}
                      {p.brand && <span className="font-normal text-[#5A7364]"> · {p.brand}</span>}
                    </td>
                    <td className="py-3 px-4 text-[#3D5246]">{p.category}</td>
                    <td className="py-3 px-4 text-[#3D5246]">{p.familyMemberName || 'Household'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#3D5246]">
                      {p.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#111C16]">
                      {formatCurrency(p.totalPrice, currency)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-xs text-[#5A7364]">
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
