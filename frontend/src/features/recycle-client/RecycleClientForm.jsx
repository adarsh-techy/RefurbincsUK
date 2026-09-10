import { useState } from 'react';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

function RecycleClientForm({ client, onSaved, onCancel }) {
  const isEdit = Boolean(client);
  const [name, setName] = useState(client?.name || '');
  const [grantLogin, setGrantLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await apiClient.patch(`/clients/${client.id}`, { name });
      } else {
        await apiClient.post('/clients', {
          name,
          email: grantLogin ? email : undefined,
          tempPassword: grantLogin ? tempPassword : undefined,
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
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. EcoRecycle Solutions"
          className={inputClasses}
          required
        />
      </div>

      {!isEdit && (
        <div className="rounded-lg border border-slate-200 p-3.5 dark:border-surface-700">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={grantLogin}
              onChange={(e) => setGrantLogin(e.target.checked)}
              className="accent-brand-600"
            />
            Grant login access
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            Lets this recycling partner log in to see their assigned unserviceable battery shipments.
          </p>

          {grantLogin && (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. partner@ecorecycle.com"
                  className={inputClasses}
                  required={grantLogin}
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
                  required={grantLogin}
                />
              </div>
            </div>
          )}
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
