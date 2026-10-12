import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import DateField from '../../../components/admin/DateField';
import { Banner, Card, Chips, ClientLogo, EmptyState, Loading, SmallButton } from '../../../components/admin/sa5/common';

// Client Ratings & Service Feedback — the web RatingsPage: GET /ratings with
// ?rating, ?clientId, ?search (debounced), ?startDate / ?endDate. Four
// summary cards, date presets, Grid / Table views, Reset, and per review
// "View Details" → AdminRatingDetail.

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

const RATING_OPTIONS = [
  { id: '', label: 'All Star Ratings' },
  { id: '5', label: '★★★★★ 5 Stars' },
  { id: '4', label: '★★★★ 4 Stars' },
  { id: '3', label: '★★★ 3 Stars' },
  { id: '2', label: '★★ 2 Stars' },
  { id: '1', label: '★ 1 Star' },
];

const THEME = {
  5: { bar: 'bg-amber-400', badge: 'border-amber-200 bg-amber-50', text: 'text-amber-800', sentiment: 'Excellent Quality' },
  4: { bar: 'bg-emerald-500', badge: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800', sentiment: 'Very Good Quality' },
  3: { bar: 'bg-blue-500', badge: 'border-blue-200 bg-blue-50', text: 'text-blue-800', sentiment: 'Satisfactory' },
  2: { bar: 'bg-orange-500', badge: 'border-orange-200 bg-orange-50', text: 'text-orange-800', sentiment: 'Needs Attention' },
  1: { bar: 'bg-rose-600', badge: 'border-rose-200 bg-rose-50', text: 'text-rose-800', sentiment: 'Critical Review' },
};

const BREAKDOWN_COLORS = { 5: 'bg-amber-400', 4: 'bg-emerald-400', 3: 'bg-blue-400', 2: 'bg-orange-400', 1: 'bg-rose-400' };

const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// same ranges as the web page
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

function Stars({ value, size = 'text-sm' }) {
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
      <View className="flex-row gap-2">
        <View className="flex-1 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Overall Score</Text>
          <Text className="mt-1.5 text-2xl font-black text-slate-900">{avg} <Text className="text-xs font-bold text-slate-400">/ 5.0</Text></Text>
          <Stars value={avg} size="text-xs" />
          <Text className="text-[10px] text-slate-500">({total} total reviews)</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Total Submissions</Text>
          <Text className="mt-1.5 text-2xl font-black text-slate-900">{total.toLocaleString()}</Text>
          <Text className="mt-1 text-[10px] font-medium text-blue-600">Verified feedback entries logged</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Client Satisfaction</Text>
          <Text className="mt-1.5 text-2xl font-black text-slate-900">{pct}% <Text className="text-xs font-bold text-emerald-700">Positive</Text></Text>
          <Text className="mt-1 text-[10px] font-medium text-emerald-700">{positive} reviews scored 4★ or 5★</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3.5">
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Star Breakdown</Text>
            <Text className="font-mono text-[9px] text-slate-400">1★ – 5★</Text>
          </View>
          {[5, 4, 3, 2, 1].map((s) => {
            const count = Number(stats?.[`stars_${s}`] || 0);
            const w = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <View key={s} className="mb-1 flex-row items-center gap-1.5">
                <Text className="w-4 text-[10px] font-bold text-slate-700">{s}★</Text>
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <View className={`h-full rounded-full ${BREAKDOWN_COLORS[s]}`} style={{ width: `${w}%` }} />
                </View>
                <Text className="w-6 text-right font-mono text-[9px] text-slate-400">{count}</Text>
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

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-4 p-4 pb-16"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRatings(); }} />}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-xl font-black text-green-600">Client Ratings & Service Feedback</Text>
          <Text className="mt-1 text-xs text-slate-500">
            Monitor client satisfaction scores, turnaround reviews, and service feedback across all battery visits.
          </Text>
        </View>
        <SmallButton label={loading ? 'Loading…' : '↻ Refresh'} onPress={() => { setLoading(true); fetchRatings(); }} />
      </View>

      <Summary stats={stats} />

      {/* Filter bar */}
      <Card className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Date Filter:</Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row rounded-xl bg-slate-100 p-1">
              {[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }].map((v) => (
                <TouchableOpacity key={v.id} onPress={() => setViewMode(v.id)} className={`rounded-lg px-2.5 py-1 ${viewMode === v.id ? 'bg-white' : ''}`}>
                  <Text className={`text-[11px] font-bold ${viewMode === v.id ? 'text-slate-900' : 'text-slate-500'}`}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={clearFilters} hitSlop={6}>
                <Text className="text-xs font-bold text-rose-600">✕ Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <Chips options={DATE_PRESETS} value={datePreset} onChange={choosePreset} />
        {datePreset === 'custom' ? (
          <View className="gap-2">
            <DateField label="From:" value={startDate} onChange={setStartDate} quick={false} />
            <DateField label="To:" value={endDate} onChange={setEndDate} quick={false} />
          </View>
        ) : null}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search battery code, comments, client..."
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900"
        />
        <Chips
          options={[{ id: '', label: 'All Clients' }, ...clients.map((c) => ({ id: String(c.id), label: c.name }))]}
          value={selectedClient}
          onChange={setSelectedClient}
          activeClass="bg-slate-900"
        />
        <Chips options={RATING_OPTIONS} value={ratingFilter} onChange={setRatingFilter} activeClass="bg-amber-500" />
      </Card>

      {loading && !refreshing ? (
        <Loading text="Loading client ratings & feedback…" />
      ) : error ? (
        <Banner tone="bad" text={error} />
      ) : ratings.length === 0 ? (
        <EmptyState
          title="No Ratings Found"
          text={hasActiveFilters
            ? 'Try widening your date range or clearing specific filter tags to see more feedback records.'
            : 'Client feedback and ratings will appear here as soon as clients review their serviced batteries.'}
          action={hasActiveFilters ? <SmallButton label="Reset Filters" onPress={clearFilters} /> : null}
        />
      ) : viewMode === 'table' ? (
        <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {ratings.map((r, index) => {
            const tags = tagsOf(r);
            const codes = batteriesOf(r);
            const d = new Date(r.created_at);
            return (
              <View key={r.id || index} className={`gap-1.5 px-3.5 py-3 ${index ? 'border-t border-slate-100' : ''}`}>
                <View className="flex-row items-center gap-2">
                  <Text className="w-6 font-mono text-[11px] text-slate-400">{index + 1}</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{r.client_name || 'Verified Client'}</Text>
                    <Text className="text-[10px] text-slate-400">
                      {d.toLocaleDateString([], { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">★ {r.rating}.0</Text>
                </View>
                <View className="ml-8 flex-row flex-wrap gap-1">
                  {codes.length ? codes.map((code) => (
                    <TouchableOpacity key={code} onPress={() => openBattery(code)} className="rounded-md bg-blue-50 px-2 py-0.5">
                      <Text className="font-mono text-[11px] font-bold text-blue-700">{code}</Text>
                    </TouchableOpacity>
                  )) : <Text className="text-[11px] text-slate-400">—</Text>}
                  {tags.slice(0, 2).map((t, i) => (
                    <Text key={`${t}${i}`} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{t}</Text>
                  ))}
                  {tags.length > 2 ? <Text className="self-center text-[10px] font-bold text-slate-400">+{tags.length - 2}</Text> : null}
                </View>
                <View className="ml-8 flex-row items-center gap-2">
                  <Text className="flex-1 text-[11px] italic text-slate-600" numberOfLines={1}>{r.custom_feedback ? `"${r.custom_feedback}"` : '—'}</Text>
                  <TouchableOpacity onPress={() => openRating(r.id)} className="rounded-lg bg-blue-50 px-2.5 py-1">
                    <Text className="text-xs font-bold text-blue-700">Inspect →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="gap-3">
          {ratings.map((r) => {
            const tags = tagsOf(r);
            const codes = batteriesOf(r);
            const theme = THEME[r.rating] || THEME[5];
            const dateStr = r.created_at
              ? new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';
            return (
              <View key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <View className={`h-1 ${theme.bar}`} />
                <View className="gap-3 p-4">
                  <View className="flex-row items-start gap-3">
                    <ClientLogo path={r.client_logo_path} name={r.client_name} size={44} />
                    <View className="flex-1">
                      <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>{r.client_name || 'Client Review'}</Text>
                      <Text className="text-[11px] text-slate-400" numberOfLines={1}>{r.user_email || 'Verified Partner'}</Text>
                    </View>
                    <Text className={`rounded-xl border px-2.5 py-1 text-xs font-black ${theme.badge} ${theme.text}`}>★ {r.rating}.0</Text>
                  </View>

                  <View className="flex-row flex-wrap items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    {codes.length ? codes.map((code) => (
                      <TouchableOpacity key={code} onPress={() => openBattery(code)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5">
                        <Text className="font-mono text-xs font-bold text-blue-700">🔋 {code}</Text>
                      </TouchableOpacity>
                    )) : <Text className="font-mono text-xs text-slate-400">General Service</Text>}
                    {r.return_id ? (
                      <TouchableOpacity onPress={() => openReturn(r.return_id)} className="rounded-lg border border-slate-200 bg-white px-2 py-0.5">
                        <Text className="text-[11px] font-bold text-slate-600">🚚 Return #{r.return_id}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Text className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">{theme.sentiment}</Text>
                  </View>

                  {tags.length > 0 ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <Text key={`${tag}${i}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">✓ {tag}</Text>
                      ))}
                    </View>
                  ) : null}

                  {r.custom_feedback ? (
                    <View className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <Text className="text-xs italic leading-5 text-slate-700">“{r.custom_feedback}”</Text>
                    </View>
                  ) : null}

                  <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
                    <Text className="text-[11px] text-slate-400">🕒 {dateStr}</Text>
                    <SmallButton label="View Details ›" tone="primary" onPress={() => openRating(r.id)} />
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
