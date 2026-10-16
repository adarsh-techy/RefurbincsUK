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

  // parts are kept per client: filter by client; "low" = at or below each part's own minimum
  const [clientFilter, setClientFilter] = useState('');
  const clientOptions = [...new Map(parts.map((p) => [String(p.client_id ?? ''), p.client_name || 'Unassigned'])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const isLow = (p) => Number(p.quantity) <= Number(p.min_stock ?? 5);
  const byClient = clientFilter ? parts.filter((p) => String(p.client_id ?? '') === clientFilter) : parts;
  const lowStock = byClient.filter(isLow);
  const base = lowStockOnly ? lowStock : byClient;
  const q = search.trim().toLowerCase();
  const visible = q ? base.filter((p) => [p.name, p.sku].some((v) => v && String(v).toLowerCase().includes(q))) : base;

  const totalUnits = useMemo(
    () => parts.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
    [parts]
  );

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
    <View className="gap-2.5 pb-1">
      {/* Executive Header Card */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-lg font-extrabold text-slate-900">Parts & Inventory</Text>
              <View className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-violet-700">Spares</Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-slate-500">Parts stock used for battery repairs</Text>
          </View>
          <TouchableOpacity
            onPress={() => setFormTarget('new')}
            className="flex-row items-center gap-1 rounded-lg bg-violet-700 px-3 py-1.5 shadow-xs"
          >
            <Text className="text-xs font-bold text-white">+ Add Part</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-2.5 flex-row items-center gap-2 border-t border-slate-100 pt-2.5 flex-wrap">
          <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
            <Text className="text-[11px] font-semibold text-slate-700">
              Total Parts: <Text className="font-extrabold text-slate-900">{parts.length}</Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1">
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Text className="text-[11px] font-semibold text-emerald-800">
              Units: <Text className="font-extrabold text-emerald-950">{totalUnits.toLocaleString()}</Text>
            </Text>
          </View>
          {lowStock.length > 0 && (
            <View className="flex-row items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1">
              <Text className="text-[11px] font-semibold text-amber-800">
                Low: <Text className="font-extrabold text-amber-950">{lowStock.length}</Text>
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Search Toolbar */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-2xs gap-2">
        <SearchBox value={search} onChangeText={setSearch} placeholder="Search part name or SKU…" />

        {/* Horizontal Chips: Low Stock Toggle + Clients */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 py-0.5">
          {/* Low Stock Filter Chip */}
          <TouchableOpacity
            onPress={() => setLowStockOnly((v) => !v)}
            className={`flex-row items-center gap-1 rounded-lg border px-2.5 py-1 ${
              lowStockOnly
                ? 'border-rose-600 bg-rose-600'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            <Text className={`text-[11px] font-bold ${lowStockOnly ? 'text-white' : 'text-rose-700'}`}>
              Low Stock Only
            </Text>
            {lowStock.length > 0 && (
              <View className={`rounded-full px-1 py-0.2 ${lowStockOnly ? 'bg-white/20' : 'bg-rose-200'}`}>
                <Text className={`text-[9px] font-extrabold ${lowStockOnly ? 'text-white' : 'text-rose-900'}`}>
                  {lowStock.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Client Filter Chips */}
          {[['', 'All Clients'], ...clientOptions].map(([id, name]) => {
            const on = clientFilter === id;
            return (
              <TouchableOpacity
                key={id || 'all'}
                onPress={() => setClientFilter(id)}
                className={`rounded-lg border px-2.5 py-1 ${
                  on ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <Text className={`text-[11px] ${on ? 'font-bold text-white' : 'font-medium text-slate-700'}`}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ErrorBox text={error} />
      {deleteError && (
        <View className="rounded-xl border border-rose-200 bg-rose-50 p-2.5">
          <Text className="text-xs font-semibold text-rose-700">{deleteError}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-3 gap-2 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200/90 bg-white p-8">
            <Icon name="package" color="#94a3b8" size={24} />
            <Text className="mt-2 text-xs font-semibold text-slate-800">
              {loading ? 'Loading…' : lowStockOnly ? 'No parts are low on stock.' : 'No records found.'}
            </Text>
          </View>
        }
        renderItem={({ item: p, index }) => {
          const quantity = Number(p.quantity) || 0;
          const minStock = Number(p.min_stock ?? 5);
          const stockRatio = Math.min(100, Math.max(5, Math.round((quantity / Math.max(minStock * 2, 10)) * 100)));

          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => navigation.navigate('AdminPartDetail', { id: p.id, name: p.name })}
              className="rounded-xl border border-slate-200/85 bg-white p-2.5 shadow-2xs gap-2"
            >
              {/* Top Row: Avatar + Title & Client + Status Badge */}
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2 min-w-0">
                  <View className="h-7 w-7 rounded-lg bg-violet-50 border border-violet-100 items-center justify-center shrink-0">
                    <Icon name="package" size={15} color="#6d28d9" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-[10px] font-bold font-mono text-slate-400">#{index + 1}</Text>
                      <Text className="font-bold text-xs text-slate-900 truncate flex-1">
                        {p.name}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
                      <Text className="text-[10.5px] text-slate-400 leading-tight">
                        Client: <Text className={`font-semibold ${p.client_name ? 'text-slate-800' : 'text-amber-600'}`}>{p.client_name || 'Unassigned'}</Text>
                      </Text>
                      {p.sku ? (
                        <View className="rounded bg-slate-100 px-1 py-0.2">
                          <Text className="font-mono text-[9.5px] font-medium text-slate-600">
                            SKU: {p.sku}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Status Badge */}
                {p.in_stock ? (
                  <View className="flex-row items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 shrink-0">
                    <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <Text className="text-[10px] font-bold text-emerald-700">In Stock</Text>
                  </View>
                ) : quantity > 0 ? (
                  <View className="flex-row items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 shrink-0">
                    <View className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <Text className="text-[10px] font-bold text-amber-700">Low ({quantity})</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 shrink-0">
                    <View className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <Text className="text-[10px] font-bold text-rose-700">Out of Stock</Text>
                  </View>
                )}
              </View>

              {/* Compact Visual Stock Level Container */}
              <View className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 gap-1">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-[9px] uppercase font-bold tracking-wider text-slate-400 leading-none">
                      Inventory Level
                    </Text>
                    <View className="flex-row items-baseline gap-1 mt-0.5">
                      <Text className="text-base font-extrabold text-slate-900 leading-none">
                        {quantity}
                      </Text>
                      <Text className="text-[10.5px] font-medium text-slate-500">
                        units in stock
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className="text-[9px] uppercase font-bold tracking-wider text-slate-400 leading-none">
                      Min. Reserve
                    </Text>
                    <View className="mt-0.5 rounded border border-slate-200/90 bg-white px-1.5 py-0.2">
                      <Text className="text-[10px] font-semibold text-slate-700 font-mono">
                        {minStock} units
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Visual Health Gauge Bar */}
                <View className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden mt-0.5">
                  <View
                    className={`h-full rounded-full ${
                      p.in_stock ? 'bg-emerald-500' : quantity > 0 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${stockRatio}%` }}
                  />
                </View>

                <View className="flex-row items-center justify-between pt-0.5">
                  <Text className="text-[10px]">
                    {p.in_stock ? (
                      <Text className="text-emerald-700 font-medium">✓ Healthy level ({quantity - minStock} above min)</Text>
                    ) : quantity > 0 ? (
                      <Text className="text-amber-700 font-medium">⚠️ Low stock: reorder recommended</Text>
                    ) : (
                      <Text className="text-rose-600 font-bold">✕ Out of stock: restock needed</Text>
                    )}
                  </Text>

                  {isSuperAdmin && (
                    <Text className="text-[10px] font-semibold text-slate-700">
                      Fee: <Text className="font-mono font-bold text-slate-900">{money(p.service_charge)}</Text>
                    </Text>
                  )}
                </View>
              </View>

              {/* Compact Action Buttons Row */}
              {canManageParts && (
                <View className="flex-row items-center justify-between pt-0.5">
                  <TouchableOpacity
                    onPress={() => setRestockTarget(p)}
                    className="flex-row items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1 shadow-2xs"
                  >
                    <Icon name="plus" size={11} color="#ffffff" />
                    <Text className="text-[11px] font-bold text-white">Restock</Text>
                  </TouchableOpacity>

                  {isSuperAdmin && (
                    <View className="flex-row items-center gap-1 ml-auto">
                      <TouchableOpacity
                        onPress={() => setFormTarget(p)}
                        className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-2xs"
                      >
                        <Icon name="edit" size={11} color="#64748b" />
                        <Text className="text-[11px] font-semibold text-slate-700">Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteTarget(p)}
                        className="flex-row items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 shadow-2xs"
                      >
                        <Icon name="trash" size={11} color="#e11d48" />
                        <Text className="text-[11px] font-bold text-rose-700">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <PartFormSheet
        visible={Boolean(formTarget)}
        part={formTarget && formTarget !== 'new' ? formTarget : null}
        defaultClientId={clientFilter || undefined}
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
