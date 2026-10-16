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
      contentContainerClassName="p-3 gap-3 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} className="self-start">
        <Text className="text-xs font-bold text-violet-700">‹ Back to Return Dispatches</Text>
      </TouchableOpacity>

      {error || !record ? (
        <Text className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {error || 'Return dispatch not found'}
        </Text>
      ) : (
        <>
          {/* Executive Header Card */}
          <View className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs gap-2.5">
            <View className="flex-row items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <View className="flex-1">
                <Text className="text-lg font-black text-slate-900">
                  <Text className="font-normal text-slate-400">Truck</Text> {record.truck_number}
                </Text>
              </View>
              <View className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-violet-700">Dispatch #{record.id}</Text>
              </View>
            </View>

            <View className="gap-1.5">
              <Field label="Driver" value={record.driver_name} />
              {record.client_name ? <Field label="Client" value={record.client_name} /> : null}
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Field label="Date" value={dateOnly(record.returned_at)} />
                </View>
                <View className="flex-1">
                  <Field label="Time" value={timeOnly(record.returned_at)} />
                </View>
              </View>
              {record.document_url ? (
                <View className="flex-row items-center gap-2 mt-1">
                  <Text className="text-xs text-slate-500">Document:</Text>
                  <TouchableOpacity
                    onPress={() => openUpload(record.document_url)}
                    className="flex-row items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1"
                  >
                    <Text className="text-[11px] font-bold text-emerald-800" numberOfLines={1}>
                      📄 {record.document_name || 'View Dispatch Note'} ↓
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

          {/* Stats Row */}
          <View className="flex-row gap-2">
            <StatTile label="Batteries Shipped" value={record.battery_count} tone="blue" />
            <StatTile label="Confirmed Returned" value={returnedCount} tone="emerald" />
          </View>

          {/* Batteries Section */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Batteries In This Return
              </Text>
              <Text className="text-[11px] font-medium text-slate-400">
                {batteries.length} {batteries.length === 1 ? 'unit' : 'units'}
              </Text>
            </View>

            {batteries.length === 0 ? (
              <View className="items-center rounded-2xl border border-slate-200/90 bg-white p-6">
                <Text className="text-xs text-slate-400">No batteries recorded for this return.</Text>
              </View>
            ) : null}

            {batteries.map((b, i) => (
              <View key={b.id || b.battery_code} className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-1.5 min-w-0">
                    <Text className="text-[10px] font-semibold text-slate-400">#{i + 1}</Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })}
                    >
                      <Text className="font-mono text-xs font-extrabold text-violet-700 underline">
                        {b.battery_code}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <StatusBadge status={b.status} />
                </View>

                <View className="mt-2 border-t border-slate-100 pt-1.5">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service Performed</Text>
                  <Text className="text-xs text-slate-700 mt-0.5">
                    {b.last_repaired_at ? dateOnly(b.last_repaired_at) : '—'}
                    {b.last_repaired_at && b.last_repaired_parts ? (
                      <Text className="text-slate-400"> · {b.last_repaired_parts}</Text>
                    ) : null}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
