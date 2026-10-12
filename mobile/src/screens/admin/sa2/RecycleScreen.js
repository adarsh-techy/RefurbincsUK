import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { FilterBar } from '../../../components/admin/sa2/FilterBar';
import RecycleEditSheet from '../../../components/admin/sa2/RecycleEditSheet';
import { apiError, dateTime, Dialog, localYmd, money, PageIntro, PrimaryButton, RowActions, useIsSuperAdmin } from '../../../components/admin/sa2/ui';

// "Recycle" — the web RecyclePage: every recycle shipment (GET /recycle)
// with vehicle, driver, battery count and date/time; search by driver /
// vehicle and filter by recycled date. "+ Record Recycle" opens the
// shipment form; super admins can Edit or Delete (batteries go back to
// "Unserviceable").
export default function RecycleScreen() {
  const navigation = useNavigation();
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/recycle');
      setRows(Array.isArray(data) ? data : data?.data || []);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || r.driver_name?.toLowerCase().includes(q) || r.vehicle_number?.toLowerCase().includes(q);
      const matchesDate = !date || localYmd(r.recycled_at) === date;
      return matchesSearch && matchesDate;
    });
  }, [rows, search, date]);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/recycle/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(apiError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const header = (
    <View className="gap-3 pb-1">
      <PageIntro
        title="Recycle"
        description="Unserviceable batteries shipped out for recycling."
        action={<PrimaryButton small label="+ Record Recycle" onPress={() => navigation.navigate('AdminRecycleCreate')} />}
      />
      <FilterBar searchLabel="Search driver / vehicle" search={search} onSearch={setSearch} dateLabel="Recycled date" date={date} onDate={setDate} />
      {deleteError ? <Text className="text-sm font-semibold text-red-600">{deleteError}</Text> : null}
      {error ? <Text className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</Text> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={error ? [] : filtered}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          error ? null : (
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
              <Icon name="package" color="#94a3b8" size={24} />
              <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading…' : 'No recycle shipments match these filters.'}</Text>
            </View>
          )
        }
        renderItem={({ item: r, index }) => (
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="text-[10px] font-bold text-slate-400">#{index + 1}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdminRecycleDetail', { id: r.id })}>
              <Text className="text-base font-extrabold text-blue-700 underline">{r.vehicle_number}</Text>
            </TouchableOpacity>
            <View className="mt-2 gap-0.5">
              <Text className="text-xs text-slate-500">Driver: <Text className="font-semibold text-slate-800">{r.driver_name || '—'}</Text></Text>
              <Text className="text-xs text-slate-500">Batteries: <Text className="font-semibold text-slate-800">{r.battery_count ?? 0}</Text></Text>
              <Text className="text-xs text-slate-500">Date/Time: <Text className="font-semibold text-slate-800">{dateTime(r.recycled_at)}</Text></Text>
              {/* mobile extra: partner + payout, as the old list showed */}
              {r.recycle_client_name ? <Text className="text-xs text-slate-500">Partner: <Text className="font-semibold text-slate-800">{r.recycle_client_name}</Text></Text> : null}
              {r.total_weight_kg ? (
                <Text className="text-xs text-slate-500">
                  Weight: <Text className="font-semibold text-slate-800">{Number(r.total_weight_kg).toFixed(1)} kg · {money(Number(r.total_weight_kg) * Number(r.price_per_kg || 0))}</Text>
                </Text>
              ) : null}
            </View>
            {isSuperAdmin ? (
              <View className="mt-3 flex-row justify-end">
                <RowActions onEdit={() => setEditTarget(r)} onDelete={() => setDeleteTarget(r)} />
              </View>
            ) : null}
          </View>
        )}
      />

      <RecycleEditSheet
        batch={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          load();
        }}
      />
      <Dialog
        visible={Boolean(deleteTarget)}
        title="Delete Recycle Shipment"
        message={`Delete recycle shipment "${deleteTarget?.vehicle_number}"? Its batteries will go back to "Unserviceable" status.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}
