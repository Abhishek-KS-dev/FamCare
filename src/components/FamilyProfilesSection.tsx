import { Check, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, type FamilyMemberRecord, type FamilyRecord } from '../services/api.ts';

interface FamilyProfilesSectionProps {
  families: FamilyRecord[];
  activeFamilyId: string;
  members: FamilyMemberRecord[];
  selectedMemberId: string | null;
  onSelectFamily: (id: string) => void;
  onSelectMember: (id: string | null) => void;
  onDataChanged: () => Promise<void>;
}

const COMMON_ALLERGIES = ['Peanut', 'Tree Nuts', 'Milk', 'Egg', 'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame'];
const COMMON_RESTRICTIONS = ['Vegetarian', 'Vegan', 'Lactose Intolerance', 'Gluten Restriction', 'Dairy-Free', 'Halal', 'Kosher'];
const COMMON_PREFERENCES = ['Low-Sugar', 'Low-Sodium', 'Low-Fat', 'Low-Calorie', 'High-Protein', 'High-Fiber'];

function parseCommaList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggleListItem(currentText: string, item: string): string {
  const list = parseCommaList(currentText);
  const exists = list.some((x) => x.toLowerCase() === item.toLowerCase());
  const next = exists
    ? list.filter((x) => x.toLowerCase() !== item.toLowerCase())
    : [...list, item];
  return next.join(', ');
}

export function FamilyProfilesSection({
  families,
  activeFamilyId,
  members,
  selectedMemberId,
  onSelectFamily,
  onSelectMember,
  onDataChanged,
}: FamilyProfilesSectionProps) {
  const [newFamilyName, setNewFamilyName] = useState('');
  const [creatingFamily, setCreatingFamily] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [allergies, setAllergies] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [foodsToAvoid, setFoodsToAvoid] = useState('');
  const [nutritionalPreferences, setNutritionalPreferences] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAge('');
    setAllergies('');
    setDietaryRestrictions('');
    setFoodsToAvoid('');
    setNutritionalPreferences('');
  };

  const startEdit = (m: FamilyMemberRecord) => {
    setEditingId(m.id);
    setName(m.name);
    setAge(m.age !== null ? String(m.age) : '');
    setAllergies(m.allergies.join(', '));
    setDietaryRestrictions(m.dietaryRestrictions.join(', '));
    setFoodsToAvoid(m.foodsToAvoid.join(', '));
    setNutritionalPreferences(m.nutritionalPreferences.join(', '));
    setError(null);
    setNotice(null);
  };

  const handleCreateFamily = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    setError(null);
    setCreatingFamily(true);
    try {
      const { family } = await api.createFamily(newFamilyName.trim());
      setNewFamilyName('');
      await onDataChanged();
      onSelectFamily(family.id);
      setNotice(`Created family group "${family.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create family group.');
    } finally {
      setCreatingFamily(false);
    }
  };

  const handleSaveMember = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError('Member name is required.');
      return;
    }

    const parsedAge = age.trim() ? Number(age.trim()) : null;
    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 130)) {
      setError('Age must be between 0 and 130.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        age: parsedAge,
        allergies: parseCommaList(allergies),
        dietaryRestrictions: parseCommaList(dietaryRestrictions),
        foodsToAvoid: parseCommaList(foodsToAvoid),
        nutritionalPreferences: parseCommaList(nutritionalPreferences),
      };

      if (editingId) {
        await api.updateMember(editingId, payload);
        setNotice(`Updated profile for ${payload.name}.`);
      } else {
        const { member } = await api.createMember({ familyId: activeFamilyId, ...payload });
        if (!selectedMemberId) onSelectMember(member.id);
        setNotice(`Added family member ${member.name}.`);
      }

      resetForm();
      await onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save family member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (member: FamilyMemberRecord) => {
    setError(null);
    try {
      await api.deleteMember(member.id);
      if (selectedMemberId === member.id) {
        onSelectMember(null);
      }
      if (editingId === member.id) resetForm();
      await onDataChanged();
      setNotice(`Removed ${member.name} from family profiles.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">
          Family Management · Privacy-Protected Profiles
        </p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">Family Health Profiles</h1>
        <p className="mt-1 text-sm text-[#4B5E53] max-w-2xl">
          Create household groups and maintain independent dietary profiles. Select any member to automatically screen scanned products against their allergies and preferences.
        </p>
      </div>

      {/* Privacy Guarantee Notice */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-4 flex items-start gap-3 text-xs text-[#4B5E53]">
        <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold text-[#111C16]">Privacy & Safety Architecture:</span> FamCare never requests medical reports or sensitive clinical records. Family profiles are restricted to your authenticated account, evaluated strictly via deterministic backend rules, and never sent directly to external AI services.
        </p>
      </div>

      {/* Family Group Selector & Creation */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#5A6E62] mr-1">Family Group:</span>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F6F3] rounded-lg">
            {families.map((fam) => (
              <button
                key={fam.id}
                type="button"
                onClick={() => onSelectFamily(fam.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  fam.id === activeFamilyId
                    ? 'bg-white text-[#111C16] shadow-xs'
                    : 'text-[#4B5E53] hover:text-[#111C16]'
                }`}
              >
                {fam.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => void handleCreateFamily(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            placeholder="New family group name"
            className="px-3 py-1.5 text-xs border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
          />
          <button
            type="submit"
            disabled={creatingFamily || !newFamilyName.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111C16] hover:bg-[#1F2E26] disabled:opacity-50 text-white text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Group</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#166534]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Existing Family Members List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#111C16]">
              Members ({members.length})
            </h2>
            {selectedMemberId && (
              <button
                type="button"
                onClick={() => onSelectMember(null)}
                className="text-xs text-[#5A6E62] hover:text-[#111C16] cursor-pointer"
              >
                Clear Active Selection
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="bg-white border border-[#E4EAE6] rounded-xl p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-[#5A6E62] mx-auto" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[#111C16]">No family members in this group yet</p>
              <p className="text-xs text-[#5A6E62]">
                Use the form on the right to add your first member profile (e.g., with Peanut allergy or Lactose intolerance).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => {
                const isSelected = m.id === selectedMemberId;
                return (
                  <div
                    key={m.id}
                    className={`bg-white rounded-xl p-5 border transition-colors ${
                      isSelected ? 'border-[#15803D] ring-1 ring-[#15803D]/20' : 'border-[#E4EAE6]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-[#111C16]">
                          {m.name}
                          {m.age !== null && (
                            <span className="font-normal text-sm text-[#5A6E62]"> · Age {m.age}</span>
                          )}
                        </h3>
                        <p className="text-xs text-[#5A6E62] mt-0.5">
                          {isSelected ? 'Active for product compatibility checks' : 'Available for selection'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectMember(isSelected ? null : m.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                            isSelected
                              ? 'bg-[#15803D] text-white'
                              : 'bg-[#F2F6F3] text-[#111C16] hover:bg-[#E4EAE6]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{isSelected ? 'Selected' : 'Select for Analysis'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          aria-label={`Edit ${m.name}`}
                          className="p-1.5 text-[#4B5E53] hover:text-[#111C16] hover:bg-[#F2F6F3] rounded-md cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteMember(m)}
                          aria-label={`Delete ${m.name}`}
                          className="p-1.5 text-[#4B5E53] hover:text-[#B91C1C] hover:bg-[#FEF2F2] rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-[#EDF2EE] text-xs">
                      <div>
                        <span className="font-medium text-[#111C16]">Food Allergies: </span>
                        <span className={m.allergies.length > 0 ? 'text-[#B91C1C] font-medium' : 'text-[#5A6E62]'}>
                          {m.allergies.length > 0 ? m.allergies.join(', ') : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-[#111C16]">Dietary Restrictions: </span>
                        <span className="text-[#4B5E53]">
                          {m.dietaryRestrictions.length > 0 ? m.dietaryRestrictions.join(', ') : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-[#111C16]">Foods to Avoid: </span>
                        <span className="text-[#4B5E53]">
                          {m.foodsToAvoid.length > 0 ? m.foodsToAvoid.join(', ') : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-[#111C16]">Nutritional Preferences: </span>
                        <span className="text-[#4B5E53]">
                          {m.nutritionalPreferences.length > 0 ? m.nutritionalPreferences.join(', ') : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add / Edit Member Form */}
        <form
          onSubmit={(e) => void handleSaveMember(e)}
          className="lg:col-span-5 bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#111C16]">
              {editingId ? 'Edit Family Member' : 'Add Family Member'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs text-[#5A6E62] hover:text-[#111C16] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya"
                className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5E53] mb-1">Age (Opt.)</label>
              <input
                type="number"
                min="0"
                max="130"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 9"
                className="w-full px-3 py-2 font-mono tabular-nums text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              Food Allergies (comma-separated)
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Peanut, Milk"
              className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_ALLERGIES.map((a) => {
                const active = parseCommaList(allergies).some((x) => x.toLowerCase() === a.toLowerCase());
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAllergies(toggleListItem(allergies, a))}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                        : 'bg-[#F8FAF9] border-[#E4EAE6] text-[#4B5E53] hover:border-[#15803D]'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dietary Restrictions */}
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              Dietary Restrictions (comma-separated)
            </label>
            <input
              type="text"
              value={dietaryRestrictions}
              onChange={(e) => setDietaryRestrictions(e.target.value)}
              placeholder="e.g. Vegetarian, Gluten Restriction"
              className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_RESTRICTIONS.map((r) => {
                const active = parseCommaList(dietaryRestrictions).some(
                  (x) => x.toLowerCase() === r.toLowerCase()
                );
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDietaryRestrictions(toggleListItem(dietaryRestrictions, r))}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
                        : 'bg-[#F8FAF9] border-[#E4EAE6] text-[#4B5E53] hover:border-[#15803D]'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Foods to Avoid */}
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              Specific Foods / Ingredients to Avoid
            </label>
            <input
              type="text"
              value={foodsToAvoid}
              onChange={(e) => setFoodsToAvoid(e.target.value)}
              placeholder="e.g. Palm oil, Caffeine, Aspartame"
              className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
          </div>

          {/* Nutritional Preferences */}
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              Nutritional Preferences (Optional)
            </label>
            <input
              type="text"
              value={nutritionalPreferences}
              onChange={(e) => setNutritionalPreferences(e.target.value)}
              placeholder="e.g. Low-Sugar, Low-Sodium"
              className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_PREFERENCES.map((p) => {
                const active = parseCommaList(nutritionalPreferences).some(
                  (x) => x.toLowerCase() === p.toLowerCase()
                );
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNutritionalPreferences(toggleListItem(nutritionalPreferences, p))}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
                        : 'bg-[#F8FAF9] border-[#E4EAE6] text-[#4B5E53] hover:border-[#15803D]'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{saving ? 'Saving...' : editingId ? 'Save Profile Changes' : 'Add Family Member'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
