import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// The client's billing history — same as the web ClientTransactionsPage:
// every repair charge and service/testing fee (GET /clients/me/transactions),
// a month filter (months that have charges, newest first) and the four
// figures for the chosen period, a Refresh button and a numbered list.

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

// same three charge categories as the web "Charge Category" column
function chargeCategory(row) {
  if (row.charge_type === 'repair') return { label: 'Repair Service', color: 'text-blue-700' };
  if (row.battery_status === 'unserviceable' || row.battery_status === 'tested_parts_removed') {
    return { label: 'Testing & Diagnostic Fee', color: 'text-rose-700' };
  }
  return { label: 'Service & Testing Fee', color: 'text-indigo-700' };
}

const money = (v) => `£${Number(v || 0).toFixed(2)}`;

function StatCard({ label, value, sub, tone }) {
  const tones = {
    amber: 'border-amber-500/30 bg-amber-50 text-amber-700',
    blue: 'border-blue-500/30 bg-blue-50 text-blue-700',
    violet: 'border-violet-500/30 bg-violet-50 text-violet-700',
    emerald: 'border-emerald-500/30 bg-emerald-50 text-emerald-700',
  };
  const cls = tones[tone] || tones.amber;
  return (
    <View className={`w-[48%] rounded-2xl border p-3 ${cls.split(' ').slice(0, 2).join(' ')}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${cls.split(' ')[2]}`} numberOfLines={1}>{label}</Text>
      <Text className={`mt-1 text-lg font-extrabold ${cls.split(' ')[2]}`}>{value}</Text>
      <Text className="mt-0.5 text-[10px] text-slate-500" numberOfLines={2}>{sub}</Text>
    </View>
  );
}

export default function ClientTransactionsScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' or 'YYYY-MM'

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

  const rows = useMemo(
    () => (selectedMonth === 'ALL' ? data : data.filter((r) => getMonthKey(r.repaired_at) === selectedMonth)),
    [data, selectedMonth]
  );
  const sum = (list) => list.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const total = sum(rows);
  const repairRows = rows.filter((r) => r.charge_type === 'repair');
  const serviceRows = rows.filter((r) => r.charge_type === 'service');
  const batteriesCount = new Set(rows.map((r) => r.battery_code).filter(Boolean)).size;
  const avgPerBattery = batteriesCount ? total / batteriesCount : 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading transactions…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchTransactions} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => `${item.charge_type || "c"}-${item.id ?? item.batch_id ?? "x"}-${i}`}
          contentContainerClassName="p-4 gap-3 pb-16"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListHeaderComponent={
            <View className="mb-1 gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-[11px] text-slate-500" numberOfLines={2}>
                  Verified repair charges, diagnostic inspection fees, and service billing across all your batteries.
                </Text>
                <TouchableOpacity onPress={onRefresh} disabled={refreshing} className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Icon name="rotateCcw" color="#334155" size={13} />
                  <Text className="text-xs font-bold text-slate-700">{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                <StatCard
                  tone="amber"
                  label={selectedMonth === 'ALL' ? 'Total Billed' : `${formatMonthLabel(selectedMonth)} Total`}
                  value={money(total)}
                  sub={`${rows.length} total billing line${rows.length === 1 ? '' : 's'}`}
                />
                <StatCard
                  tone="blue"
                  label="Repair Services"
                  value={money(sum(repairRows))}
                  sub={`${repairRows.length} repair service line${repairRows.length === 1 ? '' : 's'} (refurbishment & service)`}
                />
                <StatCard
                  tone="violet"
                  label="Testing & Diagnostics"
                  value={money(sum(serviceRows))}
                  sub={`${serviceRows.length} intake inspection & QA test${serviceRows.length === 1 ? '' : 's'}`}
                />
                <StatCard
                  tone="emerald"
                  label="Batteries Serviced"
                  value={`${batteriesCount} ${batteriesCount === 1 ? 'Battery' : 'Batteries'}`}
                  sub={`Avg. ${money(avgPerBattery)} per battery`}
                />
              </View>
              {availableMonths.length > 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-slate-700">Filter by Month:</Text>
                  {selectedMonth !== 'ALL' ? (
                    <TouchableOpacity onPress={() => setSelectedMonth('ALL')} className="rounded-lg bg-slate-100 px-2.5 py-1">
                      <Text className="text-[11px] font-bold text-slate-600">Clear Filter</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
              {availableMonths.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                  {[{ key: 'ALL', label: 'All Months', count: data.length }, ...availableMonths].map((m) => {
                    const on = selectedMonth === m.key;
                    return (
                      <TouchableOpacity key={m.key} onPress={() => setSelectedMonth(m.key)} className={`rounded-xl px-3 py-1.5 ${on ? 'bg-amber-600' : 'bg-white border border-slate-200'}`}>
                        <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{m.label} ({m.count} records)</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">{selectedMonth === 'ALL' ? 'No transactions yet.' : `No transactions found for ${formatMonthLabel(selectedMonth)}.`}</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">Your billing history will appear here.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false })
              }
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  <Text className="text-[11px] font-mono text-slate-400">#{index + 1}  </Text>
                  {item.battery_code}
                </Text>
                <Text className="text-sm font-extrabold text-slate-900 dark:text-white">£{Number(item.amount).toFixed(2)}</Text>
              </View>
              <View className="mt-2 flex-row items-center justify-between gap-2">
                <Text className={`text-[11px] font-semibold ${chargeCategory(item).color}`}>{chargeCategory(item).label}</Text>
                {item.battery_status ? <StatusBadge status={item.battery_status} /> : null}
              </View>
              <View className="mt-1.5 flex-row items-center justify-between">
                <Text className="flex-1 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>{item.part_name || '—'}{item.truck_number ? ` · Truck ${item.truck_number}` : ''}</Text>
                <Text className="text-[11px] text-slate-400 dark:text-slate-500">
                  {item.repaired_at ? new Date(item.repaired_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </Text>
              </View>
              {item.staff_name && (
                <Text className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Technician: {item.staff_name}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
