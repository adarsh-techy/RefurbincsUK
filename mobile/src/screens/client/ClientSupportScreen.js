import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';

// Help & Support — clients and recycling partners: the mobile version of the
// web ClientSupportPage (status tabs, search, ticket list with "New Reply",
// the conversation with its category / priority / battery details, reply
// composer, and "New Help Request" with category, priority and a linked
// battery picked from the client's own batteries). The web gets new
// messages over a socket; the phone re-reads an open ticket every 15 s.
// Office roles get the Support Messages view (all clients, status changes).

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

const CLIENT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
];

const SUPPORT_ROLES = ['admin', 'super_admin', 'staff'];

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (new Date().toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_TONE = {
  open: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' },
  in_progress: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  resolved: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' },
  closed: { bg: 'bg-slate-200/50 dark:bg-slate-700/50', text: 'text-slate-500 dark:text-slate-400' },
};

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

export default function ClientSupportScreen() {
  const user = useSelector((state) => state.auth.user);
  const route = useRoute();
  // Office roles see every client's tickets and can change status; clients
  // and recycling partners only see their own and can raise new ones.
  const isOffice = ['super_admin', 'admin', 'staff'].includes(user?.role);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function changeStatus(status) {
    if (!activeTicket) return;
    setUpdatingStatus(true);
    try {
      const { data } = await apiClient.patch(`/tickets/${activeTicket.id}/status`, { status });
      setActiveTicket((t) => ({ ...t, ...(data?.ticket || data || {}), status }));
      setTickets((list) => list.map((t) => (t.id === activeTicket.id ? { ...t, status } : t)));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }
  const [tickets, setTickets] = useState([]);
  // office roles: ticket counters + status / client filters, as on the web
  // Support Messages page (GET /tickets/stats, client list from /clients)
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newPriority, setNewPriority] = useState('normal');
  const [newBatteryCode, setNewBatteryCode] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [search, setSearch] = useState('');
  // the fleet client's own batteries — suggestions for, and validation of,
  // the "Linked Battery ID" (GET /clients/me/batteries is client-only, so a
  // recycling partner's field isn't validated, as on the web)
  const [myBatteries, setMyBatteries] = useState([]);
  const [batteriesLoaded, setBatteriesLoaded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const scrollRef = useRef(null);

  const fetchTickets = useCallback(async () => {
    setError(null);
    try {
      if (isOffice) {
        const [ticketsRes, statsRes, clientsRes] = await Promise.all([
          apiClient.get('/tickets', { params: { limit: 100 } }),
          apiClient.get('/tickets/stats').catch(() => ({ data: null })),
          apiClient.get('/clients').catch(() => ({ data: [] })),
        ]);
        setTickets(ticketsRes.data?.data || []);
        setStats(statsRes.data || null);
        const list = Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data?.data || [];
        setClients(list);
      } else {
        const { data } = await apiClient.get('/tickets');
        setTickets(data?.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOffice]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (user?.role !== 'client') return;
    apiClient
      .get('/clients/me/batteries')
      .then(({ data: result }) => {
        setMyBatteries(result?.data || []);
        setBatteriesLoaded(true);
      })
      .catch(() => {});
  }, [user?.role]);

  // opened from a notification / dashboard with a ticket id
  const routeTicketId = route.params?.ticketId;
  useEffect(() => {
    if (!isOffice && routeTicketId) openTicket(routeTicketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffice, routeTicketId]);

  // the web gets new messages / status changes over a socket; re-read the
  // open conversation (and the list) instead
  const activeId = activeTicket?.id;
  useEffect(() => {
    if (isOffice || !activeId) return undefined;
    const t = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/tickets/${activeId}`);
        setActiveTicket((prev) => (prev && prev.id === activeId ? data : prev));
      } catch {
        // keep what is shown
      }
    }, 15000);
    return () => clearInterval(t);
  }, [isOffice, activeId]);

  // same local filter as the web page
  const visibleTickets = !isOffice
    ? tickets.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      const q = search.trim().toLowerCase();
      if (q) {
        const num = (t.ticket_number || '').toLowerCase();
        const sub = (t.subject || '').toLowerCase();
        const bat = (t.battery_code || '').toLowerCase();
        if (!num.includes(q) && !sub.includes(q) && !bat.includes(q)) return false;
      }
      return true;
    })
    : tickets.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterClient && String(t.client_id) !== String(filterClient) && t.client_name !== filterClient) return false;
      return true;
    });

  function onRefresh() {
    setRefreshing(true);
    fetchTickets();
  }

  async function openTicket(id) {
    setLoadingActive(true);
    try {
      const { data } = await apiClient.get(`/tickets/${id}`);
      setActiveTicket(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoadingActive(false);
    }
  }

  const batterySuggestions = (() => {
    const q = newBatteryCode.trim().toLowerCase();
    if (!q) return myBatteries.slice(0, 8);
    return myBatteries
      .filter((b) => b.battery_code.toLowerCase().includes(q) || (b.serial_number && b.serial_number.toLowerCase().includes(q)))
      .slice(0, 8);
  })();
  const isKnownBatteryCode = (code) => myBatteries.some((b) => b.battery_code.toUpperCase() === code.trim().toUpperCase());
  const batteryInvalid = Boolean(batteriesLoaded && newBatteryCode.trim() && !isKnownBatteryCode(newBatteryCode));

  async function handleCreateTicket() {
    if (!newSubject.trim() || !newMessage.trim()) return;
    if (batteryInvalid) {
      setCreateError('That battery code isn’t linked to your account. Pick one from the suggestions.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const { data } = await apiClient.post('/tickets', {
        subject: newSubject,
        category: newCategory,
        priority: newPriority,
        batteryCode: newBatteryCode || null,
        initialMessage: newMessage,
      });
      setCreateOpen(false);
      setNewSubject('');
      setNewCategory('general');
      setNewPriority('normal');
      setNewBatteryCode('');
      setNewMessage('');
      fetchTickets();
      openTicket(data.id);
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSendReply() {
    if (!replyMessage.trim() || !activeTicket) return;
    setSendingReply(true);
    try {
      await apiClient.post(`/tickets/${activeTicket.id}/messages`, { message: replyMessage });
      setReplyMessage('');
      await openTicket(activeTicket.id);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      if (isOffice) setError(err.response?.data?.message || err.message);
      else Alert.alert('Message not sent', err.response?.data?.message || err.message);
    } finally {
      setSendingReply(false);
    }
  }

  // ── Ticket Detail View ────────────────────────────────────────────────
  if (activeTicket) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50 dark:bg-slate-950">
        <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 py-3">
          <TouchableOpacity onPress={() => setActiveTicket(null)} className="flex-row items-center gap-1.5">
            <Text className="text-sm font-bold text-blue-600 dark:text-blue-400">‹ Back</Text>
          </TouchableOpacity>
          <View className="items-end">
            <Text className="text-xs font-bold text-slate-900 dark:text-white" numberOfLines={1}>
              {activeTicket.subject}
            </Text>
            <Text className="text-[10px] text-slate-400 dark:text-slate-500">{activeTicket.ticket_number}</Text>
          </View>
        </View>

        {loadingActive ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#38bdf8" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="p-4 gap-3"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {isOffice && (
              <View className="rounded-2xl border border-slate-200 bg-white p-3">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {activeTicket.client_name || 'Client'} · status: {(activeTicket.status || 'open').replace('_', ' ')}
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {['open', 'in_progress', 'resolved', 'closed'].map((s) => {
                    const active = activeTicket.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        disabled={updatingStatus || active}
                        onPress={() => changeStatus(s)}
                        className={`rounded-lg px-2.5 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}
                      >
                        <Text className={`text-[11px] font-bold capitalize ${active ? 'text-white' : 'text-slate-600'}`}>{s.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {!isOffice && (
              <View className="rounded-2xl border border-slate-200 bg-white p-4">
                <View className="flex-row flex-wrap items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="rounded-lg bg-slate-200 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-900">{activeTicket.ticket_number}</Text>
                    <View className={`rounded-full px-2.5 py-0.5 ${(STATUS_TONE[activeTicket.status] || STATUS_TONE.open).bg}`}>
                      <Text className={`text-[10px] font-bold ${(STATUS_TONE[activeTicket.status] || STATUS_TONE.open).text}`}>
                        {(activeTicket.status || 'open').replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-[11px] font-medium text-slate-500">Created {formatTime(activeTicket.created_at)}</Text>
                </View>
                <Text className="mt-2 text-base font-bold text-slate-900">{activeTicket.subject}</Text>
                <View className="mt-3 flex-row flex-wrap gap-1.5">
                  <Text className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                    Category: <Text className="capitalize text-slate-900">{(activeTicket.category || 'general').replace('_', ' ')}</Text>
                  </Text>
                  <Text className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                    Priority: <Text className="capitalize text-slate-900">{activeTicket.priority || 'normal'}</Text>
                  </Text>
                  {activeTicket.battery_code ? (
                    <Text className="rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-900">🔋 {activeTicket.battery_code}</Text>
                  ) : null}
                </View>
              </View>
            )}
            {isOffice && activeTicket.battery_code && (
              <View className="self-start rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1">
                <Text className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Battery: {activeTicket.battery_code}
                </Text>
              </View>
            )}
            {(activeTicket.messages || []).map((msg) => {
              const isMe = msg.sender_id != null && user?.id != null ? Number(msg.sender_id) === Number(user.id) : msg.sender_role === 'client' || msg.sender_role === 'recycle_client';
              return (
                <View key={msg.id} className={`max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                  <View
                    className={`rounded-2xl px-3.5 py-2.5 ${
                      isMe ? 'bg-blue-600' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <Text className={`text-xs leading-relaxed ${isMe ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                      {msg.message}
                    </Text>
                  </View>
                  <Text className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    {isOffice
                      ? `${isMe ? 'You' : msg.sender_name || 'Support'} · ${timeAgo(msg.created_at)}`
                      : `${isMe ? 'You' : `${msg.sender_name || 'Support'} (Support Team)`} • ${formatTime(msg.created_at)}`}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {!isOffice && activeTicket.status === 'closed' ? (
          <View className="border-t border-slate-200 bg-slate-50 p-4">
            <Text className="text-center text-xs font-semibold text-slate-500">
              This ticket has been marked as closed. You can open a new request if you need further help.
            </Text>
          </View>
        ) : (
        <View className="flex-row items-center gap-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-3">
          <TextInput
            value={replyMessage}
            onChangeText={setReplyMessage}
            placeholder={isOffice ? 'Type a message…' : 'Type your message or response…'}
            placeholderTextColor="#64748b"
            multiline
            className="flex-1 max-h-24 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white"
          />
          <TouchableOpacity
            onPress={handleSendReply}
            disabled={sendingReply || !replyMessage.trim()}
            className="rounded-2xl bg-blue-600 px-4 py-3 disabled:opacity-50"
          >
            {sendingReply ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-xs font-bold text-white">Send</Text>}
          </TouchableOpacity>
        </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // ── Ticket List View ─────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 py-3">
        <Text className="flex-1 pr-2 text-xs text-slate-500 dark:text-slate-400">
          {isOffice ? 'Support requests from all clients' : 'Direct messaging with the Refurbinics service & repair team.'}
        </Text>
        {!isOffice && (
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            className="rounded-xl bg-blue-600 px-3.5 py-2 shadow-sm active:bg-blue-700"
          >
            <Text className="text-xs font-bold text-white">+ New Help Request</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isOffice && (
        <View className="gap-2 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900">
          <View className="flex-row gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {CLIENT_TABS.map((tab) => {
              const on = filterStatus === tab.id;
              return (
                <TouchableOpacity key={tab.id} onPress={() => setFilterStatus(tab.id)} className={`flex-1 items-center rounded-xl py-1.5 ${on ? 'bg-emerald-600' : ''}`}>
                  <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your requests…"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900"
          />
        </View>
      )}

      {isOffice && !loading && (
        <View className="gap-2 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900">
          <View className="flex-row gap-2">
            {[['Open', stats?.open, 'text-amber-600'], ['In progress', stats?.in_progress, 'text-blue-600'], ['Resolved', stats?.resolved, 'text-emerald-600'], ['Unread', stats?.admin_unread, 'text-red-600']].map(([label, n, color]) => (
              <View key={label} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
                <Text className="text-[9px] font-bold uppercase text-slate-400">{label}</Text>
                <Text className={`text-base font-black ${color}`}>{n || 0}</Text>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
            {[
              { id: 'all', label: 'All', count: stats?.total },
              { id: 'open', label: 'Open', count: stats?.open },
              { id: 'in_progress', label: 'In Progress', count: stats?.in_progress },
              { id: 'resolved', label: 'Resolved', count: stats?.resolved },
            ].map((tab) => (
              <TouchableOpacity key={tab.id} onPress={() => setFilterStatus(tab.id)} className={`rounded-xl px-3 py-1.5 ${filterStatus === tab.id ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Text className={`text-[11px] font-bold ${filterStatus === tab.id ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{tab.label} ({tab.count || 0})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {clients.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              {[{ id: '', name: 'All clients' }, ...clients].map((c) => (
                <TouchableOpacity key={String(c.id)} onPress={() => setFilterClient(String(c.id))} className={`rounded-xl px-3 py-1.5 ${String(filterClient) === String(c.id) ? 'bg-violet-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <Text className={`text-[11px] font-bold ${String(filterClient) === String(c.id) ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading tickets…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchTickets} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleTickets}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-4 gap-3 pb-16"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">
                {isOffice ? (tickets.length ? 'No requests match these filters' : 'No support requests yet') : 'No support tickets'}
              </Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {isOffice ? 'Client support requests will appear here.' : "Tap 'New Help Request' to submit an inquiry."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const tone = STATUS_TONE[item.status] || STATUS_TONE.open;
            if (!isOffice) {
              const isSupportReply = SUPPORT_ROLES.includes(item.last_message?.sender_role);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => openTicket(item.id)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1 flex-row items-center gap-1.5">
                      <Text className="font-mono text-xs font-extrabold text-slate-900">{item.ticket_number}</Text>
                      {isSupportReply && item.status !== 'closed' ? (
                        <Text className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">New Reply</Text>
                      ) : null}
                    </View>
                    <View className={`rounded-full ${tone.bg} px-2.5 py-0.5`}>
                      <Text className={`text-[10px] font-bold uppercase ${tone.text}`}>{(item.status || 'open').replace('_', ' ')}</Text>
                    </View>
                  </View>
                  <Text className="mt-2 text-xs font-bold text-slate-900" numberOfLines={1}>{item.subject}</Text>
                  <Text className="mt-0.5 text-[11px] text-slate-500" numberOfLines={1}>
                    {isSupportReply ? 'Support: ' : 'You: '}
                    {item.last_message?.message || 'No messages yet'}
                  </Text>
                  <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
                    <View className="flex-1 flex-row items-center gap-1.5">
                      <Text className="text-[10px] capitalize text-slate-400">{(item.category || 'general').replace('_', ' ')}</Text>
                      {item.battery_code ? (
                        <Text className="rounded-full bg-emerald-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white">🔋 {item.battery_code}</Text>
                      ) : null}
                    </View>
                    <Text className="text-[10px] text-slate-400">{timeAgo(item.updated_at)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openTicket(item.id)}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 pr-2 text-sm font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <View className={`rounded-full ${tone.bg} px-2.5 py-0.5`}>
                    <Text className={`text-[10px] font-bold uppercase ${tone.text}`}>
                      {(item.status || 'open').replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                {isOffice && item.client_name ? (
                  <Text className="mt-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300" numberOfLines={1}>{item.client_name}</Text>
                ) : null}
                <Text className="mt-1 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
                  {item.last_message?.message || 'No messages yet'}
                </Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                    {(item.category || 'general').replace('_', ' ')}
                    {item.battery_code ? ` · ${item.battery_code}` : ''}
                  </Text>
                  <Text className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(item.updated_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── New Ticket Modal ────────────────────────────────────────────── */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 items-center justify-center bg-slate-900/50 px-4"
        >
          <ScrollView
            className="w-full max-w-md"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl"
          >
            <Text className="text-base font-extrabold text-slate-900 dark:text-white">Create New Help Request / Ticket</Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Signed in as {user?.name || user?.email}
            </Text>

            {createError && (
              <View className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <Text className="text-xs font-semibold text-red-600">{createError}</Text>
              </View>
            )}

            <Text className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Subject *</Text>
            <TextInput
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder="Brief summary of your inquiry (e.g. Battery UBE-0012 inquiry)"
              placeholderTextColor="#64748b"
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
            />

            <Text className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Category</Text>
            <View className="gap-1.5">
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setNewCategory(c.id)}
                  className={`rounded-xl border px-3 py-2 ${newCategory === c.id ? 'border-emerald-600 bg-emerald-600' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}
                >
                  <Text className={`text-xs font-semibold ${newCategory === c.id ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Priority</Text>
            <View className="flex-row gap-1.5">
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setNewPriority(p.id)}
                  className={`flex-1 items-center rounded-xl py-2 ${newPriority === p.id ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-800'}`}
                >
                  <Text className={`text-xs font-bold ${newPriority === p.id ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Linked Battery ID <Text className="font-normal normal-case text-slate-400">(optional)</Text>
            </Text>
            <TextInput
              value={newBatteryCode}
              onChangeText={(v) => setNewBatteryCode(v.toUpperCase())}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={batteriesLoaded ? 'Start typing to pick from your batteries…' : 'e.g. UBE-0001 or serial number'}
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              className={`rounded-2xl border bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm ${batteryInvalid ? 'border-red-400 text-red-600' : 'border-slate-300 text-slate-900 dark:border-slate-700 dark:text-white'}`}
            />
            {batteryInvalid ? (
              <Text className="mt-1 text-[11px] font-semibold text-red-600">Not one of your registered batteries — pick from the suggestions below.</Text>
            ) : null}
            {showSuggestions && batteriesLoaded && batterySuggestions.length > 0 && (
              <View className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                {batterySuggestions.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => {
                      setNewBatteryCode(b.battery_code);
                      setShowSuggestions(false);
                    }}
                    className="flex-row items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700"
                  >
                    <Text className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{b.battery_code}</Text>
                    {b.serial_number ? <Text className="text-[10px] text-slate-400">{b.serial_number}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Message / Details *</Text>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Describe your request or issue in detail…"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              className="min-h-24 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
              textAlignVertical="top"
            />

            <View className="mt-5 flex-row justify-end gap-2.5">
              <TouchableOpacity onPress={() => setCreateOpen(false)} className="rounded-xl px-4 py-2.5">
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTicket}
                disabled={creating || !newSubject.trim() || !newMessage.trim() || batteryInvalid}
                className={`rounded-xl bg-emerald-600 px-5 py-2.5 ${creating || !newSubject.trim() || !newMessage.trim() || batteryInvalid ? 'opacity-50' : ''}`}
              >
                <Text className="text-sm font-bold text-white">{creating ? 'Submitting…' : 'Submit Ticket'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
