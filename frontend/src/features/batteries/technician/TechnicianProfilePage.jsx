import { useState } from 'react';
import SuccessPopup from './SuccessPopup';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../services/api-client';
import { logout, setUser, setToken } from '../../auth/auth-slice';
import { canTestBatteries } from '../../../utils/permissions';
import {
  FiUser,
  FiShield,
  FiLock,
  FiKey,
  FiLogOut,
} from 'react-icons/fi';

function TechnicianProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function closePasswordForm() {
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setSuccess(false);
    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', { currentPassword, newPassword });
      if (data.token) dispatch(setToken(data.token));
      dispatch(setUser(data.user));
      setCurrentPassword('');
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
      ? 'Field Technician'
      : user?.role === 'supervisor'
        ? 'Workshop Supervisor'
        : user?.role
          ? user.role.replace(/_/g, ' ')
          : 'Staff Member';

  const userInitials = (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div className="mx-auto max-w-xl pb-20">
      <SuccessPopup
        open={success}
        title="Password Updated"
        message="Your new password is saved. Use it the next time you sign in."
        onClose={() => setSuccess(false)}
      />

      {/* ── Hero Identity Banner ── */}
      <div className="mb-3.5 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex items-center gap-3.5 sm:gap-4">
          {/* Avatar Initials Badge */}
          <div className="flex h-13 w-13 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-2xs dark:border-blue-800/40 dark:from-blue-950/60 dark:to-indigo-950/40">
            <span className="text-base sm:text-lg font-black tracking-wider text-blue-700 dark:text-blue-300">
              {userInitials || 'U'}
            </span>
          </div>

          {/* User Details */}
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
              {user?.name || 'Staff User'}
            </h1>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/60 dark:text-blue-300">
                {roleLabel}
              </span>

              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Shift
              </span>
            </div>

            {user?.email && (
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 truncate">
                {user.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Account Credentials Card ── */}
      <div className="mb-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
              <FiUser className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
              Account Credentials
            </h2>
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <FiShield className="h-3.5 w-3.5" />
            <span>Verified Staff</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-2.5 dark:border-white/5">
            <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Staff Member</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{user?.name || '—'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100/80 pb-2.5 dark:border-white/5">
            <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Account Email</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">{user?.email || '—'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100/80 pb-2.5 dark:border-white/5">
            <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Role Authority</span>
            <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">{roleLabel}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100/80 pb-2.5 dark:border-white/5">
            <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Testing QA Sign-off</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${canTest ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className={`text-xs font-bold ${canTest ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {canTest ? 'Authorized (Supervisor)' : 'Supervisors Only'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">Session Security</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-300">
              <FiLock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>256-Bit SSL</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Security & Password Card ── */}
      <div className="mb-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        {showPasswordForm ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <FiKey className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                  Update Password
                </span>
              </div>
              <button
                type="button"
                onClick={closePasswordForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
                New Password (min 8 characters)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                required
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                required
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-surface-950 dark:text-white"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex h-10 w-full items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Updating…' : 'Save New Password'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className="flex w-full items-center justify-between text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300">
                <FiKey className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Change Account Password
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">
                  Update your authentication credentials
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:border-white/10 dark:bg-surface-800 dark:text-blue-400">
              Modify ›
            </div>
          </button>
        )}
      </div>

      {/* ── Sign Out Button ── */}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3 sm:py-3.5 text-xs font-bold text-red-600 shadow-2xs hover:bg-red-100 active:bg-red-200 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
      >
        <FiLogOut className="h-4 w-4" />
        <span>Sign Out of Account</span>
      </button>

      {/* ── Footer Meta ── */}
      <div className="mt-5 text-center">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500">
          Refurbnics System • Enterprise Service Suite
        </p>
      </div>
    </div>
  );
}

export default TechnicianProfilePage;
