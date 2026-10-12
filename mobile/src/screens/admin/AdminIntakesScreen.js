import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { FilterBar } from '../../components/admin/sa2/FilterBar';
import TruckVerifyModal from '../../components/admin/sa2/TruckVerifyModal';
import IntakeEditSheet from '../../components/admin/sa2/IntakeEditSheet';
import { apiError, dateTime, Dialog, PageIntro, RowActions, useIsSuperAdmin } from '../../components/admin/sa2/ui';

// "Intake Battery" — the web TruckIntakePage on the phone. GET
// /truck-intakes (paged { data, hasMore }, ?search= driver/truck, ?date=);
// each truck shows driver, client, battery count, arrival status with "Scan
// to Verify →" while it's pending, and the intake time. Super admins also get
// Edit (truck/driver/client) and Delete. Tapping the truck opens its detail.
// Needs the 'truck_intakes' permission (super_admin always has it).

const PAGE = 15;
const DEBOUNCE_MS = 350;

export default function AdminIntakesScreen() {
  const navigation = useNavigation();
  const isSuperAdmin = useIsSuperAdmin();

  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  const fetchPage = useCallback(async (offset, replace) => {
    const reqId = ++requestRef.current;
    try {
      const params = { limit: PAGE, offset };
      if (search.trim()) params.search = search.trim();
      if (date) params.date = date;
      const { data } = await apiClient.get('/truck-intakes', { params });
      if (reqId !== requestRef.current) return;
      setRows((prev) => (replace ? data.data || [] : [...prev, ...(data.data || [])]));
      setHasMore(Boolean(data.hasMore));
      setError(null);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setError(apiError(err));
    } finally {
      if (reqId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [search, date]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => fetchPage(0, true), search ? DEBOUNCE_MS : 0);
    return () => clearTimeout(debounceRef.current);
  }, [fetchPage, search]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      fetchPage(0, true);
    }, [fetchPage])
  );

  const refetch = () => fetchPage(0, true);

  function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    fetchPage(rows.length, false);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/truck-intakes/${deleteTarget.id}`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(apiError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const header = (
    <View className="gap-3 pb-1">
      <PageIntro title="Intake Battery" description="Batteries delivered by truck for repair." />
      <FilterBar
        searchLabel="Search driver / truck"
        search={search}
        onSearch={setSearch}
        dateLabel="Intake date"
        date={date}
        onDate={setDate}
      />
      {error ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={error ? [] : rows}
        keyExtractor={(t) => String(t.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          error ? null : (
            <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
              <Icon name="truck" color="#94a3b8" size={24} />
              <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading…' : 'No intakes match these filters.'}</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
        renderItem={({ item: t, index }) => {
          const pending = t.status === 'pending_arrival';
          return (
            <View className={`rounded-2xl border bg-white p-4 ${pending ? 'border-amber-300' : 'border-slate-200'}`}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-slate-400">#{index + 1}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('AdminIntakeDetail', { id: t.id })}>
                    <Text className="font-mono text-base font-extrabold text-blue-700 underline">{t.truck_number}</Text>
                  </TouchableOpacity>
                </View>
                {pending ? (
                  <Text className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">● Pending Arrival</Text>
                ) : (
                  <Text className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">✓ Arrived & Verified</Text>
                )}
              </View>
              <View className="mt-2 gap-0.5">
                <Text className="text-xs text-slate-500">Driver: <Text className="font-semibold text-slate-800">{t.driver_name || '—'}</Text></Text>
                <Text className="text-xs text-slate-500">Client: <Text className="font-semibold text-slate-800">{t.client_name || '—'}</Text></Text>
                <Text className="text-xs text-slate-500">Batteries: <Text className="font-semibold text-slate-800">{t.battery_count ?? 0}</Text></Text>
                <Text className="text-xs text-slate-500">Date/Time: <Text className="font-semibold text-slate-800">{dateTime(t.intake_at)}</Text></Text>
              </View>
              {pending || isSuperAdmin ? (
                <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
                  {pending ? (
                    <TouchableOpacity onPress={() => setVerifyTarget(t)} className="rounded-lg bg-emerald-600 px-3 py-2">
                      <Text className="text-xs font-bold text-white">Scan to Verify →</Text>
                    </TouchableOpacity>
                  ) : <View />}
                  {isSuperAdmin ? <RowActions onEdit={() => setEditTarget(t)} onDelete={() => setDeleteTarget(t)} /> : null}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <TruckVerifyModal
        visible={Boolean(verifyTarget)}
        intakeId={verifyTarget?.id}
        onClose={() => setVerifyTarget(null)}
        onSuccess={() => {
          setVerifyTarget(null);
          refetch();
        }}
        onInspect={(code) => {
          setVerifyTarget(null);
          navigation.navigate('BatteryDetail', { code, fromScan: false });
        }}
      />

      <IntakeEditSheet
        intake={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          refetch();
        }}
      />

      <Dialog
        visible={Boolean(deleteTarget)}
        title="Delete Truck Intake"
        message={`Delete truck intake "${deleteTarget?.truck_number}"?`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <Dialog
        visible={Boolean(deleteError)}
        title="Cannot Delete Intake"
        message={deleteError}
        confirmLabel="OK"
        cancelLabel={null}
        onConfirm={() => setDeleteError(null)}
        onCancel={() => setDeleteError(null)}
      />
    </View>
  );
}
