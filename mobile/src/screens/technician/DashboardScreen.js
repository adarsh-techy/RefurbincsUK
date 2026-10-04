import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import formatDuration from '../../utils/format-duration';

const DAYS_SHOWN = 14;

const FAILED_STATUSES = [
  'unserviceable',
  'tested_parts_removed',
  'unserviceable_parts_removed',
  'recycled',
];

// Fixed-window bucketing for the last 14 days
function buildDailyCounts(jobs) {
  const countsByDay = {};
  for (const j of jobs) {
    if (j.doneAt) {
      const day = new Date(j.doneAt).toDateString();
      countsByDay[day] = (countsByDay[day] || 0) + 1;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    series.push({
      label: day.toLocaleDateString([], { day: 'numeric', month: 'short' }),
      dayName: day.toLocaleDateString([], { weekday: 'narrow' }),
      isToday: i === 0,
      count: countsByDay[day.toDateString()] || 0,
    });
  }
  return series;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name) {
  return (name || 'ST')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeAgo(dateString) {
  if (!dateString) return 'recently';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'recently';
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isPartsRemoved(r) {
  if (!r) return false;
  return Boolean(
    r.parts_removed ||
    r.removed_at ||
    r.removed_by_me ||
    r.battery_status === 'tested_parts_removed' ||
    r.battery_status === 'unserviceable_parts_removed'
  );
}

function getRepairBadgeStatus(r) {
  if (!r) return 'repaired';
  if (isPartsRemoved(r)) return 'tested_parts_removed';
  if (r.outcome === 'completed') return r.battery_status === 'returned' ? 'returned' : 'repaired';
  if (r.outcome === 'failed') {
    return FAILED_STATUSES.includes(r.battery_status) ? r.battery_status : 'tested_parts_removed';
  }
  return r.battery_status || 'repaired';
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const loadData = useCallback(() => {
    return apiClient
      .get('/staff/me')
      .then(({ data: resData }) => {
        setData(resData);
        setError(null);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const { staff = {}, repairs = [], issues = [], tests = [] } = data || {};

  const isSupervisor = useMemo(() => {
    return (staff?.role || '').toLowerCase() === 'supervisor';
  }, [staff?.role]);

  // Completed jobs:
  // - Supervisor: all tests
  // - Technician: all repairs completed (including awaiting QA verification)
  const completedJobs = useMemo(() => {
    if (isSupervisor) {
      return tests
        .map((t) => ({
          ...t,
          kind: 'test',
          doneAt: t.tested_at,
          duration: t.testing_duration_seconds,
        }))
        .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
    }
    return repairs
      .filter((r) => {
        if (!r) return false;
        if (r.outcome === 'failed' || r.parts_removed) return false;
        if (FAILED_STATUSES.includes(r.battery_status)) return false;
        return Boolean(r.repaired_at || r.id);
      })
      .map((r) => ({
        ...r,
        kind: 'repair',
        doneAt: r.repaired_at,
        duration: r.duration_seconds,
      }))
      .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
  }, [isSupervisor, tests, repairs]);

  // Pillar 2: Passed to Testing / In Testing
  const inTestingRepairs = useMemo(
    () =>
      repairs.filter(
        (r) =>
          !r.parts_removed &&
          r.outcome !== 'failed' &&
          (r.battery_status === 'in_testing' ||
            r.battery_status === 'in_progress' ||
            r.outcome === 'active')
      ),
    [repairs]
  );

  // Pillar 3: Marked Unserviceable
  const unserviceableIssues = issues || [];

  // Pillar 4: Parts Removed
  const partsRemovedRepairs = useMemo(
    () => repairs.filter(isPartsRemoved),
    [repairs]
  );

  // Verified QA complete
  const verifiedRepairs = useMemo(
    () =>
      repairs.filter(
        (r) =>
          !r.parts_removed &&
          r.outcome !== 'failed' &&
          (r.battery_status === 'repaired' ||
            r.battery_status === 'returned' ||
            r.outcome === 'completed')
      ),
    [repairs]
  );

  // Supervisor metrics
  const passedTests = useMemo(() => tests.filter((t) => !t.passed_back), [tests]);
  const passedBackTests = useMemo(() => tests.filter((t) => t.passed_back), [tests]);

  const dailyCounts = useMemo(() => buildDailyCounts(completedJobs), [completedJobs]);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  const avgDuration = useMemo(() => {
    if (isSupervisor) {
      const timed = tests.filter(
        (t) => typeof t.testing_duration_seconds === 'number' && t.testing_duration_seconds > 0
      );
      return timed.length
        ? Math.round(timed.reduce((s, t) => s + t.testing_duration_seconds, 0) / timed.length)
        : null;
    }
    const timed = completedJobs.filter((r) => typeof r.duration === 'number' && r.duration > 0);
    return timed.length
      ? Math.round(timed.reduce((s, r) => s + r.duration, 0) / timed.length)
      : null;
  }, [isSupervisor, tests, completedJobs]);

  const approvalRate = useMemo(() => {
    if (isSupervisor) {
      if (!tests.length) return 100;
      return Math.round((passedTests.length / tests.length) * 100);
    }
    const totalAttempted = repairs.length + unserviceableIssues.length;
    if (!totalAttempted) return 100;
    return Math.round((completedJobs.length / totalAttempted) * 100);
  }, [isSupervisor, tests, passedTests, repairs.length, unserviceableIssues.length, completedJobs.length]);

  // Combined workshop feed
  const filteredFeed = useMemo(() => {
    if (isSupervisor) {
      if (activeTab === 'passed') return tests.filter((t) => !t.passed_back);
      if (activeTab === 'passed_back') return tests.filter((t) => t.passed_back);
      if (activeTab === 'unserviceable') return unserviceableIssues;
      return tests;
    }

    if (activeTab === 'testing') {
      return inTestingRepairs.map((r) => ({ ...r, entryType: 'testing', date: r.repaired_at }));
    }
    if (activeTab === 'unserviceable') {
      return unserviceableIssues.map((i) => ({ ...i, entryType: 'issue', date: i.reported_at }));
    }
    if (activeTab === 'removed') {
      return partsRemovedRepairs.map((r) => ({ ...r, entryType: 'removed', date: r.removed_at || r.repaired_at }));
    }
    if (activeTab === 'completed') {
      return verifiedRepairs.map((r) => ({ ...r, entryType: 'completed', date: r.repaired_at }));
    }

    // 'all': blend repairs and issues
    const repairItems = repairs.map((r) => ({
      ...r,
      entryType: isPartsRemoved(r) ? 'removed' : (r.battery_status === 'in_testing' || r.outcome === 'active') ? 'testing' : 'completed',
      date: r.removed_at || r.repaired_at,
    }));
    const issueItems = unserviceableIssues.map((i) => ({
      ...i,
      entryType: 'issue',
      date: i.reported_at,
    }));

    return [...repairItems, ...issueItems].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );
  }, [
    isSupervisor,
    activeTab,
    tests,
    unserviceableIssues,
    inTestingRepairs,
    partsRemovedRepairs,
    verifiedRepairs,
    repairs,
  ]);

  const todayDateFormatted = new Date().toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const staffDisplayName = staff.name || (isSupervisor ? 'Supervisor' : 'Technician');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color={isSupervisor ? '#7c3aed' : '#2563eb'} />
        <Text className="mt-2.5 text-xs font-semibold text-slate-500">
          Loading {isSupervisor ? 'supervisor' : 'technician'} dashboard…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-28 gap-4"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={isSupervisor ? '#7c3aed' : '#2563eb'}
          colors={[isSupervisor ? '#7c3aed' : '#2563eb']}
        />
      }
    >
      {/* ── Executive Hero Card ─────────────────────────────────────────── */}
      <View className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2.5 w-2.5 rounded-full ${
                isSupervisor ? 'bg-violet-500' : 'bg-emerald-500'
              }`}
            />
            <Text
              className={`text-[11px] font-black uppercase tracking-wider ${
                isSupervisor ? 'text-violet-700' : 'text-emerald-700'
              }`}
            >
              {isSupervisor ? 'QA Session Active · Verification' : 'Workshop Shift Active · Live'}
            </Text>
          </View>
          <View className="rounded-full bg-slate-100 px-3 py-1">
            <Text className="text-[11px] font-bold text-slate-600">{todayDateFormatted}</Text>
          </View>
        </View>

        <View className="mt-3.5 flex-row items-center gap-3.5">
          <View
            className={`h-12 w-12 items-center justify-center rounded-2xl shadow-xs ${
              isSupervisor ? 'bg-violet-600' : 'bg-blue-600'
            }`}
          >
            <Text className="text-base font-black text-white">{initials(staffDisplayName)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black text-slate-900 tracking-tight" numberOfLines={1}>
              {greeting()}, {staffDisplayName}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <View
                className={`rounded-lg px-2 py-0.5 border ${
                  isSupervisor
                    ? 'bg-violet-50 border-violet-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <Text
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isSupervisor ? 'text-violet-700' : 'text-blue-700'
                  }`}
                >
                  {isSupervisor ? 'SUPERVISOR · QA TESTING' : 'TECHNICIAN · WORKSHOP REPAIRS'}
                </Text>
              </View>
              <Text className="text-xs text-slate-400">Refurbnics Workshop</Text>
            </View>
          </View>
        </View>
      </View>

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {/* ── Core 4 KPI Status Breakdown ──────────────────────────────────── */}
      <View>
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            {isSupervisor ? 'QA Verification Overview' : 'Workshop Repairs & Status Overview'}
          </Text>
          <Text className="text-[11px] font-bold text-slate-400">Live Breakdown</Text>
        </View>

        <View className="gap-2.5">
          {/* Top Row: Repairs Today & Passed to Test */}
          <View className="flex-row gap-2.5">
            {/* Pillar 1: Repairs Today / Today Tested */}
            <View
              className={`flex-1 rounded-2xl border p-3.5 ${
                isSupervisor
                  ? 'border-violet-200 bg-violet-50/60'
                  : 'border-emerald-200 bg-emerald-50/60'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isSupervisor ? 'text-violet-800' : 'text-emerald-800'
                  }`}
                >
                  {isSupervisor ? 'Today Tested' : 'Repairs Today'}
                </Text>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isSupervisor ? 'bg-violet-100' : 'bg-emerald-100'
                  }`}
                >
                  <Icon
                    name="zap"
                    color={isSupervisor ? '#7c3aed' : '#059669'}
                    size={14}
                  />
                </View>
              </View>
              <Text
                className={`mt-1 text-2xl sm:text-3xl font-black ${
                  isSupervisor ? 'text-violet-700' : 'text-emerald-700'
                }`}
              >
                {todayCount}
              </Text>
              <Text
                className={`mt-0.5 text-[10px] font-bold ${
                  isSupervisor ? 'text-violet-600' : 'text-emerald-600'
                }`}
              >
                {isSupervisor ? 'Tests signed off' : 'Completed today'}
              </Text>
            </View>

            {/* Pillar 2: Passed to Test / Queue */}
            <View
              className={`flex-1 rounded-2xl border p-3.5 ${
                isSupervisor
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-blue-200 bg-blue-50/60'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isSupervisor ? 'text-emerald-800' : 'text-blue-800'
                  }`}
                >
                  {isSupervisor ? 'Passed QA' : 'Passed to Test'}
                </Text>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isSupervisor ? 'bg-emerald-100' : 'bg-blue-100'
                  }`}
                >
                  <Icon
                    name={isSupervisor ? 'checkCircle' : 'flask'}
                    color={isSupervisor ? '#059669' : '#2563eb'}
                    size={14}
                  />
                </View>
              </View>
              <Text
                className={`mt-1 text-2xl sm:text-3xl font-black ${
                  isSupervisor ? 'text-emerald-700' : 'text-blue-700'
                }`}
              >
                {isSupervisor ? passedTests.length : inTestingRepairs.length}
              </Text>
              <Text
                className={`mt-0.5 text-[10px] font-bold ${
                  isSupervisor ? 'text-emerald-600' : 'text-blue-600'
                }`}
              >
                {isSupervisor ? 'Passed inspection' : 'In testing queue'}
              </Text>
            </View>
          </View>

          {/* Bottom Row: Unservice Marked & Parts Removed */}
          <View className="flex-row gap-2.5">
            {/* Pillar 3: Unservice Marked / Passed Back */}
            <View
              className={`flex-1 rounded-2xl border p-3.5 ${
                isSupervisor
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-rose-200 bg-rose-50/60'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isSupervisor ? 'text-amber-800' : 'text-rose-800'
                  }`}
                >
                  {isSupervisor ? 'Passed Back' : 'Unservice Marked'}
                </Text>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isSupervisor ? 'bg-amber-100' : 'bg-rose-100'
                  }`}
                >
                  <Icon
                    name={isSupervisor ? 'rotateCcw' : 'alertTriangle'}
                    color={isSupervisor ? '#d97706' : '#e11d48'}
                    size={14}
                  />
                </View>
              </View>
              <Text
                className={`mt-1 text-2xl sm:text-3xl font-black ${
                  isSupervisor ? 'text-amber-700' : 'text-rose-700'
                }`}
              >
                {isSupervisor ? passedBackTests.length : unserviceableIssues.length}
              </Text>
              <Text
                className={`mt-0.5 text-[10px] font-bold ${
                  isSupervisor ? 'text-amber-600' : 'text-rose-600'
                }`}
              >
                {isSupervisor ? 'Returned for rework' : 'Issues logged'}
              </Text>
            </View>

            {/* Pillar 4: Parts Removed / Unserviceable */}
            <View
              className={`flex-1 rounded-2xl border p-3.5 ${
                isSupervisor
                  ? 'border-rose-200 bg-rose-50/60'
                  : 'border-amber-200 bg-amber-50/60'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    isSupervisor ? 'text-rose-800' : 'text-amber-800'
                  }`}
                >
                  {isSupervisor ? 'Unserviceable' : 'Parts Removed'}
                </Text>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isSupervisor ? 'bg-rose-100' : 'bg-amber-100'
                  }`}
                >
                  <Icon
                    name={isSupervisor ? 'alertTriangle' : 'rotateCcw'}
                    color={isSupervisor ? '#e11d48' : '#d97706'}
                    size={14}
                  />
                </View>
              </View>
              <Text
                className={`mt-1 text-2xl sm:text-3xl font-black ${
                  isSupervisor ? 'text-rose-700' : 'text-amber-700'
                }`}
              >
                {isSupervisor ? unserviceableIssues.length : partsRemovedRepairs.length}
              </Text>
              <Text
                className={`mt-0.5 text-[10px] font-bold ${
                  isSupervisor ? 'text-rose-600' : 'text-amber-600'
                }`}
              >
                {isSupervisor ? 'Marked failed' : 'Restocked to stock'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Secondary Performance Snapshot Bar ────────────────────────── */}
      <View className="flex-row items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
        <View className="items-center flex-1">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">This Week</Text>
          <Text className="text-sm font-black text-slate-800 mt-0.5">{weekCount} units</Text>
        </View>
        <View className="h-5 w-px bg-slate-200" />
        <View className="items-center flex-1">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lifetime</Text>
          <Text className="text-sm font-black text-slate-800 mt-0.5">{completedJobs.length} done</Text>
        </View>
        <View className="h-5 w-px bg-slate-200" />
        <View className="items-center flex-1">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Avg Speed</Text>
          <Text className="text-sm font-black text-slate-800 mt-0.5">
            {avgDuration != null ? formatDuration(avgDuration) : '—'}
          </Text>
        </View>
        <View className="h-5 w-px bg-slate-200" />
        <View className="items-center flex-1">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pass Rate</Text>
          <Text className="text-sm font-black text-emerald-600 mt-0.5">{approvalRate}%</Text>
        </View>
      </View>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <View className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-black text-slate-900">
              {isSupervisor ? 'QA Testing Activity (14 Days)' : 'Repair Activity (14 Days)'}
            </Text>
            <Text className="text-[11px] font-medium text-slate-400">Past {DAYS_SHOWN} days output</Text>
          </View>
          <View
            className={`rounded-full px-2.5 py-1 ${
              isSupervisor ? 'bg-violet-100' : 'bg-blue-100'
            }`}
          >
            <Text
              className={`text-[11px] font-black ${
                isSupervisor ? 'text-violet-700' : 'text-blue-700'
              }`}
            >
              {weekCount} this week
            </Text>
          </View>
        </View>

        {hasActivity ? (
          <View className="pt-2">
            <View className="flex-row items-end gap-1.5" style={{ height: 85 }}>
              {dailyCounts.map((d, index) => {
                const heightPct = Math.max(8, (d.count / maxCount) * 65);
                const isHighlight = d.isToday;
                return (
                  <View key={`${d.label}-${index}`} className="flex-1 items-center justify-end">
                    {d.count > 0 && (
                      <Text
                        className={`mb-1 text-[9px] font-black ${
                          isHighlight
                            ? 'text-emerald-600'
                            : isSupervisor
                              ? 'text-violet-600'
                              : 'text-blue-600'
                        }`}
                      >
                        {d.count}
                      </Text>
                    )}
                    <View
                      className={`w-full rounded-t-md ${
                        isHighlight
                          ? 'bg-emerald-500'
                          : d.count > 0
                            ? isSupervisor
                              ? 'bg-violet-500'
                              : 'bg-blue-500'
                            : 'bg-slate-100'
                      }`}
                      style={{ height: heightPct }}
                    />
                    <Text
                      className={`mt-1.5 text-[8px] font-black ${
                        isHighlight ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                      numberOfLines={1}
                    >
                      {isHighlight ? 'TD' : d.dayName}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2">
              <Text className="text-[10px] font-medium text-slate-400">14 days ago</Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1.5">
                  <View
                    className={`h-2 w-2 rounded-full ${
                      isSupervisor ? 'bg-violet-500' : 'bg-blue-500'
                    }`}
                  />
                  <Text className="text-[10px] font-medium text-slate-500">Past Shift</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Text className="text-[10px] font-bold text-emerald-700">Today</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="items-center py-6">
            <Text className="text-xs font-semibold text-slate-400">
              No completed {isSupervisor ? 'tests' : 'repairs'} in the past {DAYS_SHOWN} days.
            </Text>
          </View>
        )}
      </View>

      {/* ── Workshop Activity Feed with Filter Tabs ─────────────────────── */}
      <View>
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Workshop Activity Feed
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('History')}
            className="flex-row items-center gap-1"
          >
            <Text className="text-[11px] font-bold text-blue-600">
              View All ({completedJobs.length})
            </Text>
            <Icon name="arrowRight" color="#2563eb" size={12} />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab('all')}
              className={`rounded-xl px-3 py-1.5 ${
                activeTab === 'all'
                  ? 'bg-slate-900 shadow-xs'
                  : 'bg-white border border-slate-200'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  activeTab === 'all' ? 'text-white' : 'text-slate-600'
                }`}
              >
                All Activity
              </Text>
            </TouchableOpacity>

            {!isSupervisor ? (
              <>
                <TouchableOpacity
                  onPress={() => setActiveTab('testing')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'testing'
                      ? 'bg-blue-600 shadow-xs'
                      : 'bg-white border border-blue-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'testing' ? 'text-white' : 'text-blue-700'
                    }`}
                  >
                    In Testing ({inTestingRepairs.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('completed')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'completed'
                      ? 'bg-emerald-600 shadow-xs'
                      : 'bg-white border border-emerald-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'completed' ? 'text-white' : 'text-emerald-700'
                    }`}
                  >
                    QA Verified ({verifiedRepairs.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('unserviceable')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'unserviceable'
                      ? 'bg-rose-600 shadow-xs'
                      : 'bg-white border border-rose-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'unserviceable' ? 'text-white' : 'text-rose-700'
                    }`}
                  >
                    Unserviceable ({unserviceableIssues.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('removed')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'removed'
                      ? 'bg-amber-600 shadow-xs'
                      : 'bg-white border border-amber-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'removed' ? 'text-white' : 'text-amber-700'
                    }`}
                  >
                    Parts Removed ({partsRemovedRepairs.length})
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setActiveTab('passed')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'passed'
                      ? 'bg-emerald-600 shadow-xs'
                      : 'bg-white border border-emerald-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'passed' ? 'text-white' : 'text-emerald-700'
                    }`}
                  >
                    Passed ({passedTests.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('passed_back')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'passed_back'
                      ? 'bg-amber-600 shadow-xs'
                      : 'bg-white border border-amber-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'passed_back' ? 'text-white' : 'text-amber-700'
                    }`}
                  >
                    Passed Back ({passedBackTests.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('unserviceable')}
                  className={`rounded-xl px-3 py-1.5 ${
                    activeTab === 'unserviceable'
                      ? 'bg-rose-600 shadow-xs'
                      : 'bg-white border border-rose-200'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      activeTab === 'unserviceable' ? 'text-white' : 'text-rose-700'
                    }`}
                  >
                    Unserviceable ({unserviceableIssues.length})
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        {/* Activity List */}
        {filteredFeed.length === 0 ? (
          <View className="items-center rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 mb-2.5">
              <Icon name={isSupervisor ? 'flask' : 'wrench'} color="#64748b" size={22} />
            </View>
            <Text className="text-sm font-black text-slate-800">No entries in this view</Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              All workshop actions and battery updates will appear here automatically.
            </Text>
          </View>
        ) : (
          <View className="gap-2.5">
            {filteredFeed.slice(0, 8).map((j, idx) => {
              const isIssue = j.entryType === 'issue' || j.reason_label != null;
              const isRemoved = j.entryType === 'removed' || isPartsRemoved(j);
              const isTesting = j.entryType === 'testing' || j.battery_status === 'in_testing';

              return (
                <TouchableOpacity
                  key={`${j.battery_code}-${j.id || idx}`}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('BatteryDetail', { code: j.battery_code })}
                  className="flex-row items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs"
                >
                  <View className="flex-row items-center gap-3 min-w-0 flex-1 pr-2">
                    {/* Status Icon Indicator */}
                    <View
                      className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isIssue
                          ? 'bg-rose-50'
                          : isRemoved
                            ? 'bg-amber-50'
                            : isTesting
                              ? 'bg-blue-50'
                              : 'bg-emerald-50'
                      }`}
                    >
                      <Icon
                        name={
                          isIssue
                            ? 'alertTriangle'
                            : isRemoved
                              ? 'rotateCcw'
                              : isTesting
                                ? 'zap'
                                : 'checkCircle'
                        }
                        color={
                          isIssue
                            ? '#e11d48'
                            : isRemoved
                              ? '#d97706'
                              : isTesting
                                ? '#2563eb'
                                : '#059669'
                        }
                        size={18}
                      />
                    </View>

                    <View className="min-w-0 flex-1">
                      <View className="mb-1 flex-row items-center gap-2">
                        <Text className="font-mono text-sm font-black text-slate-900">
                          {j.battery_code}
                        </Text>

                        {isIssue ? (
                          <View className="rounded-full bg-rose-100 px-2 py-0.5">
                            <Text className="text-[9px] font-black uppercase tracking-wider text-rose-800">
                              Unserviceable
                            </Text>
                          </View>
                        ) : isRemoved ? (
                          <View className="rounded-full bg-amber-100 px-2 py-0.5">
                            <Text className="text-[9px] font-black uppercase tracking-wider text-amber-800">
                              Parts Removed
                            </Text>
                          </View>
                        ) : isTesting ? (
                          <View className="rounded-full bg-blue-100 px-2 py-0.5">
                            <Text className="text-[9px] font-black uppercase tracking-wider text-blue-800">
                              Passed to Testing
                            </Text>
                          </View>
                        ) : (
                          <StatusBadge status={getRepairBadgeStatus(j)} />
                        )}

                        <Text className="text-[10px] font-medium text-slate-400 ml-auto">
                          {timeAgo(j.date || j.doneAt || j.repaired_at || j.reported_at)}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-medium text-slate-600 flex-1" numberOfLines={1}>
                          {isIssue
                            ? `Reported: ${j.reason_label || j.note || 'Can not service unit'}`
                            : isRemoved
                              ? `Parts restocked: ${j.part_name || 'Fitted parts returned'}`
                              : isSupervisor
                                ? j.passed_back
                                  ? 'Returned to technician for rework'
                                  : `QA Tested: ${j.service_name || 'Inspection passed'}`
                                : j.part_name
                                  ? `Fitted: ${j.part_name}`
                                  : 'Completed service inspection'}
                        </Text>
                        {typeof (j.duration || j.duration_seconds) === 'number' &&
                          (j.duration || j.duration_seconds) > 0 && (
                            <View className="ml-2 flex-row items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                              <Icon name="clock" color="#64748b" size={10} />
                              <Text className="text-[9px] font-black text-slate-600">
                                {formatDuration(j.duration || j.duration_seconds)}
                              </Text>
                            </View>
                          )}
                      </View>
                    </View>
                  </View>

                  <Icon name="arrowRight" color="#94a3b8" size={14} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
