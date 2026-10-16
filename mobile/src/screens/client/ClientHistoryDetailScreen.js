import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { buildTruckManifestCsv, formatEventTime, truckManifestFileName } from '../../utils/history-csv';
import { shareCsv } from '../../utils/share-csv';

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
    navigation.setOptions({
      title: event?.vehicle_number ? `Truck ${event.vehicle_number}` : 'Shipment Details',
    });
  }, [navigation, event?.vehicle_number]);

  const list = useMemo(() => (Array.isArray(event?.batteries_list) ? event.batteries_list : []), [event]);

  // Meaningful content metrics:
  const contentStats = useMemo(() => {
    if (!list.length) return { total: 0, withSerial: 0, withNotes: 0 };
    let withSerial = 0;
    let withNotes = 0;
    list.forEach((b) => {
      if (b.serial && b.serial.trim()) withSerial++;
      if (b.notes && b.notes.trim()) withNotes++;
    });
    return {
      total: list.length,
      withSerial,
      withNotes,
    };
  }, [list]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    list.forEach((b) => {
      if (b.status) set.add(b.status);
    });
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
        <Text className="text-xs text-slate-500">Loading shipment manifest details…</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View className="flex-1 bg-slate-50 p-4">
        <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-xs font-semibold text-red-700">{error || 'No shipment details found.'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-3 items-center rounded-2xl bg-white py-2.5 border border-slate-200"
        >
          <Text className="text-xs font-bold text-slate-700">Back to History</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const header = (
    <View className="gap-3 pb-2">
      {/* ── Executive Shipment Summary Header Card ─────────────────── */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
        <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
          <View className="flex-row items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <Text className="text-[10px] font-bold text-emerald-700">{event.type_label}</Text>
          </View>
          <Text className="text-[10px] font-medium text-slate-500">{formatEventTime(event.timestamp)}</Text>
        </View>

        <View className="mt-3">
          <Text className="text-lg font-black text-slate-900">
            {event.vehicle_number ? `Truck #${event.vehicle_number}` : 'Shipment Manifest'}
          </Text>
          <View className="mt-1 gap-1">
            {event.driver_name ? (
              <View className="flex-row items-center gap-1.5">
                <Icon name="user" color="#64748b" size={11} />
                <Text className="text-[11px] text-slate-600">
                  Driver: <Text className="font-semibold text-slate-900">{event.driver_name}</Text>
                </Text>
              </View>
            ) : null}
            {event.reference ? (
              <View className="flex-row items-center gap-1.5">
                <Icon name="fileText" color="#64748b" size={11} />
                <Text className="text-[11px] font-mono text-slate-500">Ref: {event.reference}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          disabled={exporting || list.length === 0}
          onPress={exportManifest}
          className={`mt-3.5 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 shadow-2xs ${
            exporting || list.length === 0 ? 'opacity-60' : ''
          }`}
        >
          <Icon name="download" color="#ffffff" size={13} />
          <Text className="text-xs font-black text-white">
            {exporting ? 'Preparing CSV…' : 'Export Manifest CSV'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 4 Meaningful Content Stats (2x2 Grid) ───────────────────── */}
      <View className="gap-2.5">
        <View className="flex-row gap-2.5">
          <View className="flex-1 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800">Total Units</Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
                <Icon name="layers" color="#1d4ed8" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-xl font-black text-blue-950">{contentStats.total}</Text>
            <Text className="mt-0.5 text-[10px] font-medium text-blue-600">Batteries on shipment</Text>
          </View>

          <View className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">With Serials</Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
                <Icon name="hash" color="#059669" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-xl font-black text-emerald-950">{contentStats.withSerial}</Text>
            <Text className="mt-0.5 text-[10px] font-medium text-emerald-600">Registered serials</Text>
          </View>
        </View>

        <View className="flex-row gap-2.5">
          <View className="flex-1 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Defects / Notes</Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
                <Icon name="alertTriangle" color="#d97706" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-xl font-black text-amber-950">{contentStats.withNotes}</Text>
            <Text className="mt-0.5 text-[10px] font-medium text-amber-600">Reported issues</Text>
          </View>

          <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Vehicle</Text>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                <Icon name="truck" color="#475569" size={12} />
              </View>
            </View>
            <Text className="mt-1 text-sm font-black text-slate-900" numberOfLines={1}>
              {event.vehicle_number ? `Truck #${event.vehicle_number}` : 'Standard'}
            </Text>
            <Text className="mt-0.5 text-[10px] font-medium text-slate-500" numberOfLines={1}>
              {event.driver_name || 'Workshop Logistics'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Search & Filter Controls ───────────────────────────────── */}
      <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs">
        <Icon name="search" color="#94a3b8" size={14} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search battery ID, serial, or notes..."
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
          className="min-w-0 flex-1 text-xs text-slate-900 py-0"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="x" color="#64748b" size={14} />
          </TouchableOpacity>
        ) : null}
      </View>

      {availableStatuses.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 py-0.5">
          {[['all', `All (${list.length})`], ...availableStatuses.map((st) => [st, statusLabel(st)])].map(
            ([id, label]) => {
              const active = statusFilter === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setStatusFilter(id)}
                  className={`rounded-xl px-3 py-1.5 border ${
                    active ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      )}

      <Text className="text-[11px] font-semibold text-slate-500">
        Showing {filtered.length} of {list.length} batteries
      </Text>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-3.5 gap-2.5 pb-20"
      data={filtered}
      keyExtractor={(b, i) => `${b.code || b.id || ''}-${i}`}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
      ListEmptyComponent={
        <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8">
          <Text className="text-xs text-slate-400">
            {search ? `No batteries found matching "${search}"` : 'No batteries on this shipment.'}
          </Text>
        </View>
      }
      renderItem={({ item: b, index }) => (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => b.code && navigation.navigate('BatteryDetail', { code: b.code, fromScan: false })}
          className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2"
        >
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                #{index + 1}
              </Text>
              <Text className="font-mono text-xs font-black text-emerald-700">{b.code}</Text>
            </View>
            <StatusBadge status={b.status} />
          </View>

          <View className="flex-row items-center gap-2 text-xs">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serial:</Text>
            <Text className="font-mono text-xs font-semibold text-slate-700">{b.serial || '—'}</Text>
          </View>

          {b.notes ? (
            <View className="rounded-xl bg-amber-50/70 p-2 border border-amber-200/70">
              <Text className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">
                Notes / Defect Reason
              </Text>
              <Text className="text-[11px] text-amber-900" numberOfLines={2}>
                {b.notes}
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-center justify-end border-t border-slate-100 pt-2">
            <View className="flex-row items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5">
              <Text className="text-[10px] font-bold text-slate-700">View Battery</Text>
              <Icon name="arrowRight" color="#334155" size={10} />
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
