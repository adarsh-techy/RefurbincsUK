import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import ClientTruckBatches from '../../components/client/ClientTruckBatches';
import { hasClientPermission } from '../../utils/permissions';
import Icon from '../../components/ui/Icon';
import { ClientStatusBadge, DateField, toLocalDateValue } from '../../components/client/batteries/common';
import SerialNumberModal from '../../components/client/batteries/SerialNumberModal';
import AddIntakeModal from '../../components/client/batteries/AddIntakeModal';

// The client's battery lists — the web ClientBatteriesPage (/my/batteries/:bucket):
//   all       five tappable stat cards, status / date filters, the fleet
//             sorted by battery ID, "+ Add Serial" and Previous Repair Date
//   packed    truck batches (Table / Cards view) + "+ Add Intake"
//   received  return dispatches (verify receipt, rate)
//   pending   In Service & Testing — reached from the dashboard
// Lists load 20 at a time as you scroll, like the web tables.

const BUCKET_META = {
  all: {
    title: 'All Batteries',
    description: 'Complete inventory of your registered battery fleet across all service stages.',
    empty: 'No batteries registered in your fleet.',
  },
  packed: {
    title: 'Battery Packed to Repair',
    description: 'Batteries delivered and logged by truck for workshop repair.',
    empty: 'No truck intake batches found.',
  },
  pending: {
    title: 'In Service & Testing',
    description: 'Batteries currently undergoing cell diagnostics, repair, or cycle testing.',
    empty: 'No batteries in service right now.',
  },
  received: {
    title: 'Battery Received',
    description: 'Batteries restored and returned back to your operational fleet.',
    empty: 'No batteries have been returned to you yet.',
  },
};

const BUCKET_TABS = [
  { id: 'all', label: 'All Batteries' },
  { id: 'packed', label: 'Packed' },
  { id: 'received', label: 'Received' },
];

const BUCKET_PERMISSION = {
  all: 'client_all_batteries',
  packed: 'client_packed',
  pending: 'client_in_service',
  received: 'client_received',
};

const STATUS_OPTIONS = [
  { id: '', label: 'All Statuses' },
  { id: 'in_fleet', label: 'Active in Fleet' },
  { id: 'registered', label: 'Registered (Not Serviced)' },
  { id: 'returned', label: 'Returned to Client' },
  { id: 'in_service', label: 'In Workshop Repair' },
  { id: 'in_repair', label: 'Packed for Repair' },
  { id: 'repaired', label: 'Repair Complete' },
  { id: 'unserviceable', label: 'Unserviceable' },
  { id: 'recycled', label: 'Recycled' },
];

const PAGE = 20;

// the date a client filters "All Batteries" by — last return / repair /
// intake, not the (often identical) registration date
function relevantDate(item) {
  if (item.status === 'returned' && item.return_date) return item.return_date;
  if (item.last_repaired_at) return item.last_repaired_at;
  if (item.intake_at) return item.intake_at;
  return item.created_at;
}

function matchesStatus(item, filter) {
  if (!filter) return true;
  if (filter === 'in_fleet') return ['registered', 'returned'].includes(item.status);
  if (filter === 'in_service') return ['in_progress', 'in_testing', 'testing', 'repair_testing', 'in_repair', 'repaired'].includes(item.status);
  if (filter === 'unserviceable') return ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'recycled'].includes(item.status);
  return item.status === filter;
}

function StatCard({ label, value, note, active, onPress, tone }) {
  const ring = {
    slate: 'border-slate-400 bg-slate-100',
    emerald: 'border-emerald-500 bg-emerald-50',
    amber: 'border-amber-500 bg-amber-50',
    rose: 'border-rose-500 bg-rose-50',
    purple: 'border-purple-500 bg-purple-50',
  }[tone];
  const text = { slate: 'text-slate-600', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700', purple: 'text-purple-700' }[tone];
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`w-[31.5%] rounded-2xl border p-2.5 ${active ? ring : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}
    >
      <Text className={`text-[10px] font-bold uppercase ${text}`} numberOfLines={1}>{label}</Text>
      <Text className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{value}</Text>
      {note ? <Text className="text-[10px] text-slate-500" numberOfLines={1}>{note}</Text> : null}
    </TouchableOpacity>
  );
}

export default function ClientBatteriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const user = useSelector((state) => state.auth.user);

  const [activeTab, setActiveTab] = useState(route.params?.initialBucket || 'all');
  const meta = BUCKET_META[activeTab] || BUCKET_META.all;
  const bucketAllowed = hasClientPermission(user, BUCKET_PERMISSION[activeTab]);

  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [statusFilter, setStatusFilter] = useState(route.params?.initialStatus || '');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('batch_table');
  const [visible, setVisible] = useState(PAGE);

  const [data, setData] = useState([]);
  const [fleet, setFleet] = useState([]); // every battery the client owns (suggestions, RFID tags, batch pages)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const [serialTarget, setSerialTarget] = useState(null);
  const [intakeOpen, setIntakeOpen] = useState(false);

  // the newest request wins — a slow older response can't overwrite fresh data
  const fetchBatteries = useCallback(async () => {
    const id = ++requestId.current;
    setError(null);
    try {
      const [bucketRes, fleetRes] = await Promise.all([
        apiClient.get('/clients/me/batteries', { params: activeTab === 'all' ? {} : { bucket: activeTab } }),
        activeTab === 'all' ? null : apiClient.get('/clients/me/batteries').catch(() => null),
      ]);
      if (id !== requestId.current) return;
      const rows = bucketRes.data?.data || [];
      setData(rows);
      setFleet(activeTab === 'all' ? rows : fleetRes?.data?.data || []);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeTab]);

  // opened from the dashboard / drawer with a bucket (and maybe ?status=)
  useEffect(() => {
    if (route.params?.initialBucket) setActiveTab(route.params.initialBucket);
    setStatusFilter(route.params?.initialStatus || '');
    setSearch('');
    setDate('');
  }, [route.params?.initialBucket, route.params?.initialStatus]);

  useEffect(() => {
    setLoading(true);
    setData([]);
    fetchBatteries();
  }, [fetchBatteries]);

  useEffect(() => setVisible(PAGE), [activeTab, search, date, statusFilter]);

  // a new bucket starts with clean filters, like the web page
  function switchTab(id) {
    if (id === activeTab) return;
    setActiveTab(id);
    setSearch('');
    setDate('');
    setStatusFilter('');
  }

  function onRefresh() {
    setRefreshing(true);
    fetchBatteries();
  }

  const counts = useMemo(() => ({
    total: data.length,
    inFleet: data.filter((b) => b.status === 'returned' || b.status === 'registered').length,
    notServiced: data.filter((b) => b.status === 'registered').length,
    workshop: data.filter((b) => ['in_repair', 'in_progress', 'in_testing', 'testing', 'repair_testing', 'repaired'].includes(b.status)).length,
    unserviceable: data.filter((b) => ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed'].includes(b.status)).length,
    recycled: data.filter((b) => b.status === 'recycled').length,
  }), [data]);

  const filteredAll = useMemo(() => {
    if (activeTab !== 'all') return [];
    const q = search.trim().toLowerCase();
    return data
      .filter((item) => {
        const matchesSearch =
          !q ||
          (item.battery_code && item.battery_code.toLowerCase().includes(q)) ||
          (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
          (item.truck_number && item.truck_number.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q));
        const matchesDate = !date || toLocalDateValue(relevantDate(item)) === date;
        return matchesSearch && matchesStatus(item, statusFilter) && matchesDate;
      })
      .sort((a, b) => (a.battery_code || '').localeCompare(b.battery_code || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [data, activeTab, search, statusFilter, date]);

  const filteredPending = useMemo(() => {
    if (activeTab !== 'pending') return [];
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch =
        !q ||
        (item.battery_code && item.battery_code.toLowerCase().includes(q)) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
        (item.truck_number && item.truck_number.toLowerCase().includes(q));
      return matchesSearch && (!date || toLocalDateValue(item.intake_at || item.created_at) === date);
    });
  }, [data, activeTab, search, date]);

  const toggleStatus = (id) => setStatusFilter((cur) => (cur === id ? '' : id));
  const anyFilter = Boolean(search || date || statusFilter);
  const isBatchBucket = activeTab === 'packed' || activeTab === 'received';
  const tabs = activeTab === 'pending' ? [...BUCKET_TABS, { id: 'pending', label: 'In Service' }] : BUCKET_TABS;
  const goDetail = (item) => navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false });

  const header = (
    <View className="border-b border-slate-200/80 bg-white/90 px-4 pb-3 pt-3 dark:border-slate-800/80 dark:bg-slate-900/90">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => switchTab(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100/80 dark:bg-slate-800/80'}`}
            >
              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">{meta.title}</Text>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">{meta.description}</Text>

      {activeTab === 'packed' && bucketAllowed && (
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1 flex-row rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[['batch_table', 'Table View'], ['cards', 'Cards View']].map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setViewMode(id)} className={`flex-1 items-center rounded-lg py-1.5 ${viewMode === id ? 'bg-emerald-600' : ''}`}>
                <Text className={`text-[11px] font-bold ${viewMode === id ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setIntakeOpen(true)} className="items-center justify-center rounded-xl bg-emerald-600 px-4">
            <Text className="text-xs font-bold text-white">+ Add Intake</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'all' && bucketAllowed && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          <StatCard label="Total Fleet" value={counts.total} tone="slate" active={statusFilter === ''} onPress={() => setStatusFilter('')} />
          <StatCard label="Active in Fleet" value={counts.inFleet} note={`${counts.notServiced} not serviced yet`} tone="emerald" active={statusFilter === 'in_fleet'} onPress={() => toggleStatus('in_fleet')} />
          <StatCard label="In Workshop Repair" value={counts.workshop} tone="amber" active={['in_service', 'in_repair', 'repaired'].includes(statusFilter)} onPress={() => toggleStatus('in_service')} />
          <StatCard label="Unserviceable" value={counts.unserviceable} tone="rose" active={statusFilter === 'unserviceable'} onPress={() => toggleStatus('unserviceable')} />
          <StatCard label="Recycled" value={counts.recycled} tone="purple" active={statusFilter === 'recycled'} onPress={() => toggleStatus('recycled')} />
        </View>
      )}

      <View className="mt-3 flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-2 dark:border-slate-700 dark:bg-slate-950">
          <Icon name="search" color="#64748b" size={15} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isBatchBucket ? 'Search Driver / Truck — e.g. John or TRK-102' : 'Search Code, Serial, Notes…'}
            placeholderTextColor="#64748b"
            className="flex-1 text-xs text-slate-900 dark:text-white"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close" color="#64748b" size={13} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters((v) => !v)}
          className={`rounded-2xl border px-3 py-2 ${showFilters || date || statusFilter ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
        >
          <Text className="text-xs font-bold text-blue-700">Filters{date || statusFilter ? ' •' : ''}</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View className="mt-2.5 gap-2.5">
          {activeTab === 'all' && (
            <View>
              <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter Status</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((o) => {
                  const on = statusFilter === o.id;
                  return (
                    <TouchableOpacity key={o.id || 'all'} onPress={() => setStatusFilter(o.id)} className={`rounded-xl px-2.5 py-1.5 ${on ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <DateField label={activeTab === 'packed' ? 'Intake Date' : 'Date'} value={date} onChange={setDate} />
        </View>
      )}

      {anyFilter && (
        <View className="mt-2 flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-[11px] text-slate-500" numberOfLines={1}>
            {[statusFilter && (STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label || statusFilter), date, search && `"${search}"`].filter(Boolean).join(' · ')}
          </Text>
          <TouchableOpacity onPress={() => { setSearch(''); setDate(''); setStatusFilter(''); }}>
            <Text className="text-[11px] font-bold text-red-600">Clear all</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  function body() {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading batteries…</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchBatteries} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (isBatchBucket) {
      return (
        <ClientTruckBatches
          bucket={activeTab}
          rows={data}
          fleet={fleet}
          search={search}
          date={date}
          viewMode={activeTab === 'packed' ? viewMode : 'batch_table'}
          onChanged={fetchBatteries}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      );
    }
    const list = activeTab === 'pending' ? filteredPending : filteredAll;
    const shown = list.slice(0, visible);
    return (
      <FlatList
        data={shown}
        keyExtractor={(item) => `${item.id}-${item.intake_id ?? item.return_id ?? 'none'}`}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />}
        onEndReached={() => visible < list.length && setVisible((v) => v + PAGE)}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Icon name="battery" color="#94a3b8" size={22} />
            <Text className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{meta.empty}</Text>
            {anyFilter ? <Text className="mt-1 text-xs text-slate-400">Try a different search, status or date</Text> : null}
          </View>
        }
        ListFooterComponent={
          list.length > PAGE ? (
            <Text className="pt-2 text-center text-[11px] text-slate-400">
              Showing {shown.length} of {list.length} batteries • Scroll to load more (20 per page)
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => goDetail(item)}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-2">
                <Text className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                  <Text className="text-xs font-semibold text-slate-400">{index + 1}. </Text>
                  {item.battery_code}
                </Text>
                {item.is_blocked ? (
                  <View className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-red-600">Blocked</Text>
                  </View>
                ) : null}
              </View>
              <ClientStatusBadge row={item} />
            </View>
            <View className="mt-2 flex-row items-center justify-between gap-2">
              <Text className="text-[10px] font-bold uppercase text-slate-400">Physical Serial Number</Text>
              {item.serial_number ? (
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.serial_number}</Text>
              ) : activeTab === 'pending' ? (
                <Text className="text-xs italic text-slate-400">Not set</Text>
              ) : (
                <TouchableOpacity onPress={() => setSerialTarget(item)} hitSlop={6}>
                  <Text className="text-xs font-bold text-blue-600">+ Add Serial</Text>
                </TouchableOpacity>
              )}
            </View>
            {activeTab === 'pending' ? (
              <>
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-[10px] font-bold uppercase text-slate-400">Arrived On</Text>
                  <Text className="text-xs text-slate-700 dark:text-slate-200">{item.truck_number || '—'}</Text>
                </View>
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-[10px] font-bold uppercase text-slate-400">Time in Workshop</Text>
                  <Text className="text-xs text-slate-700 dark:text-slate-200">{new Date(item.intake_at || item.created_at).toLocaleString()}</Text>
                </View>
              </>
            ) : (
              <View className="mt-1 flex-row justify-between">
                <Text className="text-[10px] font-bold uppercase text-slate-400">Previous Repair Date</Text>
                <Text className="text-xs text-slate-700 dark:text-slate-200">{item.last_repaired_at ? new Date(item.last_repaired_at).toLocaleString() : '—'}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {header}
      {bucketAllowed ? (
        body()
      ) : (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-slate-600">
            You do not have permission to view this section. Please contact your Refurbinics administrator if you need access.
          </Text>
        </View>
      )}

      <SerialNumberModal battery={serialTarget} onClose={() => setSerialTarget(null)} onSaved={fetchBatteries} />
      <AddIntakeModal visible={intakeOpen} fleet={fleet} onClose={() => setIntakeOpen(false)} onRecorded={fetchBatteries} />
    </View>
  );
}
