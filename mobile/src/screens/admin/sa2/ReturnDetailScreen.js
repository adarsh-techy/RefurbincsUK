import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { StatusBadge } from '../../../components/ui/Badge';
import { apiError, dateOnly, Field, openUpload, StatTile, timeOnly } from '../../../components/admin/sa2/ui';

// Return detail — the web ReturnDetailPage: truck, driver, client, date,
// time and the return document, "Batteries Shipped" / "Confirmed Returned",
// and each battery with the service it had before shipping and its status.
// route.params: { id }
export default function ReturnDetailScreen() {
  const navigation = useNavigation();
  const { id } = useRoute().params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/returns/${id}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const record = data?.returnRecord;
  const batteries = data?.batteries || [];
  const returnedCount = batteries.filter((b) => b.status === 'returned').length;

  useLayoutEffect(() => {
    navigation.setOptions({ title: record?.truck_number ? `Truck ${record.truck_number}` : 'Return Dispatch' });
  }, [navigation, record?.truck_number]);

  if (loading) return <Text className="flex-1 bg-slate-50 p-8 text-center text-sm text-slate-500">Loading…</Text>;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 gap-4 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-xs font-semibold text-emerald-700">‹ Back to Returns</Text>
      </TouchableOpacity>

      {error || !record ? (
        <Text className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error || 'Return not found'}</Text>
      ) : (
        <>
          <View className="gap-2">
            <Text className="text-xl font-black text-slate-900"><Text className="font-normal text-slate-400">Truck</Text> {record.truck_number}</Text>
            <Field label="Driver" value={record.driver_name} />
            {record.client_name ? <Field label="Client" value={record.client_name} /> : null}
            <Field label="Date" value={dateOnly(record.returned_at)} />
            <Field label="Time" value={timeOnly(record.returned_at)} />
            {record.document_url ? (
              <View className="flex-row items-center">
                <Text className="text-xs text-slate-500">Document: </Text>
                <TouchableOpacity onPress={() => openUpload(record.document_url)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1">
                  <Text className="text-xs font-semibold text-emerald-700">📄 {record.document_name || 'View Return Document'} ↓</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View className="flex-row gap-2">
            <StatTile label="Batteries Shipped" value={record.battery_count} tone="blue" />
            <StatTile label="Confirmed Returned" value={returnedCount} tone="emerald" />
          </View>

          <Text className="text-sm font-semibold text-slate-800">Batteries In This Return</Text>
          <View className="gap-2">
            {batteries.length === 0 ? (
              <Text className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">No batteries recorded for this return.</Text>
            ) : null}
            {batteries.map((b, i) => (
              <View key={b.id || b.battery_code} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-slate-400">#{i + 1}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })}>
                      <Text className="font-mono text-sm font-bold text-blue-700 underline">{b.battery_code}</Text>
                    </TouchableOpacity>
                  </View>
                  <StatusBadge status={b.status} />
                </View>
                <Text className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Service Performed</Text>
                <Text className="text-xs text-slate-700">
                  {b.last_repaired_at ? dateOnly(b.last_repaired_at) : '—'}
                  {b.last_repaired_at && b.last_repaired_parts ? <Text className="text-slate-400"> · {b.last_repaired_parts}</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
