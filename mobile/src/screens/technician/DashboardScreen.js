import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import formatDuration from '../../utils/format-duration';
import {
  isCompletedRepair,
  isActiveRepair,
  isVerifiedRepair,
  isPartsRemoved,
} from '../../components/technician/work-outcome';

const DAYS_SHOWN = 14;


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





export default function DashboardScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
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

  // The tab stays mounted, so re-read when it comes back into view (the web
  // page reloads each time it is opened) — work just logged shows up.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const { staff = {}, repairs = [], issues = [], tests = [] } = data || {};

  const isSupervisor = useMemo(() => {
    const role = (staff?.role || user?.staff_role || user?.role || '').toLowerCase();
    return role === 'supervisor';
  }, [staff?.role, user?.staff_role, user?.role]);

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
      .filter(isCompletedRepair)
      .map((r) => ({
        ...r,
        kind: 'repair',
        doneAt: r.repaired_at,
        duration: r.duration_seconds,
      }))
      .sort((a, b) => new Date(b.doneAt || 0) - new Date(a.doneAt || 0));
  }, [isSupervisor, tests, repairs]);

  // Pillar 2: Passed to Testing / In Testing
  const inTestingRepairs = useMemo(() => repairs.filter(isActiveRepair), [repairs]);

  // Pillar 3: Marked Unserviceable
  const unserviceableIssues = issues || [];

  // Pillar 4: Parts Removed
  const partsRemovedRepairs = useMemo(
    () => repairs.filter(isPartsRemoved),
    [repairs]
  );

  // Verified QA complete
  const verifiedRepairs = useMemo(() => repairs.filter(isVerifiedRepair), [repairs]);

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

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {/* ── Core 4 KPI Status Breakdown ──────────────────────────────────── */}
      <View>
        <View className="mb-2.5 flex-row items-center justify-between gap-2">
          <Text className="shrink text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
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
                  Total Batteries
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
                {isSupervisor
                  ? tests.length + unserviceableIssues.length
                  : repairs.length + unserviceableIssues.length}
              </Text>
              <Text
                className={`mt-0.5 text-[10px] font-bold ${
                  isSupervisor ? 'text-violet-600' : 'text-emerald-600'
                }`}
              >
                {`Total started work · ${todayCount} today`}
              </Text>
            </View>

            {/* Pillar 2: Verified Passed / QA */}
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
                  {isSupervisor ? 'Passed QA' : 'Verified Passed'}
                </Text>
                <View
                  className={`h-7 w-7 items-center justify-center rounded-lg ${
                    isSupervisor ? 'bg-emerald-100' : 'bg-blue-100'
                  }`}
                >
                  <Icon
                    name={isSupervisor ? 'checkCircle' : 'checkCircle'}
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
                {isSupervisor ? passedTests.length : verifiedRepairs.length}
              </Text>
              <Text
                className={`mt-0.5 text-[10px] font-bold ${
                  isSupervisor ? 'text-emerald-600' : 'text-blue-600'
                }`}
              >
                {isSupervisor
                  ? 'Passed inspection'
                  : inTestingRepairs.length > 0
                    ? `${inTestingRepairs.length} awaiting QA`
                    : 'All QA verified'}
              </Text>
            </View>
          </View>

          {/* Bottom Row: Test Failed & Unservice Marked */}
          <View className="flex-row gap-2.5">
            {/* Pillar 3: Test Failed / Passed Back */}
            <View
              className="flex-1 rounded-2xl border p-3.5 border-amber-200 bg-amber-50/60"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800"
                >
                  {isSupervisor ? 'Passed Back' : 'Test Failed'}
                </Text>
                <View
                  className="h-7 w-7 items-center justify-center rounded-lg bg-amber-100"
                >
                  <Icon
                    name="rotateCcw"
                    color="#d97706"
                    size={14}
                  />
                </View>
              </View>
              <Text
                className="mt-1 text-2xl sm:text-3xl font-black text-amber-700"
              >
                {isSupervisor ? passedBackTests.length : partsRemovedRepairs.length}
              </Text>
              <Text
                className="mt-0.5 text-[10px] font-bold text-amber-600"
              >
                {isSupervisor ? 'Returned for rework' : 'Unserviceable / restocked'}
              </Text>
            </View>

            {/* Pillar 4: Unservice Marked */}
            <View
              className="flex-1 rounded-2xl border p-3.5 border-rose-200 bg-rose-50/60"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800"
                >
                  {isSupervisor ? 'Unserviceable' : 'Unservice Marked'}
                </Text>
                <View
                  className="h-7 w-7 items-center justify-center rounded-lg bg-rose-100"
                >
                  <Icon
                    name="alertTriangle"
                    color="#e11d48"
                    size={14}
                  />
                </View>
              </View>
              <Text
                className="mt-1 text-2xl sm:text-3xl font-black text-rose-700"
              >
                {unserviceableIssues.length}
              </Text>
              <Text
                className="mt-0.5 text-[10px] font-bold text-rose-600"
              >
                {isSupervisor ? 'Marked failed tests' : 'Issues logged'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Secondary Performance Snapshot (2x2 Grid with Proper Sizing) ── */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 items-center border-r border-slate-100 pr-2">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">This Week</Text>
            <Text className="text-sm font-black text-slate-800 mt-0.5">{weekCount} units</Text>
          </View>
          <View className="flex-1 items-center pl-2">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lifetime</Text>
            <Text className="text-sm font-black text-slate-800 mt-0.5">{completedJobs.length} done</Text>
          </View>
        </View>
        <View className="h-px bg-slate-100" />
        <View className="flex-row items-center justify-between">
          <View className="flex-1 items-center border-r border-slate-100 pr-2">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Avg Speed</Text>
            <Text className="text-sm font-black text-slate-800 mt-0.5">
              {avgDuration != null ? formatDuration(avgDuration) : '—'}
            </Text>
          </View>
          <View className="flex-1 items-center pl-2">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Approval Rate</Text>
            <Text className="text-sm font-black text-emerald-600 mt-0.5">{approvalRate}% pass</Text>
          </View>
        </View>
      </View>

      {/* ── 14-Day Activity Chart ─────────────────────────────────────── */}
      <View className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
          <View className="shrink">
            <Text className="text-sm font-black text-slate-900">
              {isSupervisor ? 'QA Testing 14-Day Output' : 'Repair Output Activity (14 Days)'}
            </Text>
            <Text className="text-[11px] font-medium text-slate-400">Daily output timeline · Past {DAYS_SHOWN} days</Text>
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
              {weekCount} units this week
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
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {isHighlight ? 'TODAY' : d.dayName}
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

      {/* ── Quick Workshop Navigation Shortcuts (Replaces duplicate activity list) ── */}
      <View className="gap-2.5">
        <TouchableOpacity
          onPress={() => navigation.navigate('History')}
          activeOpacity={0.7}
          className="flex-row items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs"
        >
          <View className="flex-1 pr-3">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Complete Audit Logs
            </Text>
            <Text className="text-sm font-bold text-slate-900 mt-0.5">
              Service History
            </Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              Review all {completedJobs.length} completed repairs, parts fitted, &amp; logs.
            </Text>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <Icon name="arrowRight" color="#059669" size={16} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Service')}
          activeOpacity={0.7}
          className="flex-row items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs"
        >
          <View className="flex-1 pr-3">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Station Ready
            </Text>
            <Text className="text-sm font-bold text-slate-900 mt-0.5">
              Scan Next Battery
            </Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              Start new diagnosis, repair, or quality test with camera/RFID.
            </Text>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <Icon name="camera" color="#059669" size={16} />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
