import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Whole-fleet battery list for office roles — GET /batteries (paged:
// { data, hasMore, total }) with the same search and status filters as the
// web Battery Fleet page. Tap a row to open the shared BatteryDetailScreen.

const PAGE = 30;
const DEBOUNCE_MS = 350;
const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'in_repair', label: 'Awaiting' },
  { id: 'in_progress', label: 'Repairing' },
  { id: 'in_testing', label: 'Testing' },
  { id: 'repaired', label: 'Repaired' },
  { id: 'returned', label: 'Returned' },
  { id: 'unserviceable', label: 'Unserviceable' },
  { id: 'recycled', label: 'Recycled' },
];

export default function AdminBatteriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(route.params?.status || '');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  // A KPI tap on the dashboard re-focuses this tab with a status param
  useEffect(() => {
    if (route.params?.status !== undefined) setStatus(route.params.status || '');
  }, [route.params?.status]);
  useEffect(() => {
    if (route.params?.search !== undefined) setSearch(route.params.search || '');
  }, [route.params?.search]);

  const fetchPage = useCallback(async (offset, replace) => {
    const reqId = ++requestRef.current;
    try {
      const params = { limit: PAGE, offset };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      const { data } = await apiClient.get('/batteries', { params });
      if (reqId !== requestRef.current) return; // a newer request superseded this one
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
  }, [search, status]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(() => fetchPage(0, true), search ? DEBOUNCE_MS : 0);
    return () => clearTimeout(debounceRef.current);
  }, [fetchPage, search]);

  function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    fetchPage(rows.length, false);
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Icon name="search" color="#94a3b8" size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search code, serial, client…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            className="flex-1 text-sm text-slate-900"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" color="#64748b" size={16} />
            </TouchableOpacity>
          ) : null}
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(f) => f.id || 'all'}
          contentContainerClassName="gap-1.5 pt-2.5"
          renderItem={({ item: f }) => {
            const active = status === f.id;
            return (
              <TouchableOpacity
                onPress={() => setStatus(f.id)}
                className={`rounded-xl px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}
              >
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{f.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {error && (
        <View className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(b) => String(b.id)}
        contentContainerClassName="p-4 gap-2 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPage(0, true); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          !loading ? (
            <Text className="mb-1 text-[11px] font-semibold text-slate-400">
              {total.toLocaleString()} batter{total === 1 ? 'y' : 'ies'}{status ? ` · ${STATUS_FILTERS.find((f) => f.id === status)?.label}` : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="battery" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading batteries…' : 'No batteries found'}</Text>
            {!loading && <Text className="mt-0.5 text-xs text-slate-400">Try a different search or status.</Text>}
          </View>
        }
        ListFooterComponent={loadingMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
        renderItem={({ item: b }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })}
            className="rounded-2xl border border-slate-200 bg-white p-3.5"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-extrabold text-blue-700">{b.battery_code}</Text>
              <StatusBadge status={b.effective_status || b.status} />
            </View>
            <View className="mt-1.5 flex-row items-center justify-between">
              <Text className="flex-1 text-xs text-slate-600" numberOfLines={1}>
                {b.client_name || 'No client'}{b.serial_number ? ` · SN ${b.serial_number}` : ''}
              </Text>
              {b.truck_number ? <Text className="text-[11px] text-slate-400">Truck {b.truck_number}</Text> : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
