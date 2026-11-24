import { ArrowRight, Leaf, Lock, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, setAuthToken, type AuthUser } from '../services/api.ts';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

const AUTH_BOTANICAL_IMAGE = '/src/assets/images/nutritrack_auth_botanical_1795438448517.jpg';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.register({
          name: name.trim(),
          email: email.trim(),
          password,
          familyName: familyName.trim() || undefined,
          currency,
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await api.login({ email: email.trim(), password });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col lg:flex-row">
      {/* Left Editorial Photography Column */}
      <div className="relative lg:w-[46%] xl:w-[48%] min-h-[260px] lg:min-h-screen bg-[#14291E] overflow-hidden flex flex-col justify-between p-8 lg:p-12">
        {!imgFailed && (
          <img
            src={AUTH_BOTANICAL_IMAGE}
            alt="Fresh whole oats, herbs, sliced green apple, and walnuts on pale stone"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1E15]/95 via-[#0D1E15]/60 to-[#0D1E15]/40" />

        <div className="relative z-10 flex items-center gap-2.5 text-white">
          <div className="w-9 h-9 rounded-lg bg-[#15803D] flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">FamCare</span>
        </div>

        <div className="relative z-10 max-w-md space-y-6 mt-12 lg:mt-0">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-white leading-tight [text-wrap:balance]">
            Transparent food analysis for every member of your household.
          </h1>
          <p className="text-sm lg:text-base text-[#D7E4DC] leading-relaxed">
            Scan packaged barcodes via Open Food Facts, verify ingredient labels with OCR, screen family allergies deterministically, and track monthly grocery spending in one workspace.
          </p>

          <div className="pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#D7E4DC]">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
              <span>Deterministic backend allergy checks—private family profiles are never sent to external AI.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
              <span>Verified Open Food Facts data only—missing nutrients and ingredients are always flagged.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white border border-[#E4EAE6] rounded-xl p-8">
          <div className="flex items-center gap-1 p-1 bg-[#F2F6F3] rounded-lg mb-7">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-[#111C16] shadow-xs'
                  : 'text-[#4B5E53] hover:text-[#111C16]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-[#111C16] shadow-xs'
                  : 'text-[#4B5E53] hover:text-[#111C16]'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="font-display text-2xl font-bold text-[#111C16] mb-1.5">
            {mode === 'login' ? 'Welcome back' : 'Set up your household'}
          </h2>
          <p className="text-sm text-[#4B5E53] mb-6">
            {mode === 'login'
              ? 'Sign in to access your family profiles, food analyses, and budget records.'
              : 'Create a FamCare account to manage family dietary profiles and grocery budgets.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium text-[#111C16] mb-1.5">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-[#111C16] mb-1.5">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-[#111C16] mb-1.5">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
              />
            </div>

            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="auth-family" className="block text-sm font-medium text-[#111C16] mb-1.5">
                    Family Group Name
                  </label>
                  <input
                    id="auth-family"
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="Rivera Household"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
                  />
                </div>
                <div>
                  <label htmlFor="auth-currency" className="block text-sm font-medium text-[#111C16] mb-1.5">
                    Currency
                  </label>
                  <select
                    id="auth-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-[#D4DFD8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]/25 focus:border-[#15803D]"
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
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Household Account'}
              </span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="mt-6 pt-5 border-t border-[#E4EAE6] text-xs text-[#5A6E62] leading-relaxed">
            No medical reports are required or stored. Family health profiles use manually entered allergies and dietary preferences protected by authenticated access control.
          </p>
        </div>
      </div>
    </div>
  );
}
