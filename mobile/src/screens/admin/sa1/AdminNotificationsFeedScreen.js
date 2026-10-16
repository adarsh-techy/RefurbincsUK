import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { navigateWebPath } from '../../../components/admin/sa1/web-route';

// Operations & System Notifications — the mobile version of the web
// AdminNotificationsPage: GET /notifications/admin?limit=150 (feed + counts),
// KPI cards, category pills with counts, keyword search, severity filter,
// read / unread marks kept on this phone (the web keeps them in the
// browser), Mark all as read / Reset Read, and each item's action link.

const STORAGE_KEY = 'refurbnics_admin_read_notifications';

const CATEGORIES = [
  ['all', 'All Activity'],
  ['urgent', 'Urgent Action'],
  ['inventory', 'Inventory Stock'],
  ['logistics', 'Shipments & Intakes'],
  ['support', 'Support Inquiries'],
  ['feedback', 'Client Feedback'],
  ['milestone', 'ESG Milestones'],
];

const SEVERITIES = [
  ['all', 'All Severities'],
  ['urgent', '🚨 Urgent Only'],
  ['warning', '⚠️ Warnings'],
  ['success', '✓ Success / Completed'],
  ['info', 'ℹ️ Information'],
];

const SEVERITY_STYLE = {
  urgent: { box: 'border-rose-300 bg-rose-50/60', bar: 'bg-rose-500', icon: '#e11d48' },
  warning: { box: 'border-amber-300 bg-amber-50/50', bar: 'bg-amber-500', icon: '#b45309' },
  success: { box: 'border-emerald-300 bg-emerald-50/40', bar: 'bg-emerald-500', icon: '#047857' },
  info: { box: 'border-slate-200 bg-white', bar: 'bg-blue-500', icon: '#2563eb' },
};

const TYPE_ICON = { stock: 'package', intake: 'truck', return: 'truck', ticket: 'user', milestone: 'award', rating: 'checkCircle' };

function timeAgo(ts) {
  if (!ts) return '';
  const minutes = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatFullDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminNotificationsFeedScreen() {
  const navigation = useNavigation();
  const [feed, setFeed] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [readIds, setReadIds] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v) setReadIds(JSON.parse(v)); })
      .catch(() => {});
  }, []);

  const saveRead = (next) => {
    setReadIds(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const fetchNotifications = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get('/notifications/admin', { params: { limit: 150 } });
      setFeed(data.feed || []);
      setCounts(data.counts || {});
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // the web refreshes over a socket; re-read whenever the screen is shown
  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  const toggleRead = (id) => saveRead(readIds.includes(id) ? readIds.filter((x) => x !== id) : [...readIds, id]);
  const markAllAsRead = () => saveRead(feed.map((i) => i.id));
  const clearAllRead = () => {
    setReadIds([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  };

  const filteredFeed = useMemo(() => feed.filter((item) => {
    if (activeCategory === 'urgent') {
      if (item.severity !== 'urgent') return false;
    } else if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const m = item.meta || {};
      const hay = [item.title, item.message, m.clientName, m.truckNumber, m.partName, m.batteryCode].map((s) => (s || '').toLowerCase());
      if (!hay.some((s) => s.includes(q))) return false;
    }
    return true;
  }), [feed, activeCategory, severityFilter, search]);

  const unreadCount = feed.filter((i) => !readIds.includes(i.id)).length;
  const badgeFor = (key) => (key === 'all' ? feed.length : key === 'milestone' ? counts.milestones || 0 : counts[key] || 0);
  const filtered = search || activeCategory !== 'all' || severityFilter !== 'all';

  const header = (
    <View className="gap-2.5 pb-2">
      {/* Top Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-base font-black text-slate-900">Operations Feed</Text>
            {unreadCount > 0 ? (
              <View className="rounded-full bg-rose-100 px-1.5 py-0.2">
                <Text className="text-[9.5px] font-black text-rose-700">{unreadCount} unread</Text>
              </View>
            ) : (
              <View className="rounded-full bg-emerald-100 px-1.5 py-0.2">
                <Text className="text-[9.5px] font-bold text-emerald-700">All clear</Text>
              </View>
            )}
          </View>
          <Text className="mt-0.5 text-[10.5px] text-slate-500">Real-time alerts, stock & dispatch stream</Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
              <Icon name="checkCircle" color="#047857" size={12} />
              <Text className="text-[10.5px] font-bold text-slate-700">Read all</Text>
            </TouchableOpacity>
          )}
          {readIds.length > 0 && (
            <TouchableOpacity onPress={clearAllRead} className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs">
              <Icon name="rotateCcw" color="#64748b" size={12} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { setLoading(true); fetchNotifications(); }} disabled={loading} className="flex-row items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 shadow-xs">
            <Icon name="refresh" color="#ffffff" size={12} />
            <Text className="text-[10.5px] font-black text-white">{loading ? '…' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Executive 4-Segment Metric Bar */}
      <View className="flex-row rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {/* Urgent */}
        <TouchableOpacity
          onPress={() => setActiveCategory((prev) => (prev === 'urgent' ? 'all' : 'urgent'))}
          className={`flex-1 py-2 items-center ${activeCategory === 'urgent' ? 'bg-rose-50/90' : ''}`}
        >
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <Text className="text-[9.5px] font-bold uppercase text-slate-600">Urgent</Text>
          </View>
          <Text className="mt-0.5 text-base font-black text-slate-900">{counts.urgent || 0}</Text>
        </TouchableOpacity>

        <View className="w-[1px] bg-slate-100" />

        {/* Stock */}
        <TouchableOpacity
          onPress={() => setActiveCategory((prev) => (prev === 'inventory' ? 'all' : 'inventory'))}
          className={`flex-1 py-2 items-center ${activeCategory === 'inventory' ? 'bg-amber-50/90' : ''}`}
        >
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <Text className="text-[9.5px] font-bold uppercase text-slate-600">Stock</Text>
          </View>
          <Text className="mt-0.5 text-base font-black text-slate-900">{counts.inventory || 0}</Text>
        </TouchableOpacity>

        <View className="w-[1px] bg-slate-100" />

        {/* Logistics */}
        <TouchableOpacity
          onPress={() => setActiveCategory((prev) => (prev === 'logistics' ? 'all' : 'logistics'))}
          className={`flex-1 py-2 items-center ${activeCategory === 'logistics' ? 'bg-blue-50/90' : ''}`}
        >
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <Text className="text-[9.5px] font-bold uppercase text-slate-600">Logistics</Text>
          </View>
          <Text className="mt-0.5 text-base font-black text-slate-900">{counts.logistics || 0}</Text>
        </TouchableOpacity>

        <View className="w-[1px] bg-slate-100" />

        {/* ESG */}
        <TouchableOpacity
          onPress={() => setActiveCategory((prev) => (prev === 'milestone' ? 'all' : 'milestone'))}
          className={`flex-1 py-2 items-center ${activeCategory === 'milestone' ? 'bg-emerald-50/90' : ''}`}
        >
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <Text className="text-[9.5px] font-bold uppercase text-slate-600">ESG</Text>
          </View>
          <Text className="mt-0.5 text-base font-black text-slate-900">{counts.milestones || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-2xs">
        <Icon name="search" color="#94a3b8" size={14} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search alerts, client, truck, part SKU..."
          placeholderTextColor="#94a3b8"
          className="min-w-0 flex-1 text-xs text-slate-900"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Text className="text-xs font-bold text-slate-400">✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Horizontal Category Pill Track */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
        {[
          ['all', 'All Activity'],
          ['urgent', 'Urgent Action'],
          ['inventory', 'Inventory'],
          ['logistics', 'Logistics'],
          ['support', 'Support'],
          ['feedback', 'Feedback'],
          ['milestone', 'ESG'],
        ].map(([key, label]) => {
          const on = activeCategory === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveCategory(key)}
              className={`flex-row items-center gap-1.5 rounded-xl px-2.5 py-1.5 ${on ? 'bg-slate-900 shadow-2xs' : 'bg-white border border-slate-200/90'}`}
            >
              <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
              <Text className={`rounded-full px-1.5 text-[9px] font-black ${on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {badgeFor(key)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-2.5"
      data={loading && feed.length === 0 ? [] : error ? [] : filteredFeed}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />}
      ListEmptyComponent={
        loading && feed.length === 0 ? (
          <Text className="py-12 text-center text-xs font-bold text-slate-500">Loading operations feed…</Text>
        ) : error ? (
          <View className="items-center rounded-2xl border border-red-200 bg-red-50 p-6">
            <Text className="text-center text-xs font-bold text-red-600">{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); fetchNotifications(); }} className="mt-3 rounded-xl bg-red-600 px-4 py-2">
              <Text className="text-xs font-bold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-10 shadow-2xs">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <Icon name="checkCircle" color="#10b981" size={20} />
            </View>
            <Text className="mt-3 text-xs font-bold text-slate-800">
              {filtered ? 'No matching notifications found' : 'All systems operating normally'}
            </Text>
            <Text className="mt-1 text-center text-[11px] text-slate-400">
              {filtered ? 'Try resetting filters or adjusting search keywords.' : 'No outstanding alerts or pending actions.'}
            </Text>
            {filtered && (
              <TouchableOpacity onPress={() => { setSearch(''); setActiveCategory('all'); setSeverityFilter('all'); }} className="mt-3 rounded-xl bg-slate-900 px-3.5 py-1.5">
                <Text className="text-xs font-bold text-white">Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      }
      renderItem={({ item }) => {
        const isRead = readIds.includes(item.id);
        const st = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.info;
        const m = item.meta || {};
        return (
          <View className={`relative overflow-hidden rounded-2xl border p-3 ${isRead ? 'border-slate-200/90 bg-white opacity-75' : st.box}`}>
            {!isRead && <View className={`absolute bottom-3 left-0 top-3 w-1 rounded-r ${st.bar}`} />}
            <View className="flex-row gap-2.5 pl-0.5">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-white shadow-2xs">
                <Icon name={TYPE_ICON[item.type] || (item.severity === 'urgent' ? 'alertTriangle' : 'zap')} color={st.icon} size={15} />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-xs font-black text-slate-900 flex-1" numberOfLines={1}>{item.title}</Text>
                  {item.severity === 'urgent' && <Text className="rounded-md bg-rose-100 px-1.5 py-0.2 text-[9px] font-black text-rose-700">🚨 Urgent</Text>}
                  {item.severity === 'warning' && <Text className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[9px] font-black text-amber-800">⚠️ Action</Text>}
                </View>
                <Text className="mt-0.5 text-[9.5px] font-semibold text-slate-400">{isRead ? 'Read' : 'New'} • {timeAgo(item.timestamp)}</Text>
                <Text className="mt-1 text-[11.5px] text-slate-600 leading-normal">{item.message}</Text>
                <View className="mt-2 flex-row flex-wrap gap-1">
                  <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">🕒 {formatFullDate(item.timestamp)}</Text>
                  {m.clientName ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">Client: {m.clientName}</Text> : null}
                  {m.truckNumber ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">Truck: {m.truckNumber}</Text> : null}
                  {m.sku ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">SKU: {m.sku}</Text> : null}
                  {m.batteryCode ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">Battery: {m.batteryCode}</Text> : null}
                </View>
                <View className="mt-2.5 flex-row items-center gap-1.5 border-t border-slate-100/80 pt-2">
                  <TouchableOpacity onPress={() => toggleRead(item.id)} className={`rounded-xl border px-2.5 py-1 ${isRead ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50'}`}>
                    <Text className={`text-[10px] font-bold ${isRead ? 'text-slate-500' : 'text-emerald-800'}`}>{isRead ? 'Mark unread' : '✓ Read'}</Text>
                  </TouchableOpacity>
                  {item.actionUrl ? (
                    <TouchableOpacity onPress={() => navigateWebPath(navigation, item.actionUrl)} className="flex-row items-center gap-1 rounded-xl bg-slate-900 px-3 py-1">
                      <Text className="text-[10px] font-bold text-white">{(item.actionLabel || 'View Record').replace(/\s*→\s*$/, '')} →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}
