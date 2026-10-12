import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { Badge } from '../../../components/ui/Badge';
import DateField from '../../../components/admin/DateField';
import { Banner, EmptyState } from '../../../components/admin/sa5/common';

// Audit Log — the web AuditLogPage: GET /audit-logs?limit=15&offset=…
// (&date=YYYY-MM-DD), loaded 15 at a time as you scroll. Each entry shows
// the user, the action (coloured like the web badge), the entity, the
// entity ID and the date/time.

const PAGE_SIZE = 15;
const ACTION_TONES = { create: 'good', import: 'good', update_stock: 'info', update: 'info', delete: 'critical' };
const label = (v) => (v ? String(v).replace(/_/g, ' ') : '');

export default function AuditLogScreen() {
  const [date, setDate] = useState('');
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const reqRef = useRef(0);

  const fetchPage = useCallback(async (offset) => {
    const id = ++reqRef.current;
    try {
      const params = { limit: PAGE_SIZE, offset };
      if (date) params.date = date;
      const { data } = await apiClient.get('/audit-logs', { params });
      if (id !== reqRef.current) return;
      const rows = data?.data || [];
      setItems((prev) => (offset === 0 ? rows : [...prev, ...rows]));
      setHasMore(Boolean(data?.hasMore));
      setError(null);
    } catch (err) {
      if (id === reqRef.current) setError(err.response?.data?.message || err.message);
    } finally {
      if (id === reqRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    fetchPage(0);
  }, [fetchPage]);

  function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    fetchPage(items.length);
  }

  const header = (
    <View className="mb-3 gap-3">
      <View>
        <Text className="text-2xl font-bold text-green-600">Audit Log</Text>
        <Text className="text-xs text-slate-500">Who did what, and when.</Text>
      </View>
      <View className="rounded-xl border border-blue-200 bg-white p-3">
        <DateField label="Log date" value={date} onChange={setDate} />
        {date ? (
          <TouchableOpacity onPress={() => setDate('')} className="mt-2 self-start">
            <Text className="text-sm font-medium text-slate-500">Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Banner tone="bad" text={error} /> : null}
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16"
      data={items}
      keyExtractor={(row) => String(row.id)}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPage(0); }} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ItemSeparatorComponent={() => <View className="h-2" />}
      renderItem={({ item: row, index }) => (
        <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Text className="font-mono text-xs font-bold text-slate-400">#{index + 1}</Text>
              <Text className="flex-1 text-sm font-bold text-slate-900" numberOfLines={1}>{row.user_name || 'System'}</Text>
            </View>
            <Badge tone={ACTION_TONES[row.action] || 'neutral'}>{label(row.action)}</Badge>
          </View>
          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
            <Text className="text-xs text-slate-500">Entity: <Text className="font-semibold capitalize text-slate-800">{label(row.entity)}</Text></Text>
            <Text className="text-xs text-slate-500">Entity ID: <Text className="font-semibold text-slate-800">{row.entity_id ?? '—'}</Text></Text>
          </View>
          <Text className="mt-1 text-[11px] text-slate-400">{new Date(row.created_at).toLocaleString()}</Text>
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <View className="items-center py-10"><ActivityIndicator color="#2563eb" /><Text className="mt-2 text-xs text-slate-500">Loading…</Text></View>
        ) : error ? null : (
          <EmptyState icon="🕒" title={date ? `No audit entries on ${date}` : 'No audit entries'} />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator className="mt-4" color="#2563eb" /> : null}
    />
  );
}
