import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { StatusBadge } from '../../../components/ui/Badge';
import DateField, { prettyYmd } from '../../../components/admin/DateField';
import ImageViewerModal from '../../../components/ui/ImageViewerModal';
import { resolveImageUrl } from '../../../utils/imageUrl';
import { navigateWebPath } from '../../../components/admin/sa1/web-route';

// The web "Unserviceable Batteries" and "Recycled Batteries" pages:
// GET /batteries with a fixed status set, search (battery / client /
// reason), created-on date, Clear all, and each battery's reason, note,
// photos (tap to enlarge) and date. Recycled rows also show the recycling
// partner and the shipment they left on.

const PAGE = 15;
const DEBOUNCE_MS = 250;
const UNSERVICEABLE_ALL = 'unserviceable,tested_parts_removed';
const UNSERVICEABLE_OPTIONS = [
  [UNSERVICEABLE_ALL, 'All Unserviceable & Test Failed'],
  ['unserviceable', 'Unserviceable Only'],
  ['tested_parts_removed', 'Test Failed (Parts Removed)'],
];

function Photos({ photos, onOpen }) {
  if (!photos?.length) return <Text className="text-xs text-slate-400">—</Text>;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {photos.map((p, i) => (
        <TouchableOpacity key={i} onPress={() => onOpen(i)} className="h-10 w-10 overflow-hidden rounded-md border border-slate-200">
          <Image source={{ uri: resolveImageUrl(p) }} className="h-full w-full" resizeMode="cover" />
        </TouchableOpacity>
      ))}
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

  const fetchPage = useCallback(async (offset, replace) => {
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
      if (id === reqRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [statusFilter, debounced, date]);

  useEffect(() => { setLoading(true); fetchPage(0, true); }, [fetchPage]);

  const filtered = search || date || (!recycled && statusFilter !== UNSERVICEABLE_ALL);
  const clearAll = () => { setSearch(''); setDate(''); if (!recycled) setStatusFilter(UNSERVICEABLE_ALL); };
  const accent = recycled ? 'emerald' : 'blue';

  const header = (
    <View className="gap-3 pb-3">
      <View>
        <Text className="text-xl font-bold text-slate-900">{recycled ? 'Recycled Batteries' : 'Unserviceable Batteries'}</Text>
        <Text className="text-xs text-slate-500">
          {recycled
            ? 'All decommissioned batteries safely processed and sent for certified eco-recycling and material recovery.'
            : 'Batteries reported as unserviceable or test-failed (parts removed) — quarantined in workshop.'}
        </Text>
        {recycled && total !== undefined && (
          <View className="mt-2 flex-row items-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Text className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Recycled: {total}</Text>
          </View>
        )}
      </View>

      <View className={`gap-3 rounded-xl border p-3 ${recycled ? 'border-emerald-200' : 'border-blue-200'} bg-white`}>
        <View>
          <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">Search battery / client / reason</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="e.g. BAT-12-001 or Damaged"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900"
          />
        </View>
        {!recycled && (
          <View>
            <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">Status</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {UNSERVICEABLE_OPTIONS.map(([v, label]) => (
                <TouchableOpacity key={v} onPress={() => setStatusFilter(v)} className={`rounded-lg px-2.5 py-1.5 ${statusFilter === v ? 'bg-blue-600' : 'bg-slate-100'}`}>
                  <Text className={`text-[11px] font-semibold ${statusFilter === v ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        <View>
          <TouchableOpacity onPress={() => setShowDate((v) => !v)} className="flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {recycled ? 'Date' : 'Created on'}: <Text className={date ? 'text-blue-700' : 'text-slate-400'}>{date ? prettyYmd(date) : 'any'}</Text>
            </Text>
            <Text className="text-[11px] font-bold text-blue-600">{showDate ? 'Hide' : 'Pick date'}</Text>
          </TouchableOpacity>
          {showDate && <View className="mt-2"><DateField value={date} onChange={setDate} /></View>}
        </View>
        {filtered ? (
          <TouchableOpacity onPress={clearAll} className="self-start">
            <Text className="text-xs font-bold text-rose-600">Clear all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</Text> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rows}
        keyExtractor={(b) => String(b.id)}
        contentContainerClassName="p-4 gap-2 pb-16"
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPage(0, true); }} />}
        onEndReached={() => { if (hasMore && !loading) { setLoading(true); fetchPage(rows.length, false); } }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="battery" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">
              {loading ? 'Loading…' : recycled ? 'No recycled batteries match these filters.' : 'No unserviceable batteries match these filters.'}
            </Text>
          </View>
        }
        ListFooterComponent={hasMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
        renderItem={({ item: b, index }) => {
          const photos = b.issue_photos || [];
          const ts = recycled ? b.recycled_at || b.updated_at || b.created_at : b.issue_reported_at;
          return (
            <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <View className="flex-row items-center justify-between gap-2">
                <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })} className="flex-1">
                  <Text className={`text-sm font-extrabold ${accent === 'emerald' ? 'text-emerald-700' : 'text-blue-700'}`}>
                    <Text className="text-[11px] font-semibold text-slate-400">{index + 1}. </Text>{b.battery_code}
                  </Text>
                </TouchableOpacity>
                <StatusBadge status={b.status || (recycled ? 'recycled' : 'unserviceable')} />
              </View>
              <Text className="mt-1 text-xs text-slate-600">
                {recycled ? 'Original Client' : 'Client'}: <Text className="font-semibold text-slate-800">{b.client_name || '—'}</Text>
              </Text>
              {recycled && (
                <View className="mt-1">
                  <Text className="text-[10px] font-bold uppercase text-slate-400">Recycling Partner / Batch</Text>
                  {!b.recycle_client_name && !b.recycle_batch_id ? (
                    <Text className="text-xs text-slate-400">Standard Certified Stream</Text>
                  ) : (
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      {b.recycle_client_name ? <Text className="text-xs font-semibold text-slate-800">{b.recycle_client_name}</Text> : null}
                      {b.recycle_batch_id ? (
                        <TouchableOpacity onPress={() => navigateWebPath(navigation, `/recycle/${b.recycle_batch_id}`)}>
                          <Text className="text-xs font-medium text-blue-600">Shipment #{b.recycle_batch_id}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {b.recycle_vehicle_number ? <Text className="text-xs text-slate-500">• {b.recycle_vehicle_number}</Text> : null}
                    </View>
                  )}
                </View>
              )}
              <View className="mt-1.5">
                <Text className="text-[10px] font-bold uppercase text-slate-400">{recycled ? 'Decommission Reason' : 'Reason'}</Text>
                {recycled ? (
                  <Text className="self-start rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{b.issue_reason || 'Decommissioned'}</Text>
                ) : (
                  <Text className="text-xs text-slate-800">{b.issue_reason || '—'}</Text>
                )}
              </View>
              {!recycled && (
                <View className="mt-1.5">
                  <Text className="text-[10px] font-bold uppercase text-slate-400">Note</Text>
                  <Text className="text-xs text-slate-700">{b.issue_note || '—'}</Text>
                </View>
              )}
              <View className="mt-1.5">
                <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">Photos</Text>
                <Photos
                  photos={photos}
                  onOpen={(i) => setLightbox({ images: photos, index: i, title: `${recycled ? 'Decommission Photos' : 'Photos'} — ${b.battery_code}` })}
                />
              </View>
              <Text className="mt-1.5 text-[11px] text-slate-500">
                {recycled ? 'Recycled Date' : 'Reported'}:{' '}
                {ts ? (recycled ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(ts).toLocaleString()) : '—'}
              </Text>
            </View>
          );
        }}
      />
      {lightbox && (
        <ImageViewerModal visible images={lightbox.images} initialIndex={lightbox.index} title={lightbox.title} onClose={() => setLightbox(null)} />
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
