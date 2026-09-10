import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api-client';
import { useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { socket } from '../../services/socket-client';

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

export default function MessagesHeaderIcon() {
  const user = useSelector((state) => state.auth.user);
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';
  const isAccentHeader = !!customTheme?.applyToHeader;

  const isClient = user?.role === 'client' || user?.role === 'recycle_client';
  const targetUrl = isClient ? '/my/support' : '/messages';

  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, in_progress: 0, client_unread: 0, admin_unread: 0 });
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef(null);

  async function fetchTickets() {
    try {
      setLoading(true);
      const [ticketsRes, statsRes] = await Promise.all([
        apiClient.get('/tickets?limit=5'),
        apiClient.get('/tickets/stats'),
      ]);
      setTickets(ticketsRes.data?.data || []);
      setStats(statsRes.data || { open: 0, in_progress: 0, client_unread: 0, admin_unread: 0 });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);

    const onTicketCreated = () => fetchTickets();
    const onTicketMessage = () => fetchTickets();
    const onTicketUpdated = () => fetchTickets();

    socket.on('ticket:created', onTicketCreated);
    socket.on('ticket:message', onTicketMessage);
    socket.on('ticket:updated', onTicketUpdated);

    return () => {
      clearInterval(interval);
      socket.off('ticket:created', onTicketCreated);
      socket.off('ticket:message', onTicketMessage);
      socket.off('ticket:updated', onTicketUpdated);
    };
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

  // For Client: Badge only appears when Support/Admin has sent a reply!
  // For Admin: Badge appears when Client has sent a new ticket/reply!
  const activeCount = isClient
    ? (stats.client_unread || 0)
    : (stats.admin_unread ?? (stats.open || 0));

  return (
    <div className="relative" ref={popoverRef}>
      {/* ── Message Icon Button ────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchTickets();
        }}
        aria-label="Support & Messages"
        title="Support & Messages"
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
          isAccentHeader
            ? 'text-white hover:bg-white/15'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.053 4.053 0 0 0 .546-1.503C3.606 17.07 3 14.655 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>

        {activeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs">
            {activeCount > 99 ? '99+' : activeCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Popover ────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-surface-900 animate-in fade-in zoom-in-95 duration-150">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {isClient ? 'Help & Support Requests' : 'Client Messages & Tickets'}
              </span>
              {activeCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.2 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  {activeCount} {isClient ? 'New Replies' : 'New Messages'}
                </span>
              )}
            </div>
            <Link
              to={targetUrl}
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Open Inbox →
            </Link>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto no-scrollbar">
            {loading && tickets.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading messages…</div>
            ) : (() => {
              const displayedTickets = isClient
                ? tickets.filter((t) => {
                    const lastRole = t.last_message?.sender_role;
                    return lastRole === 'admin' || lastRole === 'super_admin' || lastRole === 'staff';
                  })
                : tickets.filter((t) => {
                    const lastRole = t.last_message?.sender_role;
                    return lastRole === 'client' || lastRole === 'recycle_client';
                  });

              if (displayedTickets.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-slate-400">
                    {isClient ? 'No new messages from support team' : 'No new messages from clients'}
                  </div>
                );
              }

              return displayedTickets.map((t) => {
                const isOpen = t.status === 'open';
                const isInProgress = t.status === 'in_progress';
                const isResolved = t.status === 'resolved';

                const lastRole = t.last_message?.sender_role;
                const isSupportSender = lastRole === 'admin' || lastRole === 'super_admin' || lastRole === 'staff';
                const isClientSender = lastRole === 'client' || lastRole === 'recycle_client';

                const isNewReplyForClient = isClient && isSupportSender && t.status !== 'closed';
                const isNewMessageForAdmin = !isClient && isClientSender && t.status !== 'closed';

                return (
                  <Link
                    key={t.id}
                    to={`${targetUrl}?ticket=${t.id}`}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col gap-1 rounded-xl p-2.5 transition-colors ${
                      isNewReplyForClient || isNewMessageForAdmin
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                          {t.ticket_number} • {t.subject}
                        </span>
                        {isNewReplyForClient && (
                          <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                            New Reply
                          </span>
                        )}
                        {isNewMessageForAdmin && (
                          <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                            New Message
                          </span>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.2 text-[10px] font-bold ${
                          isOpen
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : isInProgress
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                              : isResolved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-400'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>

                    {!isClient && (
                      <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        {t.client_name}
                      </p>
                    )}

                    <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
                      {isClient && isClientSender ? 'You: ' : isSupportSender ? 'Support: ' : ''}
                      {t.last_message?.message || 'No messages yet'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {isClient
                          ? isSupportSender
                            ? 'Support Team'
                            : 'Waiting for Support Response'
                          : t.last_message?.sender_name || t.client_name}
                      </span>
                      <span>{timeAgo(t.updated_at)}</span>
                    </div>
                  </Link>
                );
              });
            })()}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2.5 text-center dark:border-white/5">
            <Link
              to={targetUrl}
              onClick={() => setOpen(false)}
              className="block w-full rounded-xl bg-slate-50 py-2 text-center text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10"
            >
              {isClient ? 'Open Help & Support Center' : 'View All Support Tickets'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
