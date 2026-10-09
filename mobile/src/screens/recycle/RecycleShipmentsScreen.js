import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

// Recycling partner (role recycle_client) home — the shipments delivered to
// them (GET /recycle-client/me/shipments → { data: batches }). Mirrors the
// web Recycle Shipments page; no actions, it's a record of what was received.

function formatDate(v) {
  return v ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export default function RecycleShipmentsScreen() {
  const user = useSelector((s) => s.auth.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/recycle-client/me/shipments');
      setRows(data.data || []);
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

  const totalBatteries = rows.reduce((s, r) => s + (Number(r.battery_count) || 0), 0);
  const totalWeight = rows.reduce((s, r) => s + (Number(r.total_weight_kg) || 0), 0);

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      data={rows}
      keyExtractor={(r) => String(r.id)}
      contentContainerClassName="p-4 gap-2.5 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View className="mb-2 gap-3">
          <View className="rounded-3xl border border-slate-200 bg-white p-4">
            <Text className="text-lg font-extrabold text-slate-900" numberOfLines={1}>{user?.name || 'Recycling partner'}</Text>
            <Text className="text-xs text-slate-500">Recycle shipments received from the workshop</Text>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Shipments</Text>
                <Text className="text-xl font-black text-emerald-700">{rows.length}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Batteries</Text>
                <Text className="text-xl font-black text-blue-700">{totalBatteries}</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Weight</Text>
                <Text className="text-xl font-black text-slate-700">{totalWeight ? `${totalWeight.toFixed(0)}kg` : '—'}</Text>
              </View>
            </View>
          </View>
          {error && (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
              <Text className="text-xs font-semibold text-red-700">{error}</Text>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
          <Icon name="package" color="#94a3b8" size={24} />
          <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading shipments…' : 'No shipments yet'}</Text>
        </View>
      }
      renderItem={({ item: r }) => (
        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-extrabold text-slate-900">Vehicle {r.vehicle_number || `#${r.id}`}</Text>
            <Text className="text-[11px] font-semibold text-slate-400">{formatDate(r.recycled_at)}</Text>
          </View>
          <Text className="mt-0.5 text-xs text-slate-600">Driver: {r.driver_name || '—'}</Text>
          <View className="mt-3 flex-row gap-4">
            <View>
              <Text className="text-[10px] font-bold uppercase text-slate-400">Batteries</Text>
              <Text className="text-sm font-bold text-slate-800">{r.battery_count || 0}</Text>
            </View>
            <View>
              <Text className="text-[10px] font-bold uppercase text-slate-400">Weight</Text>
              <Text className="text-sm font-bold text-slate-800">{r.total_weight_kg ? `${Number(r.total_weight_kg).toFixed(1)} kg` : '—'}</Text>
            </View>
            {r.price_per_kg && r.total_weight_kg ? (
              <View>
                <Text className="text-[10px] font-bold uppercase text-slate-400">Value</Text>
                <Text className="text-sm font-bold text-emerald-700">£{(Number(r.total_weight_kg) * Number(r.price_per_kg)).toFixed(2)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}
