import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { BackLink, ErrorBox, errMessage, money, Stat } from '../../../components/admin/sa3/ui';

// A fleet client's page — the web ClientDetailPage: status breakdown across
// their batteries, client since, the Milestone & ESG link, Total Batteries /
// Repair Visits / Balance, and (super admin) the full Billing History.
// route.params: { id, row? }

const STATUS_BREAKDOWN = [
  { key: 'in_repair_count', label: 'Awaiting Repair', dot: 'bg-amber-500' },
  { key: 'in_progress_count', label: 'Repair In Progress', dot: 'bg-red-500' },
  { key: 'in_testing_count', label: 'In Testing', dot: 'bg-blue-500' },
  { key: 'repaired_count', label: 'Repair Completed', dot: 'bg-emerald-500' },
  { key: 'registered_count', label: 'Registered (Not Serviced)', dot: 'bg-slate-400' },
  { key: 'returned_count', label: 'Returned to Client', dot: 'bg-sky-500' },
];

export default function ClientDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const id = route.params?.id;
  const me = useSelector((s) => s.auth.user);
  const isSuperAdmin = me?.role === 'super_admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/clients/${id}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const client = data?.client || route.params?.row;
  useLayoutEffect(() => {
    navigation.setOptions({ title: client?.name || 'Client' });
  }, [navigation, client?.name]);

  if (loading && !data) {
    return <View className="flex-1 items-center justify-center bg-slate-50"><Text className="text-xs text-slate-400">Loading…</Text></View>;
  }

  if (error && !data) {
    return (
      <View className="flex-1 gap-4 bg-slate-50 p-4">
        <BackLink label="Back to Clients" onPress={() => navigation.goBack()} />
        <ErrorBox message={error} />
      </View>
    );
  }

  const stats = data.stats || {};
  const transactions = data.transactions || [];
  const description = client.invoice_email
    ? `Invoice Email: ${client.invoice_email}${client.login_email ? ` • Login: ${client.login_email}` : ''}`
    : client.login_email
      ? `Login: ${client.login_email}`
      : 'No login access';

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <BackLink label="Back to Clients" onPress={() => navigation.goBack()} />

      <View>
        <Text className="text-2xl font-bold text-slate-900">{client.name}</Text>
        <Text className="mt-0.5 text-xs text-slate-500">{description}</Text>
      </View>

      <View className="rounded-2xl border border-l-4 border-slate-200 border-l-emerald-500 bg-emerald-50/60 p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100">
            <Icon name="user" color="#047857" size={20} />
          </View>
          <View className="flex-1">
            <View className="flex-row flex-wrap gap-x-3 gap-y-1.5">
              {STATUS_BREAKDOWN.map((s) => (
                <View key={s.key} className="flex-row items-center gap-1.5">
                  <View className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  <Text className="text-xs font-medium text-slate-600">
                    {s.label}: <Text className="font-bold text-slate-900">{Number(stats[s.key] || 0)}</Text>
                  </Text>
                </View>
              ))}
            </View>
            <Text className="mt-1.5 text-xs text-slate-500">
              Client since {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminCertificateClient', { id: client.id, name: client.name })}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5"
        >
          <Text className="text-xs font-bold text-white">🏆 Milestone &amp; ESG Impact</Text>
          <Text className="text-xs font-bold text-white">→</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Stat label="Total Batteries" value={Number(stats.battery_count || 0)} tone="good" />
        <Stat label="Repair Visits" value={Number(stats.repair_visit_count || 0)} tone="info" />
        {isSuperAdmin && <Stat label="Balance" value={money(stats.balance)} tone="warn" />}
      </View>

      {/* phone extra: jump to this client's batteries in the fleet list */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Batteries', { search: client.name, status: '' })}
        className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5"
      >
        <Text className="text-sm font-bold text-slate-800">View this client's batteries</Text>
        <Icon name="arrowRight" color="#94a3b8" size={16} />
      </TouchableOpacity>

      {isSuperAdmin && (
        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="mb-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Billing History</Text>
          {transactions.length === 0 ? (
            <Text className="py-6 text-center text-sm text-slate-500">No repair charges logged for this client yet.</Text>
          ) : (
            transactions.map((t, i) => {
              const label = t.charge_type === 'service' ? 'Service / Fee:' : (t.part_name || '').includes(',') ? 'Parts:' : 'Part:';
              return (
                <View key={t.id || t.batch_id || i} className={`flex-row gap-3 py-3.5 ${i ? 'border-t border-slate-100' : ''}`}>
                  <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                    <Icon name="card" color="#047857" size={14} />
                  </View>
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: t.battery_code, fromScan: false })}>
                          <Text className="font-mono text-sm font-medium text-blue-700">{t.battery_code}</Text>
                        </TouchableOpacity>
                        {t.battery_status === 'unserviceable' && (
                          <View className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5">
                            <Text className="text-[10px] font-bold text-rose-700">Unserviceable</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-xs text-slate-400">{t.repaired_at ? new Date(t.repaired_at).toLocaleString() : ''}</Text>
                    </View>
                    <Text className="text-xs text-slate-500">
                      {label} <Text className="font-semibold text-emerald-700">{t.part_name || t.description || 'Service Fee'}</Text>
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-slate-500">By <Text className="font-semibold text-slate-700">{t.staff_name}</Text></Text>
                      <Text className="text-sm font-bold text-pink-800">{money(t.amount)}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}
