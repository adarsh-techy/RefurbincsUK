import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';
import { Badge } from '../ui/Badge';
import Icon from '../ui/Icon';

// One list screen for every admin module. Each page passes a config:
//   endpoint   GET path (e.g. '/repairs')
//   params     extra query params
//   paged      true → server paging with limit/offset (expects { data, hasMore })
//              false → whole list fetched once ({ data } | array | { rows })
//   pick       (res) => array, when the list lives somewhere unusual
//   searchKeys fields matched by the local search box (always local filter;
//              with paged lists the search is also sent as ?search=)
//   title / subtitle / meta / badge / actions / onPress   per-row renderers
//   header     (rows, extra) => node rendered above the list
//   empty      text when nothing is found
// Rows refresh on pull-down and after any action resolves.

const PAGE = 25;
const DEBOUNCE_MS = 350;

function extract(res, pick) {
  if (pick) return pick(res) || [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

export default function AdminListScreen({
  endpoint,
  params = {},
  paged = false,
  pick,
  searchKeys = [],
  searchPlaceholder = 'Search…',
  title,
  subtitle,
  meta,
  badge,
  actions,
  onPress,
  header,
  empty = 'Nothing found',
  icon = 'grid',
  keyField = 'id',
  filters, // [{ id, label, test(row) }] local filter chips
  addLabel, // shows an "+ Add …" button when set
  onAdd, // (reload) => void
  onPressRow, // (row, reload) => void — like onPress but gets reload
}) {
  const [rows, setRows] = useState([]);
  const [extra, setExtra] = useState(null); // the non-list part of the response (stats etc.)
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(filters?.[0]?.id || null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);
  const paramsKey = JSON.stringify(params);

  const fetchPage = useCallback(async (offset, replace) => {
    const reqId = ++requestRef.current;
    try {
      const query = { ...params };
      if (paged) {
        query.limit = PAGE;
        query.offset = offset;
        if (search.trim()) query.search = search.trim();
      }
      const { data } = await apiClient.get(endpoint, { params: query });
      if (reqId !== requestRef.current) return;
      const list = extract(data, pick);
      setRows((prev) => (replace ? list : [...prev, ...list]));
      setExtra(Array.isArray(data) ? null : data);
      setHasMore(paged ? Boolean(data?.hasMore ?? data?.pagination?.hasMore) : false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey, paged, search]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (paged) {
      setLoading(true);
      debounceRef.current = setTimeout(() => fetchPage(0, true), search ? DEBOUNCE_MS : 0);
      return () => clearTimeout(debounceRef.current);
    }
    setLoading(true);
    fetchPage(0, true);
    return undefined;
  }, [fetchPage, paged, search]);

  const reload = () => {
    setRefreshing(true);
    fetchPage(0, true);
  };

  // Coming back from a create/edit form: refresh quietly
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      fetchPage(0, true);
    }, [fetchPage])
  );

  function loadMore() {
    if (!paged || loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    fetchPage(rows.length, false);
  }

  const q = search.trim().toLowerCase();
  let visible = rows;
  if (q && searchKeys.length) {
    visible = visible.filter((row) =>
      searchKeys.some((k) => {
        const v = typeof k === 'function' ? k(row) : row[k];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
      })
    );
  }
  if (filters && filter) {
    const f = filters.find((x) => x.id === filter);
    if (f?.test) visible = visible.filter(f.test);
  }

  async function runAction(row, action) {
    const key = `${row[keyField]}-${action.label}`;
    setBusyKey(key);
    try {
      await action.onPress(row);
      await fetchPage(0, true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      {(searchKeys.length > 0 || filters || addLabel) && (
        <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
          {addLabel && onAdd && (
            <TouchableOpacity onPress={() => onAdd(reload)} className="mb-2.5 items-center rounded-2xl bg-emerald-600 py-2.5">
              <Text className="text-sm font-bold text-white">+ {addLabel}</Text>
            </TouchableOpacity>
          )}
          {searchKeys.length > 0 && (
            <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <Icon name="search" color="#94a3b8" size={16} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
                className="flex-1 text-sm text-slate-900"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Icon name="x" color="#64748b" size={16} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          {filters && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={filters}
              keyExtractor={(f) => f.id}
              contentContainerClassName="gap-1.5 pt-2.5"
              renderItem={({ item: f }) => {
                const active = filter === f.id;
                return (
                  <TouchableOpacity
                    onPress={() => setFilter(f.id)}
                    className={`rounded-xl px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}
                  >
                    <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{f.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(row, i) => String(row[keyField] ?? i)}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View className="gap-3">
            {error && (
              <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
                <Text className="text-xs font-semibold text-red-700">{error}</Text>
              </View>
            )}
            {header ? header(rows, extra, reload) : null}
            {!loading && (
              <Text className="text-[11px] font-semibold text-slate-400">
                {visible.length} item{visible.length === 1 ? '' : 's'}{hasMore ? ' · scroll for more' : ''}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name={icon} color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading…' : empty}</Text>
          </View>
        }
        ListFooterComponent={loadingMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
        renderItem={({ item: row }) => {
          const b = badge ? badge(row) : null;
          const metaLines = meta ? [].concat(meta(row)).filter(Boolean) : [];
          const rowActions = actions ? actions(row).filter(Boolean) : [];
          const tap = onPressRow ? () => onPressRow(row, reload) : onPress ? () => onPress(row) : undefined;
          const Wrapper = tap ? TouchableOpacity : View;
          return (
            <Wrapper
              onPress={tap}
              activeOpacity={0.8}
              className="rounded-2xl border border-slate-200 bg-white p-3.5"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-slate-900" numberOfLines={2}>{title(row)}</Text>
                  {subtitle ? (
                    <Text className="mt-0.5 text-xs text-slate-600" numberOfLines={2}>{subtitle(row)}</Text>
                  ) : null}
                </View>
                {b ? <Badge tone={b.tone || 'neutral'}>{b.label}</Badge> : null}
              </View>
              {metaLines.length > 0 && (
                <View className="mt-2 gap-0.5">
                  {metaLines.map((line, i) => (
                    <Text key={i} className="text-[11px] text-slate-500" numberOfLines={2}>{line}</Text>
                  ))}
                </View>
              )}
              {rowActions.length > 0 && (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {rowActions.map((a) => {
                    const busy = busyKey === `${row[keyField]}-${a.label}`;
                    const tones = {
                      primary: 'bg-blue-600',
                      good: 'bg-emerald-600',
                      danger: 'bg-red-600',
                      neutral: 'bg-slate-700',
                    };
                    return (
                      <TouchableOpacity
                        key={a.label}
                        disabled={busy}
                        onPress={() => runAction(row, a)}
                        className={`rounded-xl px-3 py-2 ${tones[a.tone] || tones.neutral} ${busy ? 'opacity-60' : ''}`}
                      >
                        <Text className="text-xs font-bold text-white">{busy ? '…' : a.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Wrapper>
          );
        }}
      />
    </View>
  );
}
