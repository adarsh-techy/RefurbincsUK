import { useState } from 'react';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

function RecycleClientForm({ client, onSaved, onCancel }) {
  const isEdit = Boolean(client);
  const [name, setName] = useState(client?.name || '');
  const hasExistingLogin = Boolean(client?.login_email);
  const [email, setEmail] = useState(client?.login_email || '');
  const [tempPassword, setTempPassword] = useState('');
  const [active, setActive] = useState(client?.user_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function capitalizeFirst(val) {
    if (!val) return '';
    return val.charAt(0).toUpperCase() + val.slice(1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (tempPassword && tempPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formattedName = capitalizeFirst(name.trim());
      if (isEdit) {
        // Same payload as the mobile partner form: login fields only when the
        // partner has a login, email only when it changed.
        const body = { name: formattedName };
        if (hasExistingLogin) {
          if (email.trim() && email.trim() !== client.login_email) body.email = email.trim();
          if (tempPassword) body.tempPassword = tempPassword;
          body.active = active ? 'true' : 'false';
        }
        await apiClient.patch(`/clients/${client.id}`, body);
      } else {
        await apiClient.post('/clients', {
          name: formattedName,
          email,
          tempPassword,
          role: 'recycle_client',
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Recycle Client Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(capitalizeFirst(e.target.value))}
          placeholder="e.g. EcoRecycle Solutions"
          className={inputClasses}
          required
        />
      </div>

      {!isEdit && (
        <div className="rounded-lg border border-slate-200 p-3.5 dark:border-surface-700">
          <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">Partner login</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            Required: the partner signs in to see their assigned battery shipments, and the login is
            what marks this account as a recycling partner (not a fleet client).
          </p>

          {(
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. partner@ecorecycle.com"
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label className={labelClasses}>Temporary Password</label>
                <input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="One-time password — they'll set their own on first login"
                  className={inputClasses}
                  minLength={8}
                  required
                />
              </div>
            </div>
          )}
        </div>
      )}

      {isEdit && hasExistingLogin && (
        <div className="rounded-lg border border-slate-200 p-3.5 dark:border-surface-700">
          <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">Partner login</p>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label className={labelClasses}>Login Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>Reset Password (optional)</label>
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Leave blank to keep existing"
                className={inputClasses}
                minLength={8}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                The partner signs in with this one-time password and must set their own straight away.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Account Active (unchecking prevents this partner from logging in)
            </label>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-critical-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-surface-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recycle Client'}
        </button>
      </div>
    </form>
  );
}

export default RecycleClientForm;
