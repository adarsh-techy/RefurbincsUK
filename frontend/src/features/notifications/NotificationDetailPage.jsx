import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBell,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiPackage,
  FiTruck,
  FiMessageSquare,
  FiAward,
  FiStar,
  FiClock,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiExternalLink,
  FiRefreshCw,
  FiShield,
  FiHome,
  FiTag,
  FiChevronRight,
  FiCornerDownRight,
  FiCpu,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';

const STORAGE_KEY = 'refurbnics_admin_read_notifications';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function NotificationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  // Read status from local storage
  const [isRead, setIsRead] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const list = stored ? JSON.parse(stored) : [];
      return id ? list.includes(id) : false;
    } catch {
      return false;
    }
  });

  async function loadNotification() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/notifications/admin/${encodeURIComponent(id)}`);
      setNotification(res.data.notification);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to load operational notification'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotification();
  }, [id]);

  // Keep read state in sync with localStorage
  function toggleRead() {
    if (!id) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const list = stored ? JSON.parse(stored) : [];
      let next;
      if (list.includes(id)) {
        next = list.filter((item) => item !== id);
        setIsRead(false);
      } else {
        next = [...list, id];
        setIsRead(true);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function handleCopyDetails() {
    if (!notification) return;
    const text = `Refurbnics Notification [${notification.id}]\nTitle: ${notification.title}\nSeverity: ${notification.severity}\nTime: ${formatFullDate(notification.timestamp)}\nMessage: ${notification.message}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Type icon & style helpers
  const iconConfig = useMemo(() => {
    if (!notification) return { Icon: FiBell, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/60' };
    switch (notification.type) {
      case 'stock':
        return {
          Icon: FiPackage,
          color: notification.severity === 'urgent'
            ? 'text-rose-600 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300'
            : 'text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300',
        };
      case 'ticket':
        return {
          Icon: FiMessageSquare,
          color: 'text-purple-600 bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300',
        };
      case 'intake':
        return {
          Icon: FiTruck,
          color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300',
        };
      case 'return':
        return {
          Icon: FiCheckCircle,
          color: 'text-teal-600 bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300',
        };
      case 'rating':
        return {
          Icon: FiStar,
          color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/60 dark:text-yellow-300',
        };
      case 'milestone':
        return {
          Icon: FiAward,
          color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300',
        };
      case 'unserviceable':
        return {
          Icon: FiAlertTriangle,
          color: 'text-orange-600 bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300',
        };
      default:
        return {
          Icon: FiInfo,
          color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300',
        };
    }
  }, [notification]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Loading notification details…
        </p>
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300">
            <FiAlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            Notification Not Found
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {error || 'The requested operational notification could not be found or has expired.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              <FiArrowLeft className="h-3.5 w-3.5" />
              All Notifications
            </button>
            <button
              type="button"
              onClick={loadNotification}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200"
            >
              <FiRefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { Icon, color } = iconConfig;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* ── Breadcrumb & Navigation Bar ──────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-neutral-500">
          <Link
            to="/"
            className="flex items-center gap-1 text-slate-600 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            <FiHome className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <FiChevronRight className="h-3 w-3" />
          <Link
            to="/notifications"
            className="text-slate-600 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            Operations Feed
          </Link>
          <FiChevronRight className="h-3 w-3" />
          <span className="truncate max-w-[200px] font-bold text-slate-800 dark:text-white">
            {notification.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleRead}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
              isRead
                ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            <FiCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>{isRead ? 'Mark as Unread' : 'Mark as Read'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyDetails}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-300"
          >
            <FiCopy className="h-3.5 w-3.5" />
            <span>{copied ? 'Copied!' : 'Copy Info'}</span>
          </button>

          <Link
            to="/notifications"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-surface-800 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Feed</span>
          </Link>
        </div>
      </div>

      {/* ── Main Notification Hero Card ─────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-surface-900">
        {/* Top Hero Banner */}
        <div className="border-b border-slate-100 p-6 dark:border-white/5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-xs ${color}`}
              >
                <Icon className="h-7 w-7" />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Severity Badge */}
                  {notification.severity === 'urgent' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 animate-pulse">
                      🚨 Urgent Action
                    </span>
                  )}
                  {notification.severity === 'warning' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800 dark:bg-amber-950/80 dark:text-amber-200">
                      ⚠️ Warning
                    </span>
                  )}
                  {notification.severity === 'success' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200">
                      ✓ Completed
                    </span>
                  )}
                  {notification.severity === 'info' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-800 dark:bg-blue-950/80 dark:text-blue-200">
                      ℹ️ Info
                    </span>
                  )}

                  {/* Category Pill */}
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:bg-surface-800 dark:text-neutral-300">
                    {notification.category}
                  </span>

                  {/* Read State Pill */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                      isRead
                        ? 'bg-slate-100 text-slate-500 dark:bg-surface-800 dark:text-neutral-400'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-extrabold'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isRead ? 'bg-slate-400' : 'bg-blue-600'}`}
                    />
                    {isRead ? 'Read' : 'New / Unread'}
                  </span>
                </div>

                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
                  {notification.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <FiClock className="h-3.5 w-3.5" />
                    {timeAgo(notification.timestamp)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <FiCalendar className="h-3.5 w-3.5" />
                    {formatFullDate(notification.timestamp)}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    ID: {notification.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Link Button */}
            {notification.actionUrl && (
              <div className="shrink-0 pt-2 sm:pt-0">
                <Link
                  to={notification.actionUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-blue-700 transition-all"
                >
                  <span>{notification.actionLabel || 'View Record'}</span>
                  <FiExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Message Callout Body */}
        <div className="p-6 sm:p-7 space-y-6">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">
              Notification Message & Details
            </h2>
            <div className="mt-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4.5 text-sm font-medium leading-relaxed text-slate-700 dark:border-white/5 dark:bg-surface-850/60 dark:text-neutral-200">
              {notification.message}
            </div>
          </div>

          {/* ── Contextual Breakdown Card Based on Type ───────────────── */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500">
              Target Entity & Operational Context
            </h2>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Common Meta Items */}
              {notification.meta?.clientName && (
                <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Client Name
                  </span>
                  <p className="mt-1 text-sm font-extrabold text-slate-800 dark:text-neutral-100">
                    {notification.meta.clientName}
                  </p>
                </div>
              )}

              {notification.meta?.batteryCode && (
                <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Battery Pack
                  </span>
                  <Link
                    to={`/batteries/${encodeURIComponent(notification.meta.batteryCode)}`}
                    className="mt-1 block font-mono text-sm font-extrabold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {notification.meta.batteryCode} →
                  </Link>
                </div>
              )}

              {/* Stock Specific Meta */}
              {notification.type === 'stock' && (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Part SKU Code
                    </span>
                    <p className="mt-1 font-mono text-sm font-extrabold text-slate-800 dark:text-neutral-100">
                      {notification.meta?.sku || 'N/A'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Current Workshop Quantity
                    </span>
                    <p className="mt-1 text-sm font-black text-rose-600 dark:text-rose-400">
                      {notification.meta?.quantity ?? 0} unit(s) remaining
                    </p>
                  </div>

                  {notification.meta?.repairCost && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Part Unit Cost
                      </span>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-neutral-100">
                        £{Number(notification.meta.repairCost).toFixed(2)}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Truck Logistics Specific Meta */}
              {(notification.type === 'intake' || notification.type === 'return') && (
                <>
                  {notification.meta?.truckNumber && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Transport Truck
                      </span>
                      <p className="mt-1 text-sm font-extrabold text-slate-800 dark:text-neutral-100">
                        {notification.meta.truckNumber}
                      </p>
                    </div>
                  )}

                  {notification.meta?.driverName && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Driver Assigned
                      </span>
                      <p className="mt-1 text-sm font-extrabold text-slate-800 dark:text-neutral-100">
                        {notification.meta.driverName}
                      </p>
                    </div>
                  )}

                  {notification.meta?.batteryCount !== undefined && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Total Batteries in Batch
                      </span>
                      <p className="mt-1 font-mono text-sm font-extrabold text-slate-800 dark:text-neutral-100">
                        {notification.meta.batteryCount} pack(s)
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Support Ticket Specific Meta */}
              {notification.type === 'ticket' && (
                <>
                  {notification.meta?.ticketNumber && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Ticket Number
                      </span>
                      <p className="mt-1 font-mono text-sm font-extrabold text-purple-600 dark:text-purple-400">
                        {notification.meta.ticketNumber}
                      </p>
                    </div>
                  )}

                  {notification.meta?.priority && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Priority Level
                      </span>
                      <p className="mt-1 text-sm font-extrabold capitalize text-slate-800 dark:text-neutral-100">
                        {notification.meta.priority}
                      </p>
                    </div>
                  )}

                  {notification.meta?.status && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Inquiry Status
                      </span>
                      <p className="mt-1 text-sm font-extrabold capitalize text-slate-800 dark:text-neutral-100">
                        {notification.meta.status}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Rating Specific Meta */}
              {notification.type === 'rating' && (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Rating Score
                    </span>
                    <p className="mt-1 text-sm font-black text-amber-500">
                      {'★'.repeat(notification.meta?.rating || 5)}{' '}
                      <span className="text-xs text-slate-500">
                        ({notification.meta?.rating || 5} of 5 Stars)
                      </span>
                    </p>
                  </div>
                </>
              )}

              {/* Milestone Specific Meta */}
              {notification.type === 'milestone' && (
                <>
                  <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Milestone Tier
                    </span>
                    <p className="mt-1 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {notification.meta?.tier}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Repaired Packs Milestone
                    </span>
                    <p className="mt-1 font-mono text-sm font-extrabold text-slate-800 dark:text-neutral-100">
                      {notification.meta?.count} packs
                    </p>
                  </div>

                  {notification.meta?.co2SavedKg && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-white/5 dark:bg-surface-850">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        CO₂ Saved
                      </span>
                      <p className="mt-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                        {notification.meta.co2SavedKg} kg
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Quick Action Command Bar ─────────────────────────────── */}
          <div className="border-t border-slate-100 pt-5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowJson((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-300"
              >
                <FiCpu className="h-3.5 w-3.5 text-slate-400" />
                <span>{showJson ? 'Hide Raw JSON' : 'Inspect Raw Payload'}</span>
              </button>
            </div>

            {notification.actionUrl && (
              <Link
                to={notification.actionUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-blue-600 dark:bg-white dark:text-slate-900 dark:hover:bg-blue-600 dark:hover:text-white transition-all shadow-2xs"
              >
                <span>Navigate to {notification.actionLabel || 'Record'}</span>
                <FiCornerDownRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {/* Raw JSON viewer */}
          {showJson && (
            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-emerald-400 dark:border-white/10 overflow-x-auto">
              <pre>{JSON.stringify(notification, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
