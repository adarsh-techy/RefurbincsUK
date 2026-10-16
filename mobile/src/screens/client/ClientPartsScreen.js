import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';

// The client's own parts inventory (web ClientPartsPage): the stock the
// workshop holds for this client's repairs, with each part's minimum level.
// Only this client's parts come back from /clients/me/parts, without pricing.

function stockState(p) {
  const qty = Number(p.quantity) || 0;
  const min = Number(p.min_stock) || 0;
  if (qty <= 0) {
    return {
      status: 'out',
      label: 'Out of Stock',
      cls: 'bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/40',
      text: 'text-rose-700 dark:text-rose-300',
      qtyColor: 'text-rose-600 dark:text-rose-400',
      barColor: 'bg-rose-500',
      ratio: 0,
    };
  }
  if (p.is_low || (min > 0 && qty <= min)) {
    const ratio = min > 0 ? Math.min(100, Math.round((qty / min) * 100)) : 50;
    return {
      status: 'low',
      label: `Low Stock (${qty} left)`,
      cls: 'bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/40',
      text: 'text-amber-800 dark:text-amber-300',
      qtyColor: 'text-amber-600 dark:text-amber-400',
      barColor: 'bg-amber-500',
      ratio,
    };
  }
  const ratio = min > 0 ? Math.min(100, Math.round((qty / (min * 2)) * 100)) : 100;
  return {
    status: 'in_stock',
    label: 'In Stock',
    cls: 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    qtyColor: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
    ratio,
  };
}

export default function ClientPartsScreen() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'in_stock' | 'low' | 'out'

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

  // Stats calculation
  const stats = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let out = 0;

    parts.forEach((p) => {
      const state = stockState(p);
      if (state.status === 'out') out += 1;
      else if (state.status === 'low') low += 1;
      else inStock += 1;
    });

    return {
      total: parts.length,
      inStock,
      low,
      out,
    };
  }, [parts]);

  // Filtered rows
  const rows = useMemo(() => {
    return parts.filter((p) => {
      const state = stockState(p);
      if (filterTab === 'in_stock' && state.status !== 'in_stock') return false;
      if (filterTab === 'low' && state.status !== 'low') return false;
      if (filterTab === 'out' && state.status !== 'out') return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    });
  }, [parts, filterTab, search]);

  const header = (
    <View className="gap-2 pb-1.5">
      {/* Title & Refresh Button */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="text-base font-black text-slate-900 dark:text-white">Parts Inventory</Text>
            <View className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 dark:border-slate-800 dark:bg-slate-800">
              <Text className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
                {rows.length} {rows.length === 1 ? 'Part' : 'Parts'}
              </Text>
            </View>
          </View>
          <Text className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            Workshop parts stock held for your battery repairs.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setRefreshing(true);
            load();
          }}
          className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900 shadow-2xs"
        >
          <Icon name="rotateCcw" size={11} color="#64748b" />
          <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Overview Metric Cards - Compact 2x2 Paired Layout */}
      <View className="gap-1.5">
        <View className="flex-row gap-1.5">
          {/* Total Catalog */}
          <TouchableOpacity
            onPress={() => setFilterTab('all')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              filterTab === 'all'
                ? 'border-blue-400 bg-blue-50/50 dark:border-blue-800/60 dark:bg-blue-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Catalog
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950">
                <Icon name="package" size={10} color="#2563eb" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-slate-900 dark:text-white leading-tight">
              {stats.total}
            </Text>
            <Text className="text-[8px] font-medium text-slate-400 dark:text-slate-400 mt-0.5">
              Registered SKUs
            </Text>
          </TouchableOpacity>

          {/* In Stock */}
          <TouchableOpacity
            onPress={() => setFilterTab(filterTab === 'in_stock' ? 'all' : 'in_stock')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              filterTab === 'in_stock'
                ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                In Stock
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                <Icon name="checkCircle" size={10} color="#059669" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-emerald-600 dark:text-emerald-400 leading-tight">
              {stats.inStock}
            </Text>
            <Text className="text-[8px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              Healthy Levels
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-1.5">
          {/* Low Stock */}
          <TouchableOpacity
            onPress={() => setFilterTab(filterTab === 'low' ? 'all' : 'low')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              filterTab === 'low'
                ? 'border-amber-400 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Low Stock
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
                <Icon name="alertTriangle" size={10} color="#d97706" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-amber-600 dark:text-amber-400 leading-tight">
              {stats.low}
            </Text>
            <Text className="text-[8px] font-medium text-amber-700 dark:text-amber-400 mt-0.5">
              Near Minimum
            </Text>
          </TouchableOpacity>

          {/* Out of Stock */}
          <TouchableOpacity
            onPress={() => setFilterTab(filterTab === 'out' ? 'all' : 'out')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              filterTab === 'out'
                ? 'border-rose-400 bg-rose-50/50 dark:border-rose-800/60 dark:bg-rose-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Out of Stock
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-rose-100 dark:bg-rose-950">
                <Icon name="close" size={10} color="#e11d48" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-rose-600 dark:text-rose-400 leading-tight">
              {stats.out}
            </Text>
            <Text className="text-[8px] font-medium text-rose-700 dark:text-rose-400 mt-0.5">
              Zero Available
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Low Stock Notice */}
      {(stats.low > 0 || stats.out > 0) && (
        <View className="flex-row items-start gap-1.5 rounded-lg border border-amber-300/80 bg-amber-50/80 p-2 dark:border-amber-900/40 dark:bg-amber-950/30">
          <Icon name="alertTriangle" size={13} color="#d97706" />
          <Text className="flex-1 text-[10px] leading-3.5 text-amber-900 dark:text-amber-200">
            <Text className="font-bold">{stats.low + stats.out} part{stats.low + stats.out === 1 ? '' : 's'} need attention. </Text>
            {stats.out > 0 ? `${stats.out} depleted. ` : ''}
            Repairs may be delayed until parts are restocked.
          </Text>
        </View>
      )}

      {/* Search Input - Clean layout with Icon */}
      <View className="relative flex-row items-center rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <Icon name="search" size={12} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search part name or SKU…"
          placeholderTextColor="#94a3b8"
          className="flex-1 py-1.5 px-2 text-[11px] text-slate-900 dark:text-white"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="close" size={11} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View className="flex-row items-center gap-1 overflow-x-auto py-0.5">
        {[
          { id: 'all', label: 'All', count: stats.total },
          { id: 'in_stock', label: 'In Stock', count: stats.inStock },
          { id: 'low', label: 'Low', count: stats.low },
          { id: 'out', label: 'Out', count: stats.out },
        ].map((tab) => {
          const active = filterTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setFilterTab(tab.id)}
              className={`flex-row items-center gap-1 rounded-lg px-2 py-1 ${
                active
                  ? 'bg-slate-900 dark:bg-white'
                  : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <Text className={`text-[10px] font-bold ${active ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                {tab.label}
              </Text>
              <View className={`rounded-full px-1.5 py-0.2 ${active ? 'bg-white/20 dark:bg-slate-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Text className={`text-[8.5px] font-bold ${active ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {(search || filterTab !== 'all') && (
        <TouchableOpacity
          onPress={() => {
            setSearch('');
            setFilterTab('all');
          }}
          className="self-start rounded-lg border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <Text className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">Clear all filters</Text>
        </TouchableOpacity>
      )}

      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <FlatList
        data={rows}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-2.5 gap-2 pb-16"
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
          <View className="items-center rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            {loading ? (
              <ActivityIndicator color="#10b981" />
            ) : (
              <>
                <View className="mb-2 h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Icon name="package" size={16} color="#94a3b8" />
                </View>
                <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {parts.length ? 'No parts match your filter criteria' : 'No parts held in inventory yet.'}
                </Text>
                {search || filterTab !== 'all' ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearch('');
                      setFilterTab('all');
                    }}
                    className="mt-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Text className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Reset Filters</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        }
        renderItem={({ item: p }) => {
          const s = stockState(p);
          const qty = Number(p.quantity) || 0;
          const min = Number(p.min_stock) || 0;

          return (
            <View className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              {/* Header: Part name + Status badge */}
              <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-xs font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text className="mt-0.5 font-mono text-[9px] text-slate-400 dark:text-slate-500">
                    {p.sku ? `SKU: ${p.sku}` : 'SKU: —'}
                  </Text>
                </View>
                <View className={`rounded-full px-1.5 py-0.5 ${s.cls}`}>
                  <Text className={`text-[8.5px] font-bold ${s.text}`}>{s.label}</Text>
                </View>
              </View>

              {/* Stock Numbers */}
              <View className="mt-2 flex-row items-center justify-between rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                <View>
                  <Text className="text-[8.5px] font-semibold text-slate-400">Available</Text>
                  <Text className={`text-xs font-black ${s.qtyColor}`}>{qty} units</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[8.5px] font-semibold text-slate-400">Min Threshold</Text>
                  <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">{min} units</Text>
                </View>
              </View>

              {/* Stock Level Bar */}
              <View className="mt-1.5">
                <View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <View
                    className={`h-full rounded-full ${s.barColor}`}
                    style={{ width: `${Math.max(5, Math.min(100, s.ratio))}%` }}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
