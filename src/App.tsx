import {
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Scale,
  ScanBarcode,
  Settings,
  ShoppingBag,
  Sparkles,
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
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'main' },
  { id: 'scan', label: 'Scan Product', icon: ScanBarcode, group: 'identify' },
  { id: 'ocr', label: 'OCR Label Scanner', icon: FileSearch, group: 'identify' },
  { id: 'manual', label: 'Manual Food Entry', icon: Utensils, group: 'identify' },
  { id: 'family', label: 'Family Profiles', icon: Users, group: 'household' },
  { id: 'analysis', label: 'Food Analysis', icon: ClipboardCheck, group: 'intelligence' },
  { id: 'alternatives', label: 'Alternatives', icon: Sparkles, group: 'intelligence' },
  { id: 'compare', label: 'Product Comparison', icon: Scale, group: 'intelligence' },
  { id: 'purchases', label: 'Purchase History', icon: ShoppingBag, group: 'household' },
  { id: 'budget', label: 'Budget Management', icon: Wallet, group: 'household' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'household' },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [section, setSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setWorkspaceError(null);
  };

  const renderNavGroup = (title: string, group: NavItem['group']) => {
    const items = NAV_ITEMS.filter((i) => i.group === group);
    return (
      <div className="space-y-0.5">
        {title && (
          <p className="px-3 pt-4 pb-1.5 text-[11px] font-medium text-[#5A6E62]">{title}</p>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#E9F5EC] text-[#14532D]'
                  : 'text-[#33463B] hover:bg-[#F2F6F3] hover:text-[#111C16]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#15803D]' : 'text-[#5A6E62]'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#111C16] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-[#E4EAE6] min-h-screen sticky top-0 h-screen">
        <div className="h-16 px-5 border-b border-[#E4EAE6] flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#15803D] flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#111C16] whitespace-nowrap">
            FamCare
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {renderNavGroup('', 'main')}
          {renderNavGroup('Product Identification', 'identify')}
          {renderNavGroup('Food Intelligence', 'intelligence')}
          {renderNavGroup('Household & Budget', 'household')}
        </nav>

        <div className="p-4 border-t border-[#E4EAE6] space-y-2.5 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#111C16] truncate">{user.name}</p>
            <p className="text-[11px] text-[#5A6E62] truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#4B5E53] hover:text-[#111C16] bg-[#F8FAF9] hover:bg-[#EDF2EE] border border-[#E4EAE6] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-[#E4EAE6]">
            <div className="h-14 px-4 border-b border-[#E4EAE6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[#15803D] flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <span className="font-display text-base font-bold text-[#111C16]">FamCare</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-[#4B5E53] hover:text-[#111C16]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {renderNavGroup('', 'main')}
              {renderNavGroup('Product Identification', 'identify')}
              {renderNavGroup('Food Intelligence', 'intelligence')}
              {renderNavGroup('Household & Budget', 'household')}
            </nav>
            <div className="p-4 border-t border-[#E4EAE6]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#4B5E53] bg-[#F8FAF9] border border-[#E4EAE6] rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Contextual Top Bar */}
        <header className="h-16 bg-white border-b border-[#E4EAE6] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#4B5E53] hover:text-[#111C16] rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#5A6E62] hidden sm:inline whitespace-nowrap">
                {activeFamily?.name || 'Household'}
              </span>
              <span className="text-[#CBD8D0] hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-[#111C16] truncate">
                {currentNav.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="active-member-select"
                className="hidden md:inline text-xs text-[#5A6E62] whitespace-nowrap"
              >
                Screening:
              </label>
              <select
                id="active-member-select"
                value={selectedMemberId || ''}
                onChange={(e) => setSelectedMemberId(e.target.value || null)}
                className="px-3 py-1.5 text-xs font-medium bg-[#F8FAF9] border border-[#D4DFD8] rounded-lg text-[#111C16] max-w-[165px] truncate focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
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

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1320px] w-full mx-auto">
          {workspaceError && (
            <div className="mb-6 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-center justify-between">
              <span>{workspaceError}</span>
              <button
                type="button"
                onClick={() => setWorkspaceError(null)}
                className="text-[#991B1B] hover:underline ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {loadingWorkspace && families.length === 0 ? (
            <div className="space-y-4">
              <div className="h-8 w-64 bg-[#E4EAE6]/70 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 bg-white border border-[#E4EAE6] rounded-xl animate-pulse" />
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
      </div>
    </div>
  );
}
