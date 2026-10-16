import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import DateField from '../../../components/admin/DateField';
import { Banner, ClientLogo, EmptyState, Loading } from '../../../components/admin/sa5/common';
import Icon from '../../../components/ui/Icon';

// Client Ratings & Service Feedback
// Polished executive redesign with zero horizontal scrolling, compact cards,
// wrapping filter pills, live metrics summary strip, and quick inspection.

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

const RATING_OPTIONS = [
  { id: '', label: 'All Ratings' },
  { id: '5', label: '★★★★★ 5 Stars' },
  { id: '4', label: '★★★★ 4 Stars' },
  { id: '3', label: '★★★ 3 Stars' },
  { id: '2', label: '★★ 2 Stars' },
  { id: '1', label: '★ 1 Star' },
];

const THEME = {
  5: { bar: 'bg-amber-400', badge: 'border-amber-200 bg-amber-50', text: 'text-amber-800', sentiment: 'Excellent Quality', pill: 'bg-amber-500 border-amber-500' },
  4: { bar: 'bg-emerald-500', badge: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800', sentiment: 'Very Good Quality', pill: 'bg-emerald-600 border-emerald-600' },
  3: { bar: 'bg-blue-500', badge: 'border-blue-200 bg-blue-50', text: 'text-blue-800', sentiment: 'Satisfactory', pill: 'bg-blue-600 border-blue-600' },
  2: { bar: 'bg-orange-500', badge: 'border-orange-200 bg-orange-50', text: 'text-orange-800', sentiment: 'Needs Attention', pill: 'bg-orange-500 border-orange-500' },
  1: { bar: 'bg-rose-600', badge: 'border-rose-200 bg-rose-50', text: 'text-rose-800', sentiment: 'Critical Review', pill: 'bg-rose-600 border-rose-600' },
};

const BREAKDOWN_COLORS = { 5: 'bg-amber-400', 4: 'bg-emerald-400', 3: 'bg-blue-400', 2: 'bg-orange-400', 1: 'bg-rose-400' };

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function presetRange(id) {
  const now = new Date();
  if (id === 'today') return [ymd(now), ymd(now)];
  if (id === 'week') {
    const monday = new Date(now);
    const d = monday.getDay();
    monday.setDate(monday.getDate() - d + (d === 0 ? -6 : 1));
    return [ymd(monday), ymd(now)];
  }
  if (id === 'month') return [`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`, ymd(now)];
  return ['', ''];
}

function tagsOf(r) {
  if (Array.isArray(r.preset_tags)) return r.preset_tags;
  if (typeof r.preset_tags === 'string') {
    try {
      return JSON.parse(r.preset_tags || '[]');
    } catch {
      return [];
    }
  }
  return [];
}

function batteriesOf(r) {
  if (Array.isArray(r.battery_codes) && r.battery_codes.length) return r.battery_codes;
  return r.battery_code ? r.battery_code.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function Stars({ value, size = 'text-xs' }) {
  const n = Math.round(Number(value) || 0);
  return (
    <Text className={size}>
      <Text className="text-amber-400">{'★'.repeat(n)}</Text>
      <Text className="text-slate-300">{'★'.repeat(Math.max(0, 5 - n))}</Text>
    </Text>
  );
}

function Summary({ stats }) {
  const total = Number(stats?.total_reviews || 0);
  const avg = Number(stats?.average_rating || 0).toFixed(1);
  const positive = Number(stats?.positive_count || 0);
  const pct = total > 0 ? Math.round((positive / total) * 100) : 0;

  return (
    <View className="gap-2">
      {/* 2x2 Grid of Executive KPI Cards */}
      <View className="flex-row gap-2">
        {/* Overall Score */}
        <View className="flex-1 rounded-xl border border-amber-200/90 bg-amber-50/70 p-2.5 shadow-2xs">
          <Text className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800">Overall Score</Text>
          <View className="mt-1 flex-row items-baseline gap-1">
            <Text className="text-xl font-black text-slate-900">{avg}</Text>
            <Text className="text-[10px] font-bold text-slate-400">/ 5.0</Text>
          </View>
          <View className="mt-0.5 flex-row items-center justify-between">
            <Stars value={avg} size="text-[11px]" />
            <Text className="text-[9px] text-slate-500 font-medium">{total} total</Text>
          </View>
        </View>

        {/* Total Submissions */}
        <View className="flex-1 rounded-xl border border-blue-200/90 bg-blue-50/70 p-2.5 shadow-2xs">
          <Text className="text-[9.5px] font-bold uppercase tracking-wider text-blue-800">Total Reviews</Text>
          <View className="mt-1 flex-row items-baseline gap-1">
            <Text className="text-xl font-black text-slate-900">{total.toLocaleString()}</Text>
            <Text className="text-[10px] font-semibold text-blue-700">logged</Text>
          </View>
          <Text className="mt-0.5 text-[9.5px] text-blue-600 font-medium" numberOfLines={1}>Verified submissions</Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        {/* Client Satisfaction */}
        <View className="flex-1 rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-2.5 shadow-2xs">
          <Text className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800">Satisfaction</Text>
          <View className="mt-1 flex-row items-baseline gap-1">
            <Text className="text-xl font-black text-slate-900">{pct}%</Text>
            <Text className="text-[10px] font-bold text-emerald-700">Positive</Text>
          </View>
          <Text className="mt-0.5 text-[9.5px] text-emerald-700 font-medium" numberOfLines={1}>
            {positive} scored 4★ or 5★
          </Text>
        </View>

        {/* Star Breakdown */}
        <View className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[9.5px] font-bold uppercase tracking-wider text-slate-600">Breakdown</Text>
            <Text className="font-mono text-[9px] text-slate-400">1★–5★</Text>
          </View>
          {[5, 4, 3, 2, 1].map((s) => {
            const count = Number(stats?.[`stars_${s}`] || 0);
            const w = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <View key={s} className="mb-0.5 flex-row items-center gap-1">
                <Text className="w-3.5 text-[9px] font-bold text-slate-700">{s}★</Text>
                <View className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <View className={`h-full rounded-full ${BREAKDOWN_COLORS[s]}`} style={{ width: `${w}%` }} />
                </View>
                <Text className="w-5 text-right font-mono text-[8.5px] text-slate-400">{count}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function RatingsScreen() {
  const navigation = useNavigation();
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [ratingFilter, setRatingFilter] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => setClients(Array.isArray(data) ? data : data?.data || [])).catch(() => {});
  }, []);

  function choosePreset(id) {
    setDatePreset(id);
    if (id !== 'custom') {
      const [s, e] = presetRange(id);
      setStartDate(s);
      setEndDate(e);
    }
  }

  const fetchRatings = useCallback(async () => {
    const id = ++reqRef.current;
    setError(null);
    try {
      const params = {};
      if (ratingFilter) params.rating = ratingFilter;
      if (selectedClient) params.clientId = selectedClient;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await apiClient.get('/ratings', { params });
      if (id !== reqRef.current) return;
      setRatings(data?.data || []);
      setStats(data?.stats || null);
    } catch (err) {
      if (id === reqRef.current) setError(err.response?.data?.message || err.message);
    } finally {
      if (id === reqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [ratingFilter, selectedClient, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    fetchRatings();
  }, [fetchRatings]);

  function clearFilters() {
    setRatingFilter('');
    setSelectedClient('');
    setSearch('');
    setDebouncedSearch('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  }

  const hasActiveFilters = Boolean(ratingFilter || selectedClient || search || datePreset !== 'all' || startDate || endDate);
  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });
  const openReturn = (id) => navigation.navigate('AdminDetail', { kind: 'return', id });
  const openRating = (id) => navigation.navigate('AdminRatingDetail', { id });

  const totalReviews = Number(stats?.total_reviews || 0);
  const avgScore = Number(stats?.average_rating || 0).toFixed(1);
  const positiveReviews = Number(stats?.positive_count || 0);
  const satisfactionPct = totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 100) : 0;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-3 p-3.5 pb-20"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRatings(); }} />}
    >
      {/* Executive Header Card with Live Metrics Strip */}
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-base font-black text-slate-900">Customer Reviews & Ratings</Text>
              <View className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-amber-800">Service Satisfaction</Text>
              </View>
            </View>
            <Text className="mt-0.5 text-[11px] text-slate-500 leading-4">
              Monitor client satisfaction scores, turnaround reviews, and service feedback across all battery visits.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { setLoading(true); fetchRatings(); }}
            className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 shadow-2xs"
          >
            <Icon name="refresh" size={11} color="#64748b" />
            <Text className="text-[10.5px] font-semibold text-slate-700">Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Live Counters Strip */}
        <View className="flex-row items-center gap-2 pt-2 mt-2 border-t border-slate-100 flex-wrap">
          <Text className="text-[10.5px] text-slate-500">
            Score: <Text className="font-black text-slate-900">{avgScore} / 5.0</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-blue-700">
            Reviews: <Text className="font-bold">{totalReviews}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-emerald-700">
            Satisfaction: <Text className="font-bold">{satisfactionPct}%</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-amber-700">
            5★: <Text className="font-bold">{stats?.stars_5 || 0}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-emerald-600">
            4★: <Text className="font-bold">{stats?.stars_4 || 0}</Text>
          </Text>
        </View>
      </View>

      {/* KPI Metric Summary Cards */}
      <Summary stats={stats} />

      {/* Filter Toolbar — WRAPPING (Zero Horizontal Scrolling) */}
      <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
        <View className="flex-row items-center justify-between">
          <Text className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Filters & Controls</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row rounded-lg bg-slate-100 p-0.5">
              {[
                { id: 'grid', label: 'Cards' },
                { id: 'table', label: 'Compact' },
              ].map((v) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setViewMode(v.id)}
                  className={`rounded-md px-2 py-0.5 ${viewMode === v.id ? 'bg-white shadow-2xs' : ''}`}
                >
                  <Text className={`text-[10.5px] font-bold ${viewMode === v.id ? 'text-slate-900' : 'text-slate-500'}`}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={clearFilters} hitSlop={6}>
                <Text className="text-[11px] font-bold text-rose-600">✕ Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Date Presets — WRAPPING */}
        <View className="flex-row flex-wrap gap-1">
          {DATE_PRESETS.map((p) => {
            const active = datePreset === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => choosePreset(p.id)}
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
        {datePreset === 'custom' ? (
          <View className="flex-row gap-2 pt-1 border-t border-slate-100">
            <View className="flex-1">
              <DateField label="From:" value={startDate} onChange={setStartDate} quick={false} />
            </View>
            <View className="flex-1">
              <DateField label="To:" value={endDate} onChange={setEndDate} quick={false} />
            </View>
          </View>
        ) : null}

        {/* Search Input */}
        <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
          <Icon name="search" size={13} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search battery, client, feedback…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            className="ml-1.5 flex-1 p-0 text-xs text-slate-900"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <Icon name="x" size={12} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Client Filter Pills — WRAPPING */}
        <View className="flex-row flex-wrap gap-1">
          <TouchableOpacity
            onPress={() => setSelectedClient('')}
            className={`rounded-lg border px-2 py-0.5 ${
              !selectedClient ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'
            }`}
          >
            <Text className={`text-[10px] font-bold ${!selectedClient ? 'text-white' : 'text-slate-600'}`}>
              All Clients
            </Text>
          </TouchableOpacity>
          {clients.map((c) => {
            const active = String(selectedClient) === String(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setSelectedClient(active ? '' : String(c.id))}
                className={`rounded-lg border px-2 py-0.5 ${
                  active ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'
                }`}
              >
                <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Star Rating Pills — WRAPPING */}
        <View className="flex-row flex-wrap gap-1">
          {RATING_OPTIONS.map((o) => {
            const active = String(ratingFilter) === String(o.id);
            return (
              <TouchableOpacity
                key={o.id}
                onPress={() => setRatingFilter(active ? '' : o.id)}
                className={`rounded-lg border px-2 py-0.5 ${
                  active ? 'border-amber-500 bg-amber-500' : 'border-slate-200 bg-white'
                }`}
              >
                <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content Stream */}
      {loading && !refreshing ? (
        <Loading text="Loading client ratings & feedback…" />
      ) : error ? (
        <Banner tone="bad" text={error} />
      ) : ratings.length === 0 ? (
        <EmptyState
          title="No Ratings Found"
          text={
            hasActiveFilters
              ? 'Try widening your date range or clearing specific filter tags to see more feedback records.'
              : 'Client feedback and ratings will appear here as soon as clients review their serviced batteries.'
          }
          action={
            hasActiveFilters ? (
              <TouchableOpacity onPress={clearFilters} className="rounded-xl bg-slate-900 px-3 py-1.5">
                <Text className="text-xs font-bold text-white">Reset Filters</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      ) : viewMode === 'table' ? (
        /* Compact List View (Zero Horizontal Scrolling) */
        <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs divide-y divide-slate-100">
          {ratings.map((r, index) => {
            const tags = tagsOf(r);
            const codes = batteriesOf(r);
            const d = new Date(r.created_at);
            const theme = THEME[r.rating] || THEME[5];
            return (
              <View key={r.id || index} className="p-3 gap-1.5">
                {/* Header row: Index, Client Name, Star Badge, Action */}
                <View className="flex-row items-center gap-2">
                  <Text className="w-5 font-mono text-[10px] text-slate-400">#{index + 1}</Text>
                  <View className="flex-1 min-w-0">
                    <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                      {r.client_name || 'Verified Client'}
                    </Text>
                    <Text className="text-[9.5px] text-slate-400">
                      {d.toLocaleDateString([], { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View className={`rounded-lg border px-1.5 py-0.5 ${theme.badge}`}>
                    <Text className={`text-[10px] font-black ${theme.text}`}>★ {r.rating}.0</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => openRating(r.id)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5"
                  >
                    <Text className="text-[10px] font-bold text-slate-700">Inspect ›</Text>
                  </TouchableOpacity>
                </View>

                {/* Battery Codes and Tags — WRAPPING */}
                <View className="ml-7 flex-row flex-wrap items-center gap-1">
                  {codes.length ? (
                    codes.map((code) => (
                      <TouchableOpacity
                        key={code}
                        onPress={() => openBattery(code)}
                        className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.2"
                      >
                        <Text className="font-mono text-[9.5px] font-bold text-blue-700">🔋 {code}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text className="text-[10px] text-slate-400">General Service</Text>
                  )}
                  {tags.slice(0, 3).map((t, i) => (
                    <View key={`${t}${i}`} className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2">
                      <Text className="text-[9px] font-bold text-emerald-800">✓ {t}</Text>
                    </View>
                  ))}
                  {tags.length > 3 ? (
                    <Text className="text-[9px] font-bold text-slate-400">+{tags.length - 3}</Text>
                  ) : null}
                </View>

                {/* Feedback quote snippet */}
                {r.custom_feedback ? (
                  <View className="ml-7 rounded-md bg-slate-50 p-1.5">
                    <Text className="text-[10.5px] italic text-slate-600 leading-4" numberOfLines={2}>
                      “{r.custom_feedback}”
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        /* Executive Grid Cards (Compact & Zero Horizontal Scrolling) */
        <View className="gap-2.5">
          {ratings.map((r) => {
            const tags = tagsOf(r);
            const codes = batteriesOf(r);
            const theme = THEME[r.rating] || THEME[5];
            const dateStr = r.created_at
              ? new Date(r.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '—';

            return (
              <View key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {/* Accent Top Line */}
                <View className={`h-0.5 ${theme.bar}`} />

                <View className="p-3 gap-2">
                  {/* Client Info & Star Rating Badge */}
                  <View className="flex-row items-center gap-2.5">
                    <ClientLogo path={r.client_logo_path} name={r.client_name} size={34} />
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                        {r.client_name || 'Client Review'}
                      </Text>
                      <Text className="text-[10px] text-slate-400" numberOfLines={1}>
                        {r.user_email || 'Verified Partner'}
                      </Text>
                    </View>
                    <View className={`flex-row items-center gap-0.5 rounded-lg border px-2 py-0.5 ${theme.badge}`}>
                      <Text className={`text-xs font-black ${theme.text}`}>★ {r.rating}.0</Text>
                    </View>
                  </View>

                  {/* Battery & Return Metadata Ribbon */}
                  <View className="flex-row flex-wrap items-center gap-1 rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                    {codes.length ? (
                      codes.map((code) => (
                        <TouchableOpacity
                          key={code}
                          onPress={() => openBattery(code)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5"
                        >
                          <Text className="font-mono text-[10px] font-bold text-blue-700">🔋 {code}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text className="font-mono text-[10px] text-slate-400">General Service</Text>
                    )}
                    {r.return_id ? (
                      <TouchableOpacity
                        onPress={() => openReturn(r.return_id)}
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5"
                      >
                        <Text className="text-[10px] font-bold text-slate-600">🚚 Return #{r.return_id}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Text className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {theme.sentiment}
                    </Text>
                  </View>

                  {/* Preset Tags Ribbon */}
                  {tags.length > 0 ? (
                    <View className="flex-row flex-wrap gap-1">
                      {tags.map((tag, i) => (
                        <View key={`${tag}${i}`} className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
                          <Text className="text-[9.5px] font-bold text-emerald-800">✓ {tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Review Quote Box */}
                  {r.custom_feedback ? (
                    <View className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
                      <Text className="text-[11px] italic leading-4 text-slate-700">
                        “{r.custom_feedback}”
                      </Text>
                    </View>
                  ) : null}

                  {/* Footer: Date & Inspect Action */}
                  <View className="flex-row items-center justify-between border-t border-slate-100 pt-2">
                    <Text className="text-[10px] text-slate-400">🕒 {dateStr}</Text>
                    <TouchableOpacity
                      onPress={() => openRating(r.id)}
                      className="flex-row items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-2xs"
                    >
                      <Text className="text-[10.5px] font-bold text-slate-700">Inspect</Text>
                      <Text className="text-[10px] text-slate-400">›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
