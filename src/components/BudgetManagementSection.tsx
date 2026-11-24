import { AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { api, type BudgetSummaryResponse } from '../services/api.ts';
import { formatCurrency } from '../utils/format.ts';

interface BudgetManagementSectionProps {
  activeFamilyId: string;
  month: string;
  budgetSummary: BudgetSummaryResponse | null;
  currency: string;
  onChangeMonth: (month: string) => void;
  onBudgetUpdated: () => Promise<void>;
}

const DOUGHNUT_COLORS = ['#15803D', '#0F766E', '#D97706', '#2563EB', '#7C3AED', '#64748B', '#DC2626'];

export function BudgetManagementSection({
  activeFamilyId,
  month,
  budgetSummary,
  currency,
  onChangeMonth,
  onBudgetUpdated,
}: BudgetManagementSectionProps) {
  const [limitInput, setLimitInput] = useState(
    budgetSummary?.budgetLimit !== null && budgetSummary?.budgetLimit !== undefined
      ? String(budgetSummary.budgetLimit)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLimitInput(
      budgetSummary?.budgetLimit !== null && budgetSummary?.budgetLimit !== undefined
        ? String(budgetSummary.budgetLimit)
        : ''
    );
  }, [budgetSummary?.budgetLimit, month]);

  const handleSaveBudget = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const val = Number(limitInput);
    if (!Number.isFinite(val) || val < 0) {
      setError('Enter a valid non-negative monthly food budget.');
      return;
    }

    setSaving(true);
    try {
      await api.upsertBudget({
        familyId: activeFamilyId,
        month,
        budgetLimit: val,
        currency,
      });
      await onBudgetUpdated();
      setNotice(`Saved monthly budget for ${month}: ${formatCurrency(val, currency)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update monthly budget.');
    } finally {
      setSaving(false);
    }
  };

  const spent = budgetSummary?.totalSpent ?? 0;
  const limit = budgetSummary?.budgetLimit ?? null;
  const remaining = budgetSummary?.remainingBudget ?? null;
  const pct = limit && limit > 0 ? Math.round((spent / limit) * 100) : null;
  const overBudget = remaining !== null && remaining < 0;
  const approaching = pct !== null && pct >= 80 && !overBudget;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4B5E53] mb-1">
            Household Expenditure · Chart.js Analytics
          </p>
          <h1 className="font-display text-2xl font-bold text-[#111C16]">Monthly Budget Management</h1>
          <p className="mt-1 text-sm text-[#4B5E53]">
            Set monthly household grocery limits, monitor remaining balances, and analyze spending by food category.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="budget-month" className="text-xs font-medium text-[#5A6E62]">
            Month:
          </label>
          <input
            id="budget-month"
            type="month"
            value={month}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="px-3 py-2 font-mono tabular-nums text-sm bg-white border border-[#D4DFD8] rounded-lg"
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">Monthly Budget Limit ({month})</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-[#111C16]">
            {limit !== null ? formatCurrency(limit, currency) : 'Not configured'}
          </p>
          <p className="mt-1 text-xs text-[#4B5E53]">Target household food allowance</p>
        </div>

        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">Total Expenditure ({month})</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-semibold text-[#111C16]">
            {formatCurrency(spent, currency)}
          </p>
          <p className="mt-1 text-xs text-[#4B5E53] tabular-nums">
            {budgetSummary?.purchaseCount ?? 0} purchase(s) recorded
            {pct !== null ? ` · ${pct}% of budget used` : ''}
          </p>
        </div>

        <div className="bg-white border border-[#E4EAE6] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5A6E62]">Remaining Balance</p>
          <p
            className={`mt-2 font-mono tabular-nums text-2xl font-semibold ${
              overBudget ? 'text-[#B91C1C]' : approaching ? 'text-[#B45309]' : 'text-[#15803D]'
            }`}
          >
            {remaining !== null ? formatCurrency(remaining, currency) : 'Set limit'}
          </p>
          <p className="mt-1 text-xs flex items-center gap-1 text-[#4B5E53]">
            {overBudget ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" />
                <span className="text-[#B91C1C] font-medium">Over monthly limit</span>
              </>
            ) : approaching ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
                <span className="text-[#B45309] font-medium">Approaching monthly limit</span>
              </>
            ) : limit !== null ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Within monthly budget</span>
              </>
            ) : (
              <span>No budget threshold set for {month}</span>
            )}
          </p>
        </div>
      </div>

      {/* Set Monthly Budget Form + Utilization Progress */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
        <form onSubmit={(e) => void handleSaveBudget(e)} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              Set Budget Limit for {month} ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder="e.g. 600.00"
              className="w-full px-3.5 py-2 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Monthly Budget'}</span>
          </button>
        </form>

        {limit !== null && limit > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#4B5E53] font-mono tabular-nums">
              <span>Utilization</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#EDF2EE] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  overBudget ? 'bg-[#DC2626]' : approaching ? 'bg-[#D97706]' : 'bg-[#15803D]'
                }`}
                style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-[#B91C1C]">{error}</p>}
        {notice && <p className="text-xs text-[#166534]">{notice}</p>}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-[#E4EAE6] rounded-xl p-6 flex flex-col">
          <h2 className="font-display text-base font-semibold text-[#111C16] mb-1">
            6-Month Spending vs Budget
          </h2>
          <p className="text-xs text-[#5A6E62] mb-4">
            Monthly comparison ending in {month}
          </p>
          <div className="h-64 flex-1">
            {budgetSummary && budgetSummary.monthlyTrend.length > 0 ? (
              <Bar
                data={{
                  labels: budgetSummary.monthlyTrend.map((m) => m.month),
                  datasets: [
                    {
                      label: 'Spent',
                      data: budgetSummary.monthlyTrend.map((m) => m.spent),
                      backgroundColor: '#15803D',
                      borderRadius: 4,
                    },
                    {
                      label: 'Budget Limit',
                      data: budgetSummary.monthlyTrend.map((m) => m.budgetLimit ?? 0),
                      backgroundColor: '#D4DFD8',
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                  scales: {
                    y: { beginAtZero: true, grid: { color: '#EDF2EE' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#5A6E62]">
                No budget history available yet.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4EAE6] rounded-xl p-6 flex flex-col">
          <h2 className="font-display text-base font-semibold text-[#111C16] mb-1">
            Expenditure by Category ({month})
          </h2>
          <p className="text-xs text-[#5A6E62] mb-4">
            Categorized from recorded purchase data
          </p>

          {budgetSummary && budgetSummary.categoryBreakdown.length > 0 ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="h-48">
                <Doughnut
                  data={{
                    labels: budgetSummary.categoryBreakdown.map((c) => c.category),
                    datasets: [
                      {
                        data: budgetSummary.categoryBreakdown.map((c) => c.amount),
                        backgroundColor: budgetSummary.categoryBreakdown.map(
                          (_, idx) => DOUGHNUT_COLORS[idx % DOUGHNUT_COLORS.length]
                        ),
                        borderWidth: 1,
                        borderColor: '#FFFFFF',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    },
                  }}
                />
              </div>

              <div className="divide-y divide-[#EDF2EE] pt-2 border-t border-[#EDF2EE] text-xs">
                {budgetSummary.categoryBreakdown.map((c) => (
                  <div key={c.category} className="py-1.5 flex items-center justify-between">
                    <span className="text-[#4B5E53] truncate pr-3">{c.category}</span>
                    <span className="font-mono tabular-nums font-semibold text-[#111C16]">
                      {formatCurrency(c.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-sm text-[#5A6E62] py-12">
              No categorized purchases recorded for {month} yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
