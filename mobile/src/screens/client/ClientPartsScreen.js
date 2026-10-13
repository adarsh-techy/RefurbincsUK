import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../services/api-client';

// The client's own parts inventory (web ClientPartsPage): the stock the
// workshop holds for this client's repairs, with each part's minimum level.
// Only this client's parts come back from /clients/me/parts, without pricing.

function stockState(p) {
  const qty = Number(p.quantity) || 0;
  if (qty <= 0) return { label: 'Out of Stock', cls: 'bg-red-100', text: 'text-red-700' };
  if (p.is_low) return { label: `Low Stock (${qty} left)`, cls: 'bg-amber-100', text: 'text-amber-800' };
  return { label: 'In Stock', cls: 'bg-emerald-100', text: 'text-emerald-700' };
}

export default function ClientPartsScreen() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/clients/me/parts');
      setParts(data?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const lowCount = parts.filter((p) => p.is_low).length;
  const q = search.trim().toLowerCase();
  const rows = parts
    .filter((p) => !lowOnly || p.is_low)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));

  const header = (
    <View className="gap-3 pb-1">
      <View>
        <Text className="text-2xl font-bold text-green-600">Parts Inventory</Text>
        <Text className="mt-1 text-sm text-slate-500">The parts stock the workshop holds for your batteries, and the minimum level for each.</Text>
      </View>
      {lowCount > 0 && (
        <View className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
          <Text className="text-sm text-amber-900">
            <Text className="font-bold">{lowCount} part{lowCount === 1 ? ' is' : 's are'} at or below the minimum stock level.</Text> Repairs may be delayed until the stock is topped up.
          </Text>
        </View>
      )}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search part name or SKU…"
        placeholderTextColor="#94a3b8"
        className="min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
      />
      <View className="flex-row flex-wrap items-center gap-3">
        <TouchableOpacity
          onPress={() => setLowOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 ${lowOnly ? 'bg-amber-600' : 'border border-amber-300 bg-white'}`}
        >
          <Text className={`text-sm font-medium ${lowOnly ? 'text-white' : 'text-amber-800'}`}>Low Stock Only ({lowCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }}>
          <Text className="text-sm font-medium text-blue-700">Refresh</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rows}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Text className="text-sm font-semibold text-slate-800">
              {loading ? 'Loading…' : parts.length ? 'No parts match your search.' : 'No parts are held for you yet.'}
            </Text>
          </View>
        }
        renderItem={({ item: p, index }) => {
          const s = stockState(p);
          return (
            <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="w-6 pt-0.5 text-xs font-bold text-slate-400">{index + 1}</Text>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-bold text-slate-900">{p.name}</Text>
                  <Text className="text-xs text-slate-500">SKU {p.sku || '—'}</Text>
                </View>
                <View className={`shrink rounded-full px-2.5 py-1 ${s.cls}`}>
                  <Text className={`text-xs font-bold ${s.text}`}>{s.label}</Text>
                </View>
              </View>
              <View className="ml-6 mt-2 flex-row flex-wrap gap-x-4">
                <Text className="text-xs text-slate-600">Available <Text className="font-bold text-slate-900">{p.quantity}</Text></Text>
                <Text className="text-xs text-slate-600">Minimum <Text className="font-bold text-slate-900">{p.min_stock}</Text></Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
