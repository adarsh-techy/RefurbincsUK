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
const RECENT_LIMIT = 5;

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
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

  // Strict role separation: supervisor gets only tests; tech gets only repairs
  const completedJobs = useMemo(() => {
    if (isSupervisor) {
      // Supervisor: strictly testing sign-offs only, NO repairs
      return tests
        .map((t) => ({
          ...t,
          kind: 'test',
          doneAt: t.tested_at,
          duration: t.testing_duration_seconds,
        }))
        .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
    }
    // Technician: strictly completed repairs only, NO tests
    return repairs
      .filter((r) => r.battery_status === 'repaired' || r.outcome !== 'failed')
      .map((r) => ({
        ...r,
        kind: 'repair',
        doneAt: r.repaired_at,
        duration: r.duration_seconds,
      }))
      .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
  }, [isSupervisor, tests, repairs]);

  const passedTests = useMemo(() => tests.filter((t) => !t.passed_back), [tests]);
  const passedBackTests = useMemo(() => tests.filter((t) => t.passed_back), [tests]);
  const inProgressRepairs = useMemo(
    () => repairs.filter((r) => r.battery_status === 'in_progress' || r.battery_status === 'in_testing'),
    [repairs]
  );

  const dailyCounts = useMemo(() => buildDailyCounts(completedJobs), [completedJobs]);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  const avgDuration = useMemo(() => {
    if (isSupervisor) {
      const timed = tests.filter((t) => typeof t.testing_duration_seconds === 'number' && t.testing_duration_seconds > 0);
      return timed.length
        ? Math.round(timed.reduce((s, t) => s + t.testing_duration_seconds, 0) / timed.length)
        : null;
    }
    const timed = completedJobs.filter((r) => typeof r.duration === 'number' && r.duration > 0);
    return timed.length
      ? Math.round(timed.reduce((s, r) => s + r.duration, 0) / timed.length)
      : null;
  }, [isSupervisor, tests, completedJobs]);

  const passRate = useMemo(() => {
    if (!tests.length) return 0;
    return Math.round((passedTests.length / tests.length) * 100);
  }, [tests, passedTests]);

  const recentJobs = completedJobs.slice(0, RECENT_LIMIT);

  const todayDateFormatted = new Date().toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color={isSupervisor ? '#7c3aed' : '#2563eb'} />
        <Text className="mt-3 text-sm font-medium text-slate-500">
          Loading {isSupervisor ? 'supervisor' : 'technician'} dashboard…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16"
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
      <View className="mb-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2.5 w-2.5 rounded-full ${
                isSupervisor ? 'bg-violet-500' : 'bg-emerald-500'
              }`}
            />
            <Text
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isSupervisor ? 'text-violet-700' : 'text-emerald-600'
              }`}
            >
              {isSupervisor ? 'QA Session Active' : 'Shift Active · Ready'}
            </Text>
          </View>
          <View className="rounded-full bg-slate-100 px-2.5 py-0.5">
            <Text className="text-[11px] font-semibold text-slate-500">{todayDateFormatted}</Text>
          </View>
        </View>

        <View className="mt-3.5 flex-row items-center gap-3.5">
          <View
            className={`h-12 w-12 items-center justify-center rounded-2xl shadow-2xs ${
              isSupervisor ? 'bg-violet-600' : 'bg-blue-600'
            }`}
          >
            <Text className="text-base font-black text-white">{initials(staff.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-slate-900" numberOfLines={1}>
              {greeting()}, {staff.name || (isSupervisor ? 'Supervisor' : 'Technician')}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <View
                className={`rounded-md px-2 py-0.5 border ${
                  isSupervisor
                    ? 'bg-violet-50 border-violet-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold uppercase tracking-wide ${
                    isSupervisor ? 'text-violet-700' : 'text-blue-700'
                  }`}
                >
                  {isSupervisor ? 'SUPERVISOR · QA TESTING' : 'TECHNICIAN · REPAIRS'}
                </Text>
              </View>
              <Text className="text-xs text-slate-400">Workshop Portal</Text>
            </View>
          </View>
        </View>
      </View>

      {error && (
        <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {/* ── Quick Action Shortcuts ──────────────────────────────────────── */}
      <View className="mb-4 flex-row gap-2.5">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Service')}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5 px-3 shadow-2xs ${
            isSupervisor ? 'bg-violet-600' : 'bg-blue-600'
          }`}
        >
          <Icon name="camera" color="#ffffff" size={16} />
          <Text className="text-sm font-bold text-white">
            {isSupervisor ? 'Scan for QA' : 'Scan Battery'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('History')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 px-3 shadow-2xs"
        >
          <Icon name="clock" color="#334155" size={16} />
          <Text className="text-sm font-bold text-slate-700">
            {isSupervisor ? 'Testing History' : 'My History'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI Metric Cards Grid ───────────────────────────────────────── */}
      <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        {isSupervisor ? 'QA Testing Performance' : 'Repair Performance Overview'}
      </Text>

      <View className="mb-4 gap-2.5">
        {/* Top Row */}
        <View className="flex-row gap-2.5">
          {/* Today */}
          <View
            className={`flex-1 rounded-2xl border p-3.5 ${
              isSupervisor
                ? 'border-violet-200 bg-violet-50/70'
                : 'border-emerald-200 bg-emerald-50/70'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  isSupervisor ? 'text-violet-800' : 'text-emerald-800'
                }`}
              >
                Today
              </Text>
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isSupervisor ? 'bg-violet-500/20' : 'bg-emerald-500/20'
                }`}
              >
                <Text className="text-xs">⚡</Text>
              </View>
            </View>
            <Text
              className={`mt-1 text-2xl font-black ${
                isSupervisor ? 'text-violet-700' : 'text-emerald-700'
              }`}
            >
              {todayCount}
            </Text>
            <Text
              className={`mt-0.5 text-[10px] font-semibold ${
                isSupervisor ? 'text-violet-600' : 'text-emerald-600'
              }`}
            >
              {isSupervisor ? 'Tests signed off' : 'Repairs completed'}
            </Text>
          </View>

          {/* This Week */}
          <View
            className={`flex-1 rounded-2xl border p-3.5 ${
              isSupervisor
                ? 'border-indigo-200 bg-indigo-50/70'
                : 'border-blue-200 bg-blue-50/70'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  isSupervisor ? 'text-indigo-800' : 'text-blue-800'
                }`}
              >
                This Week
              </Text>
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isSupervisor ? 'bg-indigo-500/20' : 'bg-blue-500/20'
                }`}
              >
                <Icon name="calendar" color={isSupervisor ? '#4338ca' : '#2563eb'} size={12} />
              </View>
            </View>
            <Text
              className={`mt-1 text-2xl font-black ${
                isSupervisor ? 'text-indigo-700' : 'text-blue-700'
              }`}
            >
              {weekCount}
            </Text>
            <Text
              className={`mt-0.5 text-[10px] font-semibold ${
                isSupervisor ? 'text-indigo-600' : 'text-blue-600'
              }`}
            >
              Past 7 days output
            </Text>
          </View>
        </View>

        {/* Bottom Row */}
        <View className="flex-row gap-2.5">
          {/* Total Output / Passed */}
          <View
            className={`flex-1 rounded-2xl border p-3.5 ${
              isSupervisor
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-amber-200 bg-amber-50/70'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  isSupervisor ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {isSupervisor ? 'Total QA' : 'Total Output'}
              </Text>
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isSupervisor ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                }`}
              >
                <Icon name="award" color={isSupervisor ? '#059669' : '#d97706'} size={12} />
              </View>
            </View>
            <Text
              className={`mt-1 text-2xl font-black ${
                isSupervisor ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {completedJobs.length}
            </Text>
            <Text
              className={`mt-0.5 text-[10px] font-semibold ${
                isSupervisor ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {isSupervisor ? `${passRate}% pass rate` : 'Lifetime serviced'}
            </Text>
          </View>

          {/* Speed / Passed Back */}
          <View
            className={`flex-1 rounded-2xl border p-3.5 ${
              isSupervisor
                ? 'border-amber-200 bg-amber-50/70'
                : 'border-purple-200 bg-purple-50/70'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  isSupervisor ? 'text-amber-800' : 'text-purple-800'
                }`}
              >
                {isSupervisor ? 'Passed Back' : 'Avg Speed'}
              </Text>
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  isSupervisor ? 'bg-amber-500/20' : 'bg-purple-500/20'
                }`}
              >
                <Text className="text-xs">{isSupervisor ? '↩' : '⏱️'}</Text>
              </View>
            </View>
            <Text
              className={`mt-1 text-2xl font-black ${
                isSupervisor ? 'text-amber-700' : 'text-purple-700'
              }`}
            >
              {isSupervisor
                ? passedBackTests.length
                : avgDuration != null
                  ? formatDuration(avgDuration)
                  : '—'}
            </Text>
            <Text
              className={`mt-0.5 text-[10px] font-semibold ${
                isSupervisor ? 'text-amber-600' : 'text-purple-600'
              }`}
            >
              {isSupervisor ? 'Returned for rework' : 'Per battery repair'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Status Snapshot Bar ───────────────────────────────────────── */}
      <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
        {isSupervisor ? (
          <>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <Text className="text-xs font-bold text-slate-700">
                {passedTests.length} Passed QA
              </Text>
            </View>
            <View className="h-4 w-px bg-slate-200" />
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <Text className="text-xs font-bold text-slate-700">
                {passedBackTests.length} Passed Back
              </Text>
            </View>
            <View className="h-4 w-px bg-slate-200" />
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <Text className="text-xs font-bold text-slate-700">
                {issues.length} Unserviceable
              </Text>
            </View>
          </>
        ) : (
          <>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <Text className="text-xs font-bold text-slate-700">
                {completedJobs.length} Repaired
              </Text>
            </View>
            <View className="h-4 w-px bg-slate-200" />
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <Text className="text-xs font-bold text-slate-700">
                {inProgressRepairs.length} Active
              </Text>
            </View>
            <View className="h-4 w-px bg-slate-200" />
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <Text className="text-xs font-bold text-slate-700">
                {issues.length} Unserviceable
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <View className="mb-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-slate-900">
              {isSupervisor ? 'QA Testing Activity' : 'Repair Activity'}
            </Text>
            <Text className="text-xs text-slate-400">Past {DAYS_SHOWN} days output</Text>
          </View>
          <View
            className={`rounded-full px-2.5 py-1 ${
              isSupervisor ? 'bg-violet-100' : 'bg-blue-100'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                isSupervisor ? 'text-violet-700' : 'text-blue-700'
              }`}
            >
              {weekCount} this week
            </Text>
          </View>
        </View>

        {hasActivity ? (
          <View className="pt-2">
            <View className="flex-row items-end gap-1" style={{ height: 110 }}>
              {dailyCounts.map((d, index) => {
                const heightPct = Math.max(8, (d.count / maxCount) * 85);
                const isHighlight = d.isToday;
                return (
                  <View key={`${d.label}-${index}`} className="flex-1 items-center justify-end">
                    {d.count > 0 && (
                      <Text
                        className={`mb-1 text-[9px] font-bold ${
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
                      className={`mt-1.5 text-[8px] font-semibold ${
                        isHighlight ? 'text-emerald-700 font-bold' : 'text-slate-400'
                      }`}
                      numberOfLines={1}
                    >
                      {isHighlight ? 'TD' : d.dayName}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
              <Text className="text-[10px] text-slate-400">14 days ago</Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <View
                    className={`h-2 w-2 rounded-full ${
                      isSupervisor ? 'bg-violet-500' : 'bg-blue-500'
                    }`}
                  />
                  <Text className="text-[10px] text-slate-500">Past</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Text className="text-[10px] font-semibold text-emerald-700">Today</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="items-center py-6">
            <Text className="text-xs text-slate-400">
              No completed {isSupervisor ? 'tests' : 'repairs'} in the past {DAYS_SHOWN} days.
            </Text>
          </View>
        )}
      </View>

      {/* ── Recent Activity Section ─────────────────────────────────────── */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {isSupervisor ? 'Recent Testing Sign-offs' : 'Recent Completed Repairs'}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('History')}
          className="flex-row items-center gap-1"
        >
          <Text className="text-xs font-bold text-blue-600">
            View All ({completedJobs.length})
          </Text>
          <Icon name="arrowRight" color="#2563eb" size={13} />
        </TouchableOpacity>
      </View>

      {recentJobs.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
          <Text className="text-2xl mb-1">{isSupervisor ? '🔬' : '🔧'}</Text>
          <Text className="text-sm font-semibold text-slate-800">
            {isSupervisor ? 'No testing sign-offs yet' : 'No completed repairs yet'}
          </Text>
          <Text className="text-xs text-slate-400 text-center mt-0.5">
            {isSupervisor
              ? 'Scan a battery to inspect and sign off QA testing.'
              : 'Scan a battery QR code to start servicing units.'}
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {recentJobs.map((j) => (
            <TouchableOpacity
              key={`${j.kind}-${j.id}`}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('BatteryDetail', { code: j.battery_code })}
              className="flex-row items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs"
            >
              <View className="min-w-0 flex-1 pr-2">
                <View className="mb-1 flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-blue-700">{j.battery_code}</Text>
                  {j.kind === 'test' ? (
                    j.passed_back ? (
                      <View className="rounded-full bg-amber-100 px-2 py-0.5">
                        <Text className="text-[10px] font-black uppercase text-amber-800">
                          Passed Back
                        </Text>
                      </View>
                    ) : (
                      <StatusBadge status="repaired" />
                    )
                  ) : (
                    <StatusBadge status={j.battery_status || 'repaired'} />
                  )}
                </View>

                <Text className="text-xs font-medium text-slate-600" numberOfLines={1}>
                  {j.kind === 'test'
                    ? j.passed_back
                      ? 'Returned to technician for rework'
                      : `Tested: ${j.service_name || 'QA Passed'}`
                    : j.part_name ? `Parts: ${j.part_name}` : 'Completed service & inspection'}
                </Text>

                <View className="mt-1 flex-row items-center gap-2">
                  {typeof j.duration === 'number' && j.duration > 0 && (
                    <Text className="text-[10px] font-semibold text-slate-500">
                      ⏱ {formatDuration(j.duration)}
                    </Text>
                  )}
                  <Text className="text-[10px] text-slate-400">{timeAgo(j.doneAt)}</Text>
                </View>
              </View>

              <Icon name="arrowRight" color="#94a3b8" size={14} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
