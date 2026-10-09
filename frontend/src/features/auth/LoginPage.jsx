import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import { login } from './auth-slice';
import loginImage from '../../assets/logpage.png';
import logo from '../../assets/REFURBNICS.png';
import SplashIntro from './SplashIntro';
import { DEMO_LOGIN_ENABLED, DEMO_CREDENTIALS, MOBILE_DEMO_CREDENTIALS } from '../../config/demo-credentials';

export default function LoginPage() {
  const defaultEmail = DEMO_LOGIN_ENABLED
    ? import.meta.env.VITE_DEFAULT_LOGIN_EMAIL || DEMO_CREDENTIALS.superAdmin.email
    : '';
  const defaultPassword = DEMO_LOGIN_ENABLED
    ? import.meta.env.VITE_DEFAULT_LOGIN_PASSWORD || DEMO_CREDENTIALS.superAdmin.password
    : '';

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error } = useSelector((state) => state.auth);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(login({ email: email.trim().toLowerCase(), password: password.trim() }));
    if (login.fulfilled.match(result)) {
      const role = result.payload?.user?.role;
      const isStaffRole = role === 'staff' || role === 'technician' || role === 'supervisor';
      if (isStaffRole) {
        finishSplash();
      } else {
        setShowSplash(true);
      }
    }
  }

  const finishSplash = useCallback(() => navigate('/'), [navigate]);

  return (
    <>
      {showSplash && <SplashIntro onDone={finishSplash} />}

      {/* =========================================================================
          DESKTOP VIEW (>= lg): Split-screen with left-side image & exact right card
          ========================================================================= */}
      <div className="hidden lg:flex min-h-screen bg-white">
        {/* Left Side: Brand Hero Image */}
        <div className="relative w-1/2">
          <img src={loginImage} alt="Refurbnics Battery" className="h-full w-full object-cover" />
        </div>

        {/* Right Side: Exact Reference Design */}
        <div className="flex w-1/2 flex-col justify-center bg-white px-8 py-10 sm:px-14 lg:px-16 overflow-y-auto selection:bg-[#0d5c3a]/20 selection:text-[#0d5c3a]">
          <div className="mx-auto w-full max-w-[400px]">
            {/* Top Logo */}
            <div className="flex justify-center mb-8">
              <img
                src={logo}
                alt="Refurbnics"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h1 className="text-3xl sm:text-[34px] font-bold text-[#111827] tracking-tight leading-tight">
                Welcome back.
              </h1>
              <p className="mt-1.5 text-base text-[#4b5563]">
                Sign in to your account.
              </p>
            </div>

            {/* Quick Access */}
            {DEMO_LOGIN_ENABLED && (
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm font-medium text-[#4b5563] mb-2.5">
                  Quick access
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.superAdmin.email);
                      setPassword(DEMO_CREDENTIALS.superAdmin.password);
                    }}
                    className={`w-full py-2.5 px-2 text-center text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                      email === DEMO_CREDENTIALS.superAdmin.email
                        ? 'bg-[#e6f4ea] border-[#0d5c3a] text-[#0d5c3a] font-semibold'
                        : 'bg-white border-[#d1d5db] text-[#374151] hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.client.email);
                      setPassword(DEMO_CREDENTIALS.client.password);
                    }}
                    className={`w-full py-2.5 px-2 text-center text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                      email === DEMO_CREDENTIALS.client.email
                        ? 'bg-[#e6f4ea] border-[#0d5c3a] text-[#0d5c3a] font-semibold'
                        : 'bg-white border-[#d1d5db] text-[#374151] hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    HumanForest
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.recycle.email);
                      setPassword(DEMO_CREDENTIALS.recycle.password);
                    }}
                    className={`w-full py-2.5 px-2 text-center text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                      email === DEMO_CREDENTIALS.recycle.email
                        ? 'bg-[#e6f4ea] border-[#0d5c3a] text-[#0d5c3a] font-semibold'
                        : 'bg-white border-[#d1d5db] text-[#374151] hover:bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    Recycle
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4b5563] mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#d1d5db] bg-white px-3.5 py-2.5 text-sm sm:text-base text-[#111827] placeholder:text-[#9ca3af] focus:border-[#0d5c3a] focus:outline-none focus:ring-1 focus:ring-[#0d5c3a] transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4b5563] mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#d1d5db] bg-white pl-3.5 pr-11 py-2.5 text-sm sm:text-base text-[#111827] placeholder:text-[#9ca3af] focus:border-[#0d5c3a] focus:outline-none focus:ring-1 focus:ring-[#0d5c3a] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#374151] transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-6 w-full rounded-xl bg-[#0d5c3a] py-3.5 text-center text-sm sm:text-base font-semibold text-white shadow-xs hover:bg-[#0a482e] active:bg-[#083a24] disabled:opacity-60 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {status === 'loading' && (
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                    />
                  </svg>
                )}
                {status === 'loading' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-[#4b5563]">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-bold text-[#0d5c3a] hover:text-[#0a482e] hover:underline transition"
              >
                Create an account
              </Link>
            </div>

            {/* Footer Copyright */}
            <p className="mt-10 sm:mt-12 text-center text-xs text-[#9ca3af]">
              © {new Date().getFullYear()} Refurbnics
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE VIEW (< lg): Retains original mobile layout with client/staff portal
          ========================================================================= */}
      <div className="flex lg:hidden min-h-screen bg-[#f8fafc] flex-col justify-between py-10 px-4 sm:px-6 relative selection:bg-emerald-500/20 selection:text-emerald-950">
        <div className="w-full max-w-[430px] mx-auto my-auto">
          {/* Brand Logo & Tagline */}
          <div className="flex flex-col items-center mb-6">
            <img
              src={logo}
              alt="Refurbnics"
              className="h-11 sm:h-12 w-auto object-contain"
            />
            <div className="flex items-center justify-center gap-3 mt-4 w-full max-w-[280px]">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[2.5px] text-slate-400">
                CLIENT &amp; STAFF PORTAL
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>

          {/* Main Login Card */}
          <div className="rounded-[32px] border border-slate-200/90 bg-white p-7 sm:p-9 shadow-sm">
            <h1 className="font-serif text-3xl sm:text-[34px] font-bold text-[#0c2e25] tracking-tight leading-tight">
              Welcome back.
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 mb-6">
              Sign in to access your workspace.
            </p>

            {/* Quick Access — dev / demo builds only (see config/demo-credentials.js) */}
            {DEMO_LOGIN_ENABLED && (
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-600 mb-2.5">
                Quick access
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Akhil Tech */}
                <button
                  type="button"
                  onClick={() => {
                    setEmail('akhil@gmail.com');
                    setPassword(MOBILE_DEMO_CREDENTIALS.akhil.password);
                  }}
                  className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
                    email === 'akhil@gmail.com'
                      ? 'border-[#0a4d3c] bg-[#f0f6f3] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a4d3c] text-xs font-bold text-white tracking-wider shadow-xs">
                    AT
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-[13px] font-bold text-slate-900 truncate">
                      Akhil Tech
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-slate-400">
                      Technician
                    </div>
                  </div>
                </button>

                {/* Akshay Sup */}
                <button
                  type="button"
                  onClick={() => {
                    setEmail('akshay@gmail.com');
                    setPassword(MOBILE_DEMO_CREDENTIALS.akshay.password);
                  }}
                  className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer ${
                    email === 'akshay@gmail.com'
                      ? 'border-[#4a6b5e] bg-[#f2f6f4] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#52796f] text-xs font-bold text-white tracking-wider shadow-xs">
                    AS
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-[13px] font-bold text-slate-900 truncate">
                      Akshay Sup
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-slate-400">
                      Supervisor
                    </div>
                  </div>
                </button>
              </div>

              {/* Other Quick Access Logins */}
              {DEMO_LOGIN_ENABLED && (
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.superAdmin.email);
                      setPassword(DEMO_CREDENTIALS.superAdmin.password);
                    }}
                    className={`text-[11px] font-semibold transition px-2 py-0.5 rounded-md cursor-pointer ${
                      email === DEMO_CREDENTIALS.superAdmin.email
                        ? 'text-indigo-700 bg-indigo-50 font-bold'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Super Admin"
                  >
                    👑 Admin
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.client.email);
                      setPassword(DEMO_CREDENTIALS.client.password);
                    }}
                    className={`text-[11px] font-semibold transition px-2 py-0.5 rounded-md cursor-pointer ${
                      email === DEMO_CREDENTIALS.client.email
                        ? 'text-emerald-700 bg-emerald-50 font-bold'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Client: HumanForest"
                  >
                    ⚡ HumanForest
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.recycle.email);
                      setPassword(DEMO_CREDENTIALS.recycle.password);
                    }}
                    className={`text-[11px] font-semibold transition px-2 py-0.5 rounded-md cursor-pointer ${
                      email === DEMO_CREDENTIALS.recycle.email
                        ? 'text-teal-700 bg-teal-50 font-bold'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Recycle Client"
                  >
                    ♻️ Recycle
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Credentials form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] py-3 pl-10 pr-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-[#0a4d3c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a4d3c]/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-200 bg-[#f8fafc] py-3 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition focus:border-[#0a4d3c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0a4d3c]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0a4d3c] hover:bg-[#073b2e] py-3.5 px-4 text-sm font-bold text-white shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
              >
                {status === 'loading' ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <FiArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              <div className="pt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400">
                <FiLock className="h-3 w-3" />
                <span>Client &amp; staff access</span>
              </div>

              <div className="mt-4 text-center text-xs text-slate-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-bold text-[#0a4d3c] hover:underline"
                >
                  Create an account
                </Link>
              </div>
            </form>
          </div>

          {/* Bottom area */}
          <div className="mt-8 text-center">
            <div className="h-px w-28 bg-slate-200 mx-auto mb-5" />
            <div className="font-serif text-base font-semibold text-slate-800 tracking-tight">
              Battery Intelligence
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[3px] text-slate-400 mt-0.5">
              FLEET MANAGEMENT
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
