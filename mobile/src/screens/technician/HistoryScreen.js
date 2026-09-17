import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import formatDuration from '../../utils/format-duration';
import { resolveImageUrl } from '../../utils/imageUrl';

const DATE_FILTERS = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
];

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'repair', label: 'Repairs' },
  { id: 'issue', label: 'Unserviceable' },
];

const DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatYMD(d) {
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYMD(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatShortDate(str) {
  const d = parseYMD(str);
  if (!d) return '';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function matchesDateFilter(dateStr, filter, customStart, customEnd) {
  if (filter === 'all' || !filter) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  if (filter === 'today') {
    return isSameDay(d, now);
  }
  if (filter === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(d, yesterday);
  }
  if (filter === 'week') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return d >= sevenDaysAgo;
  }
  if (filter === 'month') {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    return d >= thirtyDaysAgo;
  }
  if (filter === 'custom') {
    if (customStart) {
      const s = parseYMD(customStart);
      if (s) {
        s.setHours(0, 0, 0, 0);
        if (d < s) return false;
      }
    }
    if (customEnd) {
      const e = parseYMD(customEnd);
      if (e) {
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
    } else if (customStart) {
      const s = parseYMD(customStart);
      if (s && !isSameDay(d, s)) return false;
    }
    return true;
  }
  return true;
}

function buildTimeline(repairs, issues) {
  const repairEntries = (repairs || []).map((r) => ({
    ...r,
    kind: 'repair',
    sortDate: r.repaired_at,
  }));
  const issueEntries = (issues || []).map((i) => ({
    ...i,
    kind: 'issue',
    sortDate: i.reported_at,
  }));
  return [...repairEntries, ...issueEntries].sort(
    (a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0)
  );
}

// Group items by date for clear date-wise breakdown
function groupTimelineByDate(items) {
  const groups = {};
  const todayStr = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();

  for (const item of items) {
    if (!item.sortDate) {
      const key = 'Undated';
      if (!groups[key]) groups[key] = { label: 'Undated', dateKey: key, data: [] };
      groups[key].data.push(item);
      continue;
    }
    const d = new Date(item.sortDate);
    const dateKey = d.toDateString();
    if (!groups[dateKey]) {
      let label = d.toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      let isToday = false;
      let isYesterday = false;
      if (dateKey === todayStr) {
        label = 'Today · ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
        isToday = true;
      } else if (dateKey === yesterdayStr) {
        label = 'Yesterday · ' + d.toLocaleDateString([], { day: 'numeric', month: 'short' });
        isYesterday = true;
      }
      groups[dateKey] = {
        label,
        isToday,
        isYesterday,
        dateKey,
        data: [],
      };
    }
    groups[dateKey].data.push(item);
  }

  return Object.values(groups);
}

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [rawTimeline, setRawTimeline] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Custom Date Modal & Range state
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [tempRange, setTempRange] = useState({ start: null, end: null });
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const load = useCallback(() => {
    setError(null);
    return apiClient
      .get('/staff/me')
      .then(({ data }) => setRawTimeline(buildTimeline(data.repairs, data.issues || [])))
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Filtered timeline computation
  const filteredTimeline = useMemo(() => {
    if (!rawTimeline) return [];
    const q = search.trim().toLowerCase();

    return rawTimeline.filter((item) => {
      // 1. Type filter
      if (typeFilter !== 'all' && item.kind !== typeFilter) {
        return false;
      }

      // 2. Date filter (including custom range)
      if (!matchesDateFilter(item.sortDate, dateFilter, customRange.start, customRange.end)) {
        return false;
      }

      // 3. Search query filter
      if (q) {
        const codeMatch = item.battery_code?.toLowerCase().includes(q);
        const partMatch = item.part_name?.toLowerCase().includes(q);
        const reasonMatch =
          item.reason_label?.toLowerCase().includes(q) ||
          item.reason_code?.toLowerCase().includes(q);
        const notesMatch = (item.note || item.notes)?.toLowerCase().includes(q);
        return Boolean(codeMatch || partMatch || reasonMatch || notesMatch);
      }

      return true;
    });
  }, [rawTimeline, search, dateFilter, typeFilter, customRange]);

  // Date-wise sectioned groups
  const dateGroups = useMemo(() => {
    return groupTimelineByDate(filteredTimeline);
  }, [filteredTimeline]);

  const hasActiveFilters =
    search.trim().length > 0 || dateFilter !== 'all' || typeFilter !== 'all';

  function resetFilters() {
    setSearch('');
    setDateFilter('all');
    setTypeFilter('all');
    setCustomRange({ start: null, end: null });
  }

  function openCustomDateModal() {
    setTempRange({ ...customRange });
    const now = new Date();
    if (customRange.start) {
      const parsed = parseYMD(customRange.start);
      if (parsed) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    } else {
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setCustomModalOpen(true);
  }

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleSelectDay(ymdStr) {
    if (!tempRange.start || (tempRange.start && tempRange.end)) {
      setTempRange({ start: ymdStr, end: null });
    } else {
      if (ymdStr >= tempRange.start) {
        setTempRange({ start: tempRange.start, end: ymdStr });
      } else {
        setTempRange({ start: ymdStr, end: null });
      }
    }
  }

  function applyCustomDateFilter() {
    if (!tempRange.start) {
      setDateFilter('all');
      setCustomRange({ start: null, end: null });
    } else {
      setCustomRange({ ...tempRange });
      setDateFilter('custom');
    }
    setCustomModalOpen(false);
  }

  function setModalQuickPreset(preset) {
    const now = new Date();
    const todayYMD = formatYMD(now);

    if (preset === 'today') {
      setTempRange({ start: todayYMD, end: todayYMD });
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setTempRange({ start: formatYMD(y), end: formatYMD(y) });
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      setTempRange({ start: formatYMD(w), end: todayYMD });
    } else if (preset === 'month') {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      setTempRange({ start: formatYMD(m), end: todayYMD });
    }
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const totalDays = lastDay.getDate();

    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6;

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      days.push(formatYMD(dateObj));
    }
    return days;
  }, [viewYear, viewMonth]);

  const viewMonthName = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString([], {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  if (rawTimeline === null && !error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" size="large" />
        <Text className="mt-3 text-sm font-medium text-slate-500">Loading your repair history…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* ── Search & Filter Controls Header ────────────────────────────── */}
      <View className="border-b border-slate-200/80 bg-white px-4 pt-3 pb-3 shadow-sm">
        {/* Search Input */}
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-2.5">
          <Icon name="search" color="#94a3b8" size={15} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search battery code, part, reason…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            className="flex-1 text-xs text-slate-900"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} className="p-1">
              <Icon name="close" color="#94a3b8" size={13} />
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Horizontal Pills */}
        <View className="mt-2.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-1.5 pr-4"
          >
            {DATE_FILTERS.map((df) => {
              const active = dateFilter === df.id;
              return (
                <TouchableOpacity
                  key={df.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDateFilter(df.id);
                    if (df.id !== 'custom') {
                      setCustomRange({ start: null, end: null });
                    }
                  }}
                  className={`rounded-xl px-3 py-1.5 ${
                    active ? 'bg-blue-600 shadow-sm shadow-blue-600/30' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      active ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {df.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom Date Filter Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={openCustomDateModal}
              className={`flex-row items-center gap-1 rounded-xl px-3 py-1.5 ${
                dateFilter === 'custom'
                  ? 'bg-blue-600 shadow-sm shadow-blue-600/30'
                  : 'bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  dateFilter === 'custom' ? 'text-white' : 'text-slate-700'
                }`}
              >
                {dateFilter === 'custom' && customRange.start
                  ? customRange.end && customRange.end !== customRange.start
                    ? `${formatShortDate(customRange.start)} – ${formatShortDate(customRange.end)}`
                    : formatShortDate(customRange.start)
                  : 'Custom Date…'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Type Filter Pills & Reset */}
        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row gap-1.5">
            {TYPE_FILTERS.map((tf) => {
              const active = typeFilter === tf.id;
              return (
                <TouchableOpacity
                  key={tf.id}
                  activeOpacity={0.7}
                  onPress={() => setTypeFilter(tf.id)}
                  className={`rounded-lg px-2.5 py-1 border ${
                    active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      active ? 'text-blue-700' : 'text-slate-500'
                    }`}
                  >
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} hitSlop={5}>
              <Text className="text-[11px] font-semibold text-rose-600">Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Summary / Active Date Filter Bar ─────────────────────────────── */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-slate-100/70 border-b border-slate-200/60">
        <Text className="text-[11px] font-semibold text-slate-500">
          Showing {filteredTimeline.length} records across {dateGroups.length} date{dateGroups.length === 1 ? '' : 's'}
        </Text>
        {dateFilter !== 'all' && (
          <View className="flex-row items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5">
            <Text className="text-[10px] font-bold text-blue-700 uppercase">
              {dateFilter === 'custom'
                ? customRange.end && customRange.end !== customRange.start
                  ? `${formatShortDate(customRange.start)} – ${formatShortDate(customRange.end)}`
                  : formatShortDate(customRange.start)
                : DATE_FILTERS.find((d) => d.id === dateFilter)?.label}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setDateFilter('all');
                setCustomRange({ start: null, end: null });
              }}
              hitSlop={5}
            >
              <Icon name="close" color="#1e40af" size={10} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error && (
        <View className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {/* ── Date-Wise Grouped Feed ─────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 gap-4 pb-16"
      >
        {dateGroups.length === 0 ? (
          hasActiveFilters ? (
            <View className="items-center rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm mt-4">
              <View className="mb-1.5"><Icon name="search" color="#94a3b8" size={22} /></View>
              <Text className="text-sm font-bold text-slate-800">No matching records found</Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                Try selecting a different date filter or clearing your search.
              </Text>
              <TouchableOpacity
                onPress={resetFilters}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2"
              >
                <Text className="text-xs font-bold text-white">Clear All Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm mt-4">
              <View className="mb-1.5"><Icon name="clock" color="#94a3b8" size={22} /></View>
              <Text className="text-sm font-bold text-slate-800">Nothing logged yet</Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                Completed repairs and reported issues will appear here date-wise.
              </Text>
            </View>
          )
        ) : (
          dateGroups.map((group) => (
            <View key={group.dateKey} className="gap-2">
              {/* Date Header Tag */}
              <View className="flex-row items-center justify-between px-1">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`h-2 w-2 rounded-full ${
                      group.isToday ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                  />
                  <Text
                    className={`text-xs font-extrabold ${
                      group.isToday ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {group.label}
                  </Text>
                </View>
                <View className="rounded-full bg-slate-200/70 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-slate-600">
                    {group.data.length} unit{group.data.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              {/* Items for this date */}
              <View className="gap-2">
                {group.data.map((item) =>
                  item.kind === 'issue' ? (
                    <TouchableOpacity
                      key={`issue-${item.id}`}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('BatteryDetail', { code: item.battery_code })}
                      className="rounded-2xl border border-rose-200/80 bg-white p-3.5 shadow-sm"
                    >
                      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
                        <View className="flex-row items-center gap-2">
                          <View className="h-6 w-6 items-center justify-center rounded-full bg-rose-100">
                            <Icon name="alertTriangle" color="#be123c" size={12} />
                          </View>
                          <Text className="text-sm font-extrabold text-rose-700">{item.battery_code}</Text>
                          <StatusBadge status={item.battery_status || 'unserviceable'} />
                        </View>
                        <Text className="text-[11px] font-medium text-slate-400">
                          {item.reported_at
                            ? new Date(item.reported_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </Text>
                      </View>

                      <View className="rounded-xl bg-rose-50/80 p-2.5 border border-rose-100">
                        <Text className="text-xs font-bold text-rose-800">
                          Issue: {item.reason_label || item.reason_code}
                        </Text>
                        {item.note ? (
                          <Text className="mt-1 text-xs text-rose-600 leading-relaxed">{item.note}</Text>
                        ) : null}
                        {item.photo_urls && item.photo_urls.length > 0 && (
                          <View className="mt-2 pt-2 border-t border-rose-200/60">
                            <View className="flex-row items-center gap-1.5 mb-1.5">
                              <Icon name="photo" color="#be123c" size={12} />
                              <Text className="text-[10px] font-bold text-rose-800">
                                {item.photo_urls.length} Attached Photo{item.photo_urls.length > 1 ? 's' : ''}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                              {item.photo_urls.map((photo, pIdx) => (
                                <View key={pIdx} className="h-12 w-12 rounded-lg border border-rose-200 overflow-hidden bg-white shadow-2xs">
                                  <Image source={{ uri: resolveImageUrl(photo) }} className="h-full w-full" resizeMode="cover" />
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>

                      <View className="mt-2 flex-row items-center justify-between">
                        <Text className="text-[10px] font-semibold text-rose-600 uppercase">
                          Marked Unserviceable
                        </Text>
                        <Text className="text-xs font-bold text-slate-400">Details ›</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={`repair-${item.id}`}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('BatteryDetail', { code: item.battery_code })}
                      className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm"
                    >
                      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
                        <View className="flex-row items-center gap-2">
                          <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                            <Icon name="wrench" color="#047857" size={12} />
                          </View>
                          <Text className="text-sm font-extrabold text-blue-700">{item.battery_code}</Text>
                          <StatusBadge status={item.battery_status || 'repaired'} />
                        </View>
                        <Text className="text-[11px] font-medium text-slate-400">
                          {item.repaired_at
                            ? new Date(item.repaired_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </Text>
                      </View>

                      <View className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                        <Text className="text-xs font-bold text-slate-700" numberOfLines={2}>
                          {item.part_name ? `Part: ${item.part_name}` : 'Completed service & inspection'}
                        </Text>
                        {item.notes ? (
                          <Text className="mt-1 text-xs text-slate-500 leading-relaxed">{item.notes}</Text>
                        ) : null}
                      </View>

                      <View className="mt-2 flex-row items-center justify-between">
                        {typeof item.duration_seconds === 'number' && item.duration_seconds > 0 ? (
                          <View className="rounded-md bg-blue-50 px-2 py-0.5 border border-blue-100">
                            <Text className="text-[10px] font-bold text-blue-700">
                              ⏱️ Duration: {formatDuration(item.duration_seconds)}
                            </Text>
                          </View>
                        ) : (
                          <View />
                        )}
                        <Text className="text-xs font-bold text-slate-400">Details ›</Text>
                      </View>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Custom Date Range Picker Modal ─────────────────────────────── */}
      <Modal
        visible={customModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCustomModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-slate-200 bg-white p-5 pb-8 shadow-2xl">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
              <View>
                <Text className="text-base font-extrabold text-slate-900">Filter By Date</Text>
                <Text className="text-xs text-slate-400">Select single day or date range</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCustomModalOpen(false)}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
              >
                <Icon name="close" color="#475569" size={14} />
              </TouchableOpacity>
            </View>

            {/* Quick Presets row */}
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setModalQuickPreset('today')}
                className="flex-1 items-center rounded-xl bg-slate-100 py-2"
              >
                <Text className="text-xs font-semibold text-slate-700">Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalQuickPreset('yesterday')}
                className="flex-1 items-center rounded-xl bg-slate-100 py-2"
              >
                <Text className="text-xs font-semibold text-slate-700">Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalQuickPreset('week')}
                className="flex-1 items-center rounded-xl bg-slate-100 py-2"
              >
                <Text className="text-xs font-semibold text-slate-700">Last 7d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setModalQuickPreset('month')}
                className="flex-1 items-center rounded-xl bg-slate-100 py-2"
              >
                <Text className="text-xs font-semibold text-slate-700">Last 30d</Text>
              </TouchableOpacity>
            </View>

            {/* Month Switcher */}
            <View className="mt-4 flex-row items-center justify-between px-2">
              <TouchableOpacity
                onPress={handlePrevMonth}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100"
              >
                <Text className="text-base font-bold text-slate-700">‹</Text>
              </TouchableOpacity>
              <Text className="text-sm font-extrabold text-slate-900">{viewMonthName}</Text>
              <TouchableOpacity
                onPress={handleNextMonth}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100"
              >
                <Text className="text-base font-bold text-slate-700">›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday initial headers */}
            <View className="mt-3 flex-row justify-between px-1">
              {DAY_NAMES.map((d, i) => (
                <View key={`day-name-${i}`} className="w-10 items-center">
                  <Text className="text-xs font-bold text-slate-400">{d}</Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View className="mt-1 flex-row flex-wrap justify-between px-1">
              {calendarDays.map((ymdStr, i) => {
                if (!ymdStr) {
                  return <View key={`empty-${i}`} className="h-10 w-10" />;
                }
                const dayNum = Number(ymdStr.split('-')[2]);
                const isStart = tempRange.start === ymdStr;
                const isEnd = tempRange.end === ymdStr;
                const inRange =
                  tempRange.start &&
                  tempRange.end &&
                  ymdStr > tempRange.start &&
                  ymdStr < tempRange.end;
                const isSelected = isStart || isEnd;

                return (
                  <TouchableOpacity
                    key={ymdStr}
                    activeOpacity={0.7}
                    onPress={() => handleSelectDay(ymdStr)}
                    className={`my-0.5 h-10 w-10 items-center justify-center rounded-xl ${
                      isSelected
                        ? 'bg-blue-600 shadow-sm'
                        : inRange
                        ? 'bg-blue-100'
                        : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected
                          ? 'text-white'
                          : inRange
                          ? 'text-blue-800'
                          : 'text-slate-800'
                      }`}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Active Selection Indicator */}
            <View className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100 flex-row items-center justify-between">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Chosen Filter Date
                </Text>
                <Text className="text-xs font-extrabold text-blue-700 mt-0.5">
                  {tempRange.start
                    ? tempRange.end && tempRange.end !== tempRange.start
                      ? `${formatShortDate(tempRange.start)} – ${formatShortDate(tempRange.end)}`
                      : `Single Day: ${formatShortDate(tempRange.start)}`
                    : 'Tap a date above'}
                </Text>
              </View>
              {tempRange.start && (
                <TouchableOpacity
                  onPress={() => setTempRange({ start: null, end: null })}
                  hitSlop={5}
                >
                  <Text className="text-xs font-bold text-rose-600">Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action Buttons */}
            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setTempRange({ start: null, end: null });
                  setDateFilter('all');
                  setCustomRange({ start: null, end: null });
                  setCustomModalOpen(false);
                }}
                className="flex-1 items-center rounded-2xl bg-slate-100 py-3.5"
              >
                <Text className="text-xs font-bold text-slate-600">Show All Dates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyCustomDateFilter}
                className="flex-1 items-center rounded-2xl bg-blue-600 py-3.5 shadow-sm shadow-blue-600/30"
              >
                <Text className="text-xs font-bold text-white">Apply Date Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
