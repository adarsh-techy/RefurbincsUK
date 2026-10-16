import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

const TABS = [
  { id: 'all', short: 'All', countKey: 'all' },
  { id: 'intake', short: 'Intake', countKey: 'intake' },
  { id: 'return', short: 'Return', countKey: 'return' },
  { id: 'invoice', short: 'Bills', countKey: 'invoice' },
];

const TYPE_CONFIG = {
  intake: {
    icon: 'package',
    color: '#059669',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-900/40',
    tag: 'Intake',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  repair: {
    icon: 'wrench',
    color: '#4f46e5',
    bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900/40',
    tag: 'Service',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  return: {
    icon: 'truck',
    color: '#0d9488',
    bg: 'bg-teal-50 dark:bg-teal-950/60 border-teal-100 dark:border-teal-900/40',
    tag: 'Return',
    textColor: 'text-teal-700 dark:text-teal-300',
  },
  invoice: {
    icon: 'fileText',
    color: '#7c3aed',
    bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-100 dark:border-purple-900/40',
    tag: 'Bill',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
};

function formatTimestamp(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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
      const { data } = await apiClient.get(
        '/clients/me/notifications?limit=100'
      );
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

  const counts = useMemo(
    () => ({
      all: items.length,
      intake: items.filter((n) => n.type === 'intake').length,
      return: items.filter((n) => n.type === 'return').length,
      invoice: items.filter((n) => n.type === 'invoice').length,
    }),
    [items]
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filterType !== 'all' && item.type !== filterType) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const codes = Array.isArray(item.battery_codes)
          ? item.battery_codes.join(' ').toLowerCase()
          : '';
        return (
          codes.includes(q) ||
          (item.message || '').toLowerCase().includes(q) ||
          (item.title || '').toLowerCase().includes(q) ||
          (item.truck_number || '').toLowerCase().includes(q) ||
          (item.driver_name || '').toLowerCase().includes(q)
        );
      }),
    [items, filterType, search]
  );

  const openBattery = (code) =>
    navigation.navigate('BatteryDetail', { code, fromScan: false });

  // ── Batch Subview ──────────────────────────────────────────────────────────
  if (selectedBatch) {
    const codes = selectedBatch.battery_codes || [];
    const q = batchSearch.trim().toLowerCase();
    const shown = codes.filter(
      (c) => !q || String(c).toLowerCase().includes(q)
    );
    const action =
      selectedBatch.type === 'intake'
        ? 'Verified Intake'
        : selectedBatch.type === 'return'
          ? 'Packed Return'
          : 'Bill';

    return (
      <FlatList
        className="flex-1 bg-slate-50 dark:bg-slate-950"
        data={shown}
        keyExtractor={(c, i) => `${c}-${i}`}
        contentContainerClassName="p-3 gap-2 pb-20"
        ListHeaderComponent={
          <View className="mb-2 gap-2">
            <TouchableOpacity
              onPress={() => {
                setSelectedBatch(null);
                setBatchSearch('');
              }}
              activeOpacity={0.7}
              className="flex-row items-center gap-1 self-start rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 shadow-2xs"
            >
              <Icon name="arrowLeft" color="#475569" size={12} />
              <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                Back
              </Text>
            </TouchableOpacity>

            <View className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-xs font-bold text-slate-900 dark:text-white flex-1 mr-2"
                  numberOfLines={1}
                >
                  {selectedBatch.title}
                </Text>
                <View className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2 py-0.2 border border-blue-200/60 dark:border-blue-900/40">
                  <Text className="text-[9.5px] font-bold text-blue-700 dark:text-blue-300">
                    {codes.length} Batteries
                  </Text>
                </View>
              </View>

              {selectedBatch.message ? (
                <Text className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                  {selectedBatch.message}
                </Text>
              ) : null}

              <View className="mt-2 flex-row flex-wrap gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                {selectedBatch.truck_number && (
                  <View className="rounded-md bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 border border-slate-100 dark:border-slate-800">
                    <Text className="text-[8.5px] font-bold text-slate-400 uppercase">
                      Truck: {selectedBatch.truck_number}
                    </Text>
                  </View>
                )}
                {selectedBatch.driver_name && (
                  <View className="rounded-md bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 border border-slate-100 dark:border-slate-800">
                    <Text className="text-[8.5px] font-bold text-slate-400 uppercase">
                      Driver: {selectedBatch.driver_name}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 h-8.5 shadow-2xs">
              <Icon name="search" color="#94a3b8" size={13} />
              <TextInput
                value={batchSearch}
                onChangeText={setBatchSearch}
                placeholder="Filter code in batch…"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                className="flex-1 text-[11px] font-medium text-slate-900 dark:text-white"
              />
              {batchSearch ? (
                <TouchableOpacity onPress={() => setBatchSearch('')} hitSlop={8}>
                  <Icon name="x" color="#94a3b8" size={12} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-6">
            <Text className="text-[11px] text-slate-400">
              No batteries match in this batch.
            </Text>
          </View>
        }
        renderItem={({ item: code, index }) => (
          <TouchableOpacity
            onPress={() => openBattery(code)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xs"
          >
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <View className="h-5 w-5 items-center justify-center rounded bg-slate-100 dark:bg-slate-800">
                <Text className="text-[9.5px] font-bold text-slate-500">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                  {code}
                </Text>
                <Text className="text-[9.5px] text-slate-400">{action}</Text>
              </View>
            </View>
            <Icon name="chevronRight" size={11} color="#94a3b8" />
          </TouchableOpacity>
        )}
      />
    );
  }

  // ── Main Compact Mobile Feed View (100% Fits Screen, No Horizontal Scroll) ─
  return (
    <FlatList
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      data={loading || error ? [] : filtered}
      keyExtractor={(item) => String(item.id)}
      contentContainerClassName="p-3 gap-2 pb-20"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor="#0f172a"
          colors={['#0f172a']}
        />
      }
      ListHeaderComponent={
        <View className="gap-2">
          {/* Header */}
          <View className="flex-row items-center justify-between pt-0.5">
            <View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-sm font-black text-slate-900 dark:text-white">
                  Notifications
                </Text>
                {counts.all > 0 && (
                  <View className="rounded-full bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2">
                    <Text className="text-[9.5px] font-bold text-slate-700 dark:text-slate-300">
                      {counts.all}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                Intakes, returns, and statements
              </Text>
            </View>

            <TouchableOpacity
              disabled={refreshing}
              onPress={refresh}
              activeOpacity={0.7}
              className="flex-row items-center gap-1 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 shadow-2xs"
            >
              <Icon name="rotateCcw" color="#475569" size={11} />
              <Text className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                {refreshing ? 'Updating…' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── 4-Segment Grid Bar (ZERO Horizontal Scroll) ── */}
          <View className="flex-row gap-1 w-full">
            {TABS.map((tab) => {
              const active = filterType === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setFilterType(tab.id)}
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
                      {counts[tab.countKey]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Compact Search Bar */}
          <View className="flex-row items-center gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 h-8.5 shadow-2xs">
            <Icon name="search" color="#94a3b8" size={13} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search serial, truck, driver…"
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

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#0f172a" size="small" />
              <Text className="mt-1.5 text-[10.5px] text-slate-500">
                Checking for activity…
              </Text>
            </View>
          ) : error ? (
            <View className="items-center rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3">
              <Text className="text-center text-[11px] font-medium text-red-600 dark:text-red-400">
                {error}
              </Text>
              <TouchableOpacity
                onPress={fetchNotifications}
                activeOpacity={0.8}
                className="mt-2 rounded-lg bg-red-600 px-3 py-1"
              >
                <Text className="text-[10.5px] font-bold text-white">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading || error ? null : (
          <View className="items-center justify-center py-8 px-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 mb-2">
              <Icon name="bell" size={18} color="#94a3b8" />
            </View>
            <Text className="text-xs font-bold text-slate-900 dark:text-white">
              {search ? 'No matching notifications' : 'All caught up'}
            </Text>
            <Text className="mt-0.5 px-3 text-center text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal">
              {search
                ? 'Try searching with another keyword.'
                : 'Alerts appear here as batteries are received, serviced, or invoiced.'}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.intake;
        const isInvoice = item.type === 'invoice';
        const codes = item.battery_codes || [];
        const count = item.battery_count || codes.length || 1;
        const isBatch = count > 1;

        return (
          <View className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-2xs">
            {/* Tag Badge + Time */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <View
                  className={`flex-row items-center gap-1 rounded-full border px-1.5 py-0.2 ${config.bg}`}
                >
                  <Icon name={config.icon} color={config.color} size={10} />
                  <Text className={`text-[9.5px] font-bold ${config.textColor}`}>
                    {config.tag}
                  </Text>
                </View>

                {count > 0 && !isInvoice && (
                  <View className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2">
                    <Text className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
                      {count} {count === 1 ? 'Battery' : 'Batteries'}
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-[9.5px] font-medium text-slate-400">
                {timeAgo(item.timestamp)}
              </Text>
            </View>

            {/* Title & Message */}
            <Text className="mt-1.5 text-xs font-bold text-slate-900 dark:text-white leading-snug">
              {item.title?.replace(/\s*\(\d+\s*Batteries\)/gi, '')}
            </Text>

            {item.message ? (
              <Text className="mt-0.5 text-[10.5px] text-slate-600 dark:text-slate-400 leading-normal">
                {item.message}
              </Text>
            ) : null}

            {/* Metadata Box */}
            {(item.truck_number || item.driver_name || item.packed_at || item.received_shop_at) && (
              <View className="mt-2 rounded-lg bg-slate-50/80 dark:bg-slate-950/60 p-2 border border-slate-100 dark:border-slate-800/80">
                <View className="flex-row justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-[8.5px] font-bold uppercase text-slate-400">
                      Truck
                    </Text>
                    <Text
                      className="font-mono text-[10.5px] font-bold text-slate-800 dark:text-slate-200"
                      numberOfLines={1}
                    >
                      {item.truck_number || '—'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[8.5px] font-bold uppercase text-slate-400">
                      Driver
                    </Text>
                    <Text
                      className="text-[10.5px] font-medium text-slate-800 dark:text-slate-200"
                      numberOfLines={1}
                    >
                      {item.driver_name || '—'}
                    </Text>
                  </View>
                </View>

                {(item.packed_at || item.received_shop_at) && (
                  <View className="mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex-row justify-between">
                    <View className="flex-1 mr-2">
                      <Text className="text-[8.5px] font-bold uppercase text-slate-400">
                        Packed
                      </Text>
                      <Text
                        className="text-[10px] text-slate-700 dark:text-slate-300"
                        numberOfLines={1}
                      >
                        {formatTimestamp(item.packed_at)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[8.5px] font-bold uppercase text-slate-400">
                        Workshop Arrival
                      </Text>
                      <Text
                        className="text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                        numberOfLines={1}
                      >
                        {item.received_shop_at ? (
                          <Text className="text-emerald-600 dark:text-emerald-400">
                            ✓ {formatTimestamp(item.received_shop_at)}
                          </Text>
                        ) : (
                          <Text className="text-amber-600 dark:text-amber-400">
                            ● In Transit
                          </Text>
                        )}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Bottom Actions */}
            <View className="mt-2 flex-row items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
              <Text className="text-[9.5px] text-slate-400">
                {formatTimestamp(item.timestamp)}
              </Text>

              {isInvoice ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Invoices')}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5"
                >
                  <Text className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                    Open PDF Bill
                  </Text>
                  <Icon name="chevronRight" size={10} color="#7c3aed" />
                </TouchableOpacity>
              ) : isBatch ? (
                <TouchableOpacity
                  onPress={() => setSelectedBatch(item)}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5"
                >
                  <Text className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    View Batch ({count})
                  </Text>
                  <Icon name="chevronRight" size={10} color="#2563eb" />
                </TouchableOpacity>
              ) : codes[0] ? (
                <TouchableOpacity
                  onPress={() => openBattery(codes[0])}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-0.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5"
                >
                  <Text className="font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200">
                    {codes[0]}
                  </Text>
                  <Icon name="chevronRight" size={10} color="#64748b" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}
