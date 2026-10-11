import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import DateField from '../../components/admin/DateField';

// Finance (super_admin) — GET /finance/summary?preset=&breakdown=&from=&to=:
// revenue totals and a per-month / per-day breakdown, same filters and figures
// as the web Finance page. Tap a period for its statement (FinanceDetail →
// GET /finance/period-detail?type=&period=).

const PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Last 7 days' },
  { id: '30days', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom range' },
];
const money = (v) => `£${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Stat({ label, value, color = 'text-slate-800', wide }) {
  return (
    <View className={`${wide ? 'w-full' : 'w-[48%]'} rounded-2xl border border-slate-200 bg-white p-3.5`}>
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className={`mt-0.5 text-xl font-black ${color}`}>{value}</Text>
    </View>
  );
}

export default function AdminFinanceScreen() {
  const navigation = useNavigation();
  const [preset, setPreset] = useState('all');
  const [breakdownType, setBreakdownType] = useState('month'); // month | day
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = { preset, breakdown: breakdownType };
      if (preset === 'custom') {
        if (from) params.from = from;
        if (to) params.to = to;
      }
      const { data: res } = await apiClient.get('/finance/summary', { params });
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preset, breakdownType, from, to]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const t = data?.totals || {};
  const allPeriods = data?.breakdown || data?.monthly || [];
  const q = search.trim().toLowerCase();
  const periods = q ? allPeriods.filter((p) => `${p.label} ${p.key}`.toLowerCase().includes(q)) : allPeriods;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <TouchableOpacity key={p.id} onPress={() => setPreset(p.id)} className={`rounded-xl px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-white border border-slate-200'}`}>
              <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {preset === 'custom' && (
        <View className="flex-row gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <DateField label="From" value={from} onChange={setFrom} compact quick={false} />
          <DateField label="To" value={to} onChange={setTo} compact quick={false} />
        </View>
      )}

      <View className="flex-row rounded-xl bg-slate-100 p-1">
        {[['month', 'Monthly breakdown'], ['day', 'Daily breakdown']].map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setBreakdownType(id)} className={`flex-1 items-center rounded-lg py-1.5 ${breakdownType === id ? 'bg-white' : ''}`}>
            <Text className={`text-xs font-bold ${breakdownType === id ? 'text-blue-700' : 'text-slate-500'}`}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {loading ? (
        <Text className="py-6 text-center text-xs text-slate-400">Loading finance…</Text>
      ) : (
        <>
          <View className="rounded-3xl bg-emerald-600 p-5">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Total revenue</Text>
            <Text className="mt-1 text-3xl font-black text-white">{money(t.totalRevenue)}</Text>
            <Text className="mt-1 text-xs text-emerald-100">
              {t.repairsCount || 0} repairs · {t.servicesCount || 0} services · {t.batteriesCount || 0} batteries
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Stat label="Parts" value={money(t.partsRevenue)} color="text-blue-700" />
            <Stat label="Labour" value={money(t.laborRevenue)} color="text-violet-700" />
            <Stat label="Services" value={money(t.servicesRevenue)} color="text-amber-700" />
            <Stat label="Recycling" value={money(t.recycleRevenue)} color="text-slate-700" />
            <Stat label="Avg per repair" value={money(t.avgRevenuePerRepair)} />
            <Stat label="Avg per battery" value={money(t.avgRevenuePerBattery)} />
          </View>

          <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {breakdownType === 'month' ? 'Monthly' : 'Daily'} breakdown · tap for the full statement
          </Text>
          {allPeriods.length > 3 && (
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={breakdownType === 'month' ? 'Search month…' : 'Search date…'}
              placeholderTextColor="#94a3b8"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
          )}
          {periods.length === 0 ? (
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
              <Text className="text-sm font-semibold text-slate-800">No revenue in this range</Text>
            </View>
          ) : (
            <View className="gap-2">
              {periods.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('FinanceDetail', { type: p.type || breakdownType, period: p.key, label: p.label })}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-extrabold text-slate-900">{p.label}</Text>
                    <Text className="text-sm font-black text-emerald-700">{money(p.totalRevenue)}</Text>
                  </View>
                  <Text className="mt-1 text-[11px] text-slate-500">
                    Parts {money(p.partsRevenue)} · Labour {money(p.laborRevenue)} · Services {money(p.servicesRevenue)} · Recycling {money(p.recycleRevenue)}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] text-slate-400">{p.repairsCount || 0} repairs · {p.batteriesCount || 0} batteries</Text>
                    <Text className="text-[11px] font-bold text-blue-600">Statement ›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
