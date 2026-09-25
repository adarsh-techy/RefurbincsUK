import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import { logout, setUser } from '../../auth/auth-slice';
import { canTestBatteries } from '../../../utils/permissions';

function TechnicianProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function closePasswordForm() {
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', { newPassword });
      dispatch(setUser(data.user));
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    dispatch(logout());
    navigate('/login', { replace: true });
  }

  const canTest = canTestBatteries(user);

  const roleLabel = user?.staff_role
    ? user.staff_role.charAt(0).toUpperCase() + user.staff_role.slice(1)
    : user?.role === 'technician'
      ? 'Technician'
      : user?.role
        ? user.role.replace('_', ' ')
        : 'Staff';

  return (
    <div className="mx-auto max-w-xl pb-16">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Account Profile</h1>
      <p className="mb-6 text-xs text-slate-500 dark:text-neutral-400">
        Manage your portal credentials and security settings.
      </p>

      {/* Account Info Card */}
      <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-900">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
          Account Details
        </h2>

        <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Name / Staff Member</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</span>
        </div>

        <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Account Type</span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold capitalize text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-400">
            {roleLabel}
          </span>
        </div>

        <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Testing Access</span>
          <span
            className={`text-xs font-bold ${
              canTest ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {canTest ? 'Authorized' : 'Supervisors only'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Email Address</span>
          <span className="text-sm font-medium text-slate-600 dark:text-neutral-300">{user?.email}</span>
        </div>
      </div>

      {/* Password Change Card */}
      <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-900">
        {showPasswordForm ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300">
                Change Password
              </span>
              <button
                type="button"
                onClick={closePasswordForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-neutral-400">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-neutral-400">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                required
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
              />
            </div>

            {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
            {success && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Password updated successfully.</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Change Account Password</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">Update your secure login passkey</p>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Edit ›</span>
          </button>
        )}
      </div>

      {/* Logout Button */}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 py-4 text-sm font-bold text-red-600 shadow-xs hover:bg-red-100 active:bg-red-200 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors tracking-wide"
      >
        Sign Out of Account
      </button>
    </div>
  );
}

export default TechnicianProfilePage;
