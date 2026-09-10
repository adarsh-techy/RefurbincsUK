import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import { useTheme } from '../../context/ThemeContext';

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

export default function ClientNotificationBell() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';
  const isAccentHeader = !!customTheme?.applyToHeader;

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef(null);

  async function fetchRecent() {
    try {
      setLoading(true);
      const res = await apiClient.get('/clients/me/notifications?limit=6');
      setNotifications(res.data?.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      {/* ── Bell Trigger Button ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchRecent();
        }}
        aria-label="Battery Notifications"
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
          isAccentHeader
            ? 'text-white hover:bg-white/15'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>

        {notifications.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </button>

      {/* ── Dropdown Popover ───────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-surface-900 animate-in fade-in zoom-in-95 duration-150">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Battery Updates
              </span>
              <span
                className="rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs"
                style={{ backgroundColor: accent }}
              >
                {notifications.length}
              </span>
            </div>
            <Link
              to="/my/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              View All
            </Link>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto no-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading alerts…</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent battery notifications
              </div>
            ) : (
              notifications.slice(0, 5).map((item) => {
                const isBatch = (item.battery_count || 1) > 1;
                const singleCode = item.battery_codes?.[0];
                const targetUrl = isBatch ? '/my/notifications' : `/batteries/${encodeURIComponent(singleCode || '')}`;

                return (
                  <Link
                    key={item.id}
                    to={targetUrl}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        item.type === 'intake'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : item.type === 'invoice'
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400'
                      }`}
                    >
                      {item.type === 'intake' ? '📥' : item.type === 'invoice' ? '📄' : '🚚'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-slate-500 dark:text-neutral-400">
                        {item.message}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2.5 text-center dark:border-white/5">
            <Link
              to="/my/notifications"
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl bg-slate-50 py-2 text-center text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              See All Battery History & Alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
