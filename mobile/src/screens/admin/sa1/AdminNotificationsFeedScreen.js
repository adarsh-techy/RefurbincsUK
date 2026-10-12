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
    <View className="gap-3 pb-3">
      <View>
        <Text className="text-lg font-black text-slate-900">Operations & System Notifications</Text>
        <Text className="mt-0.5 text-xs text-slate-500">Live dispatch updates, inventory thresholds, client support alerts & ESG milestone notices</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <Text className="text-xs font-bold text-emerald-800">✓ Mark all as read</Text>
            </TouchableOpacity>
          )}
          {readIds.length > 0 && (
            <TouchableOpacity onPress={clearAllRead} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Text className="text-xs font-bold text-slate-600">Reset Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { setLoading(true); fetchNotifications(); }} disabled={loading} className="rounded-xl bg-slate-900 px-3 py-2">
            <Text className="text-xs font-bold text-white">{loading ? 'Refreshing…' : 'Refresh Feed'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row flex-wrap justify-between gap-y-2.5">
        {[
          ['🚨 Urgent Attention', counts.urgent, 'Stock shortages & high-priority items', 'border-rose-200 bg-rose-50/60', 'text-rose-700'],
          ['📦 Low Stock Items', counts.inventory, 'Parts needing workshop restock', 'border-amber-200 bg-amber-50/60', 'text-amber-700'],
          ['🚚 Logistics & Intakes', counts.logistics, 'Active dispatches & intake manifests', 'border-blue-200 bg-blue-50/60', 'text-blue-700'],
          ['🏆 ESG Milestones', counts.milestones, 'Client certificates issued to date', 'border-emerald-200 bg-emerald-50/60', 'text-emerald-700'],
        ].map(([label, n, sub, box, text]) => (
          <View key={label} className={`w-[48.5%] rounded-2xl border p-3 ${box}`}>
            <Text className={`text-[10px] font-bold uppercase ${text}`}>{label}</Text>
            <Text className={`mt-1 text-2xl font-black ${text}`}>{n || 0}</Text>
            <Text className="text-[10px] text-slate-500">{sub}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
        {CATEGORIES.map(([key, label]) => {
          const on = activeCategory === key;
          return (
            <TouchableOpacity key={key} onPress={() => setActiveCategory(key)} className={`flex-row items-center gap-1.5 rounded-xl px-3 py-2 ${on ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
              <Text className={`rounded-full px-1.5 text-[10px] font-black ${on ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>{badgeFor(key)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <Icon name="search" color="#94a3b8" size={16} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by client, truck, part SKU, battery code, or subject..."
          placeholderTextColor="#94a3b8"
          className="flex-1 text-xs text-slate-900"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Text className="text-xs font-bold text-slate-400">✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
        {SEVERITIES.map(([key, label]) => {
          const on = severityFilter === key;
          return (
            <TouchableOpacity key={key} onPress={() => setSeverityFilter(key)} className={`rounded-xl border px-3 py-1.5 ${on ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'}`}>
              <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
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
          <Text className="py-10 text-center text-xs font-bold text-slate-500">Loading live operational notifications…</Text>
        ) : error ? (
          <View className="items-center rounded-2xl border border-red-200 bg-red-50 p-6">
            <Text className="text-center text-sm font-bold text-red-600">{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); fetchNotifications(); }} className="mt-3 rounded-xl bg-red-600 px-4 py-2">
              <Text className="text-xs font-bold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="checkCircle" color="#10b981" size={26} />
            <Text className="mt-2 text-sm font-bold text-slate-800">No matching notifications found</Text>
            <Text className="mt-1 text-center text-xs text-slate-400">
              {filtered ? 'Try resetting your search query or filters to view all activity.' : 'All systems are operating normally with no outstanding alerts.'}
            </Text>
            {filtered && (
              <TouchableOpacity onPress={() => { setSearch(''); setActiveCategory('all'); setSeverityFilter('all'); }} className="mt-3 rounded-xl bg-slate-900 px-4 py-2">
                <Text className="text-xs font-bold text-white">Clear All Filters</Text>
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
          <View className={`overflow-hidden rounded-2xl border p-3.5 ${isRead ? 'border-slate-200 bg-white opacity-70' : st.box}`}>
            {!isRead && <View className={`absolute bottom-3 left-0 top-3 w-1 rounded-r ${st.bar}`} />}
            <View className="flex-row gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
                <Icon name={TYPE_ICON[item.type] || (item.severity === 'urgent' ? 'alertTriangle' : 'zap')} color={st.icon} size={18} />
              </View>
              <View className="flex-1">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-sm font-bold text-slate-900">{item.title}</Text>
                  {item.severity === 'urgent' && <Text className="rounded-md bg-rose-100 px-1.5 text-[10px] font-black text-rose-700">🚨 Urgent</Text>}
                  {item.severity === 'warning' && <Text className="rounded-md bg-amber-100 px-1.5 text-[10px] font-black text-amber-800">⚠️ Action Required</Text>}
                  <Text className="text-[10px] font-semibold text-slate-400">{isRead ? 'Read' : 'Unread'} • {timeAgo(item.timestamp)}</Text>
                </View>
                <Text className="mt-1 text-xs text-slate-600">{item.message}</Text>
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">🕒 {formatFullDate(item.timestamp)}</Text>
                  {m.clientName ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Client: {m.clientName}</Text> : null}
                  {m.truckNumber ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Truck: {m.truckNumber}</Text> : null}
                  {m.sku ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">SKU: {m.sku}</Text> : null}
                  {m.batteryCode ? <Text className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Battery: {m.batteryCode}</Text> : null}
                </View>
                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity onPress={() => toggleRead(item.id)} className={`rounded-xl border px-2.5 py-1.5 ${isRead ? 'border-slate-200' : 'border-emerald-200 bg-emerald-50'}`}>
                    <Text className={`text-xs font-bold ${isRead ? 'text-slate-500' : 'text-emerald-800'}`}>{isRead ? 'Mark unread' : '✓ Read'}</Text>
                  </TouchableOpacity>
                  {item.actionUrl ? (
                    <TouchableOpacity onPress={() => navigateWebPath(navigation, item.actionUrl)} className="flex-row items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5">
                      <Text className="text-xs font-bold text-white">{(item.actionLabel || 'View Details').replace(/\s*→\s*$/, '')} →</Text>
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
