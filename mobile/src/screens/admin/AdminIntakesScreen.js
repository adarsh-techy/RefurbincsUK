import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Truck intakes for office roles — GET /truck-intakes (paged { data, hasMore })
// plus the one action that matters on the yard floor: verifying a truck's
// arrival (PATCH /truck-intakes/:id/verify-arrival), which moves every
// battery on it to in_repair. Needs the 'truck_intakes' permission
// (super_admin always has it); the backend refuses a second verify (409).

const PAGE = 20;
const DEBOUNCE_MS = 350;

function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AdminIntakesScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const canVerify = user?.role === 'super_admin' || (user?.permissions || []).includes('truck_intakes');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending'); // pending | verified | all
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  const fetchPage = useCallback(async (offset, replace) => {
    const reqId = ++requestRef.current;
    try {
      const params = { limit: PAGE, offset };
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/truck-intakes', { params });
      if (reqId !== requestRef.current) return;
      setRows((prev) => (replace ? data.data || [] : [...prev, ...(data.data || [])]));
      setHasMore(Boolean(data.hasMore));
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
  }, [search]);

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

  const isVerified = (t) => t.status === 'verified' || Boolean(t.verified_at);
  // The API pages by date only; the pending/verified split is applied to
  // what's loaded, so "Load more" may be needed to find older pending trucks.
  const visible = rows.filter((t) => (filter === 'all' ? true : filter === 'verified' ? isVerified(t) : !isVerified(t)));

  function confirmVerify(intake) {
    Alert.alert(
      'Verify truck arrival?',
      `Truck ${intake.truck_number || '#' + intake.id}${intake.client_name ? ` from ${intake.client_name}` : ''} — ${intake.battery_count || 0} batteries will be moved to "awaiting repair" and the client's intake fee applied.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify', style: 'default', onPress: () => verify(intake) },
      ]
    );
  }

  async function verify(intake) {
    setVerifyingId(intake.id);
    try {
      const { data } = await apiClient.patch(`/truck-intakes/${intake.id}/verify-arrival`);
      setRows((prev) => prev.map((t) => (t.id === intake.id ? { ...t, ...(data.intake || {}), status: 'verified' } : t)));
    } catch (err) {
      Alert.alert('Could not verify', err.response?.data?.message || err.message);
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Icon name="search" color="#94a3b8" size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search truck, driver, client…"
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
        <View className="mt-2.5 flex-row gap-1.5">
          {[
            { id: 'pending', label: 'Awaiting arrival' },
            { id: 'verified', label: 'Verified' },
            { id: 'all', label: 'All' },
          ].map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                className={`rounded-xl px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-slate-100'}`}
              >
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {error && (
        <View className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(t) => String(t.id)}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPage(0, true); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="truck" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">
              {loading ? 'Loading intakes…' : filter === 'pending' ? 'No trucks awaiting arrival' : 'No intakes found'}
            </Text>
            {!loading && hasMore && (
              <TouchableOpacity onPress={loadMore} className="mt-3 rounded-xl bg-slate-100 px-3 py-1.5">
                <Text className="text-xs font-bold text-slate-700">Load older intakes</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={loadingMore ? <Text className="py-3 text-center text-xs text-slate-400">Loading more…</Text> : null}
        renderItem={({ item: t }) => {
          const verified = isVerified(t);
          return (
            <View className={`rounded-2xl border bg-white p-4 ${verified ? 'border-slate-200' : 'border-amber-300'}`}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-base font-extrabold text-slate-900">Truck {t.truck_number || `#${t.id}`}</Text>
                  <Text className="text-xs text-slate-600" numberOfLines={1}>
                    {t.client_name || 'Unassigned client'}{t.driver_name ? ` · ${t.driver_name}` : ''}
                  </Text>
                </View>
                <Badge tone={verified ? 'good' : 'warning'}>{verified ? 'Verified' : 'Pending arrival'}</Badge>
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-xs text-slate-500">
                  {t.battery_count || 0} batter{Number(t.battery_count) === 1 ? 'y' : 'ies'} · {formatDate(verified ? t.verified_at || t.intake_at : t.intake_at)}
                </Text>
                {verified ? (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Batteries', { search: t.client_name || '' })}
                    className="rounded-xl bg-slate-100 px-3 py-1.5"
                  >
                    <Text className="text-xs font-bold text-slate-700">Batteries ›</Text>
                  </TouchableOpacity>
                ) : canVerify ? (
                  <TouchableOpacity
                    disabled={verifyingId === t.id}
                    onPress={() => confirmVerify(t)}
                    className="flex-row items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2"
                  >
                    <Icon name="check" color="#fff" size={14} />
                    <Text className="text-xs font-bold text-white">{verifyingId === t.id ? 'Verifying…' : 'Verify arrival'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
