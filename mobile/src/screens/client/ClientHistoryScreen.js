import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Service History — the mobile version of the web ClientHistoryPage:
// GET /clients/me/history → { summary, events }, every truck packed, every
// workshop intake and every return dispatch, newest first, with the same
// type / date filters and search.

const TYPE_FILTERS = [
  { id: 'all', label: 'All Truck Shipments' },
  { id: 'packed', label: 'Trucks Packed' },
  { id: 'intake', label: 'Workshop Intakes' },
  { id: 'return', label: 'Trucks Returned' },
];
const DATE_FILTERS = [
  { id: 'all', label: 'All Time', days: null },
  { id: '30d', label: '30 Days', days: 30 },
  { id: '90d', label: '90 Days', days: 90 },
  { id: 'year', label: '1 Year', days: 365 },
];
const TYPE_META = {
  packed: { tone: 'warning', icon: 'package' },
  intake: { tone: 'info', icon: 'truck' },
  return: { tone: 'good', icon: 'checkCircle' },
};

const when = (v) => (v ? new Date(v).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function ClientHistoryScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [type, setType] = useState('all');
  const [range, setRange] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clients/me/history');
      setEvents(data?.events || []);
      setSummary(data?.summary || {});
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const days = DATE_FILTERS.find((d) => d.id === range)?.days;
    const since = days ? Date.now() - days * 86400000 : null;
    return events.filter((e) => {
      if (type !== 'all' && e.type !== type) return false;
      if (since && e.timestamp && new Date(e.timestamp).getTime() < since) return false;
      if (!q) return true;
      return [e.details, e.reference, e.vehicle_number, e.driver_name, e.type_label, e.staff_name]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [events, type, range, search]);

  const counts = {
    all: events.length,
    packed: summary.packed_count ?? events.filter((e) => e.type === 'packed').length,
    intake: summary.intake_count ?? events.filter((e) => e.type === 'intake').length,
    return: summary.return_count ?? events.filter((e) => e.type === 'return').length,
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Icon name="search" color="#94a3b8" size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search truck, driver, reference…"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="flex-1 text-sm text-slate-900"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 pt-2.5">
          {TYPE_FILTERS.map((f) => {
            const active = type === f.id;
            return (
              <TouchableOpacity key={f.id} onPress={() => setType(f.id)} className={`rounded-xl px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{f.label} ({counts[f.id] ?? 0})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View className="mt-2 flex-row gap-1.5">
          {DATE_FILTERS.map((f) => {
            const active = range === f.id;
            return (
              <TouchableOpacity key={f.id} onPress={() => setRange(f.id)} className={`rounded-lg px-2.5 py-1 ${active ? 'bg-emerald-600' : 'bg-slate-100'}`}>
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(e) => String(e.id)}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          error ? (
            <View className="mb-2 rounded-2xl border border-red-200 bg-red-50 p-3">
              <Text className="text-xs font-semibold text-red-700">{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="clock" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading history…' : 'No shipments in this range'}</Text>
          </View>
        }
        renderItem={({ item: e }) => {
          const meta = TYPE_META[e.type] || { tone: 'neutral', icon: 'clock' };
          const open = expanded === e.id;
          const list = Array.isArray(e.batteries_list) ? e.batteries_list : [];
          return (
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-row items-center gap-2.5 flex-1">
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                    <Icon name={meta.icon} color="#334155" size={18} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-slate-900">{e.type_label}</Text>
                    <Text className="text-[11px] text-slate-400">{when(e.timestamp)}</Text>
                  </View>
                </View>
                <Badge tone={meta.tone}>{e.reference || e.type}</Badge>
              </View>
              <Text className="mt-2.5 text-xs text-slate-700">{e.details}</Text>
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                {e.vehicle_number ? <Text className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Truck {e.vehicle_number}</Text> : null}
                {e.driver_name ? <Text className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Driver: {e.driver_name}</Text> : null}
                {e.staff_name ? <Text className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">By {e.staff_name}</Text> : null}
                {e.amount != null && Number(e.amount) > 0 ? <Text className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">£{Number(e.amount).toFixed(2)}</Text> : null}
                {e.type === 'return' ? (
                  <Text className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${e.verified_by_client ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {e.verified_by_client ? 'Receipt confirmed' : 'Awaiting your confirmation'}
                  </Text>
                ) : null}
              </View>
              {list.length > 0 && (
                <TouchableOpacity onPress={() => setExpanded(open ? null : e.id)} className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
                  <Text className="text-xs font-bold text-blue-700">{open ? 'Hide' : 'Show'} {list.length} batter{list.length === 1 ? 'y' : 'ies'}</Text>
                  <Text className="text-xs text-slate-400">{open ? '▲' : '▼'}</Text>
                </TouchableOpacity>
              )}
              {open && (
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {list.map((b, i) => {
                    const code = typeof b === 'string' ? b : b.battery_code || b.code;
                    return (
                      <TouchableOpacity key={`${code}-${i}`} onPress={() => navigation.navigate('BatteryDetail', { code, fromScan: false })} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1">
                        <Text className="text-[11px] font-bold text-blue-700">{code}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
