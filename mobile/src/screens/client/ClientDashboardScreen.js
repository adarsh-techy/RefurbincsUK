import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { StatusBadge, clientBatteryStatus } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { hasClientPermission } from '../../utils/permissions';

// Client dashboard — the same eight figures, in the same order and with the
// same destinations, as the web ClientDashboardPage (GET /clients/me/dashboard
// stats), plus the newest batteries and a prompt when a milestone certificate
// is waiting to be acknowledged.

function Card({ label, value, sub, cta, tone, onPress }) {
  const tones = {
    slate: ['border-slate-200 bg-white', 'text-slate-700', 'text-slate-500'],
    amber: ['border-amber-200 bg-amber-50/70', 'text-amber-800', 'text-amber-700'],
    blue: ['border-blue-200 bg-blue-50/70', 'text-blue-800', 'text-blue-700'],
    teal: ['border-teal-200 bg-teal-50/70', 'text-teal-800', 'text-teal-700'],
    emerald: ['border-emerald-200 bg-emerald-50/70', 'text-emerald-800', 'text-emerald-700'],
    rose: ['border-rose-200 bg-rose-50/70', 'text-rose-800', 'text-rose-700'],
    violet: ['border-violet-200 bg-violet-50/70', 'text-violet-800', 'text-violet-700'],
    sky: ['border-sky-200 bg-sky-50/70', 'text-sky-800', 'text-sky-700'],
  };
  const [box, strong, soft] = tones[tone] || tones.slate;
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.8} className={`w-[48%] rounded-2xl border p-3.5 ${box}`}>
      <Text className={`text-[10px] font-black uppercase tracking-wider ${soft}`}>{label}</Text>
      <Text className={`mt-1 text-2xl font-black ${strong}`}>{Number(value || 0).toLocaleString()}</Text>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className={`flex-1 text-[10px] ${soft}`} numberOfLines={1}>{sub}</Text>
        {cta ? <Text className={`text-[10px] font-bold ${strong}`}>{cta} ›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ClientDashboardScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [pendingCerts, setPendingCerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dash, batt, certs] = await Promise.all([
        apiClient.get('/clients/me/dashboard'),
        apiClient.get('/clients/me/batteries'),
        apiClient.get('/certificates/my-milestones').catch(() => ({ data: null })),
      ]);
      setData(dash.data);
      setRecent((batt.data?.data || []).slice(0, 5));
      setPendingCerts((certs.data?.unacknowledged || []).length);
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" size="large" />
        <Text className="mt-3 text-sm font-medium text-slate-500">Loading your client portal…</Text>
      </View>
    );
  }

  const { client, stats } = data || {};
  const n = (k) => Number(stats?.[k] || 0);
  const totalBatteries = n('battery_count');
  const awaitingIntake = n('awaiting_intake_count');
  const workshopQueue = n('workshop_queue_count');
  const repaired = n('repaired_count');
  const returned = n('returned_count');
  const unserviceable = n('unserviceable_count');
  const repairVisits = n('repair_visit_count');
  const returnedFromWorkshop = n('returned_from_workshop_count');
  const balanceOwed = n('balance');
  const can = (k) => hasClientPermission(user, k);
  const goBatteries = (bucket, status) => navigation.navigate('MyBatteries', { initialBucket: bucket, initialStatus: status });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Hero */}
      <View className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <Text className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Verified client portal</Text>
          </View>
          <Text className="text-[11px] font-medium text-slate-400">Live</Text>
        </View>
        <Text className="mt-2 text-2xl font-extrabold text-slate-900">Welcome, {client?.name || user?.name}</Text>
        <Text className="mt-1 text-xs leading-relaxed text-slate-500">Track your battery servicing, live workshop stages and return dispatches.</Text>
        <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Balance owed</Text>
            <Text className="text-xl font-black text-amber-800">£{balanceOwed.toFixed(2)}</Text>
          </View>
          {can('client_transactions') && (
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')} className="rounded-xl bg-amber-600 px-3 py-2">
              <Text className="text-xs font-bold text-white">Transactions ›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {pendingCerts > 0 && (
        <TouchableOpacity onPress={() => navigation.navigate('ClientCertificates')} className="flex-row items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <Icon name="award" color="#059669" size={22} />
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-emerald-800">New milestone certificate{pendingCerts === 1 ? '' : 's'} awarded</Text>
            <Text className="text-xs text-emerald-700">Tap to view and acknowledge.</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Eight stat cards — same as the web dashboard */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fleet overview</Text>
      <View className="flex-row flex-wrap justify-between gap-y-3">
        <Card label="Total batteries" value={totalBatteries} sub="All registered fleet" cta="View all" tone="slate" onPress={can('client_all_batteries') ? () => goBatteries('all') : null} />
        <Card label="On the way" value={awaitingIntake} sub="Traveling to workshop" cta="Inspect" tone="amber" onPress={can('client_packed') ? () => goBatteries('packed') : null} />
        <Card label="In workshop" value={workshopQueue} sub="Under diagnosis & repair" cta="Live queue" tone="blue" onPress={can('client_packed') ? () => goBatteries('packed') : null} />
        <Card label="Ready to return" value={repaired} sub="Repaired & tested" cta="View ready" tone="teal" onPress={can('client_all_batteries') ? () => goBatteries('all', 'repaired') : null} />
        <Card label="Working in fleet" value={returned} sub="Active in your vehicles" cta="View fleet" tone="emerald" onPress={can('client_all_batteries') ? () => goBatteries('all', 'returned') : null} />
        <Card label="Scrapped / recycled" value={unserviceable} sub="Unrepairable units" cta="History" tone="rose" onPress={can('client_all_batteries') ? () => goBatteries('all', 'unserviceable') : null} />
        <Card label="Total repairs done" value={repairVisits} sub="All-time completed jobs" cta="Timeline" tone="violet" onPress={() => navigation.navigate('ClientHistory')} />
        <Card label="Returned batteries" value={returnedFromWorkshop} sub="Received back from workshop" cta="View received" tone="sky" onPress={can('client_received') ? () => goBatteries('received') : null} />
      </View>

      {/* Pipeline */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Repair pipeline</Text>
      <View className="gap-2">
        {can('client_packed') && (
          <TouchableOpacity onPress={() => goBatteries('packed')} className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-white p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-100"><Icon name="package" color="#b45309" size={18} /></View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">Stage 1 · Battery packed to repair</Text>
              <Text className="text-[11px] text-slate-500">Packed at your site or on its way for workshop intake</Text>
            </View>
            <Text className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-900">{awaitingIntake + workshopQueue}</Text>
          </TouchableOpacity>
        )}
        {can('client_received') && (
          <TouchableOpacity onPress={() => goBatteries('received')} className="flex-row items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-100"><Icon name="checkCircle" color="#047857" size={18} /></View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">Stage 3 · Received back in fleet</Text>
              <Text className="text-[11px] text-slate-500">Confirm receipt and rate each return dispatch</Text>
            </View>
            <Text className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-900">{returnedFromWorkshop}</Text>
          </TouchableOpacity>
        )}
        {can('client_battery_sorting') && (
          <TouchableOpacity onPress={() => navigation.navigate('BatterySorting')} className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100"><Icon name="grid" color="#334155" size={18} /></View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">Sort batteries</Text>
              <Text className="text-[11px] text-slate-500">Group batteries by requirement before packing</Text>
            </View>
            <Icon name="arrowRight" color="#94a3b8" size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Recent batteries */}
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent fleet batteries</Text>
        {can('client_all_batteries') && (
          <TouchableOpacity onPress={() => goBatteries('all')}>
            <Text className="text-xs font-semibold text-blue-600">View all ({totalBatteries}) ›</Text>
          </TouchableOpacity>
        )}
      </View>
      {recent.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
          <Text className="text-xs text-slate-400">No batteries registered yet.</Text>
        </View>
      ) : (
        <View className="gap-2">
          {recent.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false })} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5">
              <View>
                <Text className="text-sm font-bold text-blue-700">{item.battery_code}</Text>
                <Text className="text-[11px] text-slate-500">{item.serial_number ? `SN ${item.serial_number}` : 'No serial'}</Text>
              </View>
              <StatusBadge status={clientBatteryStatus(item)} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
