import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { register } from './auth-slice';
import loginImage from '../../assets/logpage.png';
import logo from '../../assets/REFURBNICS.png';

const inputClasses =
  'w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d5c3a] focus:outline-none focus:ring-2 focus:ring-[#0d5c3a]/20 transition';
const labelClasses = 'mb-1.5 block text-xs font-semibold text-slate-700 uppercase tracking-wider';
const iconClasses = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', icon: '👑', desc: 'Full platform access' },
  { value: 'client', label: 'Fleet Client', icon: '⚡', desc: 'Fleet portal & battery sorting' },
  { value: 'technician', label: 'Technician', icon: '🔧', desc: 'Repairs & intake testing' },
  { value: 'supervisor', label: 'Supervisor', icon: '🛡️', desc: 'QA inspection & workshop lead' },
];

function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('super_admin');
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error } = useSelector((state) => state.auth);
  const [created, setCreated] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setCreated(null);
    setClientError(null);

    if (password.length < 8) {
      setClientError('Password must be at least 8 characters long.');
      return;
    }

    const result = await dispatch(register({ name: name.trim(), email: email.trim().toLowerCase(), password: password.trim(), role }));
    if (register.fulfilled.match(result)) {
      if (result.payload?.token) {
        navigate('/');
      } else {
        setCreated(result.payload?.user?.email || email);
        setName('');
        setEmail('');
        setPassword('');
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left side banner image (desktop) */}
      <div className="relative hidden w-1/2 lg:block">
        <img src={loginImage} alt="" className="h-full w-full object-cover" />
      </div>

      {/* Form area */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <Link to="/login" className="inline-block mb-6">
            <img src={logo} alt="Refurbnics" className="h-10 w-auto object-contain" />
          </Link>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Create an Account</h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              Register new credentials to access the Refurbnics platform
            </p>
          </div>

          {created && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Account <b>{created}</b> created successfully!{' '}
              <Link to="/login" className="font-semibold underline">Click here to sign in</Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {/* Full Name */}
            <div>
              <label className={labelClasses}>Full Name</label>
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="currentColor" className={iconClasses}>
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
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
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
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
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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
              <p className="mt-1 text-[11px] text-slate-400">Must be at least 8 characters long</p>
            </div>

            {/* Role Selection */}
            <div>
              <label className={labelClasses}>Select Account Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const isSelected = role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-[#0d5c3a] bg-[#0d5c3a]/5 ring-1 ring-[#0d5c3a]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{r.icon}</span>
                        <span className="text-xs font-bold text-slate-900">{r.label}</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {clientError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold text-red-600">
                {clientError}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d5c3a] hover:bg-[#0a482e] active:bg-[#083a24] py-3 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
              {status === 'loading' ? 'Creating Account…' : 'Register Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-bold text-[#0d5c3a] hover:text-[#0a482e] hover:underline transition cursor-pointer"
            >
              Sign In
            </Link>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Refurbnics. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
