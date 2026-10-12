import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import DateField from '../../components/admin/DateField';
import { ErrorBox, PageHead, SearchBox, Stat, money } from '../../components/admin/sa4/ui';

// Finance & Billing (super_admin) — the phone version of the web FinancePage:
// GET /finance/summary?preset=&breakdown=&from=&to= → the six KPI cards, the
// revenue trend chart and the monthly / daily breakdown. Tap a period (or
// "View Statement") for FinanceDetail { type, period, label }.

const PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

export function avgPerUnit(t) {
  return t.avgRevenuePerBattery || (t.batteriesCount > 0 ? (Number(t.repairRevenue || 0) + Number(t.servicesRevenue || 0)) / t.batteriesCount : 0);
}

// the six KPI cards shared with the statement page
export function FinanceKpis({ totals: t }) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      <Stat icon="zap" label="Total Revenue" value={money(t.totalRevenue)} tone="good" sub="All services & recycling" />
      <Stat icon="wrench" label="Parts Service" value={money(t.repairRevenue)} tone="neutral" sub="Fitting & part charges" />
      <Stat icon="grid" label="Service & Fees" value={money(t.servicesRevenue)} tone="info" sub={`${t.servicesCount || 0} diagnostic & tests`} />
      <Stat icon="rotateCcw" label="Recycle Scrap" value={money(t.recycleRevenue)} tone="warning" sub="End-of-life battery payout" />
      <Stat icon="battery" label="Units Serviced" value={`${t.batteriesCount || 0} units`} tone="good" sub="Unique batteries handled" />
      <Stat icon="award" label="Avg. per Unit" value={money(avgPerUnit(t))} tone="purple" sub="Average revenue per battery" />
    </View>
  );
}

function TrendChart({ series }) {
  const max = Math.max(1, ...series.map((s) => Number(s.count) || 0));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="h-44 flex-row items-end gap-2 pr-2">
        {series.map((s, i) => {
          const v = Number(s.count) || 0;
          const last = i === series.length - 1;
          return (
            <View key={`${s.label}-${i}`} className="w-12 items-center">
              <Text className="mb-1 text-[9px] font-bold text-slate-500" numberOfLines={1}>{v ? `£${Math.round(v)}` : ''}</Text>
              <View className="h-28 w-7 justify-end">
                <View className={`w-full rounded-t-md ${last ? 'bg-emerald-700' : 'bg-emerald-500'}`} style={{ height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%` }} />
              </View>
              <Text className="mt-1 text-center text-[9px] text-slate-500" numberOfLines={2}>{s.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function AdminFinanceScreen() {
  const navigation = useNavigation();
  const [datePreset, setDatePreset] = useState('all');
  const [breakdownType, setBreakdownType] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = { preset: datePreset, breakdown: breakdownType };
      if (datePreset === 'custom') {
        if (customFrom) params.from = customFrom;
        if (customTo) params.to = customTo;
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
  }, [datePreset, breakdownType, customFrom, customTo]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const totals = data?.totals || {};
  const breakdown = data?.breakdown || [];
  const chartSeries = useMemo(
    () => breakdown.slice(0, 14).reverse().map((it) => ({ label: it.label, count: it.totalRevenue ?? it.repairRevenue })),
    [breakdown]
  );
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return breakdown;
    return breakdown.filter((it) => (it.label || '').toLowerCase().includes(q) || (it.key || '').toLowerCase().includes(q));
  }, [breakdown, searchQuery]);

  const hasActiveFilters = datePreset !== 'all' || customFrom !== '' || customTo !== '' || searchQuery.trim() !== '';
  const clearAll = () => {
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setSearchQuery('');
  };
  const isMonth = breakdownType === 'month';
  const openStatement = (row) => navigation.navigate('FinanceDetail', { type: breakdownType, period: row.key, label: row.label });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <PageHead title="Finance & Billing" description="Comprehensive repair revenue, recycling revenue, and total financial performance." />

      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <Text className="text-xs font-bold text-slate-500">Date Filter:</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = datePreset === p.id;
            return (
              <TouchableOpacity key={p.id} onPress={() => setDatePreset(p.id)} className={`rounded-lg px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-slate-500">View By:</Text>
          <View className="flex-1 flex-row rounded-xl bg-slate-100 p-1">
            {[['month', 'Monthly'], ['day', 'Daily']].map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setBreakdownType(id)} className={`flex-1 items-center rounded-lg py-1.5 ${breakdownType === id ? 'bg-white' : ''}`}>
                <Text className={`text-xs font-bold ${breakdownType === id ? 'text-slate-900' : 'text-slate-500'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {datePreset === 'custom' && (
          <View className="gap-3 border-t border-slate-100 pt-3">
            <DateField label="From:" value={customFrom} onChange={setCustomFrom} />
            <DateField label="To:" value={customTo} onChange={setCustomTo} />
          </View>
        )}
      </View>

      {loading && !refreshing ? <Text className="py-6 text-center text-xs text-slate-400">Loading financial breakdown…</Text> : null}
      <ErrorBox text={error} />

      {!loading && !error && (
        <>
          <FinanceKpis totals={totals} />

          {chartSeries.length > 0 && (
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-sm font-bold text-slate-900">{isMonth ? 'Monthly Revenue Trend' : 'Daily Revenue Trend'}</Text>
              <Text className="mb-3 text-[11px] text-slate-500">
                {breakdown.length} period{breakdown.length === 1 ? '' : 's'} tracked · {totals.batteriesCount || 0} total batteries
              </Text>
              <TrendChart series={chartSeries} />
            </View>
          )}

          <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <View>
              <Text className="text-base font-bold text-slate-900">{isMonth ? 'Monthly Financial Breakdown' : 'Daily Financial Breakdown'}</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Click on any {isMonth ? 'month' : 'day'} row to view its itemized statements, client distribution, battery fees, and technician logs.
              </Text>
            </View>
            <SearchBox value={searchQuery} onChangeText={setSearchQuery} placeholder="Search period…" />
            {filtered.length === 0 ? (
              <View className="items-center py-6">
                <Text className="text-center text-xs text-slate-500">
                  {searchQuery ? 'No periods match your search query.' : 'No financial activity recorded for the selected date range.'}
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity onPress={clearAll} className="mt-2">
                    <Text className="text-xs font-bold text-blue-600">Reset all filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filtered.map((row, i) => {
                const jobs = (row.repairsCount || 0) + (row.servicesCount || 0);
                return (
                  <TouchableOpacity key={row.key || i} activeOpacity={0.85} onPress={() => openStatement(row)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-xs font-bold text-slate-400">{i + 1}</Text>
                      <Text className="flex-1 text-sm font-extrabold text-blue-700">{row.label}</Text>
                      <Text className="text-sm font-black text-emerald-700">{money(row.totalRevenue)}</Text>
                    </View>
                    <View className="mt-2 flex-row flex-wrap justify-between gap-y-1">
                      <Text className="w-[48%] text-[11px] text-slate-500">Repair Cost <Text className="font-bold text-slate-800">{money(row.repairRevenue)}</Text></Text>
                      <Text className="w-[48%] text-[11px] text-slate-500">Service &amp; Fees <Text className="font-bold text-slate-800">{money(row.servicesRevenue || 0)}</Text></Text>
                      <Text className="w-[48%] text-[11px] text-slate-500">Recycle Revenue <Text className="font-bold text-slate-800">{money(row.recycleRevenue || 0)}</Text></Text>
                      <Text className="w-[48%] text-[11px] text-slate-500">Jobs Logged <Text className="font-bold text-slate-800">{jobs} job{jobs === 1 ? '' : 's'}</Text></Text>
                      <Text className="w-[48%] text-[11px] text-slate-500">Batteries Serviced <Text className="font-bold text-slate-800">{row.batteriesCount || 0} unit{row.batteriesCount === 1 ? '' : 's'}</Text></Text>
                    </View>
                    <Text className="mt-2 text-right text-[11px] font-bold text-blue-600">View Statement →</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
