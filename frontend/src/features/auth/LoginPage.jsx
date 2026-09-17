import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { login } from './auth-slice';
import loginImage from '../../assets/logpage.png';
import logo from '../../assets/logo.png';
import DEMO_CREDENTIALS from '../../config/demo-credentials';

const inputClasses =
  'w-full rounded-md border border-surface-600 bg-black py-2.5 pl-10 pr-3.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-neutral-200';
const iconClasses = 'pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500';

function LoginPage() {
  const defaultEmail = import.meta.env.VITE_DEFAULT_LOGIN_EMAIL || DEMO_CREDENTIALS.superAdmin.email;
  const defaultPassword = import.meta.env.VITE_DEFAULT_LOGIN_PASSWORD || DEMO_CREDENTIALS.superAdmin.password;

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error } = useSelector((state) => state.auth);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      navigate('/');
    }
  }

  return (
    <div className="flex min-h-screen bg-black">
      <div className="relative hidden w-1/2 lg:block">
        <img src={loginImage} alt="" className="h-full w-full object-cover" />
      </div>

      <div className="flex w-full flex-col justify-center bg-surface-950 px-8 py-12 sm:px-14 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <img src={logo} alt="Refurbinics" className="mx-auto mb-8 h-24 w-auto" />

          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Welcome Back!</h1>
            <p className="mt-1 text-sm text-neutral-400">Sign in to continue</p>
          </div>

          {/* Demo quick-fill credentials from demo-credentials config */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium px-0.5">
              <span>Quick Fill Credentials:</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail(DEMO_CREDENTIALS.superAdmin.email);
                  setPassword(DEMO_CREDENTIALS.superAdmin.password);
                }}
                className="rounded-md border border-dashed border-neutral-600 bg-neutral-800/40 px-2 py-2 text-[11px] font-medium text-neutral-300 transition hover:bg-neutral-800/80 truncate cursor-pointer"
                title={`Super Admin: ${DEMO_CREDENTIALS.superAdmin.email}`}
              >
                👑 Super Admin
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail(DEMO_CREDENTIALS.client.email);
                  setPassword(DEMO_CREDENTIALS.client.password);
                }}
                className="rounded-md border border-dashed border-emerald-500/50 bg-emerald-500/10 px-2 py-2 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-500/20 truncate cursor-pointer"
                title={`Client: ${DEMO_CREDENTIALS.client.email}`}
              >
                ⚡ HumanForest
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail(DEMO_CREDENTIALS.recycle.email);
                  setPassword(DEMO_CREDENTIALS.recycle.password);
                }}
                className="rounded-md border border-dashed border-teal-500/50 bg-teal-500/10 px-2 py-2 text-[11px] font-medium text-teal-400 transition hover:bg-teal-500/20 truncate cursor-pointer"
                title={`Recycle: ${DEMO_CREDENTIALS.recycle.email}`}
              >
                ♻️ Recycle Client
              </button>
            </div>
          </div>

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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
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

            {error && <p className="text-sm text-red-400">{error}</p>}

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

          <p className="mt-6 text-center text-sm text-neutral-400">
            Need an account?{' '}
            <Link to="/register" className="font-medium text-emerald-400 hover:underline">
              Create one
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-neutral-500">
            © {new Date().getFullYear()} Refurbinics. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
