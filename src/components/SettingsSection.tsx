import { Database, KeyRound, Save, Trash2, UserCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, type AuthUser, type FamilyRecord, type HealthResponse } from '../services/api.ts';

interface SettingsSectionProps {
  user: AuthUser;
  families: FamilyRecord[];
  health: HealthResponse | null;
  onUserUpdated: (user: AuthUser) => void;
  onFamiliesChanged: () => Promise<void>;
}

export function SettingsSection({
  user,
  families,
  health,
  onUserUpdated,
  onFamiliesChanged,
}: SettingsSectionProps) {
  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency || 'USD');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);

  const [familyErr, setFamilyErr] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const { user: updated } = await api.updateProfile({ name: name.trim(), currency });
      onUserUpdated(updated);
      setProfileMsg('Profile preferences updated.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPassErr(null);
    setPassMsg(null);
    setPassSaving(true);
    try {
      const res = await api.updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPassMsg(res.message);
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setPassSaving(false);
    }
  };

  const handleRenameFamily = async (id: string) => {
    if (!renameText.trim()) return;
    setFamilyErr(null);
    try {
      await api.updateFamily(id, renameText.trim());
      setRenamingId(null);
      setRenameText('');
      await onFamiliesChanged();
    } catch (err) {
      setFamilyErr(err instanceof Error ? err.message : 'Unable to rename group.');
    }
  };

  const handleDeleteFamily = async (id: string) => {
    setFamilyErr(null);
    try {
      await api.deleteFamily(id);
      await onFamiliesChanged();
    } catch (err) {
      setFamilyErr(err instanceof Error ? err.message : 'Unable to delete group.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-xs font-medium text-[#4B5E53] mb-1">Account & Configuration</p>
        <h1 className="font-display text-2xl font-bold text-[#111C16]">Settings</h1>
        <p className="mt-1 text-sm text-[#4B5E53]">
          Manage your profile, currency display, security credentials, and family groups.
        </p>
      </div>

      {/* User Profile */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4"
      >
        <h2 className="font-display text-base font-semibold text-[#111C16] flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#15803D]" />
          <span>Profile Preferences</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full px-3.5 py-2 text-sm bg-[#F8FAF9] text-[#5A6E62] border border-[#E4EAE6] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">Budget Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D4DFD8] rounded-lg bg-white"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>
        </div>

        {profileErr && <p className="text-xs text-[#B91C1C]">{profileErr}</p>}
        {profileMsg && <p className="text-xs text-[#166534]">{profileMsg}</p>}

        <button
          type="submit"
          disabled={profileSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-xs font-medium rounded-lg cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{profileSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </form>

      {/* Security / Password */}
      <form
        onSubmit={(e) => void handleChangePassword(e)}
        className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4"
      >
        <h2 className="font-display text-base font-semibold text-[#111C16] flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#15803D]" />
          <span>Update Password</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B5E53] mb-1">
              New Password (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-[#D4DFD8] rounded-lg"
            />
          </div>
        </div>

        {passErr && <p className="text-xs text-[#B91C1C]">{passErr}</p>}
        {passMsg && <p className="text-xs text-[#166534]">{passMsg}</p>}

        <button
          type="submit"
          disabled={passSaving}
          className="px-4 py-2 bg-[#111C16] hover:bg-[#1F2E26] disabled:opacity-60 text-white text-xs font-medium rounded-lg cursor-pointer"
        >
          {passSaving ? 'Updating...' : 'Change Password'}
        </button>
      </form>

      {/* Manage Family Groups */}
      <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-[#111C16]">Family Groups</h2>
        {familyErr && <p className="text-xs text-[#B91C1C]">{familyErr}</p>}
        <div className="divide-y divide-[#EDF2EE]">
          {families.map((fam) => (
            <div key={fam.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              {renamingId === fam.id ? (
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <input
                    type="text"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-[#D4DFD8] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRenameFamily(fam.id)}
                    className="px-3 py-1.5 bg-[#15803D] text-white text-xs font-medium rounded-lg cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="px-2 py-1.5 text-xs text-[#5A6E62] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium text-[#111C16]">{fam.name}</span>
              )}

              <div className="flex items-center gap-3">
                {renamingId !== fam.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(fam.id);
                      setRenameText(fam.name);
                    }}
                    className="text-xs font-medium text-[#15803D] hover:underline cursor-pointer"
                  >
                    Rename
                  </button>
                )}
                {families.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteFamily(fam.id)}
                    aria-label={`Delete family group ${fam.name}`}
                    className="text-[#5A6E62] hover:text-[#B91C1C] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Source & Architecture Info */}
      {health && (
        <div className="bg-white border border-[#E4EAE6] rounded-xl p-6 space-y-2.5 text-xs text-[#4B5E53]">
          <h2 className="font-display text-sm font-semibold text-[#111C16] flex items-center gap-2">
            <Database className="w-4 h-4 text-[#15803D]" />
            <span>Integration Architecture</span>
          </h2>
          <p>
            <span className="font-medium text-[#111C16]">External Food Data Source:</span>{' '}
            {health.externalFoodApi} (exclusive food API)
          </p>
          <p>
            <span className="font-medium text-[#111C16]">Database Storage:</span>{' '}
            {health.storageMode === 'mongodb' ? 'MongoDB via Mongoose' : 'Local Persistent Store (Mongoose ready)'} —{' '}
            {health.storageNotice}
          </p>
          <p>
            <span className="font-medium text-[#111C16]">Food Intelligence Agent:</span>{' '}
            {health.geminiConfigured
              ? 'Server-side Gemini function calling enabled with deterministic safety guardrails.'
              : 'Running in deterministic backend mode (add GEMINI_API_KEY in server secrets for Gemini tool orchestration).'}
          </p>
        </div>
      )}
    </div>
  );
}
