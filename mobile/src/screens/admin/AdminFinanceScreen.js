import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';

// Finance (super_admin) — GET /finance/summary?preset=…: revenue totals and a
// per-period breakdown, same figures as the web Finance page.

const PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: '7 days' },
  { id: '30days', label: '30 days' },
  { id: 'month', label: 'This month' },
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
  const [preset, setPreset] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/finance/summary', { params: { preset } });
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preset]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const t = data?.totals || {};
  const periods = data?.breakdown || data?.monthly || [];

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

          <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">By period</Text>
          {periods.length === 0 ? (
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
              <Text className="text-sm font-semibold text-slate-800">No revenue in this range</Text>
            </View>
          ) : (
            <View className="gap-2">
              {periods.map((p) => (
                <View key={p.key} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-extrabold text-slate-900">{p.label}</Text>
                    <Text className="text-sm font-black text-emerald-700">{money(p.totalRevenue)}</Text>
                  </View>
                  <Text className="mt-1 text-[11px] text-slate-500">
                    Parts {money(p.partsRevenue)} · Labour {money(p.laborRevenue)} · Services {money(p.servicesRevenue)} · Recycling {money(p.recycleRevenue)}
                  </Text>
                  <Text className="text-[11px] text-slate-400">{p.repairsCount || 0} repairs · {p.batteriesCount || 0} batteries</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
