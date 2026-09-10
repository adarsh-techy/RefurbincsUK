import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../services/api-client';
import { StatusBadge } from '../components/Badge';

export default function ClientDashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [recentBatteries, setRecentBatteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadDashboard() {
    setError(null);
    try {
      const [dashRes, battRes] = await Promise.all([
        apiClient.get('/clients/me/dashboard'),
        apiClient.get('/clients/me/batteries'),
      ]);
      setData(dashRes.data);
      setRecentBatteries((battRes.data?.data || []).slice(0, 5));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    loadDashboard();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-slate-900">
        <ActivityIndicator color="#38bdf8" size="large" />
        <Text className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">Loading your client portal…</Text>
      </View>
    );
  }

  const { client, stats } = data || {};
  const inRepair = Number(stats?.in_repair_count || 0);
  const inProgress = Number(stats?.in_progress_count || 0);
  const inTesting = Number(stats?.in_testing_count || 0);
  const completed = Number(stats?.repaired_count || 0);
  const returned = Number(stats?.returned_count || 0);
  const totalBatteries = Number(stats?.battery_count || 0);
  const balanceOwed = Number(stats?.balance || 0);

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerClassName="p-5 pb-16"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#38bdf8"
          colors={['#38bdf8']}
        />
      }
    >
      {/* ── Executive Hero Card ─────────────────────────────────────────── */}
      <View className="mb-5 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <Text className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Verified Client Portal
            </Text>
          </View>
          <Text className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Real-Time</Text>
        </View>

        <Text className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Welcome, {client?.name}</Text>
        <Text className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Track all your battery servicing, live diagnostic stages, and return dispatches.
        </Text>
      </View>

      {error && (
        <View className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 p-3">
          <Text className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</Text>
        </View>
      )}

      {/* ── Balance & Total Metrics ─────────────────────────────────────── */}
      <View className="mb-5 flex-row gap-3">
        {/* Balance Card */}
        <View className="flex-1 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Balance Owed
            </Text>
            <Text className="text-amber-600 dark:text-amber-400">💳</Text>
          </View>
          <Text className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-300">
            £{balanceOwed.toFixed(2)}
          </Text>
          <Text className="mt-0.5 text-[10px] text-amber-600/80 dark:text-amber-500/80">Invoiced services</Text>
        </View>

        {/* Total Batteries */}
        <View className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Fleet Units
            </Text>
            <Text className="text-blue-600 dark:text-blue-400">🔋</Text>
          </View>
          <Text className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
            {totalBatteries.toLocaleString()}
          </Text>
          <Text className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">Registered</Text>
        </View>
      </View>

      {/* ── Status Pipeline Breakdown ───────────────────────────────────── */}
      <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Live Service Pipeline
      </Text>

      <View className="mb-6 gap-2.5">
        {/* Stage 1: Packed to Repair */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('MyBatteries', { initialBucket: 'packed' })}
          className="flex-row items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Text className="text-lg">📦</Text>
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-900 dark:text-white">Battery Packed to Repair</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">Awaiting pickup / triage</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-amber-500/20 px-2.5 py-0.5 border border-amber-500/30">
              <Text className="text-xs font-extrabold text-amber-600 dark:text-amber-400">{inRepair}</Text>
            </View>
            <Text className="text-slate-700 dark:text-slate-600 text-xs">›</Text>
          </View>
        </TouchableOpacity>

        {/* Stage 2: In Service & Testing */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('MyBatteries', { initialBucket: 'pending' })}
          className="flex-row items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
              <Text className="text-lg">⚙️</Text>
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-900 dark:text-white">In Service & Testing</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">Active repairs by technician</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-blue-500/20 px-2.5 py-0.5 border border-blue-500/30">
              <Text className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                {inProgress + inTesting + completed}
              </Text>
            </View>
            <Text className="text-slate-700 dark:text-slate-600 text-xs">›</Text>
          </View>
        </TouchableOpacity>

        {/* Stage 3: Returned to Client */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('MyBatteries', { initialBucket: 'received' })}
          className="flex-row items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
              <Text className="text-lg">🚚</Text>
            </View>
            <View>
              <Text className="text-sm font-bold text-slate-900 dark:text-white">Battery Received Back</Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">Restored & ready in fleet</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 border border-emerald-500/30">
              <Text className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{returned}</Text>
            </View>
            <Text className="text-slate-700 dark:text-slate-600 text-xs">›</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Recent Batteries Quick Section ──────────────────────────────── */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Recent Fleet Batteries
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('MyBatteries', { initialBucket: 'all' })}>
          <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">View All ({totalBatteries}) →</Text>
        </TouchableOpacity>
      </View>

      {recentBatteries.length === 0 ? (
        <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 items-center">
          <Text className="text-xs text-slate-400 dark:text-slate-500">No batteries registered yet.</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {recentBatteries.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false })
              }
              className="flex-row items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-3.5 shadow-sm"
            >
              <View>
                <Text className="text-sm font-bold text-blue-600 dark:text-blue-400">{item.battery_code}</Text>
                {item.serial_number ? (
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                    SN: {item.serial_number} {item.serial_number_added_by_role === 'client' ? '🔒' : ''}
                  </Text>
                ) : (
                  <Text className="text-[11px] text-slate-700 dark:text-slate-600">No Serial</Text>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <StatusBadge status={item.status} />
                <Text className="text-slate-700 dark:text-slate-600 text-xs">›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
