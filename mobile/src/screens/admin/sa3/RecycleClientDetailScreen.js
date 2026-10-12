import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { BackLink, ErrorBox, errMessage, SearchBox, Stat } from '../../../components/admin/sa3/ui';

// A recycling partner's page — the web RecycleClientDetailPage: hero card
// (Portal Login, Partner Since, Account ID), Shipments Dispatched / Total
// Batteries Received / Avg Units per Shipment, and the searchable list of
// assigned shipments (each opens the recycle shipment).
// route.params: { id, row? }

export default function RecycleClientDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const id = route.params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

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

  const client = data?.client;
  const shipments = data?.shipments || [];
  const stats = data?.stats || { shipment_count: 0, battery_count: 0 };

  useLayoutEffect(() => {
    navigation.setOptions({ title: client?.name || route.params?.row?.name || 'Recycle Client' });
  }, [navigation, client?.name, route.params?.row?.name]);

  const avgPerShipment = !stats.shipment_count ? '0' : (stats.battery_count / stats.shipment_count).toFixed(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter((s) => s.vehicle_number?.toLowerCase().includes(q) || s.driver_name?.toLowerCase().includes(q));
  }, [shipments, search]);

  if (loading && !data) {
    return <View className="flex-1 items-center justify-center bg-slate-50"><Text className="text-xs text-slate-400">Loading recycle client details…</Text></View>;
  }

  if (!client) {
    return (
      <View className="flex-1 gap-4 bg-slate-50 p-4">
        <BackLink label="Back to Recycle Clients" onPress={() => navigation.goBack()} />
        <ErrorBox message={error || 'Recycle client not found'} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <BackLink label="Back to Recycle Clients" onPress={() => navigation.goBack()} />

      <View className="rounded-2xl border border-slate-200 bg-white p-4">
        <View className="flex-row items-start gap-3.5">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600">
            <Text className="text-xl">🏢</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-slate-900">{client.name}</Text>
            <View className="mt-1 flex-row items-center gap-1.5 self-start rounded-full bg-emerald-50 px-2.5 py-0.5">
              <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <Text className="text-xs font-bold text-emerald-700">Recycle Client Partner</Text>
            </View>
            <Text className="mt-1 text-xs text-slate-500">Authorized recycling facility receiving unserviceable battery dispatches</Text>
          </View>
        </View>
        <View className="mt-4 flex-row flex-wrap gap-y-3 border-t border-slate-200 pt-3">
          <View className="w-1/2">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Portal Login</Text>
            <Text className="mt-0.5 font-mono text-xs font-bold text-slate-800" selectable>{client.login_email ? `✉️ ${client.login_email}` : 'No login account'}</Text>
          </View>
          <View className="w-1/2">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partner Since</Text>
            <Text className="mt-0.5 text-xs font-bold text-slate-800">📅 {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}</Text>
          </View>
          <View className="w-1/2">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Account ID</Text>
            <Text className="mt-0.5 font-mono text-xs font-bold text-slate-800">#{client.id}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Stat label="🚚 Shipments Dispatched" value={stats.shipment_count} tone="info" />
        <Stat label="🔋 Total Batteries Received" value={stats.battery_count} tone="good" />
        <Stat label="📊 Avg Units / Shipment" value={avgPerShipment} />
      </View>

      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <View>
          <Text className="text-sm font-bold uppercase tracking-wider text-slate-900">Assigned Shipments ({filtered.length})</Text>
          <Text className="text-[11px] text-slate-500">All vehicle runs dispatched to this recycling partner</Text>
        </View>
        <SearchBox value={search} onChangeText={setSearch} placeholder="Search vehicle or driver..." />
        {filtered.length === 0 ? (
          <Text className="py-6 text-center text-xs text-slate-500">No shipments recorded for this recycling partner yet.</Text>
        ) : (
          filtered.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => navigation.navigate('AdminDetail', { kind: 'recycle', id: s.id })}
              className="rounded-xl border border-slate-200 p-3"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[11px] text-slate-400">{i + 1}.</Text>
                  <View className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <Text className="font-mono text-sm font-bold text-blue-700">{s.vehicle_number}</Text>
                </View>
                <View className="rounded-md bg-emerald-50 px-2.5 py-1">
                  <Text className="text-xs font-bold text-emerald-800">📦 {s.battery_count} units</Text>
                </View>
              </View>
              <Text className="mt-1 text-xs font-medium text-slate-800">👤 {s.driver_name}</Text>
              <Text className="mt-0.5 text-xs text-slate-600">Dispatched {s.recycled_at ? new Date(s.recycled_at).toLocaleString() : '—'}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
