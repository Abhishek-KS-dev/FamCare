import { Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { api, type FamilyMemberRecord, type PurchaseRecord } from '../services/api.ts';
import { formatCurrency, formatDateShort, formatSourceLabel } from '../utils/format.ts';

interface PurchaseHistorySectionProps {
  activeFamilyId: string;
  members: FamilyMemberRecord[];
  purchases: PurchaseRecord[];
  currency: string;
  onDataChanged: () => Promise<void>;
}

export function PurchaseHistorySection({
  activeFamilyId,
  members,
  purchases,
  currency,
  onDataChanged,
}: PurchaseHistorySectionProps) {
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // New purchase form fields
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => {
      if (memberFilter === 'household' && p.familyMemberId !== null) return false;
      if (memberFilter !== 'all' && memberFilter !== 'household' && p.familyMemberId !== memberFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.productName.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [purchases, search, memberFilter]);

  const filteredTotal = useMemo(
    () => Math.round(filtered.reduce((acc, p) => acc + p.totalPrice, 0) * 100) / 100,
    [filtered]
  );

  const handleAddPurchase = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!productName.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      setError('Please enter a product name, quantity > 0, and valid unit price.');
      return;
    }

    setSaving(true);
    try {
      await api.createPurchase({
        familyId: activeFamilyId,
        familyMemberId: familyMemberId || null,
        productName: productName.trim(),
        brand: brand.trim() || null,
        category: category.trim() || 'Uncategorized',
        source: 'manual_entry',
        quantity: qty,
        unitPrice: price,
        purchasedAt: purchasedAt ? new Date(`${purchasedAt}T12:00:00`).toISOString() : undefined,
      });
      setProductName('');
      setBrand('');
      setUnitPrice('');
      setQuantity('1');
      setShowAddForm(false);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePurchase(id);
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete purchase record.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#4B5E53] mb-1">Household Food Ledger</p>
          <h1 className="font-display text-2xl font-bold text-[#111C16]">Purchase History</h1>
          <p className="mt-1 text-sm text-[#4B5E53]">
            Review saved food purchases, quantities, and unit costs linked to your monthly household budget.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Close Form' : 'Record Purchase'}</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={(e) => void handleAddPurchase(e)}
          className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#111C16]">
            Log Food Purchase
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Organic Oats"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Brand (Optional)</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Quaker"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Grains, Snacks, Produce"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Family Member</label>
              <select
                value={familyMemberId}
                onChange={(e) => setFamilyMemberId(e.target.value)}
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
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Quantity *</label>
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
                Unit Price ({currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="w-full px-3 py-2 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 px-4 bg-[#111C16] hover:bg-[#1F2E26] disabled:opacity-50 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
          {error}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E4EAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-[#5A6E62] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by product, brand, or category..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>

            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-[#D4DFD8] rounded-lg bg-white text-[#111C16]"
            >
              <option value="all">All Members</option>
              <option value="household">Shared Household</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-[#4B5E53] font-mono tabular-nums whitespace-nowrap">
            {filtered.length} record(s) · Total {formatCurrency(filteredTotal, currency)}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <ShoppingBag className="w-8 h-8 text-[#5A6E62] mx-auto" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#111C16]">No matching purchase records</p>
            <p className="text-xs text-[#5A6E62]">
              Save scanned products from the Food Analysis report or click "Record Purchase" above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4EAE6] bg-[#F8FAF9] text-xs font-medium text-[#5A6E62]">
                  <th className="py-2.5 px-5">Product</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4">Source</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Date</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EE] text-sm">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAF9]">
                    <td className="py-3 px-5">
                      <p className="font-medium text-[#111C16]">{p.productName}</p>
                      {(p.brand || p.barcode) && (
                        <p className="text-xs text-[#5A6E62]">
                          {p.brand || 'No brand'}
                          {p.barcode ? ` · ${p.barcode}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#4B5E53]">{p.category}</td>
                    <td className="py-3 px-4 text-xs text-[#4B5E53]">
                      {p.familyMemberName || 'Household'}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#5A6E62]">
                      {formatSourceLabel(p.source)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-[#4B5E53]">
                      {p.quantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-[#4B5E53]">
                      {formatCurrency(p.unitPrice, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-sm font-semibold text-[#111C16]">
                      {formatCurrency(p.totalPrice, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-[#5A6E62]">
                      {formatDateShort(p.purchasedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(p.id)}
                        aria-label={`Delete purchase ${p.productName}`}
                        className="p-1.5 text-[#5A6E62] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
