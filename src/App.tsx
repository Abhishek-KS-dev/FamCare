import {
  Activity,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  Heart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Scale,
  ScanBarcode,
  Settings,
  ShoppingBag,
  Sparkles,
  UserCheck,
  Users,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { AlternativesSection } from './components/AlternativesSection.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { BarcodeScannerSection } from './components/BarcodeScannerSection.tsx';
import { BudgetManagementSection } from './components/BudgetManagementSection.tsx';
import { ComparisonSection } from './components/ComparisonSection.tsx';
import { FamilyProfilesSection } from './components/FamilyProfilesSection.tsx';
import { FoodAnalysisSection } from './components/FoodAnalysisSection.tsx';
import { ManualEntrySection } from './components/ManualEntrySection.tsx';
import { OcrScannerSection } from './components/OcrScannerSection.tsx';
import { OverviewSection, type NavSection } from './components/OverviewSection.tsx';
import { PurchaseHistorySection } from './components/PurchaseHistorySection.tsx';
import { SettingsSection } from './components/SettingsSection.tsx';
import { ToastContainer } from './components/Toast.tsx';
import {
  api,
  setAuthToken,
  type AgentAnalysisReport,
  type AlternativeSearchResult,
  type AuthUser,
  type BudgetSummaryResponse,
  type FamilyMemberRecord,
  type FamilyRecord,
  type HealthResponse,
  type ProductData,
  type PurchaseRecord,
} from './services/api.ts';
import { currentMonthKey } from './utils/format.ts';

interface NavItem {
  id: NavSection;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: 'main' | 'identify' | 'intelligence' | 'household';
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'main' },
  { id: 'scan', label: 'Scan Product', icon: ScanBarcode, group: 'identify' },
  { id: 'ocr', label: 'OCR Label Scanner', icon: FileSearch, group: 'identify' },
  { id: 'manual', label: 'Manual Food Entry', icon: Utensils, group: 'identify' },
  { id: 'analysis', label: 'Food Analysis', icon: ClipboardCheck, group: 'intelligence' },
  { id: 'alternatives', label: 'Alternatives', icon: Sparkles, group: 'intelligence' },
  { id: 'compare', label: 'Comparison', icon: Scale, group: 'intelligence' },
  { id: 'family', label: 'Family Profiles', icon: Users, group: 'household' },
  { id: 'purchases', label: 'Purchase History', icon: ShoppingBag, group: 'household' },
  { id: 'budget', label: 'Budget Tracker', icon: Wallet, group: 'household' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'household' },
];

// Bottom tab navigation items for mobile view
const MOBILE_TAB_ITEMS: Array<{ id: NavSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'scan', label: 'Scan', icon: ScanBarcode },
  { id: 'analysis', label: 'Analysis', icon: ClipboardCheck },
  { id: 'family', label: 'Family', icon: Users },
  { id: 'budget', label: 'Budget', icon: Wallet },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [section, setSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false);

  // Household data
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string>('');
  const [members, setMembers] = useState<FamilyMemberRecord[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [budgetMonth, setBudgetMonth] = useState<string>(currentMonthKey());
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);

  // Analysis & comparison state
  const [latestReport, setLatestReport] = useState<AgentAnalysisReport | null>(null);
  const [comparisonProducts, setComparisonProducts] = useState<ProductData[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => {
        // Non-blocking health check
      });
  }, []);

  const loadFamilyScopedData = useCallback(
    async (familyId: string, month: string) => {
      if (!familyId) return;
      try {
        const [membersRes, purchasesRes, budgetRes] = await Promise.all([
          api.listMembers(familyId),
          api.listPurchases(familyId),
          api.getBudgetSummary(familyId, month),
        ]);
        setMembers(membersRes.members);
        setPurchases(purchasesRes.purchases);
        setBudgetSummary(budgetRes);
        setSelectedMemberId((prev) => {
          if (prev && membersRes.members.some((m) => m.id === prev)) return prev;
          return membersRes.members[0]?.id ?? null;
        });
      } catch (err) {
        setWorkspaceError(err instanceof Error ? err.message : 'Unable to load household data.');
      }
    },
    []
  );

  const loadAllWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    setWorkspaceError(null);
    try {
      const { families: fams } = await api.listFamilies();
      setFamilies(fams);
      const nextFamilyId =
        activeFamilyId && fams.some((f) => f.id === activeFamilyId)
          ? activeFamilyId
          : fams[0]?.id || '';
      setActiveFamilyId(nextFamilyId);
      if (nextFamilyId) {
        await loadFamilyScopedData(nextFamilyId, budgetMonth);
      }
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Failed to load workspace.');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [activeFamilyId, budgetMonth, loadFamilyScopedData]);

  useEffect(() => {
    if (user) {
      void loadAllWorkspace();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && activeFamilyId) {
      void loadFamilyScopedData(activeFamilyId, budgetMonth);
    }
  }, [user, activeFamilyId, budgetMonth, loadFamilyScopedData]);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setFamilies([]);
    setActiveFamilyId('');
    setMembers([]);
    setSelectedMemberId(null);
    setPurchases([]);
    setBudgetSummary(null);
    setLatestReport(null);
    setComparisonProducts([]);
    setSection('overview');
  };

  const handleAnalysisComplete = (report: AgentAnalysisReport) => {
    setLatestReport(report);
    setSection('analysis');
  };

  const handleAddToComparison = (product: ProductData) => {
    setComparisonProducts((prev) => {
      if (prev.length >= 4) return prev;
      if (
        prev.some(
          (p) => (p.barcode && product.barcode && p.barcode === product.barcode) || p.id === product.id
        )
      ) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const handleInspectBarcode = async (barcode: string) => {
    try {
      const { report } = await api.analyzeWithAgent({
        taskType: 'barcode_analysis',
        barcode,
        familyMemberId: selectedMemberId,
        requestAlternatives: false,
      });
      setLatestReport(report);
      setSection('analysis');
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Unable to analyze selected product.');
    }
  };

  const handleReanalyzeForMember = async (product: ProductData) => {
    try {
      const taskType =
        product.source === 'open_food_facts' && product.barcode
          ? 'barcode_analysis'
          : product.source === 'ocr_verified'
            ? 'ocr_analysis'
            : 'manual_analysis';
      const { report } = await api.analyzeWithAgent({
        taskType,
        barcode: product.barcode || undefined,
        product: taskType !== 'barcode_analysis' ? { ...product, verifiedByUser: true } : undefined,
        familyMemberId: selectedMemberId,
        requestAlternatives: false,
      });
      setLatestReport(report);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Unable to re-analyze product.');
    }
  };

  const handleUpdateAlternatives = (alternatives: AlternativeSearchResult) => {
    setLatestReport((prev) => (prev ? { ...prev, alternatives } : prev));
  };

  if (!user) {
    return <AuthScreen onAuthenticated={(u) => setUser(u)} />;
  }

  const activeFamily = families.find((f) => f.id === activeFamilyId) ?? families[0] ?? null;
  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;
  const currentNav = NAV_ITEMS.find((n) => n.id === section) ?? NAV_ITEMS[0];
  const currency = user.currency || 'USD';

  const navigateTo = (next: NavSection) => {
    setSection(next);
    setMobileMenuOpen(false);
    setFamilyDropdownOpen(false);
    setWorkspaceError(null);
  };

  const renderNavGroup = (title: string, group: NavItem['group']) => {
    const items = NAV_ITEMS.filter((i) => i.group === group);
    return (
      <div className="space-y-1">
        {title && (
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--app-fg-subtle)]">
            {title}
          </p>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`group relative w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all duration-150 cursor-pointer ${
                active
                  ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-800)] shadow-xs'
                  : 'text-[var(--app-fg-muted)] hover:bg-[var(--color-surface-100)] hover:text-[var(--app-fg)]'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active
                      ? 'text-[var(--color-primary-700)]'
                      : 'text-[var(--app-fg-subtle)] group-hover:text-[var(--app-fg)]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {/* Active Pill Indicator */}
              {active && (
                <span
                  className="w-1.5 h-4 rounded-full bg-[var(--color-primary-600)]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] flex flex-col lg:flex-row antialiased selection:bg-[var(--color-primary-100)] selection:text-[var(--color-primary-900)]">
      {/* =========================================================================
          Desktop Modern Sidebar
         ========================================================================= */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[var(--sidebar-bg)] border-r border-[var(--card-border)] min-h-screen sticky top-0 h-screen z-20">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-[var(--card-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--color-primary-700)] to-[var(--color-primary-500)] flex items-center justify-center shadow-xs">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-[var(--app-fg)]">
                FamCare
              </span>
              <span className="ml-1 text-[10px] font-semibold text-[var(--color-primary-700)] bg-[var(--color-primary-50)] px-1.5 py-0.5 rounded-full border border-[var(--color-primary-200)]">
                AI Health
              </span>
            </div>
          </div>
        </div>

        {/* Household Selector in Sidebar */}
        <div className="px-4 py-3 border-b border-[var(--card-border)] bg-[var(--color-surface-50)]/50">
          <label className="block text-[10px] font-semibold text-[var(--app-fg-subtle)] uppercase tracking-wider mb-1">
            Active Household
          </label>
          <div className="relative">
            <select
              value={activeFamilyId}
              onChange={(e) => setActiveFamilyId(e.target.value)}
              className="w-full pl-2.5 pr-8 py-1.5 text-xs font-semibold bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg text-[var(--app-fg)] truncate focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]/20 cursor-pointer"
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--app-fg-subtle)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {renderNavGroup('', 'main')}
          {renderNavGroup('Identification', 'identify')}
          {renderNavGroup('Intelligence', 'intelligence')}
          {renderNavGroup('Household & Budget', 'household')}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-[var(--card-border)] bg-[var(--color-surface-50)]/50 shrink-0">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-800)] font-bold text-xs flex items-center justify-center shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--app-fg)] truncate">{user.name}</p>
                <p className="text-[10px] text-[var(--app-fg-subtle)] truncate">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 text-[var(--app-fg-subtle)] hover:text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          Mobile Drawer & Overlay
         ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-[var(--sidebar-bg)] h-full flex flex-col border-r border-[var(--card-border)] shadow-dropdown animate-in slide-in-from-left duration-200">
            <div className="h-16 px-4 border-b border-[var(--card-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-700)] flex items-center justify-center shadow-xs">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <span className="font-display text-base font-bold text-[var(--app-fg)]">FamCare</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-[var(--app-fg-muted)] hover:text-[var(--app-fg)] rounded-lg hover:bg-[var(--color-surface-100)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {renderNavGroup('', 'main')}
              {renderNavGroup('Identification', 'identify')}
              {renderNavGroup('Intelligence', 'intelligence')}
              {renderNavGroup('Household & Budget', 'household')}
            </nav>
            <div className="p-4 border-t border-[var(--card-border)] bg-[var(--color-surface-50)]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--app-fg-muted)] hover:text-[var(--app-fg)] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Main Content & Translucent Sticky Header
         ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Sticky Translucent Blur Header */}
        <header className="h-16 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--card-border)] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[var(--app-fg-muted)] hover:text-[var(--app-fg)] rounded-lg hover:bg-[var(--color-surface-100)] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[var(--app-fg-subtle)] hidden sm:inline whitespace-nowrap text-xs font-medium">
                {activeFamily?.name || 'Household'}
              </span>
              <span className="text-[var(--app-fg-subtle)] opacity-40 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-display font-bold text-[var(--app-fg)] truncate text-base">
                {currentNav.label}
              </span>
            </div>
          </div>

          {/* Right Header Controls (Member Screening Selector & Health Tag) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-2.5 py-1.5 shadow-xs">
              <UserCheck className="w-3.5 h-3.5 text-[var(--color-primary-600)] shrink-0" />
              <label
                htmlFor="active-member-select"
                className="hidden md:inline text-[11px] font-semibold text-[var(--app-fg-subtle)] whitespace-nowrap"
              >
                Screening for:
              </label>
              <select
                id="active-member-select"
                value={selectedMemberId || ''}
                onChange={(e) => setSelectedMemberId(e.target.value || null)}
                className="text-xs font-semibold bg-transparent border-0 text-[var(--app-fg)] max-w-[140px] truncate focus:outline-none cursor-pointer"
              >
                <option value="">No member selected</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Main Content Area with Smooth Fade Entrance */}
        <main
          key={section}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto animate-in fade-in duration-200"
        >
          {workspaceError && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-danger-50)] border border-[var(--color-danger-100)] text-xs text-[var(--color-danger-700)] flex items-center justify-between shadow-xs">
              <span className="font-medium">{workspaceError}</span>
              <button
                type="button"
                onClick={() => setWorkspaceError(null)}
                className="text-[var(--color-danger-700)] underline font-semibold ml-4 cursor-pointer hover:opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {loadingWorkspace && families.length === 0 ? (
            <div className="space-y-4">
              <div className="h-8 w-64 ui-skeleton" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 ui-card ui-skeleton" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <OverviewSection
                  familyName={activeFamily?.name || 'Household'}
                  members={members}
                  selectedMember={selectedMember}
                  purchases={purchases}
                  budgetSummary={budgetSummary}
                  latestReport={latestReport}
                  currency={currency}
                  onNavigate={navigateTo}
                />
              )}

              {section === 'scan' && (
                <BarcodeScannerSection
                  selectedMember={selectedMember}
                  onAnalysisComplete={handleAnalysisComplete}
                  onNavigate={navigateTo}
                />
              )}

              {section === 'ocr' && (
                <OcrScannerSection
                  selectedMember={selectedMember}
                  onAnalysisComplete={handleAnalysisComplete}
                />
              )}

              {section === 'manual' && (
                <ManualEntrySection
                  selectedMember={selectedMember}
                  onAnalysisComplete={handleAnalysisComplete}
                />
              )}

              {section === 'family' && (
                <FamilyProfilesSection
                  families={families}
                  activeFamilyId={activeFamilyId}
                  members={members}
                  selectedMemberId={selectedMemberId}
                  onSelectFamily={(id) => setActiveFamilyId(id)}
                  onSelectMember={(id) => setSelectedMemberId(id)}
                  onDataChanged={loadAllWorkspace}
                />
              )}

              {section === 'analysis' && (
                <FoodAnalysisSection
                  report={latestReport}
                  activeFamilyId={activeFamilyId}
                  members={members}
                  selectedMember={selectedMember}
                  currency={currency}
                  onNavigate={navigateTo}
                  onAddToComparison={handleAddToComparison}
                  onPurchaseSaved={() => loadFamilyScopedData(activeFamilyId, budgetMonth)}
                  onReanalyzeForMember={handleReanalyzeForMember}
                />
              )}

              {section === 'alternatives' && (
                <AlternativesSection
                  report={latestReport}
                  selectedMember={selectedMember}
                  onUpdateAlternatives={handleUpdateAlternatives}
                  onAddToComparison={handleAddToComparison}
                  onInspectBarcode={handleInspectBarcode}
                  onNavigate={navigateTo}
                />
              )}

              {section === 'compare' && (
                <ComparisonSection
                  products={comparisonProducts}
                  members={members}
                  selectedMemberId={selectedMemberId}
                  currency={currency}
                  onAddProduct={handleAddToComparison}
                  onRemoveProduct={(id) =>
                    setComparisonProducts((prev) => prev.filter((p) => p.id !== id))
                  }
                  onUpdateProductPrice={(id, price) =>
                    setComparisonProducts((prev) =>
                      prev.map((p) => (p.id === id ? { ...p, userPrice: price } : p))
                    )
                  }
                  onSelectMember={(id) => setSelectedMemberId(id)}
                />
              )}

              {section === 'purchases' && (
                <PurchaseHistorySection
                  activeFamilyId={activeFamilyId}
                  members={members}
                  purchases={purchases}
                  currency={currency}
                  onDataChanged={() => loadFamilyScopedData(activeFamilyId, budgetMonth)}
                />
              )}

              {section === 'budget' && (
                <BudgetManagementSection
                  activeFamilyId={activeFamilyId}
                  month={budgetMonth}
                  budgetSummary={budgetSummary}
                  currency={currency}
                  onChangeMonth={(m) => setBudgetMonth(m)}
                  onBudgetUpdated={() => loadFamilyScopedData(activeFamilyId, budgetMonth)}
                />
              )}

              {section === 'settings' && (
                <SettingsSection
                  user={user}
                  families={families}
                  health={health}
                  onUserUpdated={(updated) => {
                    setUser(updated);
                    if (activeFamilyId) {
                      void loadFamilyScopedData(activeFamilyId, budgetMonth);
                    }
                  }}
                  onFamiliesChanged={loadAllWorkspace}
                />
              )}
            </>
          )}
        </main>

        {/* =========================================================================
            Mobile Bottom Navigation Tab Bar
           ========================================================================= */}
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--header-bg)] backdrop-blur-md border-t border-[var(--card-border)] px-3 py-1.5 flex items-center justify-around shadow-dropdown"
        >
          {MOBILE_TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigateTo(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                  active
                    ? 'text-[var(--color-primary-700)] font-semibold'
                    : 'text-[var(--app-fg-subtle)] hover:text-[var(--app-fg)]'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
                <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
                {active && (
                  <span
                    className="absolute -bottom-1 w-5 h-1 rounded-full bg-[var(--color-primary-600)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <ToastContainer />
    </div>
  );
}
