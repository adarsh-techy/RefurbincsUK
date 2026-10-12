import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { FilterBar } from '../../../components/admin/sa2/FilterBar';
import ReturnEditSheet from '../../../components/admin/sa2/ReturnEditSheet';
import { apiError, dateTime, Dialog, localYmd, openUpload, PageIntro, PrimaryButton, RowActions, useIsSuperAdmin } from '../../../components/admin/sa2/ui';

// "Return Battery" — the web ReturnsPage: every return dispatch (GET
// /returns) with truck, driver, client, battery count, date/time and the
// dispatch document; search by driver / truck and filter by return date
// (both on the phone, like the web). "+ Record Return" opens the dispatch
// form; super admins can Edit or Delete (batteries go back to "Repaired").
export default function ReturnsScreen() {
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
      const { data } = await apiClient.get('/returns');
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
      const matchesSearch = !q || r.driver_name?.toLowerCase().includes(q) || r.truck_number?.toLowerCase().includes(q);
      const matchesDate = !date || localYmd(r.returned_at) === date;
      return matchesSearch && matchesDate;
    });
  }, [rows, search, date]);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/returns/${deleteTarget.id}`);
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
        title="Return Battery"
        description="Repaired batteries dispatched back to the customer."
        action={<PrimaryButton small label="+ Record Return" onPress={() => navigation.navigate('AdminReturnCreate')} />}
      />
      <FilterBar searchLabel="Search driver / truck" search={search} onSearch={setSearch} dateLabel="Return date" date={date} onDate={setDate} />
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
              <Icon name="truck" color="#94a3b8" size={24} />
              <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading…' : 'No returns match these filters.'}</Text>
            </View>
          )
        }
        renderItem={({ item: r, index }) => {
          const received = r.status === 'verified' || Boolean(r.verified_at);
          return (
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-slate-400">#{index + 1}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('AdminReturnDetail', { id: r.id })}>
                    <Text className="text-base font-extrabold text-blue-700 underline">{r.truck_number}</Text>
                  </TouchableOpacity>
                </View>
                {/* mobile extra: whether the client has confirmed receipt */}
                <Text className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${received ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {received ? 'Received by client' : 'In transit'}
                </Text>
              </View>
              <View className="mt-2 gap-0.5">
                <Text className="text-xs text-slate-500">Driver: <Text className="font-semibold text-slate-800">{r.driver_name || '—'}</Text></Text>
                <Text className="text-xs text-slate-500">Client: <Text className="font-semibold text-slate-800">{r.client_name || '—'}</Text></Text>
                <Text className="text-xs text-slate-500">Batteries: <Text className="font-semibold text-slate-800">{r.battery_count ?? 0}</Text></Text>
                <Text className="text-xs text-slate-500">Date/Time: <Text className="font-semibold text-slate-800">{dateTime(r.returned_at)}</Text></Text>
                <View className="flex-row items-center">
                  <Text className="text-xs text-slate-500">Document: </Text>
                  {r.document_url ? (
                    <TouchableOpacity onPress={() => openUpload(r.document_url)}>
                      <Text className="text-xs font-semibold text-emerald-700 underline" numberOfLines={1}>📄 {r.document_name || 'View Note'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text className="text-xs text-slate-400">—</Text>
                  )}
                </View>
              </View>
              {isSuperAdmin ? (
                <View className="mt-3 flex-row justify-end">
                  <RowActions onEdit={() => setEditTarget(r)} onDelete={() => setDeleteTarget(r)} />
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <ReturnEditSheet
        record={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          load();
        }}
      />
      <Dialog
        visible={Boolean(deleteTarget)}
        title="Delete Return"
        message={`Delete return "${deleteTarget?.truck_number}"? Its batteries will go back to "Repaired" status.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}
