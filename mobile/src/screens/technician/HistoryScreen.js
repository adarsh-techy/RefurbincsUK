import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
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
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: '7 Days' },
  { id: 'month', label: '30 Days' },
];

const SUPERVISOR_TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'passed', label: 'Passed QA' },
  { id: 'passed_back', label: 'Passed Back' },
  { id: 'issue', label: 'Unserviceable' },
];

const TECHNICIAN_TYPE_FILTERS = [
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

function buildTimeline(repairs, issues, tests, isSupervisor) {
  if (isSupervisor) {
    // ONLY tester history: tests and test unserviceable issues. Strictly NO tech repairs!
    const testEntries = (tests || []).map((t) => ({
      ...t,
      kind: 'test',
      sortDate: t.tested_at,
    }));
    const issueEntries = (issues || []).map((i) => ({
      ...i,
      kind: 'issue',
      sortDate: i.reported_at,
    }));
    return [...testEntries, ...issueEntries].sort(
      (a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0)
    );
  }

  // ONLY tech history: repairs and reported issues. Strictly NO supervisor tests!
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
  const [staffInfo, setStaffInfo] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
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

  const currentUser = useSelector((state) => state.auth?.user);
  const isSupervisor = useMemo(() => {
    return (
      (staffInfo?.role || currentUser?.staff_role || currentUser?.staffRole || currentUser?.role || '')
        .toLowerCase() === 'supervisor'
    );
  }, [staffInfo?.role, currentUser?.staff_role, currentUser?.staffRole, currentUser?.role]);

  const typeFilters = isSupervisor ? SUPERVISOR_TYPE_FILTERS : TECHNICIAN_TYPE_FILTERS;

  const load = useCallback(() => {
    setError(null);
    return apiClient
      .get('/staff/me')
      .then(({ data }) => {
        setStaffInfo(data.staff);
        const supervisor = (data.staff?.role || '').toLowerCase() === 'supervisor';
        setRawTimeline(
          buildTimeline(data.repairs || [], data.issues || [], data.tests || [], supervisor)
        );
        if (supervisor) {
          const tests = data.tests || [];
          const issues = data.issues || [];
          const passed = tests.filter((t) => !t.passed_back);
          const passedBack = tests.filter((t) => t.passed_back);
          setSummaryStats({
            total: tests.length + issues.length,
            passed: passed.length,
            passedBack: passedBack.length,
            issues: issues.length,
          });
        } else {
          const repairs = data.repairs || [];
          const issues = data.issues || [];
          const completed = repairs.filter(
            (r) => !r.parts_removed && (r.repaired_at || r.id)
          );
          setSummaryStats({
            total: repairs.length + issues.length,
            completed: completed.length,
            issues: issues.length,
          });
        }
      })
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
      if (typeFilter !== 'all') {
        if (isSupervisor) {
          if (typeFilter === 'passed' && (item.kind !== 'test' || item.passed_back)) return false;
          if (typeFilter === 'passed_back' && (item.kind !== 'test' || !item.passed_back))
            return false;
          if (typeFilter === 'issue' && item.kind !== 'issue') return false;
        } else {
          if (typeFilter === 'repair' && item.kind !== 'repair') return false;
          if (typeFilter === 'issue' && item.kind !== 'issue') return false;
        }
      }

      // 2. Date filter (including custom range)
      if (!matchesDateFilter(item.sortDate, dateFilter, customRange.start, customRange.end)) {
        return false;
      }

      // 3. Search query filter
      if (q) {
        const codeMatch = item.battery_code?.toLowerCase().includes(q);
        const partMatch = (item.part_name || item.service_name)?.toLowerCase().includes(q);
        const reasonMatch =
          item.reason_label?.toLowerCase().includes(q) ||
          item.reason_code?.toLowerCase().includes(q);
        const notesMatch = (item.note || item.notes)?.toLowerCase().includes(q);
        return Boolean(codeMatch || partMatch || reasonMatch || notesMatch);
      }

      return true;
    });
  }, [rawTimeline, search, dateFilter, typeFilter, customRange, isSupervisor]);

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

  return (
    <View className="flex-1 bg-slate-50">
      {/* ── Top Header & Stats Summary Banner ────────────────────────── */}
      <View className="bg-white px-4 pt-3 pb-3 border-b border-slate-200/80 shadow-2xs">
        {/* Role Title & Staff Badge */}
        <View className="flex-row items-center justify-between mb-2.5">
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-black text-slate-900 tracking-tight">
                {isSupervisor ? 'Testing History' : 'Repair History'}
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${
                  isSupervisor ? 'bg-violet-100' : 'bg-blue-100'
                }`}
              >
                <Text
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isSupervisor ? 'text-violet-700' : 'text-blue-700'
                  }`}
                >
                  {isSupervisor ? 'Supervisor' : 'Technician'}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-slate-400">
              {isSupervisor
                ? 'QA testing sign-offs and rework passes'
                : 'Completed repairs and replaced parts'}
            </Text>
          </View>

          {staffInfo?.name && (
            <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
              <View className="h-2 w-2 rounded-full bg-emerald-500" />
              <Text className="text-[11px] font-bold text-slate-700">{staffInfo.name}</Text>
            </View>
          )}
        </View>

        {/* 3-Column Metrics Strip */}
        {summaryStats && (
          <View className="flex-row gap-2 mt-1 mb-2.5">
            {isSupervisor ? (
              <>
                <View className="flex-1 rounded-xl bg-violet-50/80 p-2.5 border border-violet-100">
                  <Text className="text-[10px] font-bold text-violet-700">Total Tested</Text>
                  <Text className="text-base font-black text-violet-950 mt-0.5">
                    {summaryStats.total}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-emerald-50/80 p-2.5 border border-emerald-100">
                  <Text className="text-[10px] font-bold text-emerald-700">Passed QA</Text>
                  <Text className="text-base font-black text-emerald-950 mt-0.5">
                    {summaryStats.passed}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-amber-50/80 p-2.5 border border-amber-100">
                  <Text className="text-[10px] font-bold text-amber-700">Passed Back</Text>
                  <Text className="text-base font-black text-amber-950 mt-0.5">
                    {summaryStats.passedBack}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className="flex-1 rounded-xl bg-blue-50/80 p-2.5 border border-blue-100">
                  <Text className="text-[10px] font-bold text-blue-700">Total Repairs</Text>
                  <Text className="text-base font-black text-blue-950 mt-0.5">
                    {summaryStats.total}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-emerald-50/80 p-2.5 border border-emerald-100">
                  <Text className="text-[10px] font-bold text-emerald-700">Completed</Text>
                  <Text className="text-base font-black text-emerald-950 mt-0.5">
                    {summaryStats.completed}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-rose-50/80 p-2.5 border border-rose-100">
                  <Text className="text-[10px] font-bold text-rose-700">Issues</Text>
                  <Text className="text-base font-black text-rose-950 mt-0.5">
                    {summaryStats.issues}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Search Bar */}
        <View className="flex-row items-center rounded-xl bg-slate-100 px-2.5 py-1.5 border border-slate-200/60">
          <Icon name="search" color="#94a3b8" size={13} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              isSupervisor
                ? 'Search battery code, tested services…'
                : 'Search battery code, parts fitted…'
            }
            placeholderTextColor="#94a3b8"
            className="flex-1 ml-2 text-xs text-slate-800 p-0"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={5}>
              <Icon name="close" color="#64748b" size={12} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Type Filter Segmented Control & Reset */}
        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {typeFilters.map((tf) => {
              const active = typeFilter === tf.id;
              return (
                <TouchableOpacity
                  key={tf.id}
                  activeOpacity={0.7}
                  onPress={() => setTypeFilter(tf.id)}
                  className={`rounded-md px-2 py-1 ${
                    active
                      ? isSupervisor
                        ? 'bg-white shadow-2xs'
                        : 'bg-white shadow-2xs'
                      : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      active
                        ? isSupervisor
                          ? 'text-violet-700'
                          : 'text-blue-700'
                        : 'text-slate-600'
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
              <Text className="text-[10px] font-bold text-rose-600">Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Pills */}
        <View className="mt-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="flex-row gap-1"
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
                  className={`rounded-md px-2 py-0.5 ${
                    active
                      ? isSupervisor
                        ? 'bg-violet-600'
                        : 'bg-blue-600'
                      : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
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
              className={`flex-row items-center gap-1 rounded-md px-2 py-0.5 ${
                dateFilter === 'custom'
                  ? isSupervisor
                    ? 'bg-violet-600'
                    : 'bg-blue-600'
                  : 'bg-slate-100 border border-slate-200/60'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  dateFilter === 'custom' ? 'text-white' : 'text-slate-700'
                }`}
              >
                {dateFilter === 'custom' && customRange.start
                  ? customRange.end && customRange.end !== customRange.start
                    ? `${formatShortDate(customRange.start)}–${formatShortDate(customRange.end)}`
                    : formatShortDate(customRange.start)
                  : '📅 Custom'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* ── Summary Count Bar ────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-slate-100/80 border-b border-slate-200/60">
        <Text className="text-[11px] font-bold text-slate-500">
          {filteredTimeline.length} unit{filteredTimeline.length === 1 ? '' : 's'} across{' '}
          {dateGroups.length} date{dateGroups.length === 1 ? '' : 's'}
        </Text>
        {dateFilter !== 'all' && (
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-0.5">
            <Text className="text-[10px] font-bold text-slate-700 uppercase">
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
              <Icon name="close" color="#475569" size={10} />
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
        contentContainerClassName="p-4 gap-6 pb-16"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={isSupervisor ? '#7c3aed' : '#2563eb'}
          />
        }
      >
        {rawTimeline === null ? (
          <View className="items-center justify-center p-12">
            <ActivityIndicator size="small" color={isSupervisor ? '#7c3aed' : '#2563eb'} />
            <Text className="text-xs font-semibold text-slate-400 mt-2">Loading history…</Text>
          </View>
        ) : dateGroups.length === 0 ? (
          hasActiveFilters ? (
            <View className="items-center rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xs mt-4">
              <View className="mb-1.5">
                <Icon name="search" color="#94a3b8" size={22} />
              </View>
              <Text className="text-sm font-bold text-slate-800">No matching records found</Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                Try selecting a different filter or clearing your search.
              </Text>
              <TouchableOpacity
                onPress={resetFilters}
                className={`mt-4 rounded-xl px-4 py-2 ${
                  isSupervisor ? 'bg-violet-600' : 'bg-blue-600'
                }`}
              >
                <Text className="text-xs font-bold text-white">Clear All Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center rounded-3xl border border-slate-200/80 bg-white p-8 shadow-2xs mt-4">
              <View className="mb-1.5">
                <Icon name="clock" color="#94a3b8" size={22} />
              </View>
              <Text className="text-sm font-bold text-slate-800">Nothing logged yet</Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                {isSupervisor
                  ? 'Completed testing sign-offs and passes will appear here date-wise.'
                  : 'Completed repairs and reported workshop issues will appear here date-wise.'}
              </Text>
            </View>
          )
        ) : (
          dateGroups.map((group) => (
            <View key={group.dateKey} className="gap-3 mb-2">
              {/* Date Header Tag */}
              <View className="flex-row items-center justify-between px-1">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`h-2.5 w-2.5 rounded-full ${
                      group.isToday
                        ? 'bg-emerald-500'
                        : isSupervisor
                          ? 'bg-violet-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <Text
                    className={`text-xs font-extrabold ${
                      group.isToday
                        ? 'text-emerald-700'
                        : 'text-slate-800'
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
              <View className="gap-3.5">
                {group.data.map((item) => {
                  if (item.kind === 'test') {
                    // SUPERVISOR TEST CARD
                    const isPassedBack = item.passed_back;
                    return (
                      <TouchableOpacity
                        key={`test-${item.id}`}
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('BatteryDetail', { code: item.battery_code, fromHistory: true, fromScan: false })
                        }
                        className={`rounded-2xl border bg-white p-4 shadow-2xs overflow-hidden ${
                          isPassedBack ? 'border-amber-200' : 'border-emerald-200'
                        }`}
                      >
                        {/* Top row */}
                        <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
                          <View className="flex-row items-center gap-2">
                            <View
                              className={`h-6 w-6 items-center justify-center rounded-full ${
                                isPassedBack ? 'bg-amber-100' : 'bg-emerald-100'
                              }`}
                            >
                              <Text
                                className={`text-xs font-black ${
                                  isPassedBack ? 'text-amber-700' : 'text-emerald-700'
                                }`}
                              >
                                {isPassedBack ? '↩' : '✓'}
                              </Text>
                            </View>
                            <Text className="font-mono text-sm font-extrabold text-slate-900">
                              {item.battery_code}
                            </Text>
                            {isPassedBack ? (
                              <View className="rounded-full bg-amber-100 px-2 py-0.5">
                                <Text className="text-[10px] font-black uppercase text-amber-800">
                                  Sent Back to Tech
                                </Text>
                              </View>
                            ) : (
                              <StatusBadge status="repaired" />
                            )}
                          </View>

                          <Text className="text-[11px] font-medium text-slate-400">
                            {item.tested_at
                              ? new Date(item.tested_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </Text>
                        </View>

                        {/* Footer row */}
                        <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
                          {typeof item.testing_duration_seconds === 'number' &&
                          item.testing_duration_seconds > 0 ? (
                            <View className="rounded-md bg-violet-50 px-2 py-0.5 border border-violet-100">
                              <Text className="text-[10px] font-bold text-violet-700">
                                ⏱️ Test: {formatDuration(item.testing_duration_seconds)}
                              </Text>
                            </View>
                          ) : (
                            <Text className="text-[10px] font-bold uppercase text-slate-400">
                              {isPassedBack ? 'Rework Pass-Back' : 'QA Sign-off'}
                            </Text>
                          )}
                          <Text className="text-xs font-bold text-violet-600">View Battery Details ›</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  if (item.kind === 'repair') {
                    // TECHNICIAN REPAIR CARD
                    return (
                      <TouchableOpacity
                        key={`repair-${item.id}`}
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('BatteryDetail', { code: item.battery_code, fromHistory: true, fromScan: false })
                        }
                        className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs"
                      >
                        <View className="flex-row flex-wrap items-center justify-between gap-2">
                          <View className="flex-row items-center gap-2">
                            <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                              <Icon name="wrench" color="#1d4ed8" size={12} />
                            </View>
                            <Text className="font-mono text-sm font-extrabold text-blue-700">
                              {item.battery_code}
                            </Text>
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

                        <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
                          {typeof item.duration_seconds === 'number' &&
                          item.duration_seconds > 0 ? (
                            <View className="rounded-md bg-blue-50 px-2 py-0.5 border border-blue-100">
                              <Text className="text-[10px] font-bold text-blue-700">
                                ⏱️ Duration: {formatDuration(item.duration_seconds)}
                              </Text>
                            </View>
                          ) : (
                            <Text className="text-[10px] font-bold uppercase text-slate-400">
                              Completed Repair
                            </Text>
                          )}
                          <Text className="text-xs font-bold text-blue-600">View Battery Details ›</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  // ISSUE CARD (UNSERVICEABLE)
                  return (
                    <TouchableOpacity
                      key={`issue-${item.id}`}
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate('BatteryDetail', { code: item.battery_code, fromHistory: true, fromScan: false })
                      }
                      className="rounded-2xl border border-rose-200/90 bg-white p-4 shadow-2xs"
                    >
                      <View className="flex-row flex-wrap items-center justify-between gap-2">
                        <View className="flex-row items-center gap-2">
                          <View className="h-6 w-6 items-center justify-center rounded-full bg-rose-100">
                            <Icon name="alertTriangle" color="#be123c" size={12} />
                          </View>
                          <Text className="font-mono text-sm font-extrabold text-rose-700">
                            {item.battery_code}
                          </Text>
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

                      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
                        <View className="rounded-md bg-rose-50 px-2 py-0.5 border border-rose-100">
                          <Text className="text-[10px] font-bold text-rose-700">
                            Marked Unserviceable
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-rose-600">View Battery Details ›</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
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

            {/* Calendar Days Grid */}
            <View className="mt-3">
              <View className="flex-row justify-between mb-1.5 px-1">
                {DAY_NAMES.map((d, i) => (
                  <View key={`dn-${i}`} className="w-10 items-center">
                    <Text className="text-xs font-bold text-slate-400">{d}</Text>
                  </View>
                ))}
              </View>

              <View className="flex-row flex-wrap">
                {calendarDays.map((ymd, i) => {
                  if (!ymd) {
                    return <View key={`empty-${i}`} className="w-[14.28%] h-10" />;
                  }
                  const dayNum = Number(ymd.split('-')[2]);
                  const isSelected = tempRange.start === ymd || tempRange.end === ymd;
                  const inRange =
                    tempRange.start &&
                    tempRange.end &&
                    ymd > tempRange.start &&
                    ymd < tempRange.end;

                  return (
                    <View
                      key={ymd}
                      className="w-[14.28%] h-10 items-center justify-center p-0.5"
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleSelectDay(ymd)}
                        className={`h-9 w-9 items-center justify-center rounded-xl ${
                          isSelected
                            ? isSupervisor
                              ? 'bg-violet-600 shadow-sm'
                              : 'bg-blue-600 shadow-sm'
                            : inRange
                              ? isSupervisor
                                ? 'bg-violet-100'
                                : 'bg-blue-100'
                              : 'bg-transparent'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isSelected
                              ? 'text-white'
                              : inRange
                                ? isSupervisor
                                  ? 'text-violet-900'
                                  : 'text-blue-900'
                                : 'text-slate-800'
                          }`}
                        >
                          {dayNum}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Selection display */}
            <View className="mt-4 flex-row items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
              <View>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Chosen Filter Date
                </Text>
                <Text
                  className={`mt-0.5 text-xs font-extrabold ${
                    isSupervisor ? 'text-violet-700' : 'text-blue-700'
                  }`}
                >
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

            {/* Action buttons */}
            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setTempRange({ start: null, end: null });
                  setDateFilter('all');
                  setCustomRange({ start: null, end: null });
                  setCustomModalOpen(false);
                }}
                className="flex-1 items-center justify-center rounded-2xl bg-slate-100 py-3.5"
              >
                <Text className="text-xs font-bold text-slate-600">Show All Dates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={applyCustomDateFilter}
                className={`flex-1 items-center justify-center rounded-2xl py-3.5 ${
                  isSupervisor
                    ? 'bg-violet-600 shadow-md shadow-violet-600/30'
                    : 'bg-blue-600 shadow-md shadow-blue-600/30'
                }`}
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
