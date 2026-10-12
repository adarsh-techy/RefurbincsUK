import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import ShipmentRow, { formatDateTime } from '../../components/recycle/ShipmentRow';
import DateField from '../../components/ui/DateField';

// Recycling partner (role recycle_client) shipments — mirrors the web
// RecycleClientShipmentsPage: GET /recycle-client/me/shipments → { data },
// searched by driver / vehicle and filtered by the received date. Tap a
// shipment for its batteries (GET /recycle/:id, scoped to the partner's own
// batches by the backend).

// YYYY-MM-DD in the phone's own timezone, like the web date input
function localDateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const input = 'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900';

export default function RecycleShipmentsScreen() {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/recycle-client/me/shipments');
      setRows(data?.data || data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : '';
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        row.driver_name?.toLowerCase().includes(q) ||
        row.vehicle_number?.toLowerCase().includes(q);
      const matchesDate = !day || localDateKey(row.recycled_at) === day;
      return matchesSearch && matchesDate;
    });
  }, [rows, search, date]);

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      data={loading || error ? [] : filtered}
      keyExtractor={(r) => String(r.id)}
      contentContainerClassName="p-4 gap-2.5 pb-16"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View className="mb-2 gap-3">
          <View>
            <Text className="text-xl font-extrabold text-slate-900">Recycle Shipments</Text>
            <Text className="text-xs text-slate-500">All unserviceable battery shipments dispatched to your facility.</Text>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by driver or vehicle..."
            placeholderTextColor="#94a3b8"
            className={input}
          />
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <DateField value={date} onChange={setDate} quick={false} clearable={false} />
            </View>
            <TouchableOpacity onPress={() => setDate(localDateKey(new Date()))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5">
              <Text className="text-xs font-semibold text-slate-700">Today</Text>
            </TouchableOpacity>
          </View>
          {(search || date) ? (
            <TouchableOpacity onPress={() => { setSearch(''); setDate(''); }} className="self-start">
              <Text className="text-xs font-medium text-slate-500">Clear filters</Text>
            </TouchableOpacity>
          ) : null}
          {error && (
            <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
              <Text className="text-xs font-semibold text-red-700">{error}</Text>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Text className="py-6 text-center text-sm text-slate-500">Loading shipments…</Text>
        ) : error ? null : (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Text className="text-sm text-slate-500">No recycle shipments match your filter criteria.</Text>
          </View>
        )
      }
      renderItem={({ item: r, index }) => (
        <ShipmentRow
          row={r}
          index={index + 1}
          dateLabel="Received At"
          dateValue={formatDateTime(r.recycled_at)}
          linkLabel="View shipment →"
          onPress={() => navigation.navigate('AdminRecycleDetail', { id: r.id })}
        />
      )}
    />
  );
}
