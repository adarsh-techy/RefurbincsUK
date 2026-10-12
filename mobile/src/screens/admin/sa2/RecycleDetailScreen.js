import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { StatusBadge } from '../../../components/ui/Badge';
import ImageViewerModal from '../../../components/ui/ImageViewerModal';
import { resolveImageUrl } from '../../../utils/imageUrl';
import { apiError, money, SearchBox, shortTime, StatTile, useRole } from '../../../components/admin/sa2/ui';

// Recycle shipment detail — the web RecycleDetailPage: vehicle with a
// "Dispatched" pill, driver, recycle partner, dispatched date/time, the four
// stat cards, and the manifest with All / Photos / Notes tabs, search, each
// battery's original client, declared reason, technician note, evidence
// photos (tap to zoom) and status. Also used by recycling partners (their
// own shipments). route.params: { id }
export default function RecycleDetailScreen() {
  const navigation = useNavigation();
  const { id } = useRoute().params || {};
  const role = useRole();
  const isRecycleClient = role === 'recycle_client';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [viewer, setViewer] = useState(null); // { images, index, title }

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/recycle/${id}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const batch = data?.batch;
  const batteries = useMemo(() => data?.batteries || [], [data]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: batch?.vehicle_number ? `Vehicle ${batch.vehicle_number}` : 'Recycle Shipment' });
  }, [navigation, batch?.vehicle_number]);

  const hasPhotos = (b) => Array.isArray(b.issue_photos) && b.issue_photos.length > 0;
  const hasNote = (b) => Boolean(b.issue_note && b.issue_note.trim());
  const recycledCount = batteries.filter((b) => b.status === 'recycled').length;
  const distinctClients = new Set(batteries.map((b) => b.client_name).filter(Boolean)).size;
  const withPhotos = batteries.filter(hasPhotos).length;
  const withNotes = batteries.filter(hasNote).length;

  const filtered = useMemo(() => {
    let list = batteries;
    if (tab === 'photos') list = list.filter(hasPhotos);
    else if (tab === 'notes') list = list.filter(hasNote);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => [b.battery_code, b.client_name, b.issue_reason, b.issue_note].some((v) => (v || '').toLowerCase().includes(q)));
  }, [batteries, tab, search]);

  if (loading) return <Text className="flex-1 bg-slate-50 p-12 text-center text-sm text-slate-500">Loading vehicle shipment details…</Text>;

  const backLabel = isRecycleClient ? 'Back to My Shipments' : 'Back to Recycle';
  const tabs = [
    { id: 'all', label: `All (${batteries.length})`, show: true },
    { id: 'photos', label: `Photos (${withPhotos})`, show: withPhotos > 0 },
    { id: 'notes', label: `Notes (${withNotes})`, show: withNotes > 0 },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="p-4 gap-4 pb-16"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-xs font-semibold text-emerald-700">‹ {backLabel}</Text>
        </TouchableOpacity>

        {error || !batch ? (
          <Text className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error || 'Shipment not found'}</Text>
        ) : (
          <>
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <View className="flex-row items-start gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-600"><Text className="text-xl">♻️</Text></View>
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-xl font-black text-slate-900"><Text className="font-light text-slate-400">Vehicle</Text> {batch.vehicle_number}</Text>
                    <Text className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">● Dispatched</Text>
                  </View>
                  <Text className="mt-1 text-xs text-slate-500">Shipment manifest for unserviceable batteries transferred for recycling</Text>
                </View>
              </View>
              <View className="mt-4 flex-row flex-wrap gap-y-3 border-t border-slate-200 pt-3">
                {[
                  ['Driver', `👤 ${batch.driver_name}`],
                  ['Recycle Partner', `🏢 ${batch.recycle_client_name || 'Standard Recycler'}`],
                  ['Dispatched Date', `📅 ${new Date(batch.recycled_at).toLocaleDateString()}`],
                  ['Dispatched Time', `⏰ ${shortTime(batch.recycled_at)}`],
                  // mobile extra: weight / payout recorded on the shipment
                  ...(batch.total_weight_kg && !isRecycleClient
                    ? [['Weight / Payout', `⚖ ${Number(batch.total_weight_kg).toFixed(1)} kg · ${money(Number(batch.total_weight_kg) * Number(batch.price_per_kg || 0))}`]]
                    : []),
                ].map(([label, value]) => (
                  <View key={label} className="w-1/2 pr-2">
                    <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</Text>
                    <Text className="mt-0.5 text-xs font-bold text-slate-800">{value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <StatTile label="📦 Total Batteries" value={batch.battery_count} tone="blue" />
              <StatTile label="✅ Confirmed Recycled" value={recycledCount} tone="emerald" />
              <StatTile label="🏢 Original Clients" value={distinctClients} tone="slate" />
              <StatTile label="📸 With Evidence Photos" value={withPhotos} tone="amber" />
            </View>

            <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <View>
                <Text className="text-sm font-bold uppercase tracking-wider text-slate-900">Manifest Inventory ({filtered.length})</Text>
                <Text className="text-[11px] text-slate-500">Detailed battery codes and declared defect information</Text>
              </View>
              <View className="flex-row gap-1 self-start rounded-xl bg-slate-100 p-0.5">
                {tabs.filter((t) => t.show).map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 ${tab === t.id ? 'bg-white' : ''}`}>
                    <Text className={`text-xs font-semibold ${tab === t.id ? 'text-slate-900' : 'text-slate-600'}`}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <SearchBox value={search} onChangeText={setSearch} placeholder="Search battery / reason..." />

              {filtered.length === 0 ? <Text className="py-4 text-center text-xs text-slate-400">No batteries match your filter or search.</Text> : null}
              {filtered.map((b, i) => {
                const photos = b.issue_photos || [];
                return (
                  <View key={b.id || b.battery_code} className="rounded-xl border border-slate-200 p-3">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-[10px] font-bold text-slate-400">#{i + 1}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })}>
                          <Text className="font-mono text-sm font-bold text-blue-700">● {b.battery_code}</Text>
                        </TouchableOpacity>
                      </View>
                      <StatusBadge status={b.status} />
                    </View>
                    <View className="mt-2 gap-1.5">
                      <Text className="text-xs text-slate-500">Original Client: <Text className="font-medium text-slate-800">{b.client_name || '—'}</Text></Text>
                      <View className="flex-row items-center">
                        <Text className="text-xs text-slate-500">Declared Reason: </Text>
                        {b.issue_reason ? (
                          <Text className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{b.issue_reason}</Text>
                        ) : (
                          <Text className="text-xs text-slate-400">—</Text>
                        )}
                      </View>
                      <Text className="text-xs text-slate-500">Technician Note: <Text className="text-slate-600">{b.issue_note || '—'}</Text></Text>
                      {photos.length > 0 ? (
                        <View className="flex-row items-center gap-1.5">
                          <Text className="text-xs text-slate-500">Photo Evidence: </Text>
                          {photos.slice(0, 3).map((p, idx) => (
                            <TouchableOpacity key={idx} onPress={() => setViewer({ images: photos, index: idx, title: `Evidence Photos — ${b.battery_code}` })}>
                              <Image source={{ uri: resolveImageUrl(p) }} className="h-10 w-10 rounded-lg border border-slate-200" />
                            </TouchableOpacity>
                          ))}
                          {photos.length > 3 ? (
                            <TouchableOpacity onPress={() => setViewer({ images: photos, index: 3, title: `Evidence Photos — ${b.battery_code}` })} className="h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                              <Text className="text-xs font-bold text-slate-600">+{photos.length - 3}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : (
                        <Text className="text-xs text-slate-500">Photo Evidence: <Text className="text-slate-400">—</Text></Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {viewer ? (
        <ImageViewerModal visible images={viewer.images} initialIndex={viewer.index} title={viewer.title} onClose={() => setViewer(null)} />
      ) : null}
    </View>
  );
}
