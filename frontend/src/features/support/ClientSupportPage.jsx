import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Modal from '../../components/ui/overlays/Modal';
import { socket } from '../../services/socket-client';

const CATEGORIES = [
  { id: 'general', label: 'General Inquiry & Assistance' },
  { id: 'battery_inquiry', label: 'Battery Status / QR Code' },
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
  const userRole = useSelector((state) => state.auth.user?.role);

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

  // Mobile view toggle: 'list' | 'chat'
  const [mobileView, setMobileView] = useState('list');

  // New ticket modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newPriority, setNewPriority] = useState('normal');
  const [newBatteryCode, setNewBatteryCode] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

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
        if (found) {
          loadTicketDetail(found.id);
          setMobileView('chat');
        }
      } else if (list.length > 0 && !activeTicket && window.innerWidth >= 1024) {
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
      setMobileView('chat');
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
    if (userRole !== 'client') return;
    apiClient
      .get('/clients/me/batteries')
      .then(({ data: result }) => {
        setMyBatteries(result.data || []);
        setBatteriesLoaded(true);
      })
      .catch(() => {});
  }, [userRole]);

  // Socket listeners for real-time messages
  useEffect(() => {
    function onCreated(t) {
      setTickets((prev) => [t, ...prev.filter((item) => item.id !== t.id)]);
    }

    function onMessage(payload) {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === payload.ticketId
            ? { ...t, updated_at: new Date().toISOString(), last_message: payload.message }
            : t
        )
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

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

  return (
    <div className="space-y-2.5 pb-8">
      {/* ── Header Bar: Unbreakable Button ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
              Help & Support
            </h1>
            {counts.all > 0 && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                {counts.all}
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
            Direct communication with Refurbnics engineering
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 whitespace-nowrap inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          <span>New Ticket</span>
        </button>
      </div>

      {/* ── Main Layout: Queue List vs Chat Thread ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[560px] items-stretch">
        {/* Left Pane: Queue (Hidden on mobile if chat is active) */}
        <div
          className={`lg:col-span-5 flex flex-col rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 ${
            mobileView === 'chat' && activeTicket ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* 4-Segment Grid Bar (ZERO Horizontal Scroll) */}
          <div className="grid grid-cols-4 gap-1 w-full mb-2">
            {[
              { id: 'all', short: 'All', full: 'All', count: counts.all },
              { id: 'open', short: 'Open', full: 'Open', count: counts.open },
              { id: 'in_progress', short: 'Active', full: 'In Progress', count: counts.in_progress },
              { id: 'resolved', short: 'Done', full: 'Resolved', count: counts.resolved },
            ].map((tab) => {
              const isActive = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1 px-1 text-[10.5px] font-semibold transition-all w-full truncate ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                      : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline truncate">{tab.full}</span>
                  <span
                    className={`rounded-full px-1 text-[9px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket #, subject or battery…"
              className="w-full h-8 rounded-lg border border-slate-200/80 bg-slate-50/70 py-1 pl-7 pr-7 text-[11px] font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>

          {/* Tickets Scroll List */}
          <div className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar max-h-[480px]">
            {loading && tickets.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-slate-400">Loading tickets…</div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.053 4.053 0 0 0 .546-1.503C3.606 17.07 3 14.655 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No support tickets</p>
                <p className="mt-0.5 text-[10.5px] text-slate-400">Click &apos;New Ticket&apos; to submit an inquiry.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = activeTicket?.id === t.id;
                const isOpen = t.status === 'open';
                const isInProgress = t.status === 'in_progress';
                const isResolved = t.status === 'resolved';

                const lastRole = t.last_message?.sender_role;
                const isSupportReply =
                  lastRole === 'admin' || lastRole === 'super_admin' || lastRole === 'staff';

                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetail(t.id)}
                    className={`relative cursor-pointer rounded-xl border p-2.5 transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/40 shadow-2xs'
                        : 'border-slate-200/70 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                          {t.ticket_number}
                        </span>
                        {isSupportReply && t.status !== 'closed' && (
                          <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[8.5px] font-bold text-white">
                            New Reply
                          </span>
                        )}
                      </div>

                      <span
                        className={`rounded-md px-1.5 py-0.2 text-[9.5px] font-bold ${
                          isOpen
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : isInProgress
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                              : isResolved
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white truncate">
                      {t.subject}
                    </p>

                    <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                      {isSupportReply ? 'Support: ' : 'You: '}
                      {t.last_message?.message || 'No messages yet'}
                    </p>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-1.5 text-[9.5px] text-slate-400">
                      <div className="flex items-center gap-1 truncate mr-2">
                        <span className="capitalize">{t.category?.replace(/_/g, ' ')}</span>
                        {t.battery_code && (
                          <span className="rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/70 px-1 font-mono font-bold">
                            {t.battery_code}
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

        {/* Right Pane: Live Support Chat Thread */}
        <div
          className={`lg:col-span-7 flex flex-col rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 justify-between ${
            mobileView === 'list' && activeTicket ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {loadingActive ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-14">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-[11px] text-slate-400">Loading conversation…</p>
            </div>
          ) : activeTicket ? (
            <div className="flex flex-1 flex-col justify-between gap-2">
              {/* Thread Header */}
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-2 sm:p-2.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="lg:hidden inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <span>←</span>
                      <span>List</span>
                    </button>

                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {activeTicket.ticket_number}
                    </span>

                    <span
                      className={`rounded-md px-1.5 py-0.2 text-[9.5px] font-bold ${
                        activeTicket.status === 'open'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                          : activeTicket.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                            : activeTicket.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {activeTicket.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {formatTime(activeTicket.created_at)}
                  </span>
                </div>

                <h2 className="mt-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {activeTicket.subject}
                </h2>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-800 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300">
                    Category: <strong className="capitalize">{activeTicket.category?.replace(/_/g, ' ')}</strong>
                  </span>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800 border border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300">
                    Priority: <strong className="capitalize">{activeTicket.priority}</strong>
                  </span>
                  {activeTicket.battery_code && (
                    <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-1.5 py-0.5 font-mono font-bold dark:bg-emerald-950/60 dark:text-emerald-300">
                      🔋 {activeTicket.battery_code}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar max-h-[380px] p-2 bg-slate-50/40 rounded-lg dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                {(activeTicket.messages || []).map((msg) => {
                  const isMe = msg.sender_role === 'client' || msg.sender_role === 'recycle_client';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 mb-0.5 px-1">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {isMe ? 'You' : `${msg.sender_name} (Support)`}
                        </span>
                        <span>•</span>
                        <span>{formatTime(msg.created_at)}</span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs font-medium leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-900 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              {activeTicket.status === 'closed' ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  This ticket is marked as closed. You can open a new request if you need further help.
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="flex gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type a message or response…"
                    className="flex-1 h-8.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyMessage.trim()}
                    className="inline-flex h-8.5 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <span>Send</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.053 4.053 0 0 0 .546-1.503C3.606 17.07 3 14.655 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Select a Ticket</h3>
              <p className="mt-0.5 text-[10.5px] text-slate-500 max-w-xs">
                Pick a ticket from the left list to view conversation history or send a reply.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Support Ticket Modal (Centered, Compact & 100% Visible) ── */}
      {createOpen && (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="New Support Ticket"
          size="md"
          centered={true}
        >
          <form onSubmit={handleCreateTicket} className="flex flex-col gap-2">
            {createError && (
              <div className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                Subject *
              </label>
              <input
                type="text"
                required
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Brief summary of your inquiry"
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Category & Priority in compact 2-column grid */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  <option value="general">General Inquiry</option>
                  <option value="battery_inquiry">Battery Status</option>
                  <option value="repair_status">Repair Inquiries</option>
                  <option value="delivery_pickup">Logistics / Pickup</option>
                  <option value="billing">Billing & Invoices</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
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
              <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                Linked Battery Code (Optional)
              </label>
              <input
                type="text"
                value={newBatteryCode}
                onChange={(e) => {
                  setNewBatteryCode(e.target.value);
                  setShowBatterySuggestions(true);
                }}
                onFocus={() => setShowBatterySuggestions(true)}
                placeholder="e.g. BAT-2024-001"
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              {showBatterySuggestions && batterySuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  {batterySuggestions.map((b) => (
                    <button
                      key={b.id || b.battery_code}
                      type="button"
                      onClick={() => {
                        setNewBatteryCode(b.battery_code);
                        setShowBatterySuggestions(false);
                      }}
                      className="w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      {b.battery_code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                Message / Details *
              </label>
              <textarea
                required
                rows={2}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Describe what you need assistance with…"
                className="w-full h-14 rounded-lg border border-slate-200 bg-white p-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Always-visible Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newSubject.trim() || !newMessage.trim()}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
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
