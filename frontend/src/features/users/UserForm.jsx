import { useState } from 'react';
import apiClient from '../../services/api-client';
import { PERMISSIONS } from '../../utils/permissions';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// targetUser: pass an existing user to edit it (PATCH — no password field,
// that's out of scope here); omit to create a new admin (POST).
function UserForm({ targetUser, onSaved, onCancel }) {
  const isEdit = Boolean(targetUser);
  const [form, setForm] = useState({
    name: targetUser?.name || '',
    email: targetUser?.email || '',
    password: '',
    role: targetUser?.role || 'admin',
    permissions: targetUser?.permissions || [],
    active: targetUser?.active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function togglePermission(key) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await apiClient.patch(`/users/${targetUser.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
          permissions: form.permissions,
          active: form.active,
        });
      } else {
        await apiClient.post('/users', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isAdmin = form.role === 'admin';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. Oliver Smith"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="e.g. oliver.smith@refurbinics.com"
            className={inputClasses}
            required
          />
        </div>

        {!isEdit && (
          <div>
            <label className={labelClasses}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={inputClasses}
              required
            />
          </div>
        )}

        <div>
          <label className={labelClasses}>Role</label>
          <select
            value={form.role}
            onChange={(e) => updateField('role', e.target.value)}
            className={inputClasses}
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="recycle_client">Recycle Client</option>
          </select>
        </div>

        {isAdmin ? (
          <div>
            <label className={labelClasses}>Permissions</label>
            <p className="mb-2 text-xs text-slate-500 dark:text-neutral-400">Which modules this admin can access.</p>
            <div className="flex flex-wrap gap-2">
              {PERMISSIONS.map((p) => (
                <label
                  key={p.key}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                    form.permissions.includes(p.key)
                      ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-surface-700 dark:text-neutral-300 dark:hover:bg-surface-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                    className="accent-brand-600"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        ) : form.role === 'recycle_client' ? (
          <p className="text-xs text-slate-400 dark:text-neutral-500">
            Recycle clients have access to their own dashboard and recycle shipments.
          </p>
        ) : (
          <p className="text-xs text-slate-400 dark:text-neutral-500">Super admins have access to every module.</p>
        )}

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateField('active', e.target.checked)}
              className="accent-brand-600"
            />
            Active (unchecking blocks this account from logging in)
          </label>
        )}
      </div>

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
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Admin'}
        </button>
      </div>
    </form>
  );
}

export default UserForm;
