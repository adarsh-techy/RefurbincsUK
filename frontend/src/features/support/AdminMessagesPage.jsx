import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiMessageSquare,
  FiSearch,
  FiRefreshCw,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowLeft,
  FiSend,
  FiExternalLink,
  FiX,
  FiCheck,
} from 'react-icons/fi';
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
  'Our technicians have inspected the battery and repair is underway.',
  'This battery has completed testing and is ready for dispatch.',
  'The issue has been resolved. Please let us know if you need anything else.',
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/40' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/40' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/40' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-slate-400 border-slate-200 dark:border-white/10' },
};

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

  // Active selected ticket & mobile thread switch
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
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
        if (found) {
          loadTicketDetail(found.id);
          setMobileThreadOpen(true);
        }
      } else if (list.length > 0 && !activeTicket && window.innerWidth >= 1024) {
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

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
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
  }, [tickets, filterStatus, filterClient, search]);

  const unreadRepliesCount = useMemo(() => {
    return tickets.filter((t) => {
      const lastRole = t.last_message?.sender_role;
      return (lastRole === 'client' || lastRole === 'recycle_client') && t.status !== 'closed';
    }).length;
  }, [tickets]);

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-12 w-full max-w-full">
      {/* ── Executive Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-base sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Support Messages
            </h1>
            {unreadRepliesCount > 0 ? (
              <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 px-2 py-0.2 text-[9.5px] sm:text-[10.5px] font-black text-rose-700 dark:text-rose-300">
                {unreadRepliesCount} awaiting reply
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.2 text-[9.5px] sm:text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                All clear
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            Direct communication channel with battery fleet clients and recyclers
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-7 sm:h-8 items-center gap-1.5 rounded-xl bg-blue-600 px-2.5 sm:px-3 text-[11px] sm:text-xs font-black text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            <FiRefreshCw className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Executive Metric Bar (Divided 4-Column Strip) ─────────────── */}
      <div className="grid grid-cols-4 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white shadow-2xs divide-x divide-slate-100 dark:border-white/10 dark:bg-surface-900 dark:divide-white/5 overflow-hidden">
        {/* Open Tickets */}
        <button
          type="button"
          onClick={() => setFilterStatus((prev) => (prev === 'open' ? 'all' : 'open'))}
          className={`p-1.5 sm:p-2.5 text-center transition-all cursor-pointer ${
            filterStatus === 'open'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 ring-1 ring-inset ring-amber-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-[9px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              Open
            </span>
          </div>
          <div className="mt-0.5 text-xs sm:text-lg font-black text-slate-900 dark:text-white">
            {stats.open || 0}
          </div>
        </button>

        {/* In Progress */}
        <button
          type="button"
          onClick={() => setFilterStatus((prev) => (prev === 'in_progress' ? 'all' : 'in_progress'))}
          className={`p-1.5 sm:p-2.5 text-center transition-all cursor-pointer ${
            filterStatus === 'in_progress'
              ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[9px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              In Prog
            </span>
          </div>
          <div className="mt-0.5 text-xs sm:text-lg font-black text-slate-900 dark:text-white">
            {stats.in_progress || 0}
          </div>
        </button>

        {/* Resolved */}
        <button
          type="button"
          onClick={() => setFilterStatus((prev) => (prev === 'resolved' ? 'all' : 'resolved'))}
          className={`p-1.5 sm:p-2.5 text-center transition-all cursor-pointer ${
            filterStatus === 'resolved'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-inset ring-emerald-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              Resolved
            </span>
          </div>
          <div className="mt-0.5 text-xs sm:text-lg font-black text-slate-900 dark:text-white">
            {stats.resolved || 0}
          </div>
        </button>

        {/* Total Inquiries */}
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`p-1.5 sm:p-2.5 text-center transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-slate-100/80 dark:bg-surface-800 ring-1 ring-inset ring-slate-400'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span className="text-[9px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              Total
            </span>
          </div>
          <div className="mt-0.5 text-xs sm:text-lg font-black text-slate-900 dark:text-white">
            {stats.total || 0}
          </div>
        </button>
      </div>

      {/* ── Unified 2-Pane Workspace (Mobile-Responsive Stack or Split) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4 items-start">
        {/* ── Left Pane: Inbox Queue List (Hidden on mobile if thread open) ── */}
        <div
          className={`lg:col-span-5 flex flex-col rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 ${
            mobileThreadOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Quick-Filter Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar mb-2">
            {[
              { id: 'all', label: 'All', count: stats.total || 0 },
              { id: 'open', label: 'Open', count: stats.open || 0 },
              { id: 'in_progress', label: 'In Prog', count: stats.in_progress || 0 },
              { id: 'resolved', label: 'Resolved', count: stats.resolved || 0 },
            ].map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg sm:rounded-xl px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-surface-800 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1 py-0.2 text-[9px] font-black ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                        : 'bg-slate-200/80 text-slate-600 dark:bg-surface-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Client Selector Bar */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket, client, battery…"
                className="w-full h-7.5 sm:h-8.5 rounded-xl border border-slate-200 bg-slate-50/70 pl-7.5 pr-6 text-[11px] sm:text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-white dark:placeholder:text-neutral-500 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="h-7.5 sm:h-8.5 max-w-[110px] sm:max-w-[130px] rounded-xl border border-slate-200 bg-white px-2 text-[10.5px] sm:text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-slate-200 cursor-pointer"
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
          <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar max-h-[560px] pr-0.5">
            {loading && tickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-neutral-500">
                <FiRefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                Loading inbox requests…
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-surface-800/40">
                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-surface-700 mx-auto flex items-center justify-center text-slate-400 mb-2">
                  <FiCheck className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-neutral-200">No tickets found</p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-neutral-500">
                  {search || filterStatus !== 'all' || filterClient
                    ? 'No support requests match your filters.'
                    : 'All customer conversations are resolved.'}
                </p>
                {(search || filterStatus !== 'all' || filterClient) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilterStatus('all');
                      setFilterClient('');
                    }}
                    className="mt-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-slate-200"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                const lastRole = t.last_message?.sender_role;
                const isClientLastSender = lastRole === 'client' || lastRole === 'recycle_client';

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      loadTicketDetail(t.id);
                      setMobileThreadOpen(true);
                    }}
                    className={`group relative cursor-pointer rounded-xl sm:rounded-2xl border p-2 sm:p-2.5 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40 shadow-2xs dark:border-blue-500 dark:bg-blue-950/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60 dark:border-white/10 dark:bg-surface-800 dark:hover:border-white/20 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Active Indicator Strip */}
                    {isSelected && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r bg-blue-600" />
                    )}

                    <div className="flex items-start justify-between gap-1.5 pl-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-[9px] sm:text-[10px] font-bold text-slate-700 dark:bg-surface-700 dark:text-slate-200">
                          {clientInitials(t.client_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-[11px] sm:text-xs font-black text-slate-900 dark:text-white">
                              {t.client_name || 'Fleet Client'}
                            </span>
                            {isClientLastSender && t.status !== 'closed' && (
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" title="Awaiting reply" />
                            )}
                          </div>
                          <p className="font-mono text-[9px] sm:text-[9.5px] text-slate-400 dark:text-neutral-400">
                            {t.ticket_number}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded px-1.5 py-0.2 text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider border ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    <p className="mt-1 pl-0.5 text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white truncate">
                      {t.subject}
                    </p>

                    <p className="mt-0.5 pl-0.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
                      {t.last_message?.message || 'No messages yet'}
                    </p>

                    <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1 text-[9px] sm:text-[9.5px] text-slate-400 dark:border-white/5 dark:text-neutral-400 pl-0.5">
                      <div className="flex items-center gap-1 truncate">
                        <span className="capitalize text-slate-500 dark:text-slate-400">{t.category?.replace(/_/g, ' ')}</span>
                        {t.battery_code && (
                          <span className="rounded bg-slate-100 px-1 py-0.2 font-mono font-bold text-slate-700 dark:bg-surface-700 dark:text-neutral-200">
                            🔋 {t.battery_code}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0">{timeAgo(t.updated_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Pane: Active Thread & Reply Studio ───────────────── */}
        <div
          className={`lg:col-span-7 ${
            mobileThreadOpen ? 'flex' : 'hidden lg:flex'
          } flex-col rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-2xs dark:border-white/10 dark:bg-surface-900 min-h-[500px] sm:min-h-[560px] justify-between`}
        >
          {loadingActive ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-400">Loading conversation…</p>
            </div>
          ) : activeTicket ? (
            <div className="flex flex-1 flex-col justify-between gap-2.5 sm:gap-3">
              {/* Active Ticket Header Bar */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-2 sm:p-2.5 shadow-2xs dark:border-white/10 dark:bg-surface-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Mobile Back Button to return to inbox queue */}
                    <button
                      type="button"
                      onClick={() => setMobileThreadOpen(false)}
                      className="lg:hidden inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-700 dark:text-white"
                      title="Back to inbox"
                    >
                      <FiArrowLeft className="h-3.5 w-3.5" />
                    </button>

                    <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-mono text-[10px] sm:text-xs font-bold text-white shadow-2xs">
                      {clientInitials(activeTicket.client_name)}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white">
                          {activeTicket.client_name || 'Client Inquiry'}
                        </span>
                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-slate-500 bg-white dark:bg-surface-700 px-1 py-0.2 rounded border border-slate-200 dark:border-white/10">
                          {activeTicket.ticket_number}
                        </span>
                      </div>
                      <h2 className="mt-0.5 text-[11px] sm:text-xs font-bold text-slate-800 dark:text-neutral-200 truncate max-w-[200px] sm:max-w-md">
                        {activeTicket.subject}
                      </h2>
                    </div>
                  </div>

                  {/* Status Dropdown Controller */}
                  <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400">Status:</span>
                    <select
                      value={activeTicket.status}
                      disabled={updatingStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[10.5px] font-bold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-surface-900 dark:text-white cursor-pointer"
                    >
                      <option value="open">🟢 Open</option>
                      <option value="in_progress">🔵 In Progress</option>
                      <option value="resolved">✅ Resolved</option>
                      <option value="closed">⚪ Closed</option>
                    </select>
                  </div>
                </div>

                {/* Metadata Strip */}
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[9.5px] sm:text-[10px] font-medium text-slate-600 dark:text-neutral-300 border-t border-slate-200/70 pt-1.5 dark:border-white/5">
                  <span className="rounded bg-white px-1.5 py-0.2 border border-slate-200/80 dark:bg-surface-700 dark:border-white/10">
                    Category: <strong className="capitalize text-slate-900 dark:text-white">{activeTicket.category?.replace(/_/g, ' ')}</strong>
                  </span>

                  <span className="rounded bg-white px-1.5 py-0.2 border border-slate-200/80 dark:bg-surface-700 dark:border-white/10">
                    Priority: <strong className="capitalize text-slate-900 dark:text-white">{activeTicket.priority}</strong>
                  </span>

                  {activeTicket.battery_code && (
                    <Link
                      to={`/batteries/${encodeURIComponent(activeTicket.battery_code)}`}
                      className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.2 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 transition-colors"
                    >
                      <span className="font-mono font-bold">🔋 {activeTicket.battery_code}</span>
                      <FiExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  )}

                  <span className="ml-auto text-[9px] text-slate-400 dark:text-neutral-400">
                    {formatTime(activeTicket.created_at)}
                  </span>
                </div>
              </div>

              {/* Message Chat Feed */}
              <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar p-2.5 sm:p-3.5 bg-slate-50/50 rounded-xl sm:rounded-2xl dark:bg-surface-800/40 border border-slate-100 dark:border-white/5 max-h-[340px] sm:max-h-[390px]">
                {(activeTicket.messages || []).map((msg) => {
                  const isStaff =
                    msg.sender_role === 'admin' ||
                    msg.sender_role === 'super_admin' ||
                    msg.sender_role === 'staff';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 mb-0.5 px-0.5">
                        <span className="font-bold text-slate-700 dark:text-neutral-300">
                          {isStaff ? `${msg.sender_name} (Support)` : `${activeTicket.client_name} (${msg.sender_name})`}
                        </span>
                        <span>•</span>
                        <span>{formatTime(msg.created_at)}</span>
                      </div>

                      <div
                        className={`max-w-[88%] sm:max-w-[80%] rounded-xl sm:rounded-2xl px-3 py-2 text-[11px] sm:text-xs font-medium leading-relaxed shadow-2xs ${
                          isStaff
                            ? 'bg-blue-600 text-white rounded-br-xs'
                            : 'bg-white text-slate-900 border border-slate-200/90 dark:bg-surface-800 dark:border-white/10 dark:text-neutral-100 rounded-bl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Snippets */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                  Quick Reply:
                </span>
                {QUICK_REPLIES.map((quick, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReplyMessage(quick)}
                    className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-300 dark:hover:bg-surface-700 cursor-pointer"
                  >
                    {quick.slice(0, 28)}…
                  </button>
                ))}
              </div>

              {/* Reply Studio Composer */}
              <form onSubmit={handleSendReply} className="flex flex-col gap-1.5 border-t border-slate-100 pt-2 dark:border-white/5">
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
                    placeholder={`Reply to ${activeTicket.client_name} (⌘+Enter)…`}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-2 pr-16 text-[11px] sm:text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-surface-800 dark:text-white dark:focus:bg-surface-900 transition-all resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyMessage.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer active:scale-95"
                  >
                    <span>Send</span>
                    <FiSend className="h-2.5 w-2.5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-8 sm:p-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-surface-800 text-slate-400 mb-2.5">
                <FiMessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Select a Support Ticket</h3>
              <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-neutral-400">
                Choose an inquiry from the left queue to review client message history and dispatch a response.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
