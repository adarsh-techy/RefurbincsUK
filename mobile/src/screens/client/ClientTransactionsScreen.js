import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Helper to format ISO date to YYYY-MM
function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key) {
  if (!key || key === 'ALL') return 'All Time';
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function chargeCategory(row) {
  if (row.charge_type === 'repair') {
    return {
      label: 'Repair Service',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300',
      icon: 'wrench',
      color: '#2563eb',
    };
  }
  if (row.battery_status === 'unserviceable' || row.battery_status === 'tested_parts_removed') {
    return {
      label: 'Diagnostic Fee',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300',
      icon: 'alertTriangle',
      color: '#e11d48',
    };
  }
  return {
    label: 'Service & Testing',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300',
    icon: 'checkCircle',
    color: '#4f46e5',
  };
}

const money = (v) => `£${Number(v || 0).toFixed(2)}`;

export default function ClientTransactionsScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' or 'YYYY-MM'
  const [chargeFilter, setChargeFilter] = useState('all'); // 'all' | 'repair' | 'service'
  const [search, setSearch] = useState('');

  const fetchTransactions = useCallback(async () => {
    setError(null);
    try {
      const { data: result } = await apiClient.get('/clients/me/transactions');
      setData(result.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function onRefresh() {
    setRefreshing(true);
    fetchTransactions();
  }

  const availableMonths = useMemo(() => {
    const counts = new Map();
    data.forEach((row) => {
      const k = getMonthKey(row.repaired_at);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({ key, label: formatMonthLabel(key), count }));
  }, [data]);

  const rows = useMemo(() => {
    return data.filter((r) => {
      if (selectedMonth !== 'ALL' && getMonthKey(r.repaired_at) !== selectedMonth) return false;
      if (chargeFilter === 'repair' && r.charge_type !== 'repair') return false;
      if (chargeFilter === 'service' && r.charge_type !== 'service') return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.battery_code?.toLowerCase().includes(q) ||
        r.part_name?.toLowerCase().includes(q) ||
        String(r.truck_number || '').toLowerCase().includes(q) ||
        r.staff_name?.toLowerCase().includes(q)
      );
    });
  }, [data, selectedMonth, chargeFilter, search]);

  const sum = (list) => list.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const total = sum(rows);
  const repairRows = rows.filter((r) => r.charge_type === 'repair');
  const serviceRows = rows.filter((r) => r.charge_type === 'service');
  const batteriesCount = new Set(rows.map((r) => r.battery_code).filter(Boolean)).size;
  const avgPerBattery = batteriesCount ? total / batteriesCount : 0;

  const anyFilter = Boolean(selectedMonth !== 'ALL' || chargeFilter !== 'all' || search);

  const header = (
    <View className="gap-2 pb-1.5">
      {/* Title & Refresh Button */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="text-base font-black text-slate-900 dark:text-white">Transactions & Billing</Text>
            <View className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 dark:border-slate-800 dark:bg-slate-800">
              <Text className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
                {rows.length} Items
              </Text>
            </View>
          </View>
          <Text className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            Verified repair charges and service fees across your fleet.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900 shadow-2xs"
        >
          <Icon name="rotateCcw" size={11} color="#64748b" />
          <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Metric Cards Strip - Compact Paired Layout */}
      <View className="gap-1.5">
        <View className="flex-row gap-1.5">
          {/* 1. Total Billed */}
          <TouchableOpacity
            onPress={() => setChargeFilter('all')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              chargeFilter === 'all'
                ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                {selectedMonth === 'ALL' ? 'Total Billed' : 'Month Total'}
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                <Icon name="package" size={10} color="#059669" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-slate-900 dark:text-white leading-tight">
              {money(total)}
            </Text>
            <Text className="text-[8px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              {rows.length} billing line{rows.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>

          {/* 2. Repair Services */}
          <TouchableOpacity
            onPress={() => setChargeFilter(chargeFilter === 'repair' ? 'all' : 'repair')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              chargeFilter === 'repair'
                ? 'border-blue-500 bg-blue-50/70 dark:border-blue-600 dark:bg-blue-950/40 ring-1 ring-blue-400/30'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Repairs
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950">
                <Icon name="wrench" size={10} color="#2563eb" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-slate-900 dark:text-white leading-tight">
              {money(sum(repairRows))}
            </Text>
            <Text className="text-[8px] font-medium text-blue-700 dark:text-blue-400 mt-0.5">
              {repairRows.length} repair line{repairRows.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-1.5">
          {/* 3. Testing & Fees */}
          <TouchableOpacity
            onPress={() => setChargeFilter(chargeFilter === 'service' ? 'all' : 'service')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              chargeFilter === 'service'
                ? 'border-indigo-500 bg-indigo-50/70 dark:border-indigo-600 dark:bg-indigo-950/40 ring-1 ring-indigo-400/30'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Testing & Fees
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-950">
                <Icon name="checkCircle" size={10} color="#4f46e5" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-slate-900 dark:text-white leading-tight">
              {money(sum(serviceRows))}
            </Text>
            <Text className="text-[8px] font-medium text-indigo-700 dark:text-indigo-400 mt-0.5">
              {serviceRows.length} fee{serviceRows.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>

          {/* 4. Fleet Serviced */}
          <View className="flex-1 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900 justify-between">
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Fleet Serviced
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
                <Icon name="battery" size={10} color="#d97706" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-slate-900 dark:text-white leading-tight">
              {batteriesCount} <Text className="text-[9px] font-bold text-slate-400">units</Text>
            </Text>
            <Text className="text-[8px] font-medium text-amber-700 dark:text-amber-400 mt-0.5">
              Avg. {money(avgPerBattery)}/unit
            </Text>
          </View>
        </View>
      </View>

      {/* Search Input - Compact */}
      <View className="relative flex-row items-center rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <Icon name="search" size={12} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search battery ID, part or truck…"
          placeholderTextColor="#94a3b8"
          className="flex-1 py-1.5 px-2 text-[11px] text-slate-900 dark:text-white"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="close" size={11} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Charge Type Category Pills */}
      <View className="flex-row items-center gap-1">
        {[
          { id: 'all', label: 'All' },
          { id: 'repair', label: 'Repairs' },
          { id: 'service', label: 'Testing' },
        ].map((tab) => {
          const active = chargeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setChargeFilter(tab.id)}
              className={`rounded-md px-2.5 py-1 ${
                active
                  ? 'bg-slate-900 shadow-2xs dark:bg-white'
                  : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <Text className={`text-[10px] font-bold ${active ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Month Filter Selector ScrollView */}
      {availableMonths.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1 py-0.5">
          {[{ key: 'ALL', label: 'All Months', count: data.length }, ...availableMonths].map((m) => {
            const on = selectedMonth === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setSelectedMonth(m.key)}
                className={`rounded-md px-2 py-0.5 border ${
                  on
                    ? 'border-slate-800 bg-slate-800 dark:border-slate-200 dark:bg-slate-200 shadow-2xs'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <Text
                  className={`text-[9.5px] font-bold ${
                    on ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.label} ({m.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {anyFilter && (
        <TouchableOpacity
          onPress={() => {
            setSelectedMonth('ALL');
            setChargeFilter('all');
            setSearch('');
          }}
          className="self-start rounded-md border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <Text className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">Clear filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading transactions…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchTransactions} className="mt-3 rounded-xl bg-emerald-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => `${item.charge_type || 'c'}-${item.id ?? item.batch_id ?? 'x'}-${i}`}
          contentContainerClassName="p-2.5 gap-1.5 pb-16"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" colors={['#10b981']} />
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View className="items-center justify-center rounded-xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <View className="mb-2 h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/60 dark:border-emerald-800/40">
                <Icon name="package" size={16} color="#059669" />
              </View>
              <Text className="text-xs font-bold text-slate-900 dark:text-white">
                {anyFilter ? 'No matching transactions' : 'No Transactions Recorded Yet'}
              </Text>
              <Text className="mt-1 text-center text-[10px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                {anyFilter
                  ? 'Try clearing the search or choosing a different filter above.'
                  : 'Billing line items will appear here as battery repairs and service inspections complete.'}
              </Text>
              {anyFilter && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMonth('ALL');
                    setChargeFilter('all');
                    setSearch('');
                  }}
                  className="mt-2.5 rounded-lg border border-slate-200 px-3 py-1 bg-white dark:border-slate-700 dark:bg-slate-800"
                >
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => {
            const cat = chargeCategory(item);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false })
                }
                className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Header: Battery Code + Amount Badge */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1 flex-1 min-w-0 pr-2">
                    <Text className="font-mono text-[9px] text-slate-400">#{index + 1}</Text>
                    <Text className="text-[11px] font-bold text-blue-600 dark:text-emerald-400 font-mono truncate">
                      {item.battery_code}
                    </Text>
                    {item.truck_number ? (
                      <View className="flex-row items-center gap-0.5 rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">
                        <Icon name="truck" size={8} color="#64748b" />
                        <Text className="text-[8.5px] text-slate-500 font-medium">T{item.truck_number}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="rounded-md border border-slate-200/70 bg-slate-50 px-1.5 py-0.5 dark:border-slate-700 dark:bg-slate-800 shrink-0">
                    <Text className="font-mono text-[11px] font-black text-slate-900 dark:text-white">
                      {money(item.amount)}
                    </Text>
                  </View>
                </View>

                {/* Badge Row: Category + Battery Status */}
                <View className="mt-1.5 flex-row items-center justify-between gap-1 flex-wrap">
                  <View className="flex-row items-center gap-1 rounded border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 dark:border-slate-800 dark:bg-slate-800/80">
                    <Icon name={cat.icon} size={9} color={cat.color} />
                    <Text className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
                      {cat.label}
                    </Text>
                  </View>
                  {item.battery_status ? <StatusBadge status={item.battery_status} /> : null}
                </View>

                {/* Metadata Row: Date, Technician, Part */}
                <View className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    {item.part_name ? (
                      <Text className="text-[9.5px] text-slate-600 dark:text-slate-300 font-medium truncate" numberOfLines={1}>
                        Part: {item.part_name}
                      </Text>
                    ) : (
                      <Text className="text-[9.5px] text-slate-400 dark:text-slate-500 truncate" numberOfLines={1}>
                        Tech: {item.staff_name || 'Workshop Staff'}
                      </Text>
                    )}
                  </View>

                  <View className="flex-row items-center gap-0.5 shrink-0">
                    <Text className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                      {item.repaired_at
                        ? new Date(item.repaired_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </Text>
                    <Icon name="chevronRight" size={10} color="#94a3b8" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
