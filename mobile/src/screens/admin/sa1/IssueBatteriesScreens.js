import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { StatusBadge } from '../../../components/ui/Badge';
import DateField, { prettyYmd } from '../../../components/admin/DateField';
import ImageViewerModal from '../../../components/ui/ImageViewerModal';
import { resolveImageUrl } from '../../../utils/imageUrl';
import { navigateWebPath } from '../../../components/admin/sa1/web-route';

// The phone version of Unserviceable Batteries and Recycled Batteries pages:
// GET /batteries with a fixed status set, search (battery / client / reason),
// date filtering, status tabs, and each battery's reason, note, photos (tap to enlarge).

const PAGE = 15;
const DEBOUNCE_MS = 250;
const UNSERVICEABLE_ALL = 'unserviceable,tested_parts_removed';
const UNSERVICEABLE_OPTIONS = [
  [UNSERVICEABLE_ALL, 'All Quarantined'],
  ['unserviceable', 'Unserviceable'],
  ['tested_parts_removed', 'Test Failed'],
];

function Photos({ photos, onOpen }) {
  if (!photos?.length) return null;
  return (
    <View className="flex-row items-center gap-1 flex-wrap pt-0.5">
      {photos.slice(0, 4).map((p, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onOpen(i)}
          className="h-8 w-8 overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs"
        >
          <Image
            source={{ uri: resolveImageUrl(p) }}
            className="h-full w-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
      {photos.length > 4 && (
        <View className="h-8 px-1.5 rounded-md bg-slate-100 border border-slate-200 items-center justify-center">
          <Text className="text-[10px] font-bold text-slate-500">+{photos.length - 4}</Text>
        </View>
      )}
    </View>
  );
}

function IssueBatteriesList({ mode }) {
  const navigation = useNavigation();
  const recycled = mode === 'recycled';
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [date, setDate] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [statusFilter, setStatusFilter] = useState(recycled ? 'recycled' : UNSERVICEABLE_ALL);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images, index, title }
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(
    async (offset, replace) => {
      const id = ++reqRef.current;
      try {
        const params = { limit: PAGE, offset, status: statusFilter };
        if (debounced) params.search = debounced;
        if (date) params.date = date;
        const { data } = await apiClient.get('/batteries', { params });
        if (id !== reqRef.current) return;
        setRows((prev) => (replace ? data.data || [] : [...prev, ...(data.data || [])]));
        setHasMore(Boolean(data.hasMore));
        setTotal(Number(data.total) || 0);
        setError(null);
      } catch (err) {
        if (id === reqRef.current) setError(err.response?.data?.message || err.message);
      } finally {
        if (id === reqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [statusFilter, debounced, date]
  );

  useEffect(() => {
    setLoading(true);
    fetchPage(0, true);
  }, [fetchPage]);

  const filtered = Boolean(search || date || (!recycled && statusFilter !== UNSERVICEABLE_ALL));
  const clearAll = () => {
    setSearch('');
    setDate('');
    if (!recycled) setStatusFilter(UNSERVICEABLE_ALL);
  };

  const header = (
    <View className="gap-2 pb-1">
      {/* Executive Header Card — COMPACT */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs gap-2">
        <View className="gap-0.5">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-base font-extrabold tracking-tight text-slate-900">
              {recycled ? 'Recycled Batteries' : 'Unserviceable Batteries'}
            </Text>
            <View
              className={`rounded-md border px-1.5 py-0.5 ${
                recycled
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <Text
                className={`text-[9.5px] font-bold ${
                  recycled ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {recycled ? 'Certified Recovery' : 'Workshop Quarantine'}
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-slate-500">
            {recycled
              ? 'All decommissioned batteries safely processed and sent for certified eco-recycling and material recovery.'
              : 'Batteries reported as unserviceable or test-failed (parts removed) — quarantined in workshop.'}
          </Text>
        </View>

        {/* Live Counters Strip */}
        <View className="flex-row items-center gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
          <Text className="text-[10.5px] text-slate-500">
            Total:{' '}
            <Text
              className={`font-bold ${
                recycled ? 'text-emerald-700' : 'text-slate-900'
              }`}
            >
              {total !== undefined ? total : rows.length}
            </Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-slate-500">
            Showing: <Text className="font-bold text-slate-700">{rows.length}</Text>
          </Text>
          {!recycled && total !== undefined && total >= 100 && (
            <>
              <Text className="text-slate-300">•</Text>
              <Text className="text-[10px] font-bold text-rose-600">
                100+ Threshold Alert
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Toolbar: Search, Status Tabs & Date Filter — COMPACT */}
      <View className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs gap-1.5">
        {/* Search input */}
        <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1">
          <Icon name="search" size={13} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={
              recycled ? 'Search battery / partner…' : 'Search battery / client / reason…'
            }
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="flex-1 p-0 text-xs text-slate-800"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" size={12} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Tab Chips (for unserviceable mode) */}
        {!recycled && (
          <View className="flex-row flex-wrap items-center gap-1">
            {UNSERVICEABLE_OPTIONS.map(([v, label]) => {
              const active = statusFilter === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setStatusFilter(v)}
                  className={`rounded-lg border px-2 py-0.5 ${
                    active
                      ? v === 'unserviceable'
                        ? 'border-rose-600 bg-rose-600'
                        : v === 'tested_parts_removed'
                        ? 'border-amber-600 bg-amber-600'
                        : 'border-slate-900 bg-slate-900'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Text
                    className={`text-[10.5px] font-bold ${
                      active ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Date Filter & Clear row */}
        <View className="flex-row items-center justify-between pt-0.5">
          <TouchableOpacity
            onPress={() => setShowDate((v) => !v)}
            className="flex-row items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5"
          >
            <Icon name="clock" size={11} color="#64748b" />
            <Text className="text-[10.5px] font-semibold text-slate-700">
              {date ? prettyYmd(date) : recycled ? 'Recycled Date' : 'Created Date'}
            </Text>
            <Text className="text-[9.5px] font-bold text-blue-600">
              {showDate ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {filtered && (
            <TouchableOpacity onPress={clearAll} className="px-1.5 py-0.5">
              <Text className="text-[10.5px] font-bold text-rose-600">Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDate && (
          <View className="pt-1 border-t border-slate-100">
            <DateField value={date} onChange={setDate} compact />
          </View>
        )}
      </View>

      {error ? (
        <Text className="rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">
          {error}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rows}
        keyExtractor={(b) => String(b.id || b.battery_code)}
        contentContainerClassName="p-2.5 pb-16 gap-2"
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPage(0, true);
            }}
          />
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            setLoading(true);
            fetchPage(rows.length, false);
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View className="items-center rounded-xl border border-slate-200/90 bg-white p-6 gap-1 shadow-2xs">
            <Icon name="battery" color="#94a3b8" size={20} />
            <Text className="text-xs font-semibold text-slate-800">
              {loading
                ? 'Loading…'
                : recycled
                ? 'No recycled batteries match these filters.'
                : 'No unserviceable batteries quarantined.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <Text className="py-2.5 text-center text-[11px] text-slate-400">
              Loading more…
            </Text>
          ) : null
        }
        renderItem={({ item: b, index }) => {
          const photos = b.issue_photos || [];
          const ts = recycled
            ? b.recycled_at || b.updated_at || b.created_at
            : b.issue_reported_at;

          return (
            <View
              key={b.id || b.battery_code}
              className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs gap-1.5"
            >
              {/* Top Row: Avatar + Battery Code + Status Badge */}
              <View className="flex-row items-start justify-between gap-1.5">
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('BatteryDetail', {
                      code: b.battery_code,
                      fromScan: false,
                    })
                  }
                  className="flex-1 flex-row items-center gap-1.5 min-w-0"
                >
                  <View
                    className={`h-6 w-6 rounded-md items-center justify-center shrink-0 border ${
                      recycled
                        ? 'bg-emerald-50 border-emerald-100'
                        : 'bg-amber-50 border-amber-100'
                    }`}
                  >
                    <Icon
                      name={recycled ? 'battery' : 'alertTriangle'}
                      size={12}
                      color={recycled ? '#059669' : '#d97706'}
                    />
                  </View>
                  <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                    <Text className="text-[10px] font-bold font-mono text-slate-400">
                      #{index + 1}
                    </Text>
                    <Text className="text-xs font-extrabold text-blue-600 truncate">
                      {b.battery_code}
                    </Text>
                  </View>
                </TouchableOpacity>

                <StatusBadge status={b.status || (recycled ? 'recycled' : 'unserviceable')} />
              </View>

              {/* Middle Container: Client & Reasons */}
              <View className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 gap-1">
                <View className="flex-row items-center justify-between text-[11px]">
                  <Text className="text-[11px] text-slate-500">
                    {recycled ? 'Original Client' : 'Client'}:{' '}
                    <Text className="font-semibold text-slate-800">
                      {b.client_name || '—'}
                    </Text>
                  </Text>
                  <Text className="text-[10px] text-slate-400">
                    {ts
                      ? new Date(ts).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : '—'}
                  </Text>
                </View>

                {/* Recycled Partner / Batch (if recycled) */}
                {recycled && (
                  <View className="flex-row items-center gap-1 flex-wrap">
                    <Text className="text-[10px] uppercase font-bold text-slate-400">
                      Partner:
                    </Text>
                    <Text className="text-[11px] font-semibold text-slate-800">
                      {b.recycle_client_name || 'Standard Certified Stream'}
                    </Text>
                    {b.recycle_batch_id ? (
                      <TouchableOpacity
                        onPress={() =>
                          navigateWebPath(navigation, `/recycle/${b.recycle_batch_id}`)
                        }
                      >
                        <Text className="text-[11px] font-semibold text-blue-600">
                          (Shipment #{b.recycle_batch_id})
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {/* Reason Row */}
                <View className="flex-row items-center gap-1 flex-wrap">
                  <Text className="text-[10px] uppercase font-bold text-slate-400">
                    {recycled ? 'Decommission:' : 'Reason:'}
                  </Text>
                  <View className="rounded bg-amber-100/70 px-1.5 py-0.2">
                    <Text className="text-[10px] font-bold text-amber-800">
                      {b.issue_reason || 'Decommissioned'}
                    </Text>
                  </View>
                </View>

                {/* Technician Note */}
                {!recycled && b.issue_note ? (
                  <Text className="text-[10.5px] italic text-slate-600 bg-white/70 rounded px-1.5 py-0.5 border border-slate-100">
                    "{b.issue_note}"
                  </Text>
                ) : null}

                {/* Photos Row */}
                {photos.length > 0 && (
                  <Photos
                    photos={photos}
                    onOpen={(i) =>
                      setLightbox({
                        images: photos,
                        index: i,
                        title: `${recycled ? 'Decommission Photos' : 'Photos'} — ${
                          b.battery_code
                        }`,
                      })
                    }
                  />
                )}
              </View>

              {/* Bottom Action Row */}
              <View className="flex-row items-center justify-between pt-0.5">
                <Text className="text-[10px] text-slate-400">
                  {recycled ? 'Recycled on' : 'Reported on'}{' '}
                  {ts
                    ? new Date(ts).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('BatteryDetail', {
                      code: b.battery_code,
                      fromScan: false,
                    })
                  }
                  className="flex-row items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs"
                >
                  <Text className="text-[10px] font-semibold text-slate-700">
                    View Battery
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {lightbox && (
        <ImageViewerModal
          visible
          images={lightbox.images}
          initialIndex={lightbox.index}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </View>
  );
}

export function UnserviceableBatteriesScreen() {
  return <IssueBatteriesList mode="unserviceable" />;
}

export function RecycledBatteriesScreen() {
  return <IssueBatteriesList mode="recycled" />;
}
