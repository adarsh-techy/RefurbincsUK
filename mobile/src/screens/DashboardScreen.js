import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import apiClient from '../services/api-client';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/Badge';
import formatDuration from '../utils/format-duration';

const DAYS_SHOWN = 14;
const RECENT_LIMIT = 4;

// Same fixed-window bucketing as the web app's Dashboard/Staff Detail pages
// — days with no repairs show as 0 rather than being skipped.
function buildDailyCounts(repairs) {
  const countsByDay = {};
  for (const r of repairs) {
    const day = new Date(r.repaired_at).toDateString();
    countsByDay[day] = (countsByDay[day] || 0) + 1;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    series.push({
      label: day.toLocaleDateString([], { day: '2-digit', month: 'short' }),
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
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeAgo(dateString) {
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get('/staff/me')
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-center text-sm text-red-600">{error}</Text>
      </View>
    );
  }

  const { staff, repairs } = data;
  // Only count visits whose battery has actually finished that round
  // (repaired/returned) — one still mid-cycle (in_progress/in_testing)
  // isn't done yet, even though it's already been logged here.
  const completedRepairs = repairs.filter(
    (r) => r.battery_status === 'repaired' || r.battery_status === 'returned'
  );
  const dailyCounts = buildDailyCounts(completedRepairs);
  const maxCount = Math.max(1, ...dailyCounts.map((d) => d.count));
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const weekCount = dailyCounts.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const hasActivity = dailyCounts.some((d) => d.count > 0);

  const timedRepairs = completedRepairs.filter((r) => typeof r.duration_seconds === 'number');
  const avgDuration = timedRepairs.length
    ? Math.round(timedRepairs.reduce((sum, r) => sum + r.duration_seconds, 0) / timedRepairs.length)
    : null;

  const recent = completedRepairs.slice(0, RECENT_LIMIT);

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-5 pb-10">
      <View className="mb-6 flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 ring-1 ring-blue-500/30">
          <Text className="text-base font-bold text-blue-600">{initials(staff.name)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-900">
            {greeting()}, {staff.name}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="rounded-full bg-blue-100 px-2 py-0.5">
              <Text className="text-[11px] font-semibold capitalize text-blue-700">
                {staff?.role
                  ? staff.role.charAt(0).toUpperCase() + staff.role.slice(1)
                  : 'Technician'}
              </Text>
            </View>
            <Text className="text-xs text-slate-500">Your repair activity</Text>
          </View>
        </View>
      </View>

      <View className="mb-3 flex-row gap-3">
        <StatCard label="Today" value={todayCount} tone="good" icon="⚡" />
        <StatCard label="This Week" value={weekCount} tone="info" icon="📅" />
      </View>
      <View className="mb-5 flex-row gap-3">
        <StatCard label="Total" value={completedRepairs.length} tone="warning" icon="🔧" />
        <StatCard
          label="Avg Time"
          value={avgDuration != null ? formatDuration(avgDuration) : '—'}
          tone="critical"
          icon="⏱️"
        />
      </View>

      <View className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-slate-900">
            Repairs per day <Text className="text-slate-400">· last {DAYS_SHOWN} days</Text>
          </Text>
          <View className="rounded-full bg-blue-500/15 px-2.5 py-1">
            <Text className="text-xs font-semibold text-blue-700">{weekCount} this week</Text>
          </View>
        </View>
        {hasActivity ? (
          <View className="flex-row items-end gap-1.5" style={{ height: 120 }}>
            {dailyCounts.map((d) => (
              <View key={d.label} className="flex-1 items-center gap-1.5">
                <View
                  className={`w-full rounded-full ${
                    d.isToday ? 'bg-emerald-400' : d.count > 0 ? 'bg-blue-500' : 'bg-slate-200'
                  }`}
                  style={{ height: Math.max(4, (d.count / maxCount) * 90) }}
                />
                {d.isToday && <View className="h-1 w-1 rounded-full bg-emerald-400" />}
              </View>
            ))}
          </View>
        ) : (
          <Text className="py-6 text-center text-sm text-slate-400">
            No repairs logged in the last {DAYS_SHOWN} days.
          </Text>
        )}
      </View>

      <Text className="mb-3 text-sm font-semibold text-slate-900">Recent Activity</Text>
      {recent.length === 0 ? (
        <View className="items-center rounded-2xl border border-blue-100 bg-blue-50 py-8">
          <Text className="text-sm text-slate-400">Nothing completed yet — get to work!</Text>
        </View>
      ) : (
        <View className="gap-2">
          {recent.map((r) => (
            <View
              key={r.id}
              className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <View className="min-w-0 flex-1">
                <View className="mb-0.5 flex-row items-center gap-2">
                  <Text className="font-medium text-slate-900">{r.battery_code}</Text>
                  <StatusBadge status={r.battery_status} />
                </View>
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {r.part_name}
                </Text>
              </View>
              <Text className="shrink-0 text-xs text-slate-400">{timeAgo(r.repaired_at)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
