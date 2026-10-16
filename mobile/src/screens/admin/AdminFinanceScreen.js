import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import DateField from '../../components/admin/DateField';
import { ErrorBox, money } from '../../components/admin/sa4/ui';
import Icon from '../../components/ui/Icon';

// Finance & Billing (super_admin)
// Polished executive redesign with zero horizontal scrolling, responsive bar chart,
// compact KPI grid, wrapping date filter pills, and itemized period cards.

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
  if (!t) return 0;
  return (
    t.avgRevenuePerBattery ||
    (t.batteriesCount > 0
      ? (Number(t.repairRevenue || 0) + Number(t.servicesRevenue || 0)) / t.batteriesCount
      : 0)
  );
}

// 6 Balanced Financial Stat Cards (shared with statement screen)
export function FinanceKpis({ totals: t = {} }) {
  const avg = avgPerUnit(t);

  const kpis = [
    { label: 'Total Revenue', value: money(t.totalRevenue), sub: 'All services & recycling', tone: 'text-emerald-700', bg: 'bg-emerald-50/70 border-emerald-200/90' },
    { label: 'Parts Service', value: money(t.repairRevenue), sub: 'Fitting & part charges', tone: 'text-slate-900', bg: 'bg-white border-slate-200' },
    { label: 'Service & Fees', value: money(t.servicesRevenue), sub: `${t.servicesCount || 0} diagnostic & tests`, tone: 'text-indigo-700', bg: 'bg-indigo-50/70 border-indigo-200/90' },
    { label: 'Recycle Scrap', value: money(t.recycleRevenue), sub: 'End-of-life battery payout', tone: 'text-amber-700', bg: 'bg-amber-50/70 border-amber-200/90' },
    { label: 'Units Serviced', value: `${t.batteriesCount || 0} units`, sub: 'Unique batteries handled', tone: 'text-slate-900', bg: 'bg-white border-slate-200' },
    { label: 'Avg. per Unit', value: money(avg), sub: 'Average revenue / pack', tone: 'text-purple-700', bg: 'bg-purple-50/70 border-purple-200/90' },
  ];

  return (
    <View className="flex-row flex-wrap gap-2">
      {kpis.map((k) => (
        <View key={k.label} className={`min-w-[46%] flex-1 rounded-xl border p-2.5 shadow-2xs ${k.bg}`}>
          <Text className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500" numberOfLines={1}>
            {k.label}
          </Text>
          <Text className={`mt-0.5 text-base font-black ${k.tone}`} numberOfLines={1}>
            {k.value}
          </Text>
          <Text className="mt-0.5 text-[9px] text-slate-400 font-medium" numberOfLines={1}>
            {k.sub}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Responsive Revenue Trend Chart — ZERO HORIZONTAL SCROLLING
function ResponsiveTrendChart({ series }) {
  // Fit up to the last 6 periods cleanly on screen without horizontal scroll
  const displaySeries = useMemo(() => {
    if (!series || series.length === 0) return [];
    return series.slice(-6);
  }, [series]);

  const max = Math.max(1, ...displaySeries.map((s) => Number(s.count) || 0));

  return (
    <View className="h-40 flex-row items-end justify-between px-1 pt-2">
      {displaySeries.map((s, i) => {
        const v = Number(s.count) || 0;
        const last = i === displaySeries.length - 1;
        const heightPct = Math.max(v > 0 ? 8 : 3, Math.round((v / max) * 100));

        return (
          <View key={`${s.label}-${i}`} className="flex-1 items-center px-0.5">
            <Text className="mb-1 text-[8.5px] font-bold text-slate-500" numberOfLines={1}>
              {v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : v ? `£${Math.round(v)}` : ''}
            </Text>
            <View className="h-24 w-full max-w-[28px] justify-end">
              <View
                className={`w-full rounded-t-md ${last ? 'bg-emerald-600' : 'bg-emerald-400'}`}
                style={{ height: `${heightPct}%` }}
              />
            </View>
            <Text className="mt-1 text-center text-[9px] font-medium text-slate-500" numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
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
      contentContainerClassName="p-3.5 pb-20 gap-3"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Executive Header Card with Live Counters Strip */}
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-base font-black text-slate-900">Finance & Billing</Text>
              <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-emerald-800">Fiscal Governance</Text>
              </View>
            </View>
            <Text className="mt-0.5 text-[11px] text-slate-500 leading-4">
              Comprehensive repair revenue, recycling scrap payouts, and period billing performance.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { setLoading(true); load(); }}
            className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 shadow-2xs"
          >
            <Icon name="refresh" size={11} color="#64748b" />
            <Text className="text-[10.5px] font-semibold text-slate-700">Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Live Counters Strip */}
        <View className="flex-row items-center gap-2 pt-2 mt-2 border-t border-slate-100 flex-wrap">
          <Text className="text-[10.5px] text-slate-500">
            Total: <Text className="font-black text-emerald-700">{money(totals.totalRevenue)}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-slate-700">
            Parts: <Text className="font-bold">{money(totals.repairRevenue)}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-indigo-700">
            Service: <Text className="font-bold">{money(totals.servicesRevenue)}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-amber-700">
            Recycle: <Text className="font-bold">{money(totals.recycleRevenue)}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-slate-600">
            Units: <Text className="font-bold">{totals.batteriesCount || 0}</Text>
          </Text>
        </View>
      </View>

      {/* Date Filter Toolbar — WRAPPING (Zero Horizontal Scrolling) */}
      <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
        <View className="flex-row items-center justify-between">
          <Text className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Date Filters</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row rounded-lg bg-slate-100 p-0.5">
              {[
                { id: 'month', label: 'Monthly' },
                { id: 'day', label: 'Daily' },
              ].map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setBreakdownType(b.id)}
                  className={`rounded-md px-2 py-0.5 ${breakdownType === b.id ? 'bg-white shadow-2xs' : ''}`}
                >
                  <Text className={`text-[10.5px] font-bold ${breakdownType === b.id ? 'text-slate-900' : 'text-slate-500'}`}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={clearAll} hitSlop={6}>
                <Text className="text-[11px] font-bold text-rose-600">✕ Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Presets — WRAPPING */}
        <View className="flex-row flex-wrap gap-1">
          {PRESETS.map((p) => {
            const active = datePreset === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setDatePreset(p.id)}
                className={`rounded-lg border px-2 py-1 ${
                  active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Date Range */}
        {datePreset === 'custom' && (
          <View className="flex-row gap-2 pt-1 border-t border-slate-100">
            <View className="flex-1">
              <DateField label="From:" value={customFrom} onChange={setCustomFrom} quick={false} />
            </View>
            <View className="flex-1">
              <DateField label="To:" value={customTo} onChange={setCustomTo} quick={false} />
            </View>
          </View>
        )}
      </View>

      {loading && !refreshing ? (
        <Text className="py-6 text-center text-xs text-slate-400">Loading financial breakdown…</Text>
      ) : null}
      <ErrorBox text={error} />

      {!loading && !error && (
        <>
          {/* 6 Balanced Financial Stat Cards */}
          <FinanceKpis totals={totals} />

          {/* Responsive Revenue Trend Chart (NO HORIZONTAL SCROLL) */}
          {chartSeries.length > 0 && (
            <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold text-slate-900">
                  {isMonth ? 'Monthly Revenue Trend' : 'Daily Revenue Trend'}
                </Text>
                <Text className="text-[10px] text-slate-400 font-medium">
                  {breakdown.length} period{breakdown.length === 1 ? '' : 's'} tracked
                </Text>
              </View>
              <ResponsiveTrendChart series={chartSeries} />
            </View>
          )}

          {/* Breakdown Section: Stacked Cards (Zero Horizontal Scrolling) */}
          <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-900">
                {isMonth ? 'Monthly Breakdown' : 'Daily Breakdown'}
              </Text>
              <Text className="text-[10px] text-slate-400">{filtered.length} entries</Text>
            </View>

            {/* Search Input */}
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
              <Icon name="search" size={13} color="#94a3b8" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search period…"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                className="ml-1.5 flex-1 p-0 text-xs text-slate-900"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
                  <Icon name="x" size={12} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

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
                  <TouchableOpacity
                    key={row.key || i}
                    activeOpacity={0.85}
                    onPress={() => openStatement(row)}
                    className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs gap-2"
                  >
                    {/* Header Row: Index, Period, Total Revenue, Action */}
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-1.5 min-w-0 flex-1">
                        <Text className="font-mono text-[10px] text-slate-400 w-4">#{i + 1}</Text>
                        <Text className="flex-1 text-xs font-black text-blue-700" numberOfLines={1}>
                          {row.label}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1 shrink-0">
                        <Text className="font-mono text-xs font-black text-emerald-700">
                          {money(row.totalRevenue)}
                        </Text>
                        <Text className="text-xs font-bold text-slate-400">›</Text>
                      </View>
                    </View>

                    {/* 4-Stat Micro Grid — WRAPPING */}
                    <View className="flex-row flex-wrap justify-between gap-y-1.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                      <View className="w-[48%]">
                        <Text className="text-[9.5px] text-slate-400">Repair Cost</Text>
                        <Text className="font-mono text-[11px] font-bold text-slate-800">{money(row.repairRevenue)}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-[9.5px] text-slate-400">Service Fees</Text>
                        <Text className="font-mono text-[11px] font-bold text-indigo-700">{money(row.servicesRevenue || 0)}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-[9.5px] text-slate-400">Recycle Scrap</Text>
                        <Text className="font-mono text-[11px] font-bold text-amber-700">{money(row.recycleRevenue || 0)}</Text>
                      </View>
                      <View className="w-[48%]">
                        <Text className="text-[9.5px] text-slate-400">Volume</Text>
                        <Text className="font-mono text-[11px] font-bold text-slate-700">{jobs}j · {row.batteriesCount || 0}u</Text>
                      </View>
                    </View>
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
