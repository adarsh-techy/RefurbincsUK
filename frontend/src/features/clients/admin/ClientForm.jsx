import { useState } from 'react';
import apiClient from '../../../services/api-client';
import logoUrl from '../../../utils/logo-url';
import { CLIENT_PERMISSIONS } from '../../../utils/permissions';

const inputClasses =
  'w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-600 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30';
const labelClasses = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-neutral-200';

const ALL_PERMISSION_KEYS = CLIENT_PERMISSIONS.map((p) => p.key);

// client: pass an existing client record to edit it (PATCH); omit to create (POST).
function ClientForm({ client, onSaved, onCancel }) {
  const isEdit = Boolean(client);
  const hasExistingLogin = Boolean(client?.login_email);

  const [name, setName] = useState(client?.name || '');
  const [invoiceEmail, setInvoiceEmail] = useState(client?.invoice_email || '');
  const [grantLogin, setGrantLogin] = useState(hasExistingLogin);
  const [email, setEmail] = useState(client?.login_email || '');
  const [tempPassword, setTempPassword] = useState('');
  const [active, setActive] = useState(client?.user_active ?? true);
  const [permissions, setPermissions] = useState(
    Array.isArray(client?.user_permissions) && client.user_permissions.length > 0
      ? client.user_permissions
      : ALL_PERMISSION_KEYS
  );
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(logoUrl(client?.logo_path));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleLogoChange(e) {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : logoUrl(client?.logo_path));
  }

  function togglePermission(key) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function selectAllPermissions() {
    setPermissions(ALL_PERMISSION_KEYS);
  }

  function clearAllPermissions() {
    setPermissions([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('invoiceEmail', invoiceEmail.trim());
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      if (grantLogin || hasExistingLogin) {
        if (email) formData.append('email', email);
        if (tempPassword) formData.append('tempPassword', tempPassword);
        formData.append('permissions', JSON.stringify(permissions));
        formData.append('active', active ? 'true' : 'false');
      }

      if (isEdit) {
        await apiClient.patch(`/clients/${client.id}`, formData);
      } else {
        await apiClient.post('/clients', formData);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Group permissions by category for clean UI organization
  const permissionGroups = CLIENT_PERMISSIONS.reduce((acc, p) => {
    acc[p.group] = acc[p.group] || [];
    acc[p.group].push(p);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>Client Name <span className="text-rose-500">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apex Fleet Logistics UK"
            className={inputClasses}
            required
          />
        </div>

        <div>
          <label className={labelClasses}>
            Invoice / Billing Email (optional)
          </label>
          <input
            type="email"
            value={invoiceEmail}
            onChange={(e) => setInvoiceEmail(e.target.value)}
            placeholder="e.g. accounts@clientfleet.co.uk"
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
            Invoices & statements will be sent to this email.
          </p>
        </div>
      </div>

      <div>
        <label className={labelClasses}>Client Logo</label>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-surface-600 dark:bg-surface-800">
            {logoPreview ? (
              <img src={logoPreview} alt="" className="h-full w-full object-contain" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-slate-300 dark:text-neutral-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 8.25V15a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 15V8.25M3 8.25a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 8.25m-18 0v.75m18-.75v.75M3.75 6h16.5" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-neutral-300 dark:file:bg-surface-700 dark:file:text-emerald-300 dark:hover:file:bg-surface-600"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
              PNG, JPEG, WEBP, or SVG, up to 2MB. Shown on this client&apos;s own dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* ── Client Login & Permissions Management Section ──────────────── */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-surface-700 dark:bg-surface-900/40">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          <input
            type="checkbox"
            checked={grantLogin}
            onChange={(e) => setGrantLogin(e.target.checked)}
            className="h-4 w-4 rounded accent-emerald-600"
          />
          {hasExistingLogin ? 'Client Portal Login & Permissions' : 'Grant Login Access'}
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
          Control portal login credentials and configure which dashboard features this client can access.
        </p>

        {grantLogin && (
          <div className="mt-4 flex flex-col gap-4 border-t border-slate-200/80 pt-4 dark:border-surface-700">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className={inputClasses}
                  required={grantLogin}
                />
              </div>
              <div>
                <label className={labelClasses}>
                  {hasExistingLogin ? 'Reset Password (optional)' : 'Temporary Password'}
                </label>
                <input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder={hasExistingLogin ? 'Leave blank to keep existing' : 'One-time password'}
                  className={inputClasses}
                  minLength={8}
                  required={!hasExistingLogin && grantLogin}
                />
              </div>
            </div>

            {hasExistingLogin && (
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-neutral-200">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-emerald-600"
                />
                Account Active (unchecking prevents this client from logging in)
              </label>
            )}

            {/* ── Client Dashboard Permissions Checkboxes ─────────────────── */}
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3.5 dark:border-surface-700 dark:bg-surface-850">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-surface-700">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-100">
                    Dashboard Access Permissions
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                    Check the tabs and modules visible on this client’s portal.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllPermissions}
                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-neutral-600">•</span>
                  <button
                    type="button"
                    onClick={clearAllPermissions}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="mt-3.5 space-y-4">
                {Object.entries(permissionGroups).map(([groupName, perms]) => (
                  <div key={groupName}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      {groupName}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {perms.map((p) => {
                        const isChecked = permissions.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2 transition ${
                              isChecked
                                ? 'border-emerald-500/60 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                                : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100/60 dark:border-surface-700 dark:bg-surface-800/50 dark:text-neutral-300 dark:hover:bg-surface-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(p.key)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-emerald-600"
                            />
                            <div className="min-w-0">
                              <span className="block text-xs font-semibold">{p.label}</span>
                              <span className="block text-[10px] text-slate-500 dark:text-neutral-400 leading-tight">
                                {p.desc}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
        </button>
      </div>
    </form>
  );
}

export default ClientForm;

