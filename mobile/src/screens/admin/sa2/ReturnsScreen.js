import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import DateField from '../../../components/admin/DateField';
import ReturnEditSheet from '../../../components/admin/sa2/ReturnEditSheet';
import { apiError, dateTime, Dialog, localYmd, openUpload, useIsSuperAdmin } from '../../../components/admin/sa2/ui';

// "Return Dispatch" — the mobile version of the web ReturnsPage:
// Outbound dispatches (GET /returns) with truck, driver, client, battery count,
// date/time and the dispatch document. Search by driver / truck / client and filter by date.
// "+ Record" opens the dispatch form; super admins can Edit or Delete.
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

  const totalBatteries = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.battery_count) || 0), 0),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.driver_name?.toLowerCase().includes(q) ||
        r.truck_number?.toLowerCase().includes(q) ||
        r.client_name?.toLowerCase().includes(q);
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
    <View className="gap-2.5 pb-1">
      {/* Executive Header Card */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-lg font-extrabold text-slate-900">Return Dispatch</Text>
              <View className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-violet-700">Outbound</Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-slate-500">Repaired batteries dispatched back to clients</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdminReturnCreate')}
            className="flex-row items-center gap-1 rounded-lg bg-violet-700 px-3 py-1.5 shadow-xs"
          >
            <Text className="text-xs font-bold text-white">+ Record</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-2.5 flex-row items-center gap-2 border-t border-slate-100 pt-2.5 flex-wrap">
          <View className="flex-row items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1">
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Text className="text-[11px] font-semibold text-emerald-800">
              Dispatches: <Text className="font-extrabold text-emerald-950">{rows.length}</Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1">
            <Text className="text-[11px] font-semibold text-violet-800">
              Batteries: <Text className="font-extrabold text-violet-950">{totalBatteries.toLocaleString()}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Bar */}
      <View className="gap-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5">
          <Icon name="search" color="#94a3b8" size={13} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search driver, truck #, or client…"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="min-w-0 flex-1 py-0.5 text-xs text-slate-900"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" color="#64748b" size={13} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <DateField label="Return Date" value={date} onChange={setDate} />
          </View>
          {search || date ? (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setDate('');
              }}
              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 self-end"
            >
              <Text className="text-xs font-bold text-rose-600">Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {deleteError ? (
        <Text className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          {deleteError}
        </Text>
      ) : null}
      {error ? (
        <Text className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
          {error}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={error ? [] : filtered}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-3 gap-2 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          error ? null : (
            <View className="items-center rounded-2xl border border-slate-200/90 bg-white p-8">
              <Icon name="truck" color="#94a3b8" size={24} />
              <Text className="mt-2 text-xs font-semibold text-slate-800">
                {loading ? 'Loading…' : 'No returns match these filters.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item: r, index }) => {
          const received = r.status === 'verified' || Boolean(r.verified_at);
          return (
            <View className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
              {/* Header: Index, Truck, Status Badge */}
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-1.5 min-w-0">
                  <Text className="text-[10.5px] font-semibold text-slate-400">#{index + 1}</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AdminReturnDetail', { id: r.id })}
                    className="flex-shrink"
                  >
                    <Text className="font-mono text-sm font-extrabold text-violet-700 underline" numberOfLines={1}>
                      {r.truck_number}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className={`flex-row items-center gap-1 rounded-md px-2 py-0.5 border ${
                  received ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                }`}>
                  <View className={`h-1.5 w-1.5 rounded-full ${received ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <Text className={`text-[10px] font-bold ${received ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {received ? 'Received by client' : 'In transit'}
                  </Text>
                </View>
              </View>

              {/* Details grid */}
              <View className="border-t border-slate-100 mt-2 pt-1.5 gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">
                    Driver: <Text className="font-semibold text-slate-800">{r.driver_name || '—'}</Text>
                  </Text>
                  <View className="rounded bg-violet-50 px-2 py-0.5 border border-violet-100">
                    <Text className="text-[10.5px] font-bold text-violet-800">
                      {r.battery_count ?? 0} {r.battery_count === 1 ? 'battery' : 'batteries'}
                    </Text>
                  </View>
                </View>

                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  Client: <Text className="font-semibold text-slate-800">{r.client_name || '—'}</Text>
                </Text>

                <Text className="text-[10.5px] text-slate-400">
                  Dispatched: {dateTime(r.returned_at)}
                </Text>
              </View>

              {/* Bottom Actions Row */}
              <View className="flex-row items-center justify-between border-t border-slate-100 mt-2 pt-2 flex-wrap gap-1.5">
                {r.document_url ? (
                  <TouchableOpacity
                    onPress={() => openUpload(r.document_url)}
                    className="flex-row items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5"
                  >
                    <Icon name="fileText" color="#059669" size={12} />
                    <Text className="text-[11px] font-bold text-emerald-800" numberOfLines={1}>
                      {r.document_name || 'View Note'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-[11px] text-slate-400">No document</Text>
                )}

                {isSuperAdmin ? (
                  <View className="flex-row items-center gap-1.5 ml-auto">
                    <TouchableOpacity
                      onPress={() => setEditTarget(r)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1"
                    >
                      <Text className="text-xs font-semibold text-slate-700">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setDeleteTarget(r)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1"
                    >
                      <Text className="text-xs font-bold text-rose-700">Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
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

