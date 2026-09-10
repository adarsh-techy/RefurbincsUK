import { useState } from 'react';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

// staff: pass an existing staff record to edit it (PATCH); omit to create (POST).
function StaffForm({ staff, onSaved, onCancel }) {
  const isEdit = Boolean(staff);
  const [form, setForm] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    role: staff?.role || 'technician',
    active: staff?.active ?? true,
    salary: staff ? String(staff.salary) : '0',
  });
  const [grantLogin, setGrantLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await apiClient.patch(`/staff/${staff.id}`, {
          name: form.name,
          phone: form.phone || undefined,
          role: form.role || 'technician',
          active: form.active,
          salary: Number(form.salary) || 0,
        });
      } else {
        await apiClient.post('/staff', {
          name: form.name,
          phone: form.phone || undefined,
          role: form.role || 'technician',
          salary: Number(form.salary) || 0,
          loginEmail: grantLogin ? loginEmail : undefined,
          tempPassword: grantLogin ? tempPassword : undefined,
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
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g. Harry Taylor"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>Phone (optional)</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="e.g. 07700 900123"
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>Staff Role</label>
          <select
            value={form.role}
            onChange={(e) => updateField('role', e.target.value)}
            className={inputClasses}
          >
            <option value="technician">Technician (Repairs only)</option>
            <option value="supervisor">Supervisor (Repairs & Testing)</option>
            <option value="manager">Manager (Repairs & Testing)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {form.role === 'technician'
              ? 'Technicians can start work and replace parts, but cannot complete testing.'
              : 'Supervisors and Managers have full testing permissions to verify and complete repairs.'}
          </p>
        </div>

        <div>
          <label className={labelClasses}>Monthly Salary</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.salary}
            onChange={(e) => updateField('salary', e.target.value)}
            placeholder="0.00"
            className={inputClasses}
          />
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateField('active', e.target.checked)}
              className="accent-brand-600"
            />
            Active
          </label>
        )}

        {!isEdit && (
          <div className="rounded-lg border border-slate-200 p-3.5 dark:border-surface-700">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-neutral-200">
              <input
                type="checkbox"
                checked={grantLogin}
                onChange={(e) => setGrantLogin(e.target.checked)}
                className="accent-brand-600"
              />
              Grant technician login access
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Lets this staff member log in, scan battery QR codes, and log their own repairs.
            </p>

            {grantLogin && (
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <label className={labelClasses}>Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="e.g. technician@example.com"
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
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff'}
        </button>
      </div>
    </form>
  );
}

export default StaffForm;
