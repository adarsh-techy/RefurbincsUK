import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiUser,
  FiMail,
  FiShield,
  FiLock,
  FiKey,
  FiCheckCircle,
  FiAlertCircle,
  FiLogOut,
  FiArrowRight,
  FiClock,
  FiFileText,
  FiAward,
  FiPackage,
  FiInbox,
  FiLayers,
  FiDollarSign,
  FiCheck,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import { logout, setUser, setToken } from '../../auth/auth-slice';
import { useTheme } from '../../../context/ThemeContext';

export default function ClientProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

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
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
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
      setShowPasswordForm(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSignOut() {
    if (window.confirm('Are you sure you want to sign out of your account?')) {
      dispatch(logout());
      navigate('/login', { replace: true });
    }
  }

  const userInitial = (user?.name || user?.email || 'C').charAt(0).toUpperCase();

  const QUICK_LINKS = [
    {
      to: '/my/history',
      label: 'Service History',
      desc: 'All historical battery diagnostics, repair visits and returns',
      icon: FiClock,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400',
    },
    {
      to: '/my/battery-sorting',
      label: 'Battery Sorting',
      desc: 'Barcode & QR triage tool for battery requirement groups',
      icon: FiLayers,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-400',
    },
    {
      to: '/my/invoices',
      label: 'Invoices & Billing',
      desc: 'Download monthly repair service statements and PDF receipts',
      icon: FiFileText,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400',
    },
    {
      to: '/my/transactions',
      label: 'Transactions Ledger',
      desc: 'Detailed itemized charges and settlement payment history',
      icon: FiDollarSign,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    {
      to: '/my/certificates',
      label: 'ESG & Eco Certificates',
      desc: 'Official CO₂ offset and sustainability milestone credentials',
      icon: FiAward,
      color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/50 dark:text-teal-400',
    },
    {
      to: '/my/parts',
      label: 'Parts Inventory',
      desc: 'Client parts catalogue stock counts and minimum threshold alerts',
      icon: FiPackage,
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400',
    },
    {
      to: '/my/support',
      label: 'Help & Support Desk',
      desc: 'Direct communication channel with Refurbnics service team',
      icon: FiInbox,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-16 px-1 sm:px-2">
      {/* ── Breadcrumb & Top Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-neutral-400">
          <Link to="/my/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            Portal
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-900 dark:text-white">Account Profile</span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200/90 bg-rose-50/70 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
        >
          <FiLogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>

      {/* ── Hero Identity Banner ───────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/40 p-4 sm:p-7 shadow-sm dark:border-white/10 dark:from-surface-900 dark:via-surface-900 dark:to-emerald-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="relative flex h-14 w-14 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-xl sm:text-3xl shadow-md border-2 border-white dark:border-surface-800">
            {userInitial}
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-white dark:bg-surface-900 shadow-2xs">
              <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>

          {/* User Details */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                {user?.name || 'Client Account'}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                <FiCheck className="w-3 h-3" />
                Verified Client
              </span>
            </div>

            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 truncate">
              <FiMail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>{user?.email}</span>
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-neutral-500 font-medium">
              <span className="inline-flex items-center gap-1">
                <FiShield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Active Fleet Portal Access
              </span>
              <span>&bull;</span>
              <span>Refurbnics Client Network</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Content Grid ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Account Info & Quick Shortcuts */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-7">
          {/* Card 1: Account Identity & Specs */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <FiUser className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Account Details</h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-neutral-400">Personal & company credentials</p>
              </div>
            </div>

            <div className="mt-3.5 divide-y divide-slate-100 dark:divide-white/5 text-xs sm:text-sm">
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Name / Company</span>
                <span className="font-bold text-slate-900 dark:text-white text-right truncate">{user?.name || '—'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Email Address</span>
                <span className="font-bold text-slate-900 dark:text-white text-right truncate">{user?.email || '—'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Account Role</span>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  Client Fleet Manager
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-neutral-400 font-medium">Portal Security Status</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <FiCheckCircle className="w-3.5 h-3.5" />
                  Active & Authenticated
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Quick Links / Shortcuts */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-neutral-300">
                  <FiLayers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Portal Navigation</h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-neutral-400">Fast access to your fleet services</p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="group flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3 transition-all hover:bg-white hover:border-slate-300 hover:shadow-xs dark:border-white/5 dark:bg-surface-850 dark:hover:bg-surface-800"
                  >
                    <span className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg ${link.color} transition-transform group-hover:scale-105`}>
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {link.label}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-neutral-400 line-clamp-1">
                        {link.desc}
                      </p>
                    </div>
                    <FiArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-600 dark:text-neutral-600 dark:group-hover:text-neutral-300 shrink-0 self-center transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Security, Change Password & Actions */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-5">
          {/* Security Card: Change Password */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-surface-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <FiKey className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Security & Password</h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-neutral-400">Portal credentials passkey</p>
                </div>
              </div>
            </div>

            {/* Success message banner */}
            {success && (
              <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Password updated successfully! Your new password is now active.</span>
              </div>
            )}

            {!showPasswordForm ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-surface-850">
                  <div className="flex items-center gap-2">
                    <FiLock className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">Account Passkey Protected</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
                    We recommend changing your password periodically to ensure your fleet records remain secure.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openPasswordForm}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-surface-800 dark:text-white dark:hover:bg-surface-700 transition-all cursor-pointer active:scale-98"
                >
                  <FiKey className="h-3.5 w-3.5 text-amber-600" />
                  <span>Change Password</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    <FiAlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-neutral-300">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-neutral-300">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-neutral-300">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ backgroundColor: accent }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white shadow-2xs hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? 'Saving…' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={closePasswordForm}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-surface-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Session Security & Info Box */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 dark:text-neutral-300">
              <FiShield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold">End-to-End Encryption</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-neutral-400 leading-relaxed">
              Your portal session is protected by 256-bit encryption. Battery serials, intake records, and billing receipts are accessible exclusively by your authorized team.
            </p>
            <div className="pt-1 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <FiLogOut className="h-3.5 w-3.5" />
                <span>Sign Out of Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
