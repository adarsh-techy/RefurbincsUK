import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
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
  // Pre-filled only when demo logins are enabled (see config/demo-credentials.js)
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
    const result = await dispatch(login({ email, password }));
    // Successful login plays the Eswincha intro screen first; it navigates
    // into the app once the animation finishes (see finishSplash).
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
    <div className="flex min-h-screen bg-white">
      {showSplash && <SplashIntro onDone={finishSplash} />}
      <div className="relative hidden w-1/2 lg:block">
        <img src={loginImage} alt="" className="h-full w-full object-cover" />
      </div>

      <div className="flex w-full flex-col justify-center bg-white px-8 py-12 sm:px-14 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <img src={logo} alt="Refurbnics" className="mx-auto mb-8 h-auto w-full max-w-xs" />

          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Welcome Back!</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
          </div>

          {/* Simple Quick Fill Buttons */}
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
  );
}

export default LoginPage;
