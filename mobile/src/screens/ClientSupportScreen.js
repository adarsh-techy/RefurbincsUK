import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import apiClient from '../services/api-client';

const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'battery_inquiry', label: 'Battery / QR' },
  { id: 'repair_status', label: 'Repair Status' },
  { id: 'delivery_pickup', label: 'Delivery' },
  { id: 'billing', label: 'Billing' },
];

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
  const [tickets, setTickets] = useState([]);
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
  const [newBatteryCode, setNewBatteryCode] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const scrollRef = useRef(null);

  const fetchTickets = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get('/tickets');
      setTickets(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

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

  async function handleCreateTicket() {
    if (!newSubject.trim() || !newMessage.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { data } = await apiClient.post('/tickets', {
        subject: newSubject,
        category: newCategory,
        priority: 'normal',
        batteryCode: newBatteryCode || null,
        initialMessage: newMessage,
      });
      setCreateOpen(false);
      setNewSubject('');
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
      setError(err.response?.data?.message || err.message);
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
            {activeTicket.battery_code && (
              <View className="self-start rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1">
                <Text className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Battery: {activeTicket.battery_code}
                </Text>
              </View>
            )}
            {(activeTicket.messages || []).map((msg) => {
              const isMe = msg.sender_role === 'client' || msg.sender_role === 'recycle_client';
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
                    {isMe ? 'You' : msg.sender_name || 'Support'} · {timeAgo(msg.created_at)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View className="flex-row items-center gap-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-3">
          <TextInput
            value={replyMessage}
            onChangeText={setReplyMessage}
            placeholder="Type a message…"
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
      </KeyboardAvoidingView>
    );
  }

  // ── Ticket List View ─────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 py-3">
        <Text className="text-xs text-slate-500 dark:text-slate-400">Direct messaging with the Refurbinics team</Text>
        <TouchableOpacity
          onPress={() => setCreateOpen(true)}
          className="rounded-xl bg-blue-600 px-3.5 py-2 shadow-sm active:bg-blue-700"
        >
          <Text className="text-xs font-bold text-white">+ New Request</Text>
        </TouchableOpacity>
      </View>

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
          data={tickets}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-4 gap-3 pb-16"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">No support requests yet</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">Tap "+ New Request" to reach the team.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const tone = STATUS_TONE[item.status] || STATUS_TONE.open;
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
          className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-6"
        >
          <ScrollView className="w-full max-w-sm" contentContainerClassName="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <Text className="text-base font-extrabold text-slate-900 dark:text-white">New Help Request</Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Signed in as {user?.name || user?.email}
            </Text>

            <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Subject</Text>
            <TextInput
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder="e.g. Missing serial number on DEM-0001"
              placeholderTextColor="#64748b"
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
            />

            <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Category</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setNewCategory(c.id)}
                  className={`rounded-xl px-3 py-1.5 ${
                    newCategory === c.id ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Text className={`text-[11px] font-bold ${newCategory === c.id ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Battery Code (optional)</Text>
            <TextInput
              value={newBatteryCode}
              onChangeText={(v) => setNewBatteryCode(v.toUpperCase())}
              placeholder="e.g. DEM-0001"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
            />

            <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Message</Text>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Describe your issue or question…"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              className="min-h-24 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white"
              textAlignVertical="top"
            />

            {createError && <Text className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{createError}</Text>}

            <View className="mt-5 flex-row justify-end gap-2.5">
              <TouchableOpacity onPress={() => setCreateOpen(false)} className="rounded-xl px-4 py-2.5">
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTicket}
                disabled={creating || !newSubject.trim() || !newMessage.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2.5 shadow-md shadow-blue-600/30 disabled:opacity-50"
              >
                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-sm font-bold text-white">Submit</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
