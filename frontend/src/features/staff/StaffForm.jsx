import { useState } from 'react';
import {
  FiUser,
  FiMail,
  FiPhone,
  FiShield,
  FiDollarSign,
  FiUploadCloud,
  FiFileText,
  FiCheckCircle,
  FiKey,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiTrash2,
  FiInfo,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';

const inputClasses =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 transition-all';
const labelClasses =
  'mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300';

// staff: pass an existing staff record to edit it (PATCH); omit to create (POST).
function StaffForm({ staff, onSaved, onCancel }) {
  const isEdit = Boolean(staff);
  const [form, setForm] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    email: staff?.email || staff?.login_email || '',
    role: staff?.role || 'technician',
    active: staff?.active ?? true,
    salary: staff ? String(staff.salary) : '0',
    passportNumber: staff?.passport_number || '',
    niNumber: staff?.ni_number || '',
    shareCode: staff?.share_code || '',
  });

  const [docFile, setDocFile] = useState(null);
  const [grantLogin, setGrantLogin] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(generated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      if (form.phone) formData.append('phone', form.phone.trim());
      if (form.email) formData.append('email', form.email.trim().toLowerCase());
      formData.append('role', form.role || 'technician');
      formData.append('salary', Number(form.salary) || 0);

      if (form.passportNumber) formData.append('passportNumber', form.passportNumber.trim());
      if (form.niNumber) formData.append('niNumber', form.niNumber.trim().toUpperCase());
      if (form.shareCode) formData.append('shareCode', form.shareCode.trim().toUpperCase());

      if (docFile) {
        formData.append('docFile', docFile);
      }

      if (isEdit) {
        formData.append('active', form.active);
        await apiClient.patch(`/staff/${staff.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        if (grantLogin) {
          formData.append('loginEmail', (form.email || '').trim().toLowerCase());
          formData.append('tempPassword', tempPassword.trim());
        }
        await apiClient.post('/staff', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── SECTION 1: Personal & Employment Details ─────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 dark:border-white/10 dark:bg-surface-850 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FiUser className="h-4 w-4" />
            </span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              1. Personal & Employment Profile
            </h3>
          </div>
          {isEdit && (
            <label className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white dark:bg-surface-800 border border-slate-200 dark:border-white/10 shadow-2xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateField('active', e.target.checked)}
                className="accent-emerald-600 h-4 w-4 rounded"
              />
              <span className={form.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                {form.active ? 'Active Employee' : 'Inactive'}
              </span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Full Name */}
          <div>
            <label className={labelClasses}>
              <span>Staff Full Name</span>
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Harry Taylor"
                className={inputClasses}
                required
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className={labelClasses}>
              <FiShield className="h-3.5 w-3.5 text-slate-400" />
              <span>Workshop Role</span>
              <span className="text-red-500">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => updateField('role', e.target.value)}
              className={inputClasses}
              required
            >
              <option value="technician">Technician — Workshop Repairs only</option>
              <option value="supervisor">Supervisor — Repairs & Testing Signoff</option>
              <option value="manager">Manager — Full Workshop Signoff & Operations</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label className={labelClasses}>
              <FiMail className="h-3.5 w-3.5 text-slate-400" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="e.g. harry.taylor@refurbinics.com"
              className={inputClasses}
            />
          </div>

          {/* Phone */}
          <div>
            <label className={labelClasses}>
              <FiPhone className="h-3.5 w-3.5 text-slate-400" />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="e.g. +44 7700 900123"
              className={inputClasses}
            />
          </div>

          {/* Salary */}
          <div className="sm:col-span-2">
            <label className={labelClasses}>
              <FiDollarSign className="h-3.5 w-3.5 text-slate-400" />
              <span>Monthly Salary (£)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-neutral-500">
                £
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salary}
                onChange={(e) => updateField('salary', e.target.value)}
                placeholder="0.00"
                className={`${inputClasses} pl-8`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Identity & Right to Work Compliance ──────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 dark:border-white/10 dark:bg-surface-850 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3 dark:border-white/10">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FiCheckCircle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              2. Right to Work & Compliance Credentials
            </h3>
          </div>
        </div>

        {/* 3-Column Compliance Identifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className={labelClasses}>Passport Number</label>
            <input
              type="text"
              value={form.passportNumber}
              onChange={(e) => updateField('passportNumber', e.target.value)}
              placeholder="e.g. 123456789"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>National Insurance (NI)</label>
            <input
              type="text"
              value={form.niNumber}
              onChange={(e) => updateField('niNumber', e.target.value.toUpperCase())}
              placeholder="e.g. QQ 12 34 56 A"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Share Code (Right to Work)</label>
            <input
              type="text"
              value={form.shareCode}
              onChange={(e) => updateField('shareCode', e.target.value.toUpperCase())}
              placeholder="e.g. W12 345 678"
              className={inputClasses}
            />
          </div>
        </div>

        {/* Compliance Document Upload */}
        <div>
          <label className={labelClasses}>Compliance / Identity Document (PDF or Photo)</label>
          <div className="mt-1">
            <label className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 text-center transition-all hover:border-blue-500 hover:bg-blue-50/20 dark:border-white/15 dark:bg-surface-800 dark:hover:border-blue-400 dark:hover:bg-surface-700/50 cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                <FiUploadCloud className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                {docFile ? docFile.name : 'Click or drag & drop compliance file'}
              </span>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-400">
                Supported formats: PDF, PNG, JPG, WebP (Max 15MB)
              </p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>

            {docFile && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-900 border border-blue-200/80 dark:bg-blue-950/40 dark:border-blue-800/40 dark:text-blue-300">
                <span className="flex items-center gap-2 truncate">
                  <FiFileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="truncate">{docFile.name}</span>
                  <span className="text-[10px] text-blue-600/80">({(docFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDocFile(null)}
                  className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 cursor-pointer"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            )}

            {isEdit && staff.document_path && !docFile && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-100 px-3.5 py-2 text-xs text-slate-700 border border-slate-200 dark:bg-surface-800 dark:border-white/10 dark:text-neutral-300">
                <span className="flex items-center gap-2 truncate">
                  <FiFileText className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="truncate">Saved Document: <strong>{staff.document_name || staff.document_path}</strong></span>
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Verified On File</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Portal Login Access (Create mode) ────────────────── */}
      {!isEdit && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-white/10 dark:bg-surface-850 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <FiKey className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  3. Portal Access & Login Credentials
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                  Enable technician access to log in, scan QR codes, and record repairs.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={grantLogin}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setGrantLogin(checked);
                  if (checked && !tempPassword) {
                    generateRandomPassword();
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-surface-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {grantLogin && (
            <div className="pt-3 border-t border-slate-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Login Email */}
              <div>
                <label className={labelClasses}>
                  <span>Login Email</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="e.g. technician@refurbinics.com"
                  className={inputClasses}
                  required={grantLogin}
                />
              </div>

              {/* Temporary Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <span>Temp Password</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                  >
                    <FiRefreshCw className="h-3 w-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className={`${inputClasses} pr-10 font-mono`}
                    minLength={8}
                    required={grantLogin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs font-bold text-red-600 dark:text-red-300">
          <FiInfo className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Footer Actions ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          {submitting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Saving…</span>
            </>
          ) : (
            <span>{isEdit ? 'Save Changes' : 'Add Staff Member'}</span>
          )}
        </button>
      </div>
    </form>
  );
}

export default StaffForm;
