import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { buildHistoryCsv, formatEventTime, historyCsvFileName } from '../../utils/history-csv';
import { shareCsv } from '../../utils/share-csv';

// History & Activity — the mobile version of the web ClientHistoryPage:
// GET /clients/me/history → { summary, events }, every truck packed, every
// workshop intake and every return dispatch, newest first. Same summary
// cards, type tabs, date presets, search, Refresh / Export CSV, and the same
// two views: day-grouped cards ("Cards View") or a compact list ("Table").
// Tapping a shipment opens its manifest (ClientHistoryDetail).

const TYPE_FILTERS = [
  { id: 'all', label: 'All Truck Shipments' },
  { id: 'packed', label: 'Trucks Packed' },
  { id: 'intake', label: 'Workshop Intakes' },
  { id: 'return', label: 'Trucks Returned' },
];
const DATE_FILTERS = [
  { id: 'all', label: 'All Time', days: null },
  { id: '7d', label: '7 Days', days: 7 },
  { id: '30d', label: '30 Days', days: 30 },
  { id: '90d', label: '90 Days', days: 90 },
  { id: 'year', label: '1 Year', days: 365 },
];
// same labels / colours as the web EVENT_CONFIG
const EVENT_CONFIG = {
  packed: { label: 'Packed for Repair', icon: 'package', color: '#4f46e5', chip: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', stripe: 'bg-indigo-500' },
  intake: { label: 'Workshop Intake', icon: 'truck', color: '#2563eb', chip: 'bg-blue-50 border-blue-200', text: 'text-blue-700', stripe: 'bg-blue-500' },
  return: { label: 'Returned to Fleet', icon: 'checkCircle', color: '#059669', chip: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', stripe: 'bg-emerald-500' },
  sort: { label: 'Battery Sorted', icon: 'grid', color: '#0d9488', chip: 'bg-teal-50 border-teal-200', text: 'text-teal-700', stripe: 'bg-teal-500' },
  scrap: { label: 'Scrapped / Recycled', icon: 'alertTriangle', color: '#e11d48', chip: 'bg-rose-50 border-rose-200', text: 'text-rose-700', stripe: 'bg-rose-500' },
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diffMins = Math.floor((Date.now() - d) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const dayKey = (ts) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

function SummaryCard({ title, value, sub, border, titleColor, icon, iconColor, iconBg }) {
  return (
    <View className={`w-[48.5%] rounded-xl border bg-white p-2 justify-between min-h-[56px] shadow-2xs ${border}`}>
      <View className="flex-row items-center justify-between">
        <Text className={`text-[8px] font-black uppercase tracking-wider flex-1 mr-1 ${titleColor}`} numberOfLines={1}>{title}</Text>
        {icon ? (
          <View className={`h-4.5 w-4.5 items-center justify-center rounded-md ${iconBg || 'bg-slate-50'}`}>
            <Icon name={icon} color={iconColor || '#64748b'} size={10} />
          </View>
        ) : null}
      </View>
      <View className="mt-0.5">
        <Text className="text-sm font-black text-slate-900">{value}</Text>
        <Text className="text-[9px] text-slate-500">{sub}</Text>
      </View>
    </View>
  );
}

export default function ClientHistoryScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [type, setType] = useState('all');
  const [range, setRange] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clients/me/history');
      setEvents(data?.events || []);
      setSummary(data?.summary || {});
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load fleet history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function refresh() {
    setRefreshing(true);
    load();
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const days = DATE_FILTERS.find((d) => d.id === range)?.days;
    const since = days ? Date.now() - days * 86400000 : null;
    return events.filter((e) => {
      if (type !== 'all' && e.type !== type) return false;
      if (since && e.timestamp && new Date(e.timestamp).getTime() < since) return false;
      if (!q) return true;
      // same fields as the web search, including the batteries on the truck
      const listMatch = (e.batteries_list || []).some((b) =>
        [b.code, b.serial, b.notes].some((v) => v && String(v).toLowerCase().includes(q))
      );
      return listMatch || [e.battery_code, e.serial_number, e.reference, e.vehicle_number, e.driver_name, e.staff_name, e.details, e.type_label]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [events, type, range, search]);

  // Cards View groups the shipments by day, like the web timeline
  const rows = useMemo(() => {
    if (viewMode === 'table') return visible.map((e) => ({ kind: 'event', key: `e-${e.id}`, event: e }));
    const out = [];
    const counts = {};
    visible.forEach((e) => {
      const k = dayKey(e.timestamp);
      counts[k] = (counts[k] || 0) + 1;
    });
    let last = null;
    visible.forEach((e) => {
      const k = dayKey(e.timestamp);
      if (k !== last) {
        out.push({ kind: 'day', key: `d-${k}`, date: k, count: counts[k] });
        last = k;
      }
      out.push({ kind: 'event', key: `e-${e.id}`, event: e });
    });
    return out;
  }, [visible, viewMode]);

  async function exportCsv() {
    if (!visible.length) return;
    setExporting(true);
    try {
      await shareCsv(historyCsvFileName(), buildHistoryCsv(visible));
    } catch (err) {
      Alert.alert('Export failed', err.message || 'Could not export the history.');
    } finally {
      setExporting(false);
    }
  }

  const filtersOn = Boolean(search || type !== 'all' || range !== 'all');
  function resetFilters() {
    setSearch('');
    setType('all');
    setRange('all');
  }

  const counts = {
    all: events.length,
    packed: summary.packed_count ?? events.filter((e) => e.type === 'packed').length,
    intake: summary.intake_count ?? events.filter((e) => e.type === 'intake').length,
    return: summary.return_count ?? events.filter((e) => e.type === 'return').length,
  };
  const openEvent = (e) => navigation.navigate('ClientHistoryDetail', { eventId: e.id, event: e });
  const openBattery = (code) => code && navigation.navigate('BatteryDetail', { code, fromScan: false });

  const header = (
    <View className="gap-2 pb-0.5">
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={refresh}
          disabled={refreshing}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xs active:scale-98"
        >
          <Icon name="rotateCcw" color="#334155" size={12} />
          <Text className="text-[11px] font-bold text-slate-700">{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!visible.length || exporting}
          onPress={exportCsv}
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-1.5 shadow-2xs active:scale-98 ${!visible.length || exporting ? 'opacity-50' : ''}`}
        >
          <Text className="text-[11px] font-bold text-white">{exporting ? 'Exporting…' : '⤓ Export CSV'}</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap justify-between gap-y-1.5">
        <SummaryCard
          title="Total Shipments"
          value={summary.total_events ?? events.length}
          sub="Total batches"
          border="border-slate-200"
          titleColor="text-slate-500"
          icon="truck"
          iconColor="#475569"
          iconBg="bg-slate-100"
        />
        <SummaryCard
          title="Packed Trucks"
          value={summary.packed_count ?? 0}
          sub="Packed for repair"
          border="border-indigo-100"
          titleColor="text-indigo-600"
          icon="package"
          iconColor="#4f46e5"
          iconBg="bg-indigo-50"
        />
        <SummaryCard
          title="Workshop Intakes"
          value={summary.intake_count ?? 0}
          sub="Workshop arrivals"
          border="border-blue-100"
          titleColor="text-blue-600"
          icon="truck"
          iconColor="#2563eb"
          iconBg="bg-blue-50"
        />
        <SummaryCard
          title="Returned Trucks"
          value={summary.return_count ?? 0}
          sub="Delivered to fleet"
          border="border-emerald-100"
          titleColor="text-emerald-600"
          icon="checkCircle"
          iconColor="#059669"
          iconBg="bg-emerald-50"
        />
      </View>

      <View className="gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
        {/* 2x2 Grid for Type Filters (No horizontal scrolling on mobile) */}
        <View className="flex-row flex-wrap justify-between gap-y-1.5">
          {TYPE_FILTERS.map((f) => {
            const active = type === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setType(f.id)}
                className={`w-[48.5%] flex-row items-center justify-between rounded-lg px-2 py-1.5 ${
                  active ? 'bg-emerald-600' : 'bg-slate-100'
                }`}
              >
                <Text className={`text-[10px] font-bold flex-1 mr-1 ${active ? 'text-white' : 'text-slate-700'}`} numberOfLines={1}>
                  {f.label}
                </Text>
                <View className={`rounded-full px-1.5 py-0.2 ${active ? 'bg-white/20' : 'bg-slate-200'}`}>
                  <Text className={`text-[9px] font-black ${active ? 'text-white' : 'text-slate-600'}`}>
                    {counts[f.id] ?? 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search Input */}
        <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
          <Icon name="search" color="#94a3b8" size={13} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search truck, driver, battery ID..."
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="min-w-0 flex-1 text-[11px] text-slate-900 py-0"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" color="#64748b" size={13} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Date presets & view mode */}
        <View className="flex-row items-center justify-between gap-1 flex-wrap">
          <View className="flex-row flex-wrap items-center gap-1">
            {DATE_FILTERS.map((f) => {
              const active = range === f.id;
              return (
                <TouchableOpacity key={f.id} onPress={() => setRange(f.id)} className={`rounded-md px-1.5 py-0.5 ${active ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Text className={`text-[9.5px] font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View className="flex-row rounded-lg bg-slate-100 p-0.5">
            {[['timeline', 'Cards'], ['table', 'Table']].map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setViewMode(id)} className={`items-center px-2 py-0.5 rounded-md ${viewMode === id ? 'bg-white shadow-2xs' : ''}`}>
                <Text className={`text-[9.5px] font-bold ${viewMode === id ? 'text-slate-900' : 'text-slate-500'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {error ? (
        <View className="rounded-xl border border-red-200 bg-red-50 p-2.5">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      ) : null}
    </View>
  );

  function renderCard(e) {
    const conf = EVENT_CONFIG[e.type] || EVENT_CONFIG.intake;
    const list = Array.isArray(e.batteries_list) ? e.batteries_list : [];
    const count = e.battery_count || list.length || 1;
    const truckTitle = e.vehicle_number ? `Truck ${e.vehicle_number}` : e.reference || 'Shipment Batch';
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => openEvent(e)} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <View className={`absolute bottom-0 left-0 top-0 w-1 ${conf.stripe}`} />
        <View className="p-2 pl-2.5">
          <View className="flex-row items-start gap-1.5">
            <View className="h-6 w-6 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 mt-0.5">
              <Icon name={conf.icon} color={conf.color} size={12} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between gap-1 flex-wrap">
                <Text className="text-xs font-black text-slate-900">{truckTitle}</Text>
                <View className={`rounded-full border px-1.5 py-0.2 ${conf.chip}`}>
                  <Text className={`text-[8px] font-bold uppercase ${conf.text}`}>● {e.type_label || conf.label}</Text>
                </View>
              </View>
              <Text className="text-[9px] text-slate-400 mt-0.5" numberOfLines={1}>
                {e.reference ? `Ref: ${e.reference}` : 'Consignment Batch'}
                {e.staff_name ? ` • By ${e.staff_name}` : ''}
              </Text>
            </View>
          </View>

          <View className="mt-1 flex-row items-center justify-between bg-slate-50/80 rounded-md px-1.5 py-0.5 border border-slate-100">
            <View className="flex-row items-center gap-1">
              <Icon name="clock" color="#64748b" size={9} />
              <Text className="text-[9px] font-bold text-slate-700">{formatEventTime(e.timestamp)}</Text>
            </View>
            <Text className="text-[8px] font-semibold text-slate-400">{formatRelativeTime(e.timestamp)}</Text>
          </View>

          {/* 3-Column Compact Logistics Metrics */}
          <View className="mt-1 flex-row gap-1">
            <View className="flex-1 rounded-md bg-slate-50 p-1 border border-slate-100">
              <Text className="text-[7.5px] font-bold uppercase text-slate-400">Volume</Text>
              <Text className="text-[10px] font-black text-slate-900 mt-0.5" numberOfLines={1}>
                {count} {count === 1 ? 'Bat' : 'Units'}
              </Text>
            </View>
            <View className="flex-1 rounded-md bg-slate-50 p-1 border border-slate-100">
              <Text className="text-[7.5px] font-bold uppercase text-slate-400">Driver</Text>
              <Text className="text-[10px] font-bold text-slate-800 mt-0.5" numberOfLines={1}>
                {e.driver_name ? e.driver_name : (e.staff_name || 'Fleet')}
              </Text>
            </View>
            <View className="flex-1 rounded-md bg-slate-50 p-1 border border-slate-100">
              <Text className="text-[7.5px] font-bold uppercase text-slate-400">Status</Text>
              <Text className={`text-[10px] font-bold mt-0.5 ${e.verified_by_client ? 'text-emerald-700' : 'text-amber-700'}`} numberOfLines={1}>
                {e.verified_by_client ? 'Verified' : 'Transit'}
              </Text>
            </View>
          </View>

          {e.amount != null && Number(e.amount) > 0 ? (
            <View className="mt-1 flex-row items-center justify-between bg-amber-50/60 rounded px-1.5 py-0.2 border border-amber-100">
              <Text className="text-[8px] font-bold uppercase text-amber-700">Amount:</Text>
              <Text className="text-[10px] font-black text-amber-800">£{Number(e.amount).toFixed(2)}</Text>
            </View>
          ) : null}

          {e.details ? (
            <Text className="mt-1 text-[9.5px] text-slate-600 bg-white/70 p-1 rounded-md border border-slate-100" numberOfLines={1}>
              {e.details}
            </Text>
          ) : null}

          {list.length > 0 && (
            <View className="mt-1 flex-row flex-wrap items-center gap-1">
              <Text className="text-[8px] font-bold uppercase text-slate-400 mr-0.5">Serials:</Text>
              {list.slice(0, 3).map((b, i) => (
                <TouchableOpacity key={`${b.code}-${i}`} onPress={() => openBattery(b.code)} className="rounded bg-slate-100 px-1 py-0.2 border border-slate-200">
                  <Text className="font-mono text-[8px] font-bold text-slate-700">{b.code}</Text>
                </TouchableOpacity>
              ))}
              {list.length > 3 ? <Text className="text-[8px] font-bold text-slate-400">+{list.length - 3} more</Text> : null}
            </View>
          )}

          <View className="mt-1 flex-row items-center justify-between border-t border-slate-100 pt-1">
            <Text className="text-[8.5px] text-slate-400">Tap to view manifest</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-[9px] font-bold text-blue-700">View Manifest</Text>
              <Icon name="arrowRight" color="#1d4ed8" size={8} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // "Table": one compact row per event
  function renderRow(e) {
    const conf = EVENT_CONFIG[e.type] || EVENT_CONFIG.intake;
    const list = Array.isArray(e.batteries_list) ? e.batteries_list : [];
    const count = e.battery_count || list.length || 1;
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => openEvent(e)} className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
        <View className="flex-row items-center justify-between gap-1">
          <View className={`rounded-full border px-1.5 py-0.2 ${conf.chip}`}>
            <Text className={`text-[8px] font-bold ${conf.text}`}>{e.type_label || conf.label}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon name="clock" color="#94a3b8" size={8} />
            <Text className="text-[8px] text-slate-400 font-semibold">{formatEventTime(e.timestamp)}</Text>
          </View>
        </View>
        <Text className="mt-0.5 text-xs font-black text-slate-900">{e.details || (e.vehicle_number ? `Shipment Truck #${e.vehicle_number}` : 'Consignment Batch')}</Text>
        <View className="mt-1 flex-row flex-wrap gap-x-2 gap-y-0.5 bg-slate-50 p-1 rounded-md border border-slate-100">
          {e.vehicle_number ? <Text className="text-[9px] font-semibold text-slate-600">Truck {e.vehicle_number}</Text> : null}
          {e.driver_name ? <Text className="text-[9px] text-slate-600">Driver: {e.driver_name}</Text> : null}
          {e.verified_by_client ? <Text className="text-[9px] font-bold text-emerald-700">✓ Verified</Text> : null}
          {e.amount != null && Number(e.amount) > 0 ? <Text className="text-[9px] font-bold text-amber-700">£{Number(e.amount).toFixed(2)}</Text> : null}
        </View>
        <View className="mt-1 flex-row items-center justify-between pt-0.5">
          <Text className="text-[9px] font-semibold text-slate-500">{count} {count === 1 ? 'Battery' : 'Batteries'}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-[9px] font-bold text-blue-700">Details</Text>
            <Icon name="arrowRight" color="#1d4ed8" size={8} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      data={loading || error ? [] : rows}
      keyExtractor={(r) => r.key}
      contentContainerClassName="p-2.5 gap-2 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Text className="text-sm font-semibold text-slate-500">Loading fleet history…</Text>
          </View>
        ) : error ? null : (
          <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8">
            <Icon name="truck" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-bold text-slate-800">No truck shipment events found</Text>
            <Text className="mt-1 text-center text-xs text-slate-500">
              {filtersOn
                ? 'Try changing or clearing your search and filter criteria.'
                : 'As truck shipments are packed, received at workshop, or returned to fleet, all truck batch activities will appear here.'}
            </Text>
            {filtersOn ? (
              <TouchableOpacity onPress={resetFilters} className="mt-4 rounded-xl bg-slate-100 px-4 py-2">
                <Text className="text-xs font-bold text-slate-700">Reset All Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )
      }
      renderItem={({ item: r }) =>
        r.kind === 'day' ? (
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-xs font-extrabold text-slate-700">{r.date}</Text>
            <Text className="text-[11px] font-semibold text-slate-400">
              {r.count} truck {r.count === 1 ? 'shipment' : 'shipments'}
            </Text>
          </View>
        ) : viewMode === 'table' ? renderRow(r.event) : renderCard(r.event)
      }
    />
  );
}
