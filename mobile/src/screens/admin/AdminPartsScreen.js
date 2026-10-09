import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlatList, Modal, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Parts & inventory for office roles — GET /parts, with the one action worth
// doing from a phone on the stockroom floor: restocking
// (PATCH /parts/:id/restock { quantityAdded }, needs the 'parts' permission;
// super_admin always has it). Creating/editing parts stays on the web.

const money = (v) => `£${Number(v || 0).toFixed(2)}`;

export default function AdminPartsScreen() {
  const navigation = useNavigation();
  const user = useSelector((s) => s.auth.user);
  const canRestock = user?.role === 'super_admin' || (user?.permissions || []).includes('parts');
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [target, setTarget] = useState(null);
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/parts');
      setParts(Array.isArray(data) ? data : data?.data || []);
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

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      load();
    }, [load])
  );

  const q = search.trim().toLowerCase();
  const visible = parts.filter((p) => {
    if (onlyLow && Number(p.quantity) > 0) return false;
    if (!q) return true;
    return [p.name, p.sku].some((v) => v && String(v).toLowerCase().includes(q));
  });
  const outOfStock = parts.filter((p) => Number(p.quantity) <= 0).length;

  async function restock() {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) {
      setSaveError('Enter a whole number greater than 0.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.patch(`/parts/${target.id}/restock`, { quantityAdded: n });
      setTarget(null);
      setQty('');
      await load();
    } catch (err) {
      setSaveError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <TouchableOpacity onPress={() => navigation.navigate('AdminForm', { kind: 'part' })} className="mb-2.5 items-center rounded-2xl bg-emerald-600 py-2.5">
          <Text className="text-sm font-bold text-white">+ Add part</Text>
        </TouchableOpacity>
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Icon name="search" color="#94a3b8" size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search part name or SKU…"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="flex-1 text-sm text-slate-900"
          />
        </View>
        <View className="mt-2.5 flex-row gap-1.5">
          <TouchableOpacity onPress={() => setOnlyLow(false)} className={`rounded-xl px-3 py-1.5 ${!onlyLow ? 'bg-blue-600' : 'bg-slate-100'}`}>
            <Text className={`text-[11px] font-bold ${!onlyLow ? 'text-white' : 'text-slate-600'}`}>All ({parts.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOnlyLow(true)} className={`rounded-xl px-3 py-1.5 ${onlyLow ? 'bg-red-600' : 'bg-slate-100'}`}>
            <Text className={`text-[11px] font-bold ${onlyLow ? 'text-white' : 'text-slate-600'}`}>Out of stock ({outOfStock})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="package" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading parts…' : 'No parts found'}</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const out = Number(p.quantity) <= 0;
          return (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('AdminDetail', { kind: 'part', id: p.id, row: p })} className={`rounded-2xl border bg-white p-3.5 ${out ? 'border-red-300' : 'border-slate-200'}`}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-slate-900">{p.name}</Text>
                  <Text className="text-xs text-slate-500">{p.sku ? `SKU ${p.sku}` : 'No SKU'}</Text>
                </View>
                <Badge tone={out ? 'critical' : 'good'}>{out ? 'Out of stock' : `${p.quantity} in stock`}</Badge>
              </View>
              <View className="mt-2.5 flex-row items-center justify-between">
                <Text className="text-[11px] text-slate-500">
                  Part {money(p.repair_cost)}{p.service_charge ? ` · labour ${money(p.service_charge)}` : ''}
                </Text>
                {canRestock && (
                  <TouchableOpacity onPress={() => { setTarget(p); setQty(''); setSaveError(null); }} className="rounded-xl bg-emerald-600 px-3 py-2">
                    <Text className="text-xs font-bold text-white">+ Restock</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={Boolean(target)} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full rounded-3xl bg-white p-5">
            <Text className="text-base font-extrabold text-slate-900">Restock {target?.name}</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Currently {target?.quantity ?? 0} in stock. How many are you adding?</Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="number-pad"
              placeholder="Quantity added"
              placeholderTextColor="#94a3b8"
              autoFocus
              className="mt-4 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-lg font-bold text-slate-900"
            />
            {saveError && <Text className="mt-2 text-xs font-semibold text-red-600">{saveError}</Text>}
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity onPress={() => setTarget(null)} className="flex-1 items-center rounded-2xl bg-slate-100 py-3">
                <Text className="text-sm font-bold text-slate-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={restock} className="flex-1 items-center rounded-2xl bg-emerald-600 py-3">
                <Text className="text-sm font-bold text-white">{saving ? 'Saving…' : 'Add stock'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
