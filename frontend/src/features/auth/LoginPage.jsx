import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from 'react-icons/fi';
import { login } from './auth-slice';
import loginImage from '../../assets/logpage.png';
import logo from '../../assets/REFURBNICS.png';
import SplashIntro from './SplashIntro';
import { DEMO_LOGIN_ENABLED, DEMO_CREDENTIALS, MOBILE_DEMO_CREDENTIALS } from '../../config/demo-credentials';

const inputClasses =
  'w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700';
const iconClasses = 'pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400';

function LoginPage() {
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
          DESKTOP VIEW (>= lg): Reverted to original split-screen layout with battery hero image
          ========================================================================= */}
      <div className="hidden lg:flex min-h-screen bg-white">
        <div className="relative w-1/2">
          <img src={loginImage} alt="Refurbnics Battery" className="h-full w-full object-cover" />
        </div>

        <div className="flex w-1/2 flex-col justify-center bg-white px-8 py-12 sm:px-14">
          <div className="mx-auto w-full max-w-sm">
            <img src={logo} alt="Refurbnics" className="mx-auto mb-8 h-auto w-full max-w-xs" />

            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900">Welcome Back!</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
            </div>

            {/* Quick Fill Buttons on Desktop */}
            {DEMO_LOGIN_ENABLED && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Quick Fill:</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.superAdmin.email);
                      setPassword(DEMO_CREDENTIALS.superAdmin.password);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-1 text-xs font-semibold transition cursor-pointer ${
                      email === DEMO_CREDENTIALS.superAdmin.email
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                    title="Super Admin: superadmin@gmail.com"
                  >
                    <span>👑</span>
                    <span className="truncate">Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.client.email);
                      setPassword(DEMO_CREDENTIALS.client.password);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-1 text-xs font-semibold transition cursor-pointer ${
                      email === DEMO_CREDENTIALS.client.email
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300'
                    }`}
                    title="HumanForest: humanforest@gmail.com"
                  >
                    <span>⚡</span>
                    <span className="truncate">HumanForest</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_CREDENTIALS.recycle.email);
                      setPassword(DEMO_CREDENTIALS.recycle.password);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-1 text-xs font-semibold transition cursor-pointer ${
                      email === DEMO_CREDENTIALS.recycle.email
                        ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:border-teal-300'
                    }`}
                    title="Recycle Client: recycle@gmail.com"
                  >
                    <span>♻️</span>
                    <span className="truncate">Recycle</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label className={labelClasses}>Email Address</label>
                <div className="relative">
                  <svg viewBox="0 0 20 20" fill="currentColor" className={iconClasses}>
                    <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                    <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                  </svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClasses}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>Password</label>
                <div className="relative">
                  <svg viewBox="0 0 20 20" fill="currentColor" className={iconClasses}>
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClasses} pr-10`}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" />
                        <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path
                          fillRule="evenodd"
                          d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#61b928] to-[#46a127] py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:from-[#6cc531] hover:to-[#4dae2c] disabled:cursor-not-allowed disabled:opacity-50"
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
                {status === 'loading' ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-slate-600">
              Need a Super Admin account?{' '}
              <Link
                to="/register"
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition cursor-pointer"
              >
                Create Super Admin
              </Link>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} Refurbinics. All rights reserved.
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Developed by{' '}
              <span className="font-bold text-blue-600">Eswincha</span>{' '}
              <span className="font-bold text-red-600">Technologies</span>
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE VIEW (< lg): Retains the modern centered card design requested by user
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

            {/* Quick Access */}
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
                    setPassword('12345678');
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
                    setPassword('12345678');
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
                    placeholder="akhil@gmail.com"
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

export default LoginPage;
