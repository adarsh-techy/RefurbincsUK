import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

// Office-role (super_admin / admin / staff) home: the same figures as the web
// admin dashboard (GET /dashboard/summary), sized for a phone.

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function roleLabel(role) {
  return (role || 'admin').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Kpi({ label, value, tone, change, onPress }) {
  const tones = {
    blue: ['border-blue-200 bg-blue-50/70', 'text-blue-700'],
    amber: ['border-amber-200 bg-amber-50/70', 'text-amber-700'],
    emerald: ['border-emerald-200 bg-emerald-50/70', 'text-emerald-700'],
    rose: ['border-rose-200 bg-rose-50/70', 'text-rose-700'],
    slate: ['border-slate-200 bg-white', 'text-slate-700'],
    violet: ['border-violet-200 bg-violet-50/70', 'text-violet-700'],
  };
  const [box, text] = tones[tone] || tones.slate;
  const changeNum = typeof change === 'number' && Number.isFinite(change) ? change : null;
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.8}
      className={`w-[48%] rounded-2xl border p-3.5 ${box}`}
    >
      <Text className={`text-[10px] font-bold uppercase tracking-wide ${text}`}>{label}</Text>
      <Text className={`mt-1 text-2xl font-black ${text}`}>{Number(value || 0).toLocaleString()}</Text>
      {changeNum !== null && (
        <Text className={`mt-0.5 text-[10px] font-semibold ${changeNum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {changeNum >= 0 ? '▲' : '▼'} {Math.abs(changeNum).toFixed(0)}% vs previous
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/dashboard/summary');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const changes = data?.changes || {};
  const todays = data?.todaysRepairs || [];

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Hero */}
      <View className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600">
            <Icon name="grid" color="#ffffff" size={22} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-extrabold text-slate-900" numberOfLines={1}>
              {greeting()}, {user?.name || 'Admin'}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <View className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{roleLabel(user?.role)}</Text>
              </View>
              <Text className="text-xs text-slate-500">Workshop overview</Text>
            </View>
          </View>
        </View>
      </View>

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {/* Quick actions */}
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => navigation.navigate('Scan')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3"
        >
          <Icon name="camera" color="#fff" size={16} />
          <Text className="text-sm font-bold text-white">Scan Battery</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Intakes')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3"
        >
          <Icon name="truck" color="#0f172a" size={16} />
          <Text className="text-sm font-bold text-slate-800">Intakes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Directory')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3"
        >
          <Icon name="user" color="#0f172a" size={16} />
          <Text className="text-sm font-bold text-slate-800">Team</Text>
        </TouchableOpacity>
      </View>

      {/* KPIs */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fleet overview</Text>
      {loading ? (
        <Text className="py-6 text-center text-xs text-slate-400">Loading dashboard…</Text>
      ) : (
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Kpi label="Total batteries" value={totals.totalBatteries} tone="blue" change={changes.totalBatteries}
               onPress={() => navigation.navigate('Batteries')} />
          <Kpi label="Pending repair" value={totals.pendingRepair} tone="amber" change={changes.pendingRepair}
               onPress={() => navigation.navigate('Batteries', { status: 'in_repair' })} />
          <Kpi label="Repaired" value={totals.repaired} tone="emerald" change={changes.repaired}
               onPress={() => navigation.navigate('Batteries', { status: 'repaired' })} />
          <Kpi label="Unserviceable" value={totals.unserviceable} tone="rose"
               onPress={() => navigation.navigate('Batteries', { status: 'unserviceable' })} />
          <Kpi label="Recycled" value={totals.recycled} tone="slate"
               onPress={() => navigation.navigate('Batteries', { status: 'recycled' })} />
          <Kpi label="Low-stock parts" value={totals.lowStockParts} tone="violet" />
        </View>
      )}

      {/* Today's repairs */}
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Today's repairs</Text>
        <Text className="text-[11px] font-bold text-slate-400">{todays.length}</Text>
      </View>
      {!loading && todays.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
          <Icon name="wrench" color="#94a3b8" size={22} />
          <Text className="mt-2 text-sm font-semibold text-slate-800">No repairs logged today</Text>
          <Text className="mt-0.5 text-xs text-slate-400">Repairs appear here as technicians log parts.</Text>
        </View>
      ) : (
        <View className="gap-2">
          {todays.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => navigation.navigate('BatteryDetail', { code: r.batteryCode, fromScan: false })}
              className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-bold text-blue-700">{r.batteryCode}</Text>
                <Text className="text-xs text-slate-600" numberOfLines={1}>
                  {r.partName || 'Repair'} · {r.staffName || 'Staff'}
                </Text>
              </View>
              <Text className="text-[11px] text-slate-400">
                {r.repairedAt ? new Date(r.repairedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
