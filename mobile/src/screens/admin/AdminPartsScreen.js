import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { AlertDialog, Btn, ConfirmDialog, ErrorBox, PageHead, SearchBox, hasPermission, money } from '../../components/admin/sa4/ui';
import { PartFormSheet, RestockSheet } from '../../components/admin/sa4/PartForms';

// Inventory — the phone version of the web Parts page (GET /parts):
// + Add Part, "Low Stock Only" (route param lowStock: true opens it
// pre-filtered, like the dashboard's ?lowStock=true link), and per part
// Restock ('parts' permission), Edit / Delete (super_admin). Tap a part for
// its detail page (AdminPartDetail).

export default function AdminPartsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const user = useSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageParts = hasPermission(user, 'parts');

  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(Boolean(route.params?.lowStock));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // null = closed, 'new' = create form, a part = edit form
  const [formTarget, setFormTarget] = useState(null);
  const [restockTarget, setRestockTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (route.params?.lowStock != null) setLowStockOnly(Boolean(route.params.lowStock));
  }, [route.params?.lowStock]);

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

  // same rule as the web: "low stock" = not in stock (quantity 0)
  const lowStock = parts.filter((p) => Number(p.quantity) <= 5);
  const base = lowStockOnly ? lowStock : parts;
  const q = search.trim().toLowerCase();
  const visible = q ? base.filter((p) => [p.name, p.sku].some((v) => v && String(v).toLowerCase().includes(q))) : base;

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/parts/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  const header = (
    <View className="gap-3 pb-1">
      <PageHead title="Inventory" description="Parts stock used for battery repairs.">
        <Btn label="+ Add Part" onPress={() => setFormTarget('new')} />
      </PageHead>
      <View className="flex-row flex-wrap items-center gap-3">
        <TouchableOpacity
          onPress={() => setLowStockOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 ${lowStockOnly ? 'bg-red-600' : 'border border-red-200 bg-white'}`}
        >
          <Text className={`text-sm font-medium ${lowStockOnly ? 'text-white' : 'text-red-700'}`}>Low Stock Only</Text>
        </TouchableOpacity>
        {lowStockOnly && (
          <Text className="text-sm text-slate-500">
            {lowStock.length} part{lowStock.length === 1 ? '' : 's'} at 5 units or fewer
          </Text>
        )}
      </View>
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search part name or SKU…" />
      <ErrorBox text={error} />
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="package" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">
              {loading ? 'Loading…' : lowStockOnly ? 'No parts are low on stock.' : 'No records found.'}
            </Text>
          </View>
        }
        renderItem={({ item: p, index }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AdminPartDetail', { id: p.id, name: p.name })}
            className={`rounded-2xl border bg-white p-3.5 ${p.in_stock ? 'border-slate-200' : 'border-red-300'}`}
          >
            <View className="flex-row items-start justify-between gap-2">
              <Text className="w-6 pt-0.5 text-xs font-bold text-slate-400">{index + 1}</Text>
              <View className="flex-1">
                <Text className="text-sm font-bold text-blue-700">{p.name}</Text>
                <Text className="text-xs text-slate-500">SKU {p.sku || '—'}</Text>
              </View>
              <Badge tone={p.in_stock ? 'good' : 'critical'}>{p.in_stock ? 'In Stock' : 'Out of Stock'}</Badge>
            </View>
            <View className="ml-6 mt-2 flex-row flex-wrap gap-x-4">
              <Text className="text-xs text-slate-600">Qty <Text className="font-bold text-slate-900">{p.quantity}</Text></Text>
              {isSuperAdmin && (
                <Text className="text-xs text-slate-600">Service Charge <Text className="font-bold text-slate-900">{money(p.service_charge)}</Text></Text>
              )}
            </View>
            {canManageParts && (
              <View className="ml-6 mt-2.5 flex-row gap-2">
                <Btn small tone="outline" label="Restock" onPress={() => setRestockTarget(p)} />
                {isSuperAdmin && <Btn small tone="outline" label="Edit" onPress={() => setFormTarget(p)} />}
                {isSuperAdmin && <Btn small tone="danger" label="Delete" onPress={() => setDeleteTarget(p)} />}
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      <PartFormSheet
        visible={Boolean(formTarget)}
        part={formTarget && formTarget !== 'new' ? formTarget : null}
        onSaved={() => { setFormTarget(null); load(); }}
        onClose={() => setFormTarget(null)}
      />
      <RestockSheet
        visible={Boolean(restockTarget)}
        part={restockTarget}
        onSaved={() => { setRestockTarget(null); load(); }}
        onClose={() => setRestockTarget(null)}
      />
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Part"
        message={`Delete part "${deleteTarget?.name}"? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <AlertDialog visible={Boolean(deleteError)} title="Cannot Delete Part" message={deleteError} onClose={() => setDeleteError(null)} />
    </View>
  );
}
