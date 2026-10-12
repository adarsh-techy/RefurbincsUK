import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import DateField, { prettyYmd } from '../../components/admin/DateField';
import FleetStatusBadge from '../../components/admin/sa1/FleetStatusBadge';
import BatteryLookup from '../../components/admin/sa1/BatteryLookup';

// Global Battery — the mobile version of the web Battery Fleet page
// (BatteriesPage): GET /batteries (paged: { data, hasMore, total }) with the
// web's filters — client (?clientName=), multi-select status (comma list),
// created-on date — plus the "Look Up Battery by ID" box, the total /
// matching count, active-status chips and Reset Filters. Each row shows the
// web table's columns. A `search` route param (e.g. from Truck Intakes)
// also filters the list and shows as a removable chip.

const PAGE = 30;
const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'registered', label: 'Registered (Not Serviced)' },
  { id: 'in_repair', label: 'Awaiting Repair' },
  { id: 'in_progress', label: 'Repair In Progress' },
  { id: 'in_testing', label: 'In Testing' },
  { id: 'repaired', label: 'Repair Completed' },
  { id: 'returned', label: 'Returned to Client' },
  { id: 'unserviceable', label: 'Unserviceable' },
  { id: 'tested_parts_removed', label: 'Unserviceable (Test Failed)' },
  { id: 'recycled', label: 'Recycled' },
];

const parseStatuses = (raw) =>
  (raw || '').split(',').map((s) => s.trim()).filter((s) => STATUS_FILTERS.some((f) => f.id && f.id === s));

// "2026-07-16" -> "16 Jul" without a UTC shift
function formatShortDate(isoDateStr) {
  const [y, m, d] = String(isoDateStr).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function Field({ label, children }) {
  return (
    <View className="w-1/2 pr-2 pt-1.5">
      <Text className="text-[10px] font-bold uppercase text-slate-400">{label}</Text>
      {children}
    </View>
  );
}

export default function AdminBatteriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [statuses, setStatuses] = useState(() => parseStatuses(route.params?.status));
  const [clientName, setClientName] = useState(route.params?.clientName || '');
  const [search, setSearch] = useState(route.params?.search || '');
  const [date, setDate] = useState('');
  const [clients, setClients] = useState([]);
  const [showDate, setShowDate] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  // dashboard cards / the side menu re-focus this tab with params
  useEffect(() => {
    if (route.params?.status !== undefined) setStatuses(parseStatuses(route.params.status));
  }, [route.params?.status]);
  useEffect(() => {
    if (route.params?.search !== undefined) setSearch(route.params.search || '');
  }, [route.params?.search]);
  useEffect(() => {
    if (route.params?.clientName !== undefined) setClientName(route.params.clientName || '');
  }, [route.params?.clientName]);

  // fleet clients for the filter — recycling partners don't own batteries
  useEffect(() => {
    apiClient
      .get('/clients')
      .then(({ data }) => setClients((Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client').map((c) => c.name)))
      .catch(() => {});
  }, []);

  const statusParam = statuses.join(',');

  const fetchPage = useCallback(async (offset, replace) => {
    const reqId = ++requestRef.current;
    try {
      const params = { limit: PAGE, offset };
      if (statusParam) params.status = statusParam;
      if (clientName) params.clientName = clientName;
      if (date) params.date = date;
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/batteries', { params });
      if (reqId !== requestRef.current) return;
      setRows((prev) => (replace ? data.data || [] : [...prev, ...(data.data || [])]));
      setHasMore(Boolean(data.hasMore));
      setTotal(Number(data.total) || 0);
      setError(null);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      if (reqId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [statusParam, clientName, date, search]);

  useEffect(() => {
    setLoading(true);
    fetchPage(0, true);
  }, [fetchPage]);

  function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    fetchPage(rows.length, false);
  }

  function toggleStatus(id) {
    if (!id) { setStatuses([]); return; }
    setStatuses((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function resetFilters() {
    setStatuses([]);
    setClientName('');
    setDate('');
    setSearch('');
    navigation.setParams({ status: undefined, clientName: undefined, search: undefined });
  }

  const hasFilters = statuses.length > 0 || clientName || date || search;

  const header = (
    <View className="gap-3 pb-3">
      <View>
        <Text className="text-2xl font-bold text-green-600">Global Battery</Text>
        <Text className="text-xs text-slate-500">Every battery ever taken in, tracked by its unique ID.</Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <View className="flex-row items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <Text className="text-xs font-semibold text-emerald-800">
              {hasFilters ? 'Matching Batteries: ' : 'Total Batteries: '}
              <Text className="text-sm font-bold text-emerald-950">{total.toLocaleString()}</Text>
            </Text>
          </View>
          {statuses.map((s) => (
            <TouchableOpacity key={s} onPress={() => toggleStatus(s)} className="flex-row items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5">
              <Text className="text-xs font-semibold text-blue-800">{STATUS_FILTERS.find((f) => f.id === s)?.label || s}</Text>
              <Text className="text-xs font-bold text-blue-500">x</Text>
            </TouchableOpacity>
          ))}
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(''); navigation.setParams({ search: undefined }); }} className="flex-row items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5">
              <Text className="text-xs font-semibold text-blue-800">Search: {search}</Text>
              <Text className="text-xs font-bold text-blue-500">x</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-blue-200 bg-white p-3.5">
        <BatteryLookup />

        <TouchableOpacity onPress={() => setShowFilters((v) => !v)} className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Filters{statuses.length ? ` · ${statuses.length} status${statuses.length === 1 ? '' : 'es'}` : ''}
          </Text>
          <Text className="text-[11px] font-bold text-blue-600">{showFilters ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>

        {showFilters && (
          <>
            <View>
              <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Client</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                {['', ...clients].map((c) => {
                  const active = clientName === c;
                  return (
                    <TouchableOpacity key={c || 'all'} onPress={() => setClientName(c)} className={`rounded-xl border px-3 py-1.5 ${active ? 'border-emerald-700 bg-emerald-700' : 'border-slate-300 bg-white'}`}>
                      <Text className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-slate-700'}`}>{c || 'All Clients'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View>
              <View className="mb-1 flex-row items-center gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Filter</Text>
                {statuses.length > 0 && (
                  <Text className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{statuses.length}</Text>
                )}
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {STATUS_FILTERS.map((f) => {
                  const active = f.id ? statuses.includes(f.id) : statuses.length === 0;
                  return (
                    <TouchableOpacity key={f.id || 'all'} onPress={() => toggleStatus(f.id)} className={`rounded-lg px-2.5 py-1.5 ${active ? 'bg-emerald-700' : 'bg-slate-100'}`}>
                      <Text className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <TouchableOpacity onPress={() => setShowDate((v) => !v)} className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Created on: <Text className={date ? 'text-blue-700' : 'text-slate-400'}>{date ? prettyYmd(date) : 'any date'}</Text>
                </Text>
                <View className="flex-row items-center gap-3">
                  {date ? (
                    <TouchableOpacity onPress={() => setDate('')} hitSlop={6}>
                      <Text className="text-[11px] font-semibold text-slate-500">Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text className="text-[11px] font-bold text-blue-600">{showDate ? 'Hide' : 'Pick date'}</Text>
                </View>
              </TouchableOpacity>
              {showDate && (
                <View className="mt-2">
                  <DateField value={date} onChange={setDate} />
                </View>
              )}
            </View>

            {hasFilters ? (
              <TouchableOpacity onPress={resetFilters} className="self-start rounded-xl bg-slate-100 px-3 py-1.5">
                <Text className="text-xs font-bold text-slate-600">Reset Filters</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      {error ? (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      ) : null}

      {!loading && (
        <Text className="px-1 text-xs font-semibold text-slate-500">
          Showing <Text className="font-bold text-slate-800">{rows.length}</Text> of{' '}
          <Text className="font-bold text-slate-800">{total.toLocaleString()}</Text> {total === 1 ? 'battery' : 'batteries'}
          {hasFilters ? ' (filtered)' : ''}
        </Text>
      )}
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      data={rows}
      keyExtractor={(b) => String(b.id)}
      contentContainerClassName="p-4 gap-2 pb-16"
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPage(0, true); }} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
          <Icon name="battery" color="#94a3b8" size={24} />
          <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading...' : 'No batteries match these filters.'}</Text>
        </View>
      }
      ListFooterComponent={loadingMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
      renderItem={({ item: b, index }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })}
          className="rounded-2xl border border-slate-200 bg-white p-3.5"
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-extrabold text-blue-700">
              <Text className="text-[11px] font-semibold text-slate-400">{index + 1}. </Text>
              {b.battery_code}
            </Text>
            <FleetStatusBadge status={b.status} isPassedBack={b.is_passed_back} hasPendingParts={Number(b.pending_parts_count || 0) > 0} />
          </View>
          <View className="mt-1 flex-row flex-wrap">
            <Field label="RFID Tag">
              <Text className={`font-mono text-xs ${b.rfid_tag ? 'text-emerald-700' : 'text-slate-400'}`} numberOfLines={1}>{b.rfid_tag || '—'}</Text>
            </Field>
            <Field label="Battery Number">
              <Text className={`text-xs ${b.serial_number ? 'font-semibold text-slate-800' : 'text-slate-400'}`} numberOfLines={1}>{b.serial_number || '—'}</Text>
              {b.serial_number && b.serial_number_added_by_role === 'client' ? <Text className="text-[10px] font-semibold text-amber-700">Set by Client</Text> : null}
            </Field>
            <Field label="Client">
              <Text className="text-xs font-semibold text-slate-800" numberOfLines={1}>{b.client_name || '-'}</Text>
            </Field>
            <Field label="Registered Time">
              <Text className="text-xs text-slate-700">{b.created_at ? new Date(b.created_at).toLocaleString() : '-'}</Text>
            </Field>
            <Field label="Last Repaired">
              <Text className="text-xs text-slate-700">{b.last_repaired_at ? new Date(b.last_repaired_at).toLocaleString() : '-'}</Text>
              {b.repairs_this_month > 1 && Array.isArray(b.repairs_this_month_dates) ? (
                <Text className="text-[10px] font-medium text-amber-600">
                  Repaired {b.repairs_this_month}x this month ({b.repairs_this_month_dates.map(formatShortDate).join(', ')})
                </Text>
              ) : null}
            </Field>
            <Field label="Part(s) Changed">
              <Text className="text-xs text-slate-700">{b.last_repaired_parts || '-'}</Text>
            </Field>
            <Field label="Repaired By">
              <Text className="text-xs text-slate-700">{b.last_repaired_by || '-'}</Text>
            </Field>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
