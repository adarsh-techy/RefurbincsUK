import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api-client';
import Modal from '../../components/ui/Modal';
import { useTheme } from '../../context/ThemeContext';
import { socket } from '../../services/socket-client';

const CATEGORIES = [
  { id: 'general', label: 'General Inquiry & Assistance' },
  { id: 'battery_inquiry', label: 'Battery Status / QR Code Question' },
  { id: 'repair_status', label: 'Repair & Service Inquiries' },
  { id: 'delivery_pickup', label: 'Delivery & Logistics' },
  { id: 'billing', label: 'Billing & Invoice Question' },
];

const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

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

export default function ClientSupportPage() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTicketIdParam = searchParams.get('ticket');

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Active selected ticket
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New ticket modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newPriority, setNewPriority] = useState('normal');
  const [newBatteryCode, setNewBatteryCode] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // The client's own registered batteries — used to suggest and validate
  // the "Linked Battery ID" field, so a ticket can't be filed against a
  // code that isn't actually theirs (typo'd or otherwise).
  const [myBatteries, setMyBatteries] = useState([]);
  const [batteriesLoaded, setBatteriesLoaded] = useState(false);
  const [showBatterySuggestions, setShowBatterySuggestions] = useState(false);

  const messagesEndRef = useRef(null);

  async function fetchTickets() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/tickets');
      const list = res.data?.data || [];
      setTickets(list);

      if (selectedTicketIdParam) {
        const found = list.find((t) => String(t.id) === String(selectedTicketIdParam));
        if (found) loadTicketDetail(found.id);
      } else if (list.length > 0 && !activeTicket) {
        loadTicketDetail(list[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
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
    fetchTickets();
  }, []);

  useEffect(() => {
    apiClient
      .get('/clients/me/batteries')
      .then(({ data: result }) => {
        setMyBatteries(result.data || []);
        setBatteriesLoaded(true);
      })
      .catch(() => {
        // Not every account this page serves (e.g. recycle_client) has a
        // linked battery fleet — fail quietly and leave batteriesLoaded
        // false, so the field isn't validated against an empty list.
      });
  }, []);

  // Socket listeners for real-time messages
  useEffect(() => {
    function onCreated(t) {
      setTickets((prev) => [t, ...prev.filter((item) => item.id !== t.id)]);
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
    }

    function onUpdated(t) {
      setTickets((prev) => prev.map((item) => (item.id === t.id ? { ...item, ...t } : item)));
      if (activeTicket && activeTicket.id === t.id) {
        setActiveTicket((prev) => ({ ...prev, ...t }));
      }
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

  const batterySuggestions = (() => {
    const q = newBatteryCode.trim().toLowerCase();
    if (!q) return myBatteries.slice(0, 8);
    return myBatteries
      .filter(
        (b) =>
          b.battery_code.toLowerCase().includes(q) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q))
      )
      .slice(0, 8);
  })();

  const isKnownBatteryCode = (code) =>
    myBatteries.some((b) => b.battery_code.toUpperCase() === code.trim().toUpperCase());

  async function handleCreateTicket(e) {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;

    // Only enforced once the client's own battery list has actually loaded
    // (it doesn't for every account this page serves, e.g. recycle_client)
    // — otherwise a real code could get rejected against an empty list.
    if (batteriesLoaded && newBatteryCode.trim() && !isKnownBatteryCode(newBatteryCode)) {
      setCreateError('That battery code isn’t linked to your account. Pick one from the suggestions.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiClient.post('/tickets', {
        subject: newSubject,
        category: newCategory,
        priority: newPriority,
        batteryCode: newBatteryCode || null,
        initialMessage: newMessage,
      });

      setCreateOpen(false);
      setNewSubject('');
      setNewBatteryCode('');
      setNewMessage('');
      fetchTickets();
      loadTicketDetail(res.data.id);
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message);
    } finally {
      setCreating(false);
    }
  }

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

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const num = (t.ticket_number || '').toLowerCase();
      const sub = (t.subject || '').toLowerCase();
      const bat = (t.battery_code || '').toLowerCase();
      if (!num.includes(q) && !sub.includes(q) && !bat.includes(q)) return false;
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
                <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Help & Support Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Direct messaging with the Refurbinics service & repair team.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{ backgroundColor: accent }}
          className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-98"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          New Help Request
        </button>
      </div>

      {/* ── Modern 2-Pane Unified Workspace ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[640px] items-stretch">
        {/* ── Left Pane: My Tickets Queue ────────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-surface-900">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-white/5 dark:bg-surface-850 mb-3">
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' },
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
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your requests…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-800 dark:text-white dark:focus:bg-surface-900"
            />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Tickets Scroll List */}
          <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar max-h-[520px] pr-1">
            {loading && tickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading your tickets…</div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-surface-850">
                <p className="text-xs font-semibold text-slate-700 dark:text-neutral-300">No support tickets</p>
                <p className="mt-1 text-[11px] text-slate-400">Click &apos;New Help Request&apos; to submit an inquiry.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const isOpen = t.status === 'open';
                const isInProgress = t.status === 'in_progress';
                const isResolved = t.status === 'resolved';

                const lastRole = t.last_message?.sender_role;
                const isSupportReply = lastRole === 'admin' || lastRole === 'super_admin' || lastRole === 'staff';

                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetail(t.id)}
                    className={`group relative cursor-pointer rounded-2xl border p-3 transition-all ${
                      isSelected
                        ? 'border-emerald-500/80 bg-emerald-50 shadow-xs dark:border-emerald-500/60 dark:bg-emerald-950/25'
                        : 'border-slate-200/70 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 hover:shadow-2xs dark:border-white/10 dark:bg-surface-850 dark:hover:border-white/20'
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                          {t.ticket_number}
                        </span>
                        {isSupportReply && t.status !== 'closed' && (
                          <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                            New Reply
                          </span>
                        )}
                      </div>

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

                    <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-neutral-100 line-clamp-1">
                      {t.subject}
                    </p>

                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-1">
                      {isSupportReply ? 'Support: ' : 'You: '}
                      {t.last_message?.message || 'No messages yet'}
                    </p>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400 dark:border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize">{t.category?.replace('_', ' ')}</span>
                        {t.battery_code && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 font-mono font-bold text-white shadow-2xs dark:bg-emerald-500">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-yellow-300">
                              <rect width="16" height="10" x="2" y="7" rx="2" ry="2" />
                              <line x1="22" x2="22" y1="11" y2="13" />
                            </svg>
                            {t.battery_code}
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

        {/* ── Right Pane: Live Support Chat ─────────────────────────── */}
        <div className="lg:col-span-7 flex flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-surface-900 justify-between">
          {loadingActive ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
              <p className="text-xs font-medium text-slate-400">Loading conversation…</p>
            </div>
          ) : activeTicket ? (
            <div className="flex flex-1 flex-col justify-between gap-4">
              {/* ── Enhanced Thread Header Container ── */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-slate-50/70 to-emerald-50/20 p-4 shadow-2xs dark:border-white/10 dark:from-surface-850 dark:via-surface-850/80 dark:to-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white bg-slate-200/80 dark:bg-white/10 px-2.5 py-0.5 rounded-lg">
                      {activeTicket.ticket_number}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        activeTicket.status === 'open'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          : activeTicket.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                            : activeTicket.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-400'
                      }`}
                    >
                      {activeTicket.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
                    Created {formatTime(activeTicket.created_at)}
                  </span>
                </div>

                <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                  {activeTicket.subject}
                </h2>

                {/* ── Enhanced Details Bar ── */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200/70 bg-blue-50/70 p-2.5 text-xs font-semibold text-slate-700 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-neutral-200">
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-blue-900 shadow-2xs border border-blue-200/60 dark:bg-surface-800 dark:text-blue-300 dark:border-white/5">
                    Category: <strong className="capitalize text-slate-900 dark:text-white">{activeTicket.category?.replace('_', ' ')}</strong>
                  </span>
                  
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-bold text-amber-900 shadow-2xs border border-amber-200/60 dark:bg-surface-800 dark:text-amber-300 dark:border-white/5">
                    Priority: <strong className="capitalize text-slate-900 dark:text-white">{activeTicket.priority}</strong>
                  </span>

                  {activeTicket.battery_code && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-mono font-bold text-white shadow-xs dark:bg-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-yellow-300">
                        <rect width="16" height="10" x="2" y="7" rx="2" ry="2" />
                        <line x1="22" x2="22" y1="11" y2="13" />
                      </svg>
                      {activeTicket.battery_code}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages Canvas */}
              <div className="flex-1 space-y-3.5 overflow-y-auto no-scrollbar pr-1 max-h-[380px] p-2 bg-slate-50/40 rounded-2xl dark:bg-black/20">
                {(activeTicket.messages || []).map((msg) => {
                  const isMe = msg.sender_role === 'client' || msg.sender_role === 'recycle_client';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                        <span className="font-bold text-slate-700 dark:text-neutral-300">
                          {isMe ? 'You' : `${msg.sender_name} (Support Team)`}
                        </span>
                        <span>•</span>
                        <span>{formatTime(msg.created_at)}</span>
                      </div>

                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-2xs ${
                          isMe
                            ? 'text-white'
                            : 'bg-white text-slate-900 border border-slate-200/80 dark:bg-surface-800 dark:border-white/10 dark:text-neutral-100'
                        }`}
                        style={isMe ? { backgroundColor: accent } : {}}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Studio Composer */}
              {activeTicket.status === 'closed' ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-surface-800">
                  This ticket has been marked as closed. You can open a new request if you need further help.
                </div>
              ) : (
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
                      placeholder="Type your message or response (Press ⌘+Enter to send)…"
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
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-400 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-7 w-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.053 4.053 0 0 0 .546-1.503C3.606 17.07 3 14.655 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Need Help with Your Battery Fleet?</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-neutral-400">
                Select an existing ticket from the left or click &quot;New Help Request&quot; to message our support team.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create New Ticket Modal ─────────────────────────────────── */}
      {createOpen && (
        <Modal title="Create New Help Request / Ticket" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            {createError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300 mb-1">
                Subject *
              </label>
              <input
                type="text"
                required
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Brief summary of your inquiry (e.g. Battery UBE-0012 inquiry)"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-surface-600 dark:bg-surface-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-surface-600 dark:bg-surface-800 dark:text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300 mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-surface-600 dark:bg-surface-800 dark:text-white"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300 mb-1">
                Linked Battery ID <span className="text-[11px] font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={newBatteryCode}
                onChange={(e) => setNewBatteryCode(e.target.value.toUpperCase())}
                onFocus={() => setShowBatterySuggestions(true)}
                onBlur={() => setTimeout(() => setShowBatterySuggestions(false), 150)}
                placeholder={batteriesLoaded ? 'Start typing to pick from your batteries…' : 'e.g. UBE-0001 or serial number'}
                autoComplete="off"
                className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs font-medium focus:outline-hidden dark:bg-surface-800 ${
                  batteriesLoaded && newBatteryCode.trim() && !isKnownBatteryCode(newBatteryCode)
                    ? 'border-red-400 text-red-600 focus:border-red-500 dark:border-red-500/60 dark:text-red-400'
                    : 'border-slate-300 text-slate-800 focus:border-emerald-500 dark:border-surface-600 dark:text-white'
                }`}
              />
              {batteriesLoaded && newBatteryCode.trim() && !isKnownBatteryCode(newBatteryCode) && (
                <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  Not one of your registered batteries — pick from the suggestions below.
                </p>
              )}
              {showBatterySuggestions && batteriesLoaded && batterySuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-surface-850">
                  {batterySuggestions.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onMouseDown={() => {
                        setNewBatteryCode(b.battery_code);
                        setShowBatterySuggestions(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span className="font-mono font-semibold text-slate-800 dark:text-neutral-100">
                        {b.battery_code}
                      </span>
                      {b.serial_number && (
                        <span className="text-[10px] text-slate-400 dark:text-neutral-500">{b.serial_number}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300 mb-1">
                Message / Details *
              </label>
              <textarea
                required
                rows={4}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe your request or issue in detail…"
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-surface-600 dark:bg-surface-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  creating ||
                  !newSubject.trim() ||
                  !newMessage.trim() ||
                  (batteriesLoaded && newBatteryCode.trim() && !isKnownBatteryCode(newBatteryCode))
                }
                style={{ backgroundColor: accent }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
