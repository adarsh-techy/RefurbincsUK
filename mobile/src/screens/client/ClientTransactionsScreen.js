import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { StatusBadge } from '../../components/ui/Badge';

function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'ALL') return 'All Time';
  const [y, m] = monthKey.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function money(n) {
  return `£${Number(n || 0).toFixed(2)}`;
}

function chargeCategory(row) {
  if (row.charge_type === 'repair') {
    return {
      type: 'repair',
      label: 'Repair Service',
      icon: 'wrench',
      color: '#2563eb',
      bgClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/50',
    };
  }
  if (row.battery_status === 'unserviceable' || row.battery_status === 'tested_parts_removed') {
    return {
      type: 'diagnostic',
      label: 'Diagnostic Fee',
      icon: 'alertTriangle',
      color: '#e11d48',
      bgClass: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/50',
    };
  }
  return {
    type: 'service',
    label: 'Service & Testing',
    icon: 'zap',
    color: '#4f46e5',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/50',
  };
}

export default function ClientTransactionsScreen() {
  const navigation = useNavigation();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [chargeFilter, setChargeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.get('/clients/me/transactions');
      setData(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    data.forEach((row) => {
      const k = getMonthKey(row.repaired_at);
      if (k) {
        monthMap.set(k, (monthMap.get(k) || 0) + 1);
      }
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({
        key,
        label: formatMonthLabel(key),
        count,
      }));
  }, [data]);

  const rows = useMemo(() => {
    return data.filter((row) => {
      if (selectedMonth !== 'ALL' && getMonthKey(row.repaired_at) !== selectedMonth) return false;
      if (chargeFilter === 'repair' && row.charge_type !== 'repair') return false;
      if (chargeFilter === 'service' && row.charge_type !== 'service') return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        row.battery_code?.toLowerCase().includes(q) ||
        row.part_name?.toLowerCase().includes(q) ||
        String(row.truck_number || '').toLowerCase().includes(q) ||
        row.staff_name?.toLowerCase().includes(q)
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
    <View className="gap-2.5 pb-2">
      {/* Title & Refresh Button */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-lg font-black text-slate-900 dark:text-white">Transactions & Billing</Text>
            <View className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 dark:border-slate-800 dark:bg-slate-800">
              <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {rows.length} Items
              </Text>
            </View>
          </View>
          <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Verified repair charges and service fees across your fleet.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs"
        >
          <Icon name="rotateCcw" size={12} color="#64748b" />
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Metric Cards Strip (2x2 Grid) */}
      <View className="gap-2">
        <View className="flex-row gap-2">
          {/* 1. Total Billed */}
          <TouchableOpacity
            onPress={() => setChargeFilter('all')}
            className={`flex-1 rounded-2xl border p-3 shadow-2xs justify-between ${
              chargeFilter === 'all'
                ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                {selectedMonth === 'ALL' ? 'Total Billed' : 'Month Total'}
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <Icon name="package" size={12} color="#059669" />
              </View>
            </View>
            <Text className="mt-1 text-lg font-black text-slate-900 dark:text-white leading-tight">
              {money(total)}
            </Text>
            <Text className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              {rows.length} billing line{rows.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>

          {/* 2. Repair Services */}
          <TouchableOpacity
            onPress={() => setChargeFilter(chargeFilter === 'repair' ? 'all' : 'repair')}
            className={`flex-1 rounded-2xl border p-3 shadow-2xs justify-between ${
              chargeFilter === 'repair'
                ? 'border-blue-400 bg-blue-50/70 dark:border-blue-600 dark:bg-blue-950/40 ring-1 ring-blue-400/30'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Repairs
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                <Icon name="wrench" size={12} color="#2563eb" />
              </View>
            </View>
            <Text className="mt-1 text-lg font-black text-slate-900 dark:text-white leading-tight">
              {money(sum(repairRows))}
            </Text>
            <Text className="text-[10px] font-medium text-blue-700 dark:text-blue-400 mt-0.5">
              {repairRows.length} repair line{repairRows.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2">
          {/* 3. Testing & Fees */}
          <TouchableOpacity
            onPress={() => setChargeFilter(chargeFilter === 'service' ? 'all' : 'service')}
            className={`flex-1 rounded-2xl border p-3 shadow-2xs justify-between ${
              chargeFilter === 'service'
                ? 'border-indigo-400 bg-indigo-50/70 dark:border-indigo-600 dark:bg-indigo-950/40 ring-1 ring-indigo-400/30'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Testing & Fees
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950">
                <Icon name="checkCircle" size={12} color="#4f46e5" />
              </View>
            </View>
            <Text className="mt-1 text-lg font-black text-slate-900 dark:text-white leading-tight">
              {money(sum(serviceRows))}
            </Text>
            <Text className="text-[10px] font-medium text-indigo-700 dark:text-indigo-400 mt-0.5">
              {serviceRows.length} fee{serviceRows.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>

          {/* 4. Fleet Serviced */}
          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 justify-between">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Fleet Serviced
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                <Icon name="battery" size={12} color="#d97706" />
              </View>
            </View>
            <Text className="mt-1 text-lg font-black text-slate-900 dark:text-white leading-tight">
              {batteriesCount} <Text className="text-xs font-bold text-slate-400">units</Text>
            </Text>
            <Text className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mt-0.5">
              Avg. {money(avgPerBattery)}/unit
            </Text>
          </View>
        </View>
      </View>

      {/* Search Input */}
      <View className="relative flex-row items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <Icon name="search" size={14} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search battery ID, part or truck…"
          placeholderTextColor="#94a3b8"
          className="flex-1 py-2 px-2.5 text-xs text-slate-900 dark:text-white"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="close" size={14} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Charge Type Category Pills */}
      <View className="flex-row items-center gap-1.5">
        {[
          { id: 'all', label: 'All Items' },
          { id: 'repair', label: 'Repairs' },
          { id: 'service', label: 'Testing' },
        ].map((tab) => {
          const active = chargeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setChargeFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 ${
                active
                  ? 'bg-slate-900 shadow-2xs dark:bg-white'
                  : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <Text className={`text-xs font-bold ${active ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Month Filter Selector ScrollView */}
      {availableMonths.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 py-0.5">
          {[{ key: 'ALL', label: 'All Months', count: data.length }, ...availableMonths].map((m) => {
            const on = selectedMonth === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setSelectedMonth(m.key)}
                className={`rounded-xl px-2.5 py-1 border ${
                  on
                    ? 'border-slate-800 bg-slate-800 dark:border-slate-200 dark:bg-slate-200 shadow-2xs'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
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
          className="self-start rounded-xl border border-slate-200 px-3 py-1 bg-white dark:border-slate-700 dark:bg-slate-800"
        >
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Reset Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-black">
      {loading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="small" color="#10b981" />
          <Text className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Loading billing records…
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <View className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 max-w-sm">
            <Text className="text-xs font-bold text-rose-700 dark:text-rose-400 text-center">{error}</Text>
          </View>
          <TouchableOpacity
            onPress={fetchTransactions}
            className="mt-3 rounded-xl bg-emerald-600 px-5 py-2.5 shadow-sm"
          >
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => `${item.charge_type}-${item.id || idx}-${item.battery_code}`}
          ListHeaderComponent={header}
          contentContainerClassName="p-3.5 gap-2.5 pb-20"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center items-center justify-center dark:border-slate-800 dark:bg-slate-900 mt-2">
              <Icon name="package" size={24} color="#94a3b8" />
              <Text className="text-sm font-bold text-slate-800 dark:text-white mt-2">
                {anyFilter ? 'No matching transactions' : 'No Transactions Recorded Yet'}
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 max-w-xs leading-relaxed">
                {anyFilter
                  ? 'No billing items match your active filters. Try resetting to all months.'
                  : 'Verified battery repair charges and service fees will automatically populate here.'}
              </Text>
              {anyFilter && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMonth('ALL');
                    setChargeFilter('all');
                    setSearch('');
                  }}
                  className="mt-3 rounded-xl border border-slate-200 px-3.5 py-1.5 bg-white dark:border-slate-700 dark:bg-slate-800"
                >
                  <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Reset Filters</Text>
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
                className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-2"
              >
                {/* Header: Battery Code + Amount Badge */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0 pr-2">
                    <Text className="font-mono text-[10px] text-slate-400">#{index + 1}</Text>
                    <Text className="text-xs font-black text-emerald-700 dark:text-emerald-400 font-mono truncate">
                      {item.battery_code}
                    </Text>
                    {item.truck_number ? (
                      <View className="flex-row items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                        <Icon name="truck" size={9} color="#64748b" />
                        <Text className="text-[9px] text-slate-500 font-medium">T{item.truck_number}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="rounded-lg border border-slate-200/70 bg-slate-50 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-800 shrink-0">
                    <Text className="font-mono text-xs font-black text-slate-900 dark:text-white">
                      {money(item.amount)}
                    </Text>
                  </View>
                </View>

                {/* Badge Row: Category + Battery Status */}
                <View className="mt-1 flex-row items-center justify-between gap-1.5 flex-wrap">
                  <View className={`flex-row items-center gap-1 rounded-md border px-2 py-0.5 ${cat.bgClass}`}>
                    <Icon name={cat.icon} size={10} color={cat.color} />
                    <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      {cat.label}
                    </Text>
                  </View>
                  {item.battery_status ? <StatusBadge status={item.battery_status} /> : null}
                </View>

                {/* Metadata Row: Date, Technician, Part */}
                <View className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    {item.part_name ? (
                      <Text className="text-[10.5px] text-slate-600 dark:text-slate-300 font-medium truncate" numberOfLines={1}>
                        Part: {item.part_name}
                      </Text>
                    ) : (
                      <Text className="text-[10.5px] text-slate-400 dark:text-slate-500 truncate" numberOfLines={1}>
                        Tech: {item.staff_name || 'Workshop Staff'}
                      </Text>
                    )}
                  </View>

                  <View className="flex-row items-center gap-1 shrink-0">
                    <Text className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {item.repaired_at
                        ? new Date(item.repaired_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </Text>
                    <Icon name="chevronRight" size={12} color="#94a3b8" />
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
