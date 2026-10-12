import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { buildTruckManifestCsv, formatEventTime, truckManifestFileName } from '../../utils/history-csv';
import { shareCsv } from '../../utils/share-csv';

// Truck shipment detail — the mobile version of the web ClientHistoryDetailPage
// (/my/history/:eventId). Same data source: GET /clients/me/history, the event
// matched by id (the list screen passes it along so the page shows at once,
// then it is refreshed). Hero, four summary cards, search + status filter over
// the batteries, each battery opens its detail, and "Export Manifest CSV"
// writes the same file as the web.

function SummaryCard({ icon, iconColor, iconBg, label, value, valueClass = 'text-slate-900' }) {
  return (
    <View className="w-[48%] rounded-2xl border border-slate-200 bg-white p-3.5">
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon name={icon} color={iconColor} size={18} />
      </View>
      <Text className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
      <Text className={`mt-0.5 text-sm font-black ${valueClass}`} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const statusLabel = (st) => String(st || '').replace(/_/g, ' ').toUpperCase();

export default function ClientHistoryDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const eventId = String(route.params?.eventId ?? '');
  const [event, setEvent] = useState(route.params?.event || null);
  const [loading, setLoading] = useState(!route.params?.event);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clients/me/history');
      const match = (data?.events || []).find((e) => String(e.id) === eventId);
      if (!match) {
        setError('This shipment could not be found — it may have been updated or removed.');
        setEvent(null);
      } else {
        setEvent(match);
        setError(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load shipment details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: event?.vehicle_number ? `Truck ${event.vehicle_number}` : 'Shipment Details' });
  }, [navigation, event?.vehicle_number]);

  const list = useMemo(() => (Array.isArray(event?.batteries_list) ? event.batteries_list : []), [event]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    list.forEach((b) => { if (b.status) set.add(b.status); });
    return Array.from(set);
  }, [list]);

  const filtered = useMemo(() => {
    let rows = list;
    if (statusFilter !== 'all') rows = rows.filter((b) => b.status === statusFilter);
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (b) =>
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.serial && b.serial.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q))
    );
  }, [list, search, statusFilter]);

  async function exportManifest() {
    if (!event) return;
    setExporting(true);
    try {
      await shareCsv(truckManifestFileName(event), buildTruckManifestCsv(event));
    } catch (err) {
      Alert.alert('Export failed', err.message || 'Could not export the manifest.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-sm text-slate-500">Loading shipment manifest details…</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-slate-50 p-4">
        <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-sm font-semibold text-red-700">{error || 'No shipment details found.'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-3 items-center rounded-2xl bg-white py-3 border border-slate-200">
          <Text className="text-sm font-bold text-slate-700">Back to History & Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const header = (
    <View className="gap-3 pb-2">
      {/* Hero */}
      <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <View className="h-1.5 w-full bg-blue-600" />
        <View className="p-4">
          <View className="flex-row flex-wrap gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1">
              <Icon name="truck" color="#1d4ed8" size={12} />
              <Text className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Truck Shipment Manifest</Text>
            </View>
            <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
              <Text className="text-[10px] font-bold text-emerald-700">● {event.type_label}</Text>
            </View>
          </View>
          <Text className="mt-2 text-2xl font-black text-slate-900">
            {event.vehicle_number ? `Truck #${event.vehicle_number}` : event.reference || 'Shipment Manifest'}
          </Text>
          <View className="mt-1.5 gap-1">
            <Text className="text-xs text-slate-500">{formatEventTime(event.timestamp)}</Text>
            {event.driver_name ? (
              <Text className="text-xs text-slate-500">
                Driver: <Text className="font-semibold text-slate-700">{event.driver_name}</Text>
              </Text>
            ) : null}
            {event.reference ? (
              <Text className="self-start rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">Ref: {event.reference}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            disabled={exporting || list.length === 0}
            onPress={exportManifest}
            className={`mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 ${exporting || list.length === 0 ? 'opacity-60' : ''}`}
          >
            <Text className="text-sm font-extrabold text-white">{exporting ? 'Preparing CSV…' : '⤓ Export Manifest CSV'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4 summary cards */}
      <View className="flex-row flex-wrap justify-between gap-y-3">
        <SummaryCard icon="truck" iconColor="#2563eb" iconBg="bg-blue-50" label="Truck / Vehicle" value={event.vehicle_number ? `Truck #${event.vehicle_number}` : '—'} />
        <SummaryCard icon="user" iconColor="#7c3aed" iconBg="bg-violet-50" label="Assigned Driver" value={event.driver_name || 'Workshop Logistics'} />
        <SummaryCard icon="battery" iconColor="#059669" iconBg="bg-emerald-50" label="Batteries Included" value={`${list.length} Units`} valueClass="text-emerald-600" />
        <SummaryCard icon="award" iconColor="#d97706" iconBg="bg-amber-50" label="Logistics Status" value={event.type_label} />
      </View>

      {/* search + status filter */}
      <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
        <Icon name="search" color="#94a3b8" size={16} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search battery ID, serial, or notes..."
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
          className="min-w-0 flex-1 text-sm text-slate-900"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="x" color="#64748b" size={16} />
          </TouchableOpacity>
        ) : null}
      </View>
      {availableStatuses.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
          {[['all', `All Statuses (${list.length})`], ...availableStatuses.map((st) => [st, statusLabel(st)])].map(([id, label]) => {
            const active = statusFilter === id;
            return (
              <TouchableOpacity key={id} onPress={() => setStatusFilter(id)} className={`rounded-xl px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <Text className="text-[11px] font-semibold text-slate-500">
        Showing {filtered.length} of {list.length} units
      </Text>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 gap-2 pb-16"
      data={filtered}
      keyExtractor={(b, i) => `${b.code || b.id || ''}-${i}`}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
          <Text className="text-xs text-slate-400">
            {search ? `No batteries found matching "${search}"` : 'No batteries on this shipment.'}
          </Text>
        </View>
      }
      renderItem={({ item: b, index }) => (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => b.code && navigation.navigate('BatteryDetail', { code: b.code, fromScan: false })}
          className="rounded-2xl border border-slate-200 bg-white p-3.5"
        >
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="font-mono text-[11px] text-slate-400">#{index + 1}</Text>
              <Text className="font-mono text-sm font-black text-emerald-700">{b.code}</Text>
              <Text className="mt-0.5 font-mono text-[11px] text-slate-500">Serial: {b.serial || '—'}</Text>
            </View>
            <StatusBadge status={b.status} />
          </View>
          <Text className="mt-2 text-xs text-slate-600" numberOfLines={2}>
            {b.notes || <Text className="text-slate-400">No client notes</Text>}
          </Text>
          <Text className="mt-2 text-[11px] font-bold text-blue-700">View Battery ›</Text>
        </TouchableOpacity>
      )}
    />
  );
}
