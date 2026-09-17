import { useCallback, useEffect, useState } from 'react';
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
function buildDailyCounts(repairs) {
  const countsByDay = {};
  for (const r of repairs) {
    if (r.repaired_at) {
      const day = new Date(r.repaired_at).toDateString();
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-3 text-sm font-medium text-slate-500">Loading technician dashboard…</Text>
      </View>
    );
  }

  const { staff = {}, repairs = [], issues = [] } = data || {};

  // Completed repairs are finished cycles
  const completedRepairs = repairs.filter(
    (r) => r.battery_status === 'repaired' || r.battery_status === 'returned'
  );
  const inProgressRepairs = repairs.filter(
    (r) => r.battery_status === 'in_progress' || r.battery_status === 'in_testing'
  );

  const dailyCounts = buildDailyCounts(completedRepairs);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  const timedRepairs = completedRepairs.filter((r) => typeof r.duration_seconds === 'number' && r.duration_seconds > 0);
  const avgDuration = timedRepairs.length
    ? Math.round(timedRepairs.reduce((sum, r) => sum + r.duration_seconds, 0) / timedRepairs.length)
    : null;

  const recentRepairs = completedRepairs.slice(0, RECENT_LIMIT);

  const todayDateFormatted = new Date().toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#2563eb"
          colors={['#2563eb']}
        />
      }
    >
      {/* ── Executive Hero Card ─────────────────────────────────────────── */}
      <View className="mb-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Shift Active · Ready
            </Text>
          </View>
          <View className="rounded-full bg-slate-100 px-2.5 py-0.5">
            <Text className="text-[11px] font-semibold text-slate-500">{todayDateFormatted}</Text>
          </View>
        </View>

        <View className="mt-3.5 flex-row items-center gap-3.5">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
            <Text className="text-base font-extrabold text-white">{initials(staff.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-slate-900" numberOfLines={1}>
              {greeting()}, {staff.name || 'Technician'}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <View className="rounded-md bg-blue-50 px-2 py-0.5 border border-blue-200">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                  {staff?.role
                    ? staff.role.replace('_', ' ').toUpperCase()
                    : 'TECHNICIAN'}
                </Text>
              </View>
              <Text className="text-xs text-slate-500">Workshop Portal</Text>
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
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 px-3 shadow-sm"
        >
          <Icon name="camera" color="#ffffff" size={16} />
          <Text className="text-sm font-bold text-white">Scan Battery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('History')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 px-3 shadow-sm"
        >
          <Icon name="clock" color="#334155" size={16} />
          <Text className="text-sm font-bold text-slate-700">My History</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI Metric Cards Grid ───────────────────────────────────────── */}
      <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Performance Overview
      </Text>

      <View className="mb-4 gap-2.5">
        {/* Top Row: Today + This Week */}
        <View className="flex-row gap-2.5">
          {/* Today */}
          <View className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                Today
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                <Icon name="zap" color="#059669" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-2xl font-extrabold text-emerald-700">{todayCount}</Text>
            <Text className="mt-0.5 text-[10px] font-medium text-emerald-600">Repairs completed</Text>
          </View>

          {/* This Week */}
          <View className="flex-1 rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-wide text-blue-800">
                This Week
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                <Icon name="calendar" color="#2563eb" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-2xl font-extrabold text-blue-700">{weekCount}</Text>
            <Text className="mt-0.5 text-[10px] font-medium text-blue-600">Past 7 days output</Text>
          </View>
        </View>

        {/* Bottom Row: Total Completed + Avg Speed */}
        <View className="flex-row gap-2.5">
          {/* Total Completed */}
          <View className="flex-1 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                Total Output
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-full bg-amber-500/20">
                <Icon name="award" color="#d97706" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-2xl font-extrabold text-amber-700">{completedRepairs.length}</Text>
            <Text className="mt-0.5 text-[10px] font-medium text-amber-600">Lifetime serviced</Text>
          </View>

          {/* Avg Duration */}
          <View className="flex-1 rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase tracking-wide text-purple-800">
                Avg Speed
              </Text>
              <View className="h-6 w-6 items-center justify-center rounded-full bg-purple-500/20">
                <Text className="text-xs">⏱️</Text>
              </View>
            </View>
            <Text className="mt-1 text-2xl font-extrabold text-purple-700">
              {avgDuration != null ? formatDuration(avgDuration) : '—'}
            </Text>
            <Text className="mt-0.5 text-[10px] font-medium text-purple-600">Per battery repair</Text>
          </View>
        </View>
      </View>

      {/* ── Status Snapshot Bar ─────────────────────────────────────────── */}
      <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full bg-emerald-500" />
          <Text className="text-xs font-semibold text-slate-700">
            {completedRepairs.length} Done
          </Text>
        </View>
        <View className="h-4 w-px bg-slate-200" />
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full bg-blue-500" />
          <Text className="text-xs font-semibold text-slate-700">
            {inProgressRepairs.length} Active
          </Text>
        </View>
        <View className="h-4 w-px bg-slate-200" />
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full bg-rose-500" />
          <Text className="text-xs font-semibold text-slate-700">
            {issues.length} Unserviceable
          </Text>
        </View>
      </View>

      {/* ── 14-Day Activity Chart ───────────────────────────────────────── */}
      <View className="mb-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-slate-900">Repair Activity</Text>
            <Text className="text-[11px] text-slate-400">Past {DAYS_SHOWN} days output</Text>
          </View>
          <View className="rounded-full bg-blue-50 px-2.5 py-1 border border-blue-200">
            <Text className="text-xs font-bold text-blue-700">{weekCount} this week</Text>
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
                          isHighlight ? 'text-emerald-600' : 'text-slate-500'
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
                          ? 'bg-blue-500'
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
                  <View className="h-2 w-2 rounded-full bg-blue-500" />
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
            <Text className="text-xs text-slate-400">No repairs logged in the past {DAYS_SHOWN} days.</Text>
          </View>
        )}
      </View>

      {/* ── Recent Activity Section ─────────────────────────────────────── */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Recent Completed Work
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')} className="flex-row items-center gap-1">
          <Text className="text-xs font-bold text-blue-600">View All ({repairs.length})</Text>
          <Icon name="arrowRight" color="#2563eb" size={13} />
        </TouchableOpacity>
      </View>

      {recentRepairs.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <View className="mb-1">
            <Icon name="zap" color="#94a3b8" size={24} />
          </View>
          <Text className="text-sm font-semibold text-slate-800">No completed jobs yet</Text>
          <Text className="text-xs text-slate-400 text-center mt-0.5">
            Scan a battery QR code to start servicing units.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {recentRepairs.map((r) => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('BatteryDetail', { code: r.battery_code })}
              className="flex-row items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm"
            >
              <View className="min-w-0 flex-1 pr-2">
                <View className="mb-1 flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-blue-700">{r.battery_code}</Text>
                  <StatusBadge status={r.battery_status} />
                </View>

                <Text className="text-xs font-medium text-slate-600" numberOfLines={1}>
                  {r.part_name || 'Completed inspection'}
                </Text>

                <View className="mt-1 flex-row items-center gap-2">
                  {typeof r.duration_seconds === 'number' && r.duration_seconds > 0 && (
                    <View className="rounded bg-slate-100 px-1.5 py-0.5">
                      <Text className="text-[10px] font-semibold text-slate-600">
                        ⏱️ {formatDuration(r.duration_seconds)}
                      </Text>
                    </View>
                  )}
                  <Text className="text-[10px] text-slate-400">{timeAgo(r.repaired_at)}</Text>
                </View>
              </View>

              <Text className="text-base text-slate-400 font-bold">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

