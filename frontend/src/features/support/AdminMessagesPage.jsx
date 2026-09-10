import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import { useTheme } from '../../context/ThemeContext';
import { socket } from '../../services/socket-client';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const isToday = new Date().toDateString() === d.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

function clientInitials(name) {
  return (name || 'CL')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const QUICK_REPLIES = [
  'Thank you for reaching out. We are actively investigating this battery.',
  'Our technicians have inspected the battery and the repair is underway.',
  'This battery has completed testing and is ready for dispatch.',
  'The issue has been resolved. Please let us know if you need anything else.',
];

export default function AdminMessagesPage() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [searchParams, setSearchParams] = useSearchParams();
  const ticketIdParam = searchParams.get('ticket');

  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('');
  const [search, setSearch] = useState('');

  // Active selected ticket
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const messagesEndRef = useRef(null);

  async function loadData() {
    try {
      setLoading(true);
      const [ticketsRes, statsRes, clientsRes] = await Promise.all([
        apiClient.get('/tickets?limit=100'),
        apiClient.get('/tickets/stats'),
        apiClient.get('/clients'),
      ]);
      const list = ticketsRes.data?.data || [];
      setTickets(list);
      setStats(statsRes.data || {});
      setClients(clientsRes.data || []);

      if (ticketIdParam) {
        const found = list.find((t) => String(t.id) === String(ticketIdParam));
        if (found) loadTicketDetail(found.id);
      } else if (list.length > 0 && !activeTicket) {
        loadTicketDetail(list[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketDetail(id) {
    try {
      setLoadingActive(true);
      const res = await apiClient.get(`/tickets/${id}`);
      setActiveTicket(res.data);
      setSearchParams({ ticket: id });
    } catch {
      // ignore
    } finally {
      setLoadingActive(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Socket listeners for real-time messages
  useEffect(() => {
    function onCreated(t) {
      setTickets((prev) => [t, ...prev.filter((item) => item.id !== t.id)]);
      apiClient.get('/tickets/stats').then((res) => setStats(res.data)).catch(() => {});
    }

    function onMessage(payload) {
      setTickets((prev) =>
        prev.map((t) => (t.id === payload.ticketId ? { ...t, updated_at: new Date().toISOString(), last_message: payload.message } : t))
      );
      if (activeTicket && activeTicket.id === payload.ticketId) {
        setActiveTicket((prev) => ({
          ...prev,
          messages: [...(prev.messages || []), payload.message],
        }));
      }
      apiClient.get('/tickets/stats').then((res) => setStats(res.data)).catch(() => {});
    }

    function onUpdated(t) {
      setTickets((prev) => prev.map((item) => (item.id === t.id ? { ...item, ...t } : item)));
      if (activeTicket && activeTicket.id === t.id) {
        setActiveTicket((prev) => ({ ...prev, ...t }));
      }
      apiClient.get('/tickets/stats').then((res) => setStats(res.data)).catch(() => {});
    }

    socket.on('ticket:created', onCreated);
    socket.on('ticket:message', onMessage);
    socket.on('ticket:updated', onUpdated);

    return () => {
      socket.off('ticket:created', onCreated);
      socket.off('ticket:message', onMessage);
      socket.off('ticket:updated', onUpdated);
    };
  }, [activeTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  async function handleSendReply(e) {
    if (e) e.preventDefault();
    if (!replyMessage.trim() || !activeTicket) return;

    setSendingReply(true);
    try {
      await apiClient.post(`/tickets/${activeTicket.id}/messages`, {
        message: replyMessage,
      });
      setReplyMessage('');
      loadTicketDetail(activeTicket.id);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSendingReply(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!activeTicket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await apiClient.patch(`/tickets/${activeTicket.id}/status`, { status: newStatus });
      setActiveTicket((prev) => ({ ...prev, status: res.data.status }));
      setTickets((prev) => prev.map((t) => (t.id === activeTicket.id ? { ...t, status: res.data.status } : t)));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterClient && String(t.client_id) !== String(filterClient) && t.client_name !== filterClient) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const num = (t.ticket_number || '').toLowerCase();
      const sub = (t.subject || '').toLowerCase();
      const cl = (t.client_name || '').toLowerCase();
      const bat = (t.battery_code || '').toLowerCase();
      if (!num.includes(q) && !sub.includes(q) && !cl.includes(q) && !bat.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.213 50.89 50.89 0 0 0-8.71 0 4.409 4.409 0 0 0-1.033.213c.114-1.866 1.483-3.476 3.405-3.727H4.913ZM3.75 9.75c0-1.036.84-1.875 1.875-1.875h12.75c1.035 0 1.875.84 1.875 1.875v7.5c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875v-7.5Z" />
                <path d="M8.25 12a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM8.25 15a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Messages & Support Tickets
              </h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Direct communication channel with your battery fleet clients.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stat Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-slate-600 dark:text-neutral-300">Open:</span>
            <strong className="text-slate-900 dark:text-white">{stats.open || 0}</strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-slate-600 dark:text-neutral-300">In Progress:</span>
            <strong className="text-slate-900 dark:text-white">{stats.in_progress || 0}</strong>
          </div>
        </div>
      </div>

      {/* ── Modern 2-Pane Unified Workspace ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[640px] items-stretch">
        {/* ── Left Pane: Inbox Queue ─────────────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-surface-900">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-white/5 dark:bg-surface-850 mb-3">
            {[
              { id: 'all', label: 'All', count: stats.total || 0 },
              { id: 'open', label: 'Open', count: stats.open || 0 },
              { id: 'in_progress', label: 'In Progress', count: stats.in_progress || 0 },
              { id: 'resolved', label: 'Resolved', count: stats.resolved || 0 },
            ].map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  style={isActive ? { backgroundColor: accent, color: '#ffffff' } : {}}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1 text-[10px] font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-200/60 text-slate-700 dark:bg-white/10 dark:text-neutral-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Client Filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket, client, battery…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white dark:focus:bg-surface-900"
              />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
            </div>

            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="max-w-[130px] rounded-xl border border-slate-200 bg-slate-50/60 py-2 px-2 text-xs font-semibold text-slate-800 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ticket Queue List */}
          <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar max-h-[520px] pr-1">
            {loading && tickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading inbox…</div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-surface-850">
                <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">No tickets found</p>
                <p className="mt-1 text-[11px] text-slate-400">No support requests match your search or filter.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const isOpen = t.status === 'open';
                const isInProgress = t.status === 'in_progress';
                const isResolved = t.status === 'resolved';

                const lastRole = t.last_message?.sender_role;
                const isClientLastSender = lastRole === 'client' || lastRole === 'recycle_client';

                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetail(t.id)}
                    className={`group relative cursor-pointer rounded-2xl border p-3 transition-all ${
                      isSelected
                        ? 'border-emerald-500/80 bg-emerald-50/20 shadow-xs dark:border-emerald-500/60 dark:bg-emerald-950/25'
                        : 'border-slate-200/70 bg-white hover:border-slate-300 hover:shadow-2xs dark:border-white/10 dark:bg-surface-850 dark:hover:border-white/20'
                    }`}
                  >
                    {/* Active accent vertical indicator bar */}
                    {isSelected && (
                      <span
                        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-neutral-200">
                          {clientInitials(t.client_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          {/* Client Name Background Badge */}
                          <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-200/60 dark:bg-emerald-950/60 dark:border-emerald-800/40 dark:text-emerald-300">
                            {t.client_name}
                          </span>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                            {t.ticket_number}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isClientLastSender && t.status !== 'closed' && (
                          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Awaiting your reply" />
                        )}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isOpen
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                              : isInProgress
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                : isResolved
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-400'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-neutral-100 line-clamp-1">
                      {t.subject}
                    </p>

                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-1">
                      {t.last_message?.message || 'No messages yet'}
                    </p>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400 dark:border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize">{t.category?.replace('_', ' ')}</span>
                        {t.battery_code && (
                          <span className="rounded bg-slate-100 px-1 py-0.2 font-mono font-bold text-slate-700 dark:bg-white/10 dark:text-neutral-300">
                            🔋 {t.battery_code}
                          </span>
                        )}
                      </div>
                      <span>{timeAgo(t.updated_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Pane: Active Thread & Reply Studio ───────────────── */}
        <div className="lg:col-span-7 flex flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-900 justify-between">
          {loadingActive ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
              <p className="text-xs font-medium text-slate-400">Loading conversation…</p>
            </div>
          ) : activeTicket ? (
            <div className="flex flex-1 flex-col justify-between gap-4">
              {/* ── Enhanced Client Name & Ticket Header Container ── */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-slate-50/70 to-emerald-50/20 p-4 shadow-2xs dark:border-white/10 dark:from-surface-850 dark:via-surface-850/80 dark:to-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 font-mono text-xs font-bold text-white shadow-xs">
                      {clientInitials(activeTicket.client_name)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* High contrast Client Name Badge */}
                        <span className="rounded-xl bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900 border border-emerald-300/80 shadow-2xs dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60">
                          {activeTicket.client_name}
                        </span>
                        <span className="font-mono text-xs font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg dark:bg-white/10 dark:text-neutral-200">
                          {activeTicket.ticket_number}
                        </span>
                      </div>
                      <h2 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {activeTicket.subject}
                      </h2>
                    </div>
                  </div>

                  {/* Status Dropdown Controller */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">Status:</span>
                    <select
                      value={activeTicket.status}
                      disabled={updatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white"
                    >
                      <option value="open">🟢 Open</option>
                      <option value="in_progress">🔵 In Progress</option>
                      <option value="resolved">✅ Resolved</option>
                      <option value="closed">⚪ Closed</option>
                    </select>
                  </div>
                </div>

                {/* ── Enhanced Distinct Details Bar Background ── */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200/70 bg-blue-50/70 p-2.5 text-xs font-semibold text-slate-700 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-neutral-200">
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-blue-900 shadow-2xs border border-blue-200/60 dark:bg-surface-800 dark:text-blue-300 dark:border-white/5">
                    Category: <strong className="capitalize text-slate-900 dark:text-white">{activeTicket.category?.replace('_', ' ')}</strong>
                  </span>
                  
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow-2xs border border-amber-200/60 dark:bg-surface-800 dark:text-amber-300 dark:border-white/5">
                    Priority: <strong className="capitalize text-slate-900 dark:text-white">{activeTicket.priority}</strong>
                  </span>

                  {activeTicket.battery_code && (
                    <Link
                      to={`/batteries/${encodeURIComponent(activeTicket.battery_code)}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-800 shadow-2xs border border-emerald-300/60 hover:bg-emerald-200 transition-colors dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                    >
                      <span>🔋 {activeTicket.battery_code}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h4a.75.75 0 0 1 0 1.5h-4Z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  )}

                  <span className="ml-auto text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                    Created {formatTime(activeTicket.created_at)}
                  </span>
                </div>
              </div>

              {/* Message Chat Feed */}
              <div className="flex-1 space-y-3.5 overflow-y-auto no-scrollbar pr-1 max-h-[380px] p-2 bg-slate-50/40 rounded-2xl dark:bg-black/20">
                {(activeTicket.messages || []).map((msg) => {
                  const isStaff = msg.sender_role === 'admin' || msg.sender_role === 'super_admin' || msg.sender_role === 'staff';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                        <span className="font-bold text-slate-700 dark:text-neutral-300">
                          {isStaff ? `${msg.sender_name} (Support)` : `${activeTicket.client_name} (${msg.sender_name})`}
                        </span>
                        <span>•</span>
                        <span>{formatTime(msg.created_at)}</span>
                      </div>

                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-2xs ${
                          isStaff
                            ? 'text-white'
                            : 'bg-white text-slate-900 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 dark:text-neutral-100'
                        }`}
                        style={isStaff ? { backgroundColor: accent } : {}}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Response Snippets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Reply:</span>
                {QUICK_REPLIES.map((quick, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyMessage(quick)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700"
                  >
                    {quick.slice(0, 32)}…
                  </button>
                ))}
              </div>

              {/* Modern Reply Studio Composer */}
              <form onSubmit={handleSendReply} className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
                <div className="relative flex items-center">
                  <textarea
                    rows={2}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSendReply(e);
                      }
                    }}
                    placeholder={`Reply directly to ${activeTicket.client_name} (Press ⌘+Enter to send)…`}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 p-3 pr-24 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-surface-800 dark:text-white dark:focus:bg-surface-900"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyMessage.trim()}
                    style={{ backgroundColor: accent }}
                    className="absolute right-2.5 top-3.5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <span>Send</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-400 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-7 w-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.053 4.053 0 0 0 .546-1.503C3.606 17.07 3 14.655 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Select a Support Ticket</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-neutral-400">
                Choose a ticket from the left inbox queue to view conversation history and reply to the client.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
