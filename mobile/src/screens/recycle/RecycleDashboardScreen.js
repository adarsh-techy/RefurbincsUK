import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import ShipmentRow, { formatDate } from '../../components/recycle/ShipmentRow';

// Recycling partner (role recycle_client) dashboard — mirrors the web
// RecycleClientDashboardPage: GET /recycle-client/me/dashboard →
// { client, stats: { shipment_count, total_batteries, latest_shipment_at }, recentShipments }.

function Stat({ label, value, tone }) {
  return (
    <View className={`flex-1 rounded-2xl border p-3 ${tone}`}>
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-1 text-lg font-black text-slate-900" numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function RecycleDashboardScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: result } = await apiClient.get('/recycle-client/me/dashboard');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { client, stats, recentShipments } = data || {};
  const openShipment = (id) => navigation.navigate('AdminRecycleDetail', { id });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 gap-3 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View>
        <Text className="text-xl font-extrabold text-slate-900">Welcome, {client?.name || 'Recycle Partner'}</Text>
        <Text className="text-xs text-slate-500">Overview of unserviceable battery recycling shipments assigned to you.</Text>
      </View>

      {loading && !data ? (
        <Text className="py-6 text-center text-sm text-slate-500">Loading…</Text>
      ) : error ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-2">
            <Stat label="Total Shipments" value={stats?.shipment_count || 0} tone="border-blue-200 bg-blue-50/70" />
            <Stat label="Total Batteries Received" value={stats?.total_batteries || 0} tone="border-emerald-200 bg-emerald-50/70" />
          </View>
          <Stat
            label="Latest Shipment"
            value={stats?.latest_shipment_at ? formatDate(stats.latest_shipment_at) : 'None'}
            tone="border-amber-200 bg-amber-50/70"
          />

          <View className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Recent Recycle Shipments</Text>
                <Text className="text-xs text-slate-500">The latest battery batches transferred to your facility.</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Shipments')} hitSlop={8}>
                <Text className="text-xs font-semibold text-emerald-700">View all shipments →</Text>
              </TouchableOpacity>
            </View>
            <View className="mt-3 gap-2.5">
              {(recentShipments || []).length === 0 ? (
                <Text className="py-4 text-center text-xs text-slate-500">No recycle shipments recorded for your account yet.</Text>
              ) : (
                recentShipments.map((row) => (
                  <ShipmentRow
                    key={row.id}
                    row={row}
                    dateLabel="Date Received"
                    dateValue={formatDate(row.recycled_at)}
                    linkLabel="View Details →"
                    onPress={() => openShipment(row.id)}
                  />
                ))
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
