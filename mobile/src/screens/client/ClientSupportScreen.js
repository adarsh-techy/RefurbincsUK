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
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

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

const CLIENT_TABS = [
  { id: 'all', short: 'All', countKey: 'all' },
  { id: 'open', short: 'Open', countKey: 'open' },
  { id: 'in_progress', short: 'Prog', countKey: 'in_progress' },
  { id: 'resolved', short: 'Done', countKey: 'resolved' },
];

const SUPPORT_ROLES = ['admin', 'super_admin', 'staff'];

const QUICK_REPLIES = [
  'Thank you for reaching out. We are investigating this battery.',
  'Our technicians have inspected the battery and repair is underway.',
  'This battery has completed testing and is ready for dispatch.',
  'The issue has been resolved. Let us know if you need anything else.',
];

function clientInitials(name) {
  return (name || 'CL')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (new Date().toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_TONE = {
  open: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-300',
  },
  in_progress: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-800 dark:text-blue-300',
  },
  resolved: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-800 dark:text-emerald-300',
  },
  closed: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
  },
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
  const navigation = useNavigation();
  const isOffice = ['super_admin', 'admin', 'staff'].includes(user?.role);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function changeStatus(status) {
    if (!activeTicket) return;
    setUpdatingStatus(true);
    try {
      const { data } = await apiClient.patch(
        `/tickets/${activeTicket.id}/status`,
        { status }
      );
      setActiveTicket((t) => ({ ...t, ...(data?.ticket || data || {}), status }));
      setTickets((list) =>
        list.map((t) => (t.id === activeTicket.id ? { ...t, status } : t))
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const [tickets, setTickets] = useState([]);
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
        const list = Array.isArray(clientsRes.data)
          ? clientsRes.data
          : clientsRes.data?.data || [];
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

  const routeTicketId = route.params?.ticketId;
  useEffect(() => {
    if (routeTicketId) openTicket(routeTicketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffice, routeTicketId]);

  const activeId = activeTicket?.id;
  useEffect(() => {
    if (!activeId) return undefined;
    const t = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/tickets/${activeId}`);
        setActiveTicket((prev) => (prev && prev.id === activeId ? data : prev));
      } catch {
        // ignore
      }
    }, 15000);
    return () => clearInterval(t);
  }, [isOffice, activeId]);

  const visibleTickets = !isOffice
    ? tickets.filter((t) => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        const q = search.trim().toLowerCase();
        if (q) {
          const num = (t.ticket_number || '').toLowerCase();
          const sub = (t.subject || '').toLowerCase();
          const bat = (t.battery_code || '').toLowerCase();
          if (!num.includes(q) && !sub.includes(q) && !bat.includes(q))
            return false;
        }
        return true;
      })
    : tickets.filter((t) => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (
          filterClient &&
          String(t.client_id) !== String(filterClient) &&
          t.client_name !== filterClient
        )
          return false;
        const q = search.trim().toLowerCase();
        if (q) {
          const hay = [
            t.ticket_number,
            t.subject,
            t.client_name,
            t.battery_code,
          ].map((v) => (v || '').toLowerCase());
          if (!hay.some((v) => v.includes(q))) return false;
        }
        return true;
      });

  const tabCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

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
      .filter(
        (b) =>
          b.battery_code.toLowerCase().includes(q) ||
          (b.serial_number && b.serial_number.toLowerCase().includes(q))
      )
      .slice(0, 8);
  })();

  const isKnownBatteryCode = (code) =>
    myBatteries.some(
      (b) => b.battery_code.toUpperCase() === code.trim().toUpperCase()
    );
  const batteryInvalid = Boolean(
    batteriesLoaded && newBatteryCode.trim() && !isKnownBatteryCode(newBatteryCode)
  );

  async function handleCreateTicket() {
    if (!newSubject.trim() || !newMessage.trim()) return;
    if (batteryInvalid) {
      setCreateError(
        'That battery code isn’t linked to your account. Pick one from the suggestions.'
      );
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
      await apiClient.post(`/tickets/${activeTicket.id}/messages`, {
        message: replyMessage,
      });
      setReplyMessage('');
      await openTicket(activeTicket.id);
      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        100
      );
    } catch (err) {
      if (isOffice) setError(err.response?.data?.message || err.message);
      else
        Alert.alert(
          'Message not sent',
          err.response?.data?.message || err.message
        );
    } finally {
      setSendingReply(false);
    }
  }

  // ── Ticket Detail View ────────────────────────────────────────────────
  if (activeTicket) {
    const tone = STATUS_TONE[activeTicket.status] || STATUS_TONE.open;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-slate-50 dark:bg-slate-950"
      >
        {/* Compact Thread Header */}
        <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-3 py-2.5">
          <TouchableOpacity
            onPress={() => setActiveTicket(null)}
            activeOpacity={0.7}
            className="flex-row items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2 py-1 shadow-2xs"
          >
            <Icon name="arrowLeft" color="#475569" size={12} />
            <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              Back
            </Text>
          </TouchableOpacity>

          <View className="min-w-0 flex-1 mx-2 items-center">
            {isOffice && activeTicket.client_name ? (
              <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400" numberOfLines={1}>
                {activeTicket.client_name}
              </Text>
            ) : null}
            <Text
              className="text-xs font-bold text-slate-900 dark:text-white"
              numberOfLines={1}
            >
              {activeTicket.subject}
            </Text>
            <Text className="font-mono text-[9.5px] text-slate-400">
              {activeTicket.ticket_number}
            </Text>
          </View>

          <View className={`rounded-md px-1.5 py-0.5 ${tone.bg}`}>
            <Text className={`text-[9px] font-bold uppercase ${tone.text}`}>
              {(activeTicket.status || 'open').replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {loadingActive ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563eb" size="small" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="p-3 gap-2.5"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            {/* Meta Strip */}
            <View className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xs">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="text-[10px] text-slate-500">
                  Category:{' '}
                  <Text className="font-bold capitalize text-slate-800 dark:text-slate-200">
                    {(activeTicket.category || 'general').replace(/_/g, ' ')}
                  </Text>
                </Text>
                <Text className="text-slate-300 dark:text-slate-700">•</Text>
                <Text className="text-[10px] text-slate-500">
                  Priority:{' '}
                  <Text className="font-bold capitalize text-slate-800 dark:text-slate-200">
                    {activeTicket.priority || 'normal'}
                  </Text>
                </Text>
                {activeTicket.battery_code ? (
                  <>
                    <Text className="text-slate-300 dark:text-slate-700">•</Text>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('BatteryDetail', {
                          code: activeTicket.battery_code,
                          fromScan: false,
                        })
                      }
                      className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 border border-emerald-200/70"
                    >
                      <Text className="font-mono text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300">
                        🔋 {activeTicket.battery_code}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>

              {isOffice && (
                <View className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-row flex-wrap gap-1">
                  {['open', 'in_progress', 'resolved', 'closed'].map((s) => {
                    const active = activeTicket.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        disabled={updatingStatus || active}
                        onPress={() => changeStatus(s)}
                        className={`rounded px-2 py-0.5 ${
                          active ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        <Text
                          className={`text-[9.5px] font-bold ${
                            active ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {
                            {
                              open: 'Open',
                              in_progress: 'In Prog',
                              resolved: 'Resolved',
                              closed: 'Closed',
                            }[s]
                          }
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Chat Bubbles */}
            {(activeTicket.messages || []).map((msg) => {
              const isMe =
                msg.sender_id != null && user?.id != null
                  ? Number(msg.sender_id) === Number(user.id)
                  : msg.sender_role === 'client' ||
                    msg.sender_role === 'recycle_client';

              return (
                <View
                  key={msg.id}
                  className={`max-w-[85%] ${
                    isMe ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <View
                    className={`rounded-xl px-3 py-2 shadow-2xs ${
                      isMe
                        ? 'bg-blue-600'
                        : 'border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <Text
                      className={`text-[11.5px] leading-relaxed ${
                        isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {msg.message}
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-[9px] text-slate-400">
                    {isOffice
                      ? `${
                          SUPPORT_ROLES.includes(msg.sender_role)
                            ? `${msg.sender_name} (Support)`
                            : `${activeTicket.client_name || 'Client'}`
                        } • ${formatTime(msg.created_at)}`
                      : `${isMe ? 'You' : `${msg.sender_name || 'Support'}`} • ${formatTime(msg.created_at)}`}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Composer */}
        {!isOffice && activeTicket.status === 'closed' ? (
          <View className="border-t border-slate-200 bg-slate-50 p-3">
            <Text className="text-center text-[11px] text-slate-500">
              This ticket is closed. Open a new request if you need assistance.
            </Text>
          </View>
        ) : (
          <View className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-2.5">
            {isOffice && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="items-center gap-1 mb-2"
              >
                {QUICK_REPLIES.map((q) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => setReplyMessage(q)}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2 py-0.5"
                  >
                    <Text className="text-[10px] text-slate-600 dark:text-slate-300">
                      {q.slice(0, 26)}…
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View className="flex-row items-center gap-1.5">
              <TextInput
                value={replyMessage}
                onChangeText={setReplyMessage}
                placeholder="Type a message or response…"
                placeholderTextColor="#94a3b8"
                className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
              />
              <TouchableOpacity
                onPress={handleSendReply}
                disabled={sendingReply || !replyMessage.trim()}
                activeOpacity={0.8}
                className="h-9 justify-center items-center rounded-lg bg-blue-600 px-3.5 disabled:opacity-50"
              >
                {sendingReply ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-xs font-bold text-white">Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // ── Ticket List View (ZERO Horizontal Scroll) ─────────────────────────
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-3.5 py-2.5">
        <View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm font-black text-slate-900 dark:text-white">
              {isOffice ? 'Support Messages' : 'Help & Support'}
            </Text>
            {tabCounts.all > 0 && (
              <View className="rounded-full bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2">
                <Text className="text-[9.5px] font-bold text-slate-700 dark:text-slate-300">
                  {tabCounts.all}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-[10px] text-slate-500 dark:text-slate-400">
            {isOffice
              ? 'Direct fleet client inquiries & responses'
              : 'Direct communication with engineering'}
          </Text>
        </View>

        {!isOffice ? (
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            activeOpacity={0.8}
            className="flex-row items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 shadow-2xs"
          >
            <Text className="text-xs font-bold text-white">+ New Ticket</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={fetchTickets}
            activeOpacity={0.8}
            className="flex-row items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 shadow-2xs"
          >
            <Icon name="refresh" color="#475569" size={11} />
            <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
              Refresh
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 4-Segment Grid Bar (ZERO Horizontal Scroll for Client & Admin) ── */}
      <View className="gap-2 border-b border-slate-200/80 bg-white px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900">
        <View className="flex-row gap-1 w-full">
          {CLIENT_TABS.map((tab) => {
            const active = filterStatus === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilterStatus(tab.id)}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center justify-center gap-1 py-1 rounded-lg ${
                  active
                    ? 'bg-slate-900 dark:bg-white shadow-2xs'
                    : 'border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    active
                      ? 'text-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.short}
                </Text>
                <View
                  className={`rounded-full px-1 ${
                    active
                      ? 'bg-white/20 dark:bg-slate-900/20'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Text
                    className={`text-[9px] font-bold ${
                      active
                        ? 'text-white dark:text-slate-900'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tabCounts[tab.countKey]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Compact Search */}
        <View className="flex-row items-center gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 h-8.5">
          <Icon name="search" color="#94a3b8" size={13} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              isOffice
                ? 'Search ticket #, subject, client or battery…'
                : 'Search by ticket #, subject or battery…'
            }
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            className="flex-1 text-[11px] font-medium text-slate-900 dark:text-white"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" color="#94a3b8" size={12} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Office Client Filter Chips */}
        {isOffice && clients.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="items-center gap-1 pt-0.5"
          >
            <TouchableOpacity
              onPress={() => setFilterClient('')}
              className={`rounded-md px-2 py-0.5 ${
                !filterClient
                  ? 'bg-slate-800 dark:bg-white'
                  : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'
              }`}
            >
              <Text
                className={`text-[9.5px] font-bold ${
                  !filterClient
                    ? 'text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                All Clients
              </Text>
            </TouchableOpacity>
            {clients.slice(0, 10).map((c) => {
              const active = String(filterClient) === String(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setFilterClient(active ? '' : String(c.id))}
                  className={`rounded-md px-2 py-0.5 ${
                    active
                      ? 'bg-slate-800 dark:bg-white'
                      : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'
                  }`}
                >
                  <Text
                    className={`text-[9.5px] font-bold ${
                      active
                        ? 'text-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0f172a" size="small" />
          <Text className="mt-1.5 text-[10.5px] text-slate-500">Loading tickets…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-xs text-red-600">{error}</Text>
          <TouchableOpacity
            onPress={fetchTickets}
            className="mt-2.5 rounded-lg bg-blue-600 px-3.5 py-1.5"
          >
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleTickets}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-2.5 gap-1.5 pb-16"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0f172a"
              colors={['#0f172a']}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-10 px-4">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 mb-2">
                <Icon name="headphones" size={16} color="#94a3b8" />
              </View>
              <Text className="text-xs font-bold text-slate-900 dark:text-white">
                {search || filterClient || filterStatus !== 'all'
                  ? 'No matching tickets'
                  : 'No support tickets'}
              </Text>
              <Text className="mt-0.5 text-center text-[10px] text-slate-500">
                {search || filterClient || filterStatus !== 'all'
                  ? 'Try clearing filters or search query.'
                  : isOffice
                    ? 'All customer tickets have been handled.'
                    : "Tap '+ New Ticket' to submit an inquiry."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const tone = STATUS_TONE[item.status] || STATUS_TONE.open;
            const isSupportReply = SUPPORT_ROLES.includes(
              item.last_message?.sender_role
            );
            const isClientLastSender = !isSupportReply && Boolean(item.last_message);

            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openTicket(item.id)}
                className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs"
              >
                {/* Office Client Name Header */}
                {isOffice && item.client_name ? (
                  <View className="mb-1 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1 flex-1 mr-2">
                      <View className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2">
                        <Text className="text-[9px] font-black text-slate-800 dark:text-slate-200">
                          {item.client_name}
                        </Text>
                      </View>
                      {isClientLastSender && item.status !== 'closed' ? (
                        <View className="rounded-full bg-rose-500 px-1.5 py-0.2">
                          <Text className="text-[7.5px] font-black text-white">
                            Needs Reply
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="font-mono text-[9px] text-slate-400">
                      {item.ticket_number}
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 flex-1 mr-1.5">
                    {!isOffice ? (
                      <Text className="font-mono text-[10px] font-bold text-slate-900 dark:text-white">
                        {item.ticket_number}
                      </Text>
                    ) : null}
                    {!isOffice && isSupportReply && item.status !== 'closed' ? (
                      <View className="rounded-full bg-blue-600 px-1 py-0.2">
                        <Text className="text-[8px] font-bold text-white">
                          New Reply
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      className="text-[11.5px] font-bold text-slate-900 dark:text-white leading-snug flex-1"
                      numberOfLines={1}
                    >
                      {item.subject}
                    </Text>
                  </View>

                  <View className={`rounded px-1.5 py-0.2 ${tone.bg}`}>
                    <Text className={`text-[9px] font-bold uppercase ${tone.text}`}>
                      {(item.status || 'open').replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>

                <Text
                  className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 leading-normal"
                  numberOfLines={1}
                >
                  {isSupportReply ? 'Support: ' : `${item.client_name || 'Client'}: `}
                  {item.last_message?.message || 'No messages yet'}
                </Text>

                <View className="mt-1.5 flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-1">
                  <View className="flex-1 flex-row items-center gap-1">
                    <Text className="text-[9px] capitalize text-slate-400">
                      {(item.category || 'general').replace(/_/g, ' ')}
                    </Text>
                    {item.battery_code ? (
                      <View className="rounded bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.2 border border-emerald-200/70">
                        <Text className="font-mono text-[8.5px] font-bold text-emerald-800 dark:text-emerald-300">
                          🔋 {item.battery_code}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-[9px] text-slate-400">
                    {timeAgo(item.updated_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── New Ticket Modal ────────────────────────────────────────────── */}
      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 items-center justify-center bg-slate-900/50 px-3"
        >
          <ScrollView
            className="w-full max-w-sm"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl"
          >
            <Text className="text-sm font-extrabold text-slate-900 dark:text-white">
              New Support Ticket
            </Text>
            <Text className="text-[10.5px] text-slate-400 mt-0.5">
              Submit your inquiry to the service team
            </Text>

            {createError && (
              <View className="mt-2 rounded-lg bg-red-50 p-2">
                <Text className="text-[11px] font-semibold text-red-600">
                  {createError}
                </Text>
              </View>
            )}

            <Text className="mb-1 mt-3 text-[10px] font-bold uppercase text-slate-500">
              Subject *
            </Text>
            <TextInput
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder="e.g. Battery inspection question"
              placeholderTextColor="#94a3b8"
              className="h-8.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white"
            />

            <Text className="mb-1 mt-2.5 text-[10px] font-bold uppercase text-slate-500">
              Category
            </Text>
            <View className="gap-1">
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setNewCategory(c.id)}
                  className={`rounded-lg border px-2.5 py-1 ${
                    newCategory === c.id
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-medium ${
                      newCategory === c.id
                        ? 'text-white font-bold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-1 mt-2.5 text-[10px] font-bold uppercase text-slate-500">
              Priority
            </Text>
            <View className="flex-row gap-1">
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setNewPriority(p.id)}
                  className={`flex-1 items-center rounded-lg py-1 ${
                    newPriority === p.id
                      ? 'bg-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      newPriority === p.id
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-1 mt-2.5 text-[10px] font-bold uppercase text-slate-500">
              Linked Battery Code (Optional)
            </Text>
            <TextInput
              value={newBatteryCode}
              onChangeText={(v) => setNewBatteryCode(v.toUpperCase())}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. BAT-001"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              className="h-8.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 font-mono text-xs text-slate-900 dark:text-white"
            />

            <Text className="mb-1 mt-2.5 text-[10px] font-bold uppercase text-slate-500">
              Message / Details *
            </Text>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Describe your request in detail…"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              className="min-h-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white"
              textAlignVertical="top"
            />

            <View className="mt-3.5 flex-row justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
              <TouchableOpacity
                onPress={() => setCreateOpen(false)}
                className="rounded-lg px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-slate-500">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTicket}
                disabled={creating || !newSubject.trim() || !newMessage.trim()}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 disabled:opacity-50"
              >
                <Text className="text-xs font-bold text-white">
                  {creating ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
