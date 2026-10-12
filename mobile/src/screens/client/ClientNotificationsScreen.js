import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

// Battery Activity & Notifications — mobile version of the web
// ClientNotificationsPage (GET /clients/me/notifications?limit=100): filter
// tabs with counts, keyword search, the Truck / Driver / Packed / Received
// grid on every card, and a batch view listing each battery of a multi-battery
// notification.

const TABS = [
  { id: 'all', label: 'All Alerts' },
  { id: 'intake', label: 'Verified Intakes' },
  { id: 'return', label: 'Packed for Return' },
  { id: 'invoice', label: 'Invoices & Bills' },
];

const TYPE_STYLE = {
  intake: { icon: 'package', color: '#059669', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  repair: { icon: 'wrench', color: '#4f46e5', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  return: { icon: 'truck', color: '#0d9488', bg: 'bg-teal-50 dark:bg-teal-950/40' },
  invoice: { icon: 'card', color: '#dc2626', bg: 'bg-red-50 dark:bg-red-950/40' },
};

function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

function SearchBox({ value, onChange, placeholder }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
      <Icon name="search" color="#94a3b8" size={16} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        className="min-w-0 flex-1 py-2.5 text-sm text-slate-900 dark:text-white"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
          <Icon name="x" color="#94a3b8" size={14} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Meta({ label, children }) {
  return (
    <View className="w-1/2 py-1.5 pr-2">
      <Text className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
      {typeof children === 'string' ? (
        <Text className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200" numberOfLines={1}>{children}</Text>
      ) : children}
    </View>
  );
}

export default function ClientNotificationsScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');

  const fetchNotifications = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get('/clients/me/notifications?limit=100');
      setItems(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  function refresh() {
    setRefreshing(true);
    fetchNotifications();
  }

  const counts = useMemo(() => ({
    all: items.length,
    intake: items.filter((n) => n.type === 'intake').length,
    return: items.filter((n) => n.type === 'return').length,
    invoice: items.filter((n) => n.type === 'invoice').length,
  }), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const codes = Array.isArray(item.battery_codes) ? item.battery_codes.join(' ').toLowerCase() : '';
    return codes.includes(q)
      || (item.message || '').toLowerCase().includes(q)
      || (item.title || '').toLowerCase().includes(q)
      || (item.truck_number || '').toLowerCase().includes(q);
  }), [items, filterType, search]);

  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  // ── Batch view: every battery of one notification ────────────────────
  if (selectedBatch) {
    const codes = selectedBatch.battery_codes || [];
    const q = batchSearch.trim().toLowerCase();
    const shown = codes.filter((c) => !q || String(c).toLowerCase().includes(q));
    const action = selectedBatch.type === 'intake' ? 'Verified Workshop Intake' : selectedBatch.type === 'return' ? 'Packed for Return' : 'Invoice Document';
    return (
      <FlatList
        className="flex-1 bg-slate-50 dark:bg-slate-950"
        data={shown}
        keyExtractor={(c, i) => `${c}-${i}`}
        contentContainerClassName="p-4 gap-2 pb-16"
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <TouchableOpacity onPress={() => { setSelectedBatch(null); setBatchSearch(''); }} className="flex-row items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <Icon name="arrowLeft" color="#475569" size={14} />
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Back to Notifications Feed</Text>
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-black text-slate-900 dark:text-white">{selectedBatch.title}</Text>
              <Text className="mt-0.5 text-[11px] text-slate-500">
                {selectedBatch.truck_number ? `Truck: ${selectedBatch.truck_number}` : ''}
                {selectedBatch.driver_name ? ` • Driver: ${selectedBatch.driver_name}` : ''}
                {` • Logged on ${formatTimestamp(selectedBatch.timestamp)}`}
              </Text>
              <Text className="mt-2 self-start rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                {codes.length} Batteries in this Batch
              </Text>
            </View>
            {selectedBatch.message ? (
              <View className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/30">
                <Text className="text-xs text-blue-900 dark:text-blue-200">{selectedBatch.message}</Text>
              </View>
            ) : null}
            <SearchBox value={batchSearch} onChange={setBatchSearch} placeholder="Search Battery Code in this batch…" />
          </View>
        }
        ListEmptyComponent={<Text className="py-10 text-center text-xs text-slate-400">No batteries found in this batch.</Text>}
        renderItem={({ item: code, index }) => (
          <TouchableOpacity onPress={() => openBattery(code)} className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <Text className="w-6 text-[11px] font-bold text-slate-400">{index + 1}</Text>
            <View className="flex-1">
              <Text className="text-sm font-bold text-blue-700 dark:text-blue-400">{code}</Text>
              <Text className="text-[11px] text-slate-500">{action}</Text>
            </View>
            <Text className="text-[11px] font-bold text-blue-600">Track Battery Details →</Text>
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <FlatList
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      data={loading || error ? [] : filtered}
      keyExtractor={(item) => String(item.id)}
      contentContainerClassName="p-4 gap-3 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#38bdf8" colors={['#38bdf8']} />}
      ListHeaderComponent={
        <View className="gap-3">
          <View>
            <Text className="text-xl font-black text-slate-900 dark:text-white">Battery Activity & Notifications</Text>
            <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Verified workshop intakes, packed return dispatches, and invoice documents for your fleet.
            </Text>
          </View>
          <TouchableOpacity disabled={refreshing} onPress={refresh} className="flex-row items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <Icon name="rotateCcw" color="#475569" size={14} />
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">{refreshing ? 'Refreshing…' : 'Refresh Feed'}</Text>
          </TouchableOpacity>
          <View className="flex-row flex-wrap gap-2">
            {TABS.map((tab) => {
              const active = filterType === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setFilterType(tab.id)}
                  className={`flex-row items-center gap-1.5 rounded-xl px-3 py-1.5 ${active ? 'bg-emerald-600' : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{tab.label}</Text>
                  <Text className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{counts[tab.id]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <SearchBox value={search} onChange={setSearch} placeholder="Search by battery ID, truck or keyword…" />
          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#38bdf8" />
              <Text className="mt-2 text-xs font-medium text-slate-500">Loading battery notifications…</Text>
            </View>
          ) : error ? (
            <View className="items-center rounded-2xl border border-red-200 bg-red-50 p-6">
              <Text className="text-center text-sm font-medium text-red-600">{error}</Text>
              <TouchableOpacity onPress={fetchNotifications} className="mt-3 rounded-xl bg-red-600 px-5 py-2.5">
                <Text className="text-xs font-bold text-white">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading || error ? null : (
          <View className="items-center justify-center py-16">
            <Text className="text-sm font-bold text-slate-900 dark:text-white">No notifications found</Text>
            <Text className="mt-1 px-6 text-center text-xs text-slate-400">
              {search ? 'No notifications match your search query.' : 'New batch alerts will appear here as your batteries are delivered, serviced, and returned.'}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const style = TYPE_STYLE[item.type] || TYPE_STYLE.intake;
        const isInvoice = item.type === 'invoice';
        const codes = item.battery_codes || [];
        const count = item.battery_count || codes.length || 1;
        const isBatch = count > 1;
        return (
          <TouchableOpacity
            activeOpacity={isBatch ? 0.7 : 1}
            onPress={() => isBatch && setSelectedBatch(item)}
            className="rounded-2xl border border-emerald-200/70 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <View className="flex-row items-start gap-2.5">
              <View className={`h-8 w-8 items-center justify-center rounded-lg ${style.bg}`}>
                <Icon name={style.icon} color={style.color} size={16} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900 dark:text-white">{item.title?.replace(/\s*\(\d+\s*Batteries\)/gi, '')}</Text>
                <Text className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</Text>
              </View>
              {isInvoice ? (
                <Text className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700">Official PDF Bill</Text>
              ) : count > 0 ? (
                <Text className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{count} {count === 1 ? 'Battery' : 'Batteries'}</Text>
              ) : null}
            </View>

            <View className="mt-2.5 flex-row flex-wrap rounded-xl bg-slate-50 px-3 py-1.5 dark:bg-slate-950">
              <Meta label="Truck">{item.truck_number || '—'}</Meta>
              <Meta label="Driver">{item.driver_name || '—'}</Meta>
              <Meta label="Packed Time">{item.packed_at ? formatTimestamp(item.packed_at) : '—'}</Meta>
              <Meta label="Received Shop">
                {item.received_shop_at ? (
                  <Text className="mt-0.5 text-xs font-semibold text-emerald-700" numberOfLines={1}>✓ {formatTimestamp(item.received_shop_at)}</Text>
                ) : (
                  <Text className="mt-0.5 text-xs font-semibold text-amber-600">● Pending Arrival</Text>
                )}
              </Meta>
            </View>

            <View className="mt-2 flex-row items-center justify-between">
              <Text className="flex-1 text-[10px] text-slate-400">Logged: {formatTimestamp(item.timestamp)} • {timeAgo(item.timestamp)}</Text>
              {isInvoice ? (
                <TouchableOpacity onPress={() => navigation.navigate('Invoices')} hitSlop={6}>
                  <Text className="text-[11px] font-bold text-red-600">Open PDF Bill →</Text>
                </TouchableOpacity>
              ) : isBatch ? (
                <Text className="text-[11px] font-bold text-blue-600">View batch →</Text>
              ) : codes[0] ? (
                <TouchableOpacity onPress={() => openBattery(codes[0])} hitSlop={6}>
                  <Text className="text-[11px] font-bold text-blue-600">{codes[0]} →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}
