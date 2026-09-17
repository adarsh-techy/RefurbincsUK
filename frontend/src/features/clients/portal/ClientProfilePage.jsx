import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import { setUser } from '../../auth/auth-slice';
import PageHeader from '../../../components/ui/primitives/PageHeader';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

function ClientProfilePage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function openPasswordForm() {
    setError(null);
    setSuccess(false);
    setShowPasswordForm(true);
  }

  function closePasswordForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setShowPasswordForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', { currentPassword, newPassword });
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

  return (
    <div>
      <PageHeader title="Profile" description="Your account details." />

      <div className="flex max-w-lg flex-col gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-neutral-100">Account</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-neutral-400">Name</dt>
              <dd className="font-medium text-slate-900 dark:text-neutral-100">{user?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-neutral-400">Email</dt>
              <dd className="font-medium text-slate-900 dark:text-neutral-100">{user?.email}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-surface-700 dark:bg-surface-900">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Change Password</h2>
            {!showPasswordForm && (
              <button
                type="button"
                onClick={openPasswordForm}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-surface-600 dark:text-neutral-200 dark:hover:bg-surface-800"
              >
                Change Password
              </button>
            )}
          </div>

          {success && !showPasswordForm && (
            <p className="mt-3 text-sm text-brand-700 dark:text-emerald-400">Password updated.</p>
          )}

          {showPasswordForm && (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label className={labelClasses}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClasses}
                  required
                  autoFocus
                />
              </div>
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
              {success && <p className="text-sm text-brand-700 dark:text-emerald-400">Password updated.</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {submitting ? 'Saving…' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={closePasswordForm}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClientProfilePage;
