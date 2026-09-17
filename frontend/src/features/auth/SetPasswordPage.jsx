import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api-client';
import { setUser, logout } from './auth-slice';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// Forced first-login screen for accounts created with an admin-issued temp
// password (technician/client logins, see must_change_password). Blocks
// everything else until a real password is set — see ProtectedRoute.
function SetPasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', { newPassword });
      dispatch(setUser(data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 dark:from-surface-950 dark:to-surface-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">
            R
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Set Your Password</h1>
          <p className="text-center text-sm text-slate-500 dark:text-neutral-400">
            Welcome{user?.name ? `, ${user.name}` : ''} — choose a permanent password to replace
            your temporary one.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-7 shadow-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <div>
            <label className={labelClasses}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className={inputClasses}
              required
            />
          </div>

          <div>
            <label className={labelClasses}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              className={inputClasses}
              required
            />
          </div>

          {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {submitting ? 'Saving…' : 'Set Password'}
          </button>

          <button
            type="button"
            onClick={() => {
              dispatch(logout());
              navigate('/login', { replace: true });
            }}
            className="text-center text-sm font-medium text-slate-500 hover:underline dark:text-neutral-400"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetPasswordPage;
