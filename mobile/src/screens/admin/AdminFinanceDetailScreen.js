import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';

// Finance statement for one month or day — the mobile twin of the web
// FinanceDetailPage: GET /finance/period-detail?type=month|day&period=YYYY-MM[-DD]
// → totals, revenue by client, technician output, services & intake fees and
// the itemized battery charge ledger. Route params: { type, period, label }.

const money = (v) => `£${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (v) => (v ? new Date(v).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
function duration(sec) {
  const s = Math.round(Number(sec) || 0);
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function Stat({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <View className="w-[48%] rounded-2xl border border-slate-200 bg-white p-3.5">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className={`mt-0.5 text-lg font-black ${color}`}>{value}</Text>
      {sub ? <Text className="text-[10px] text-slate-400">{sub}</Text> : null}
    </View>
  );
}

function Section({ title, count, children }) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}{count != null ? ` (${count})` : ''}</Text>
      {children}
    </View>
  );
}

function Empty({ text }) {
  return <Text className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-400">{text}</Text>;
}

export default function AdminFinanceDetailScreen() {
  const navigation = useNavigation();
  const { type = 'month', period = '', label } = useRoute().params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: label ? `Statement · ${label}` : 'Finance statement' });
  }, [navigation, label]);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/finance/period-detail', { params: { type, period } });
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type, period]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals || {};
  const clients = data?.clientBreakdown || [];
  const staff = data?.staffBreakdown || [];
  const services = data?.serviceBreakdown || [];
  const q = search.trim().toLowerCase();
  const ledger = (data?.repairs || []).filter((r) =>
    !q || [r.batteryCode, r.clientName, r.staffName, r.itemDescription, r.notes].some((v) => v && String(v).toLowerCase().includes(q))
  );
  const range = data?.period ? (data.period.startDate === data.period.endDate ? data.period.startDate : `${data.period.startDate} → ${data.period.endDate}`) : '';

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View className="rounded-3xl bg-emerald-600 p-5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">{type === 'day' ? 'Daily' : 'Monthly'} statement · {label || period}</Text>
        <Text className="mt-1 text-3xl font-black text-white">{money(t.totalRevenue)}</Text>
        <Text className="mt-1 text-xs text-emerald-100">{range}</Text>
      </View>

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {loading ? (
        <Text className="py-6 text-center text-xs text-slate-400">Loading statement…</Text>
      ) : (
        <>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Stat label="Total revenue" value={money(t.totalRevenue)} sub="All services & recycling" color="text-emerald-700" />
            <Stat label="Parts service" value={money(t.repairRevenue)} sub="Fitting & part charges" color="text-blue-700" />
            <Stat label="Service & fees" value={money(t.servicesRevenue)} sub={`${t.servicesCount || 0} diagnostic & tests`} color="text-amber-700" />
            <Stat label="Recycle scrap" value={money(t.recycleRevenue)} sub="End-of-life battery payout" />
            <Stat label="Units serviced" value={`${t.batteriesCount || 0} units`} sub="Unique batteries handled" />
            <Stat label="Avg. per unit" value={money(t.avgRevenuePerBattery)} sub={`${t.repairsCount || 0} repairs`} />
          </View>

          <Section title="Revenue by client" count={clients.length}>
            {clients.length === 0 ? <Empty text="No client revenue in this period." /> : clients.map((c) => (
              <View key={c.id ?? c.name} className="rounded-2xl border border-slate-200 bg-white p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-bold text-slate-900" numberOfLines={1}>{c.name || 'No client'}</Text>
                  <Text className="text-sm font-black text-emerald-700">{money(c.totalRevenue)}</Text>
                </View>
                <Text className="mt-0.5 text-[11px] text-slate-500">{c.batteriesCount || 0} batteries · {c.repairsCount || 0} repairs · {c.servicesCount || 0} services</Text>
              </View>
            ))}
          </Section>

          <Section title="Technician output" count={staff.length}>
            {staff.length === 0 ? <Empty text="No technician work in this period." /> : staff.map((s) => (
              <View key={s.id ?? s.name} className="rounded-2xl border border-slate-200 bg-white p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-bold text-slate-900" numberOfLines={1}>
                    {s.name}{s.role ? <Text className={`text-[11px] font-bold ${s.role === 'supervisor' ? 'text-red-600' : 'text-blue-600'}`}>  {s.role}</Text> : null}
                  </Text>
                  <Text className="text-sm font-black text-emerald-700">{money(s.totalRevenue)}</Text>
                </View>
                <Text className="mt-0.5 text-[11px] text-slate-500">{s.repairsCount || 0} repairs · {s.servicesCount || 0} services · avg {duration(s.avgDurationSeconds)}</Text>
              </View>
            ))}
          </Section>

          <Section title="Services & intake fees" count={services.length}>
            {services.length === 0 ? <Empty text="No services charged in this period." /> : services.map((s) => (
              <View key={s.id ?? s.name} className="rounded-2xl border border-slate-200 bg-white p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-bold text-slate-900" numberOfLines={2}>{s.name}</Text>
                  <Text className="text-sm font-black text-amber-700">{money(s.totalRevenue)}</Text>
                </View>
                <Text className="mt-0.5 text-[11px] text-slate-500">{s.timesApplied || 0}× applied · {s.batteriesCount || 0} batteries · avg {money(s.avgRate)}</Text>
              </View>
            ))}
          </Section>

          <Section title="Itemized battery charges" count={ledger.length}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search battery, client, technician…"
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
            {ledger.length === 0 ? <Empty text={q ? 'No charges match this search.' : 'No battery charges in this period.'} /> : ledger.map((r) => (
              <TouchableOpacity
                key={r.id}
                activeOpacity={0.85}
                onPress={() => r.batteryCode && navigation.navigate('BatteryDetail', { code: r.batteryCode, fromScan: false })}
                className="rounded-2xl border border-slate-200 bg-white p-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-blue-700">{r.batteryCode || '—'}</Text>
                  <Text className="text-sm font-black text-slate-900">{money(r.totalCharge)}</Text>
                </View>
                <Text className="mt-0.5 text-[11px] text-slate-600" numberOfLines={2}>{r.itemDescription || r.partName || '—'}</Text>
                <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                  {[r.clientName, r.staffName, when(r.repairedAt)].filter(Boolean).join(' · ')}
                </Text>
                <Text className="text-[10px] text-slate-400">
                  Parts {money(r.partsCharge)} · Labour {money(r.laborCharge)} · Service fee {money(r.serviceFee)}
                </Text>
                {r.isUnserviceable ? (
                  <Text className="mt-1 text-[10px] font-semibold text-amber-700">Unserviceable — fitted parts removed, client not charged for them</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </Section>
        </>
      )}
    </ScrollView>
  );
}
