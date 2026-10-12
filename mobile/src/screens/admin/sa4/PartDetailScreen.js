import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import { StatusBadge } from '../../../components/ui/Badge';
import Icon from '../../../components/ui/Icon';
import { AlertDialog, Btn, Chips, ConfirmDialog, Empty, ErrorBox, SearchBox, Stat, dateOnly, dateTime, hasPermission, money } from '../../../components/admin/sa4/ui';
import { PartFormSheet, RestockSheet } from '../../../components/admin/sa4/PartForms';

// Part detail — the phone version of the web PartDetailPage
// (GET /parts/:id → { part, usageHistory, stockHistory }): stock health and
// unit economics, the six metric cards, and the five tabs (Usage & Fitted,
// Removed / Reclaimed, Restock Receipts, Specifications & Economics, Monthly
// Activity & Burn Rate). Restock, Edit Details (super_admin — PATCH /parts/:id
// is super_admin only on the server) and Delete (super_admin).
// Route params: { id, name }.

const MONTHS_SHOWN = 6;

function buildMonthlyBreakdown(usageHistory = [], stockHistory = []) {
  const monthKey = (s) => {
    const d = new Date(s);
    return `${d.getFullYear()}-${d.getMonth()}`;
  };
  const used = {};
  usageHistory.forEach((h) => {
    const k = monthKey(h.repaired_at);
    used[k] = (used[k] || 0) + Number(h.quantity_used || 1);
  });
  const restocked = {};
  stockHistory.forEach((a) => {
    const k = monthKey(a.adjusted_at);
    restocked[k] = (restocked[k] || 0) + Number(a.quantity_added || 0);
  });
  const now = new Date();
  const months = [];
  for (let i = MONTHS_SHOWN - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months.push({ key, label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), restocked: restocked[key] || 0, used: used[key] || 0 });
  }
  return months;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Row({ label, children }) {
  return (
    <View className="flex-row items-start justify-between gap-3 border-b border-slate-100 py-2">
      <Text className="flex-1 text-xs text-slate-500">{label}</Text>
      <View className="max-w-[60%] items-end">{typeof children === 'string' || typeof children === 'number' ? <Text className="text-right text-xs font-bold text-slate-900">{children}</Text> : children}</View>
    </View>
  );
}

export default function PartDetailScreen() {
  const navigation = useNavigation();
  const { id, name } = useRoute().params || {};
  const user = useSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const canManageParts = hasPermission(user, 'parts') || isAdmin;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [restocking, setRestocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [activeTab, setActiveTab] = useState('usage');
  const [usageSearch, setUsageSearch] = useState('');
  const [usageStatusFilter, setUsageStatusFilter] = useState('all');
  const [removedSearch, setRemovedSearch] = useState('');
  const [restockSearch, setRestockSearch] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: data?.part?.name || name || 'Part' });
  }, [navigation, data?.part?.name, name]);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get(`/parts/${id}`);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/parts/${id}`);
      setDeleting(false);
      navigation.goBack();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete part');
      setDeleting(false);
    }
  }

  if (loading) return <Text className="flex-1 bg-slate-50 py-12 text-center text-xs text-slate-400">Loading part inventory details…</Text>;
  if (error || !data?.part) {
    return (
      <View className="flex-1 bg-slate-50 p-4">
        <ErrorBox text={error || 'Part not found'} />
      </View>
    );
  }

  const { part, usageHistory = [], stockHistory = [] } = data;
  const removedHistory = usageHistory.filter((h) => Boolean(h.removed_at));
  const activeHistory = usageHistory.filter((h) => !h.removed_at);
  const sumQty = (list) => list.reduce((s, h) => s + Number(h.quantity_used || 1), 0);
  const totalQuantityUsed = sumQty(usageHistory);
  const totalRemovedQuantity = sumQty(removedHistory);
  const activeQuantity = sumQty(activeHistory);

  const quantity = Number(part.quantity || 0);
  const unitCost = Number(part.repair_cost || 0);
  const serviceCharge = Number(part.service_charge || 0);
  const unitMargin = serviceCharge - unitCost;
  const marginPct = serviceCharge > 0 ? ((unitMargin / serviceCharge) * 100).toFixed(1) : '0.0';
  const totalStockValuation = quantity * unitCost;
  const potentialRevenue = quantity * serviceCharge;
  const totalRevenue = usageHistory.reduce((s, h) => (h.removed_at ? s : s + Number(h.price || 0) + Number(h.labor_charge || 0)), 0);
  const totalRestocked = stockHistory.reduce((s, a) => s + Number(a.quantity_added || 0), 0);
  const uniqueBatteriesCount = new Set(usageHistory.map((h) => h.battery_code).filter(Boolean)).size;
  const uniqueClientsCount = new Set(usageHistory.map((h) => h.client_name).filter(Boolean)).size;
  const lastRestockedAt = stockHistory.length > 0 ? stockHistory[0].adjusted_at : null;
  const isOutOfStock = quantity <= 0;
  const isLowStock = quantity > 0 && quantity <= 10;

  const monthly = buildMonthlyBreakdown(usageHistory, stockHistory);
  const maxMonthly = Math.max(1, ...monthly.flatMap((m) => [m.restocked, m.used]));
  const totalUsedLast6Months = monthly.reduce((s, m) => s + m.used, 0);
  const avgMonthlyBurnRate = (totalUsedLast6Months / MONTHS_SHOWN).toFixed(1);
  const monthsOfSupplyRemaining = Number(avgMonthlyBurnRate) > 0 ? (quantity / Number(avgMonthlyBurnRate)).toFixed(1) : '∞';

  const has = (v, q) => v && String(v).toLowerCase().includes(q);
  const uq = usageSearch.toLowerCase().trim();
  const filteredUsage = usageHistory.filter((item) => {
    const m = !uq || [item.battery_code, item.serial_number, item.client_name, item.staff_name, item.removed_by_staff_name, item.truck_number, item.notes].some((v) => has(v, uq));
    if (usageStatusFilter === 'active') return m && !item.removed_at;
    if (usageStatusFilter === 'removed') return m && Boolean(item.removed_at);
    if (usageStatusFilter === 'all') return m;
    return m && item.battery_status?.toLowerCase() === usageStatusFilter;
  });
  const rq = removedSearch.toLowerCase().trim();
  const filteredRemoved = removedHistory.filter(
    (item) => !rq || [item.battery_code, item.serial_number, item.client_name, item.removed_by_staff_name, item.staff_name, item.truck_number, item.battery_status, item.notes].some((v) => has(v, rq))
  );
  const sq = restockSearch.toLowerCase().trim();
  const filteredStock = stockHistory.filter(
    (item) => !sq || [item.adjusted_by_name, item.adjusted_by_email, item.note].some((v) => has(v, sq)) || String(item.quantity_added).includes(sq)
  );

  const openBattery = (code) => code && navigation.navigate('BatteryDetail', { code, fromScan: false });
  const health = isOutOfStock
    ? { box: 'border-rose-200 bg-rose-50', pill: 'bg-rose-100 text-rose-800', label: 'Out of Stock', bar: 'w-0 bg-rose-500', meter: '0% (Depleted)' }
    : isLowStock
      ? { box: 'border-amber-200 bg-amber-50', pill: 'bg-amber-100 text-amber-800', label: `Low Stock (${quantity} left)`, bar: 'w-1/4 bg-amber-500', meter: 'Low Stock Warning' }
      : { box: 'border-emerald-200 bg-emerald-50', pill: 'bg-emerald-100 text-emerald-800', label: 'In Stock & Available', bar: 'w-full bg-emerald-500', meter: 'Healthy Inventory' };

  const TABS = [
    { id: 'usage', label: `Usage & Fitted (${usageHistory.length})` },
    { id: 'removed', label: `Removed / Reclaimed Parts (${removedHistory.length})` },
    { id: 'restock', label: `Restock Receipts (${stockHistory.length})` },
    { id: 'specs', label: 'Part Specifications & Economics' },
    { id: 'analytics', label: 'Monthly Activity & Burn Rate' },
  ];

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Action controls */}
      <View className="flex-row flex-wrap gap-2">
        {canManageParts && <Btn tone="emerald" label="+ Restock Stock" onPress={() => setRestocking(true)} />}
        {isSuperAdmin && <Btn tone="outline" label="Edit Details" onPress={() => setEditing(true)} />}
        {isSuperAdmin && <Btn tone="danger" label="Delete" onPress={() => setDeleting(true)} />}
        <Btn tone="outline" label="↻ Refresh" onPress={() => { setRefreshing(true); load(); }} />
      </View>

      {/* Title & badges */}
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-2xl font-black text-slate-900">{part.name}</Text>
          <Text className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">ID #{part.id}</Text>
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          <Text className={`rounded-full px-3 py-0.5 text-xs font-bold ${health.pill}`}>{health.label}</Text>
          {totalRemovedQuantity > 0 && (
            <Text className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">↺ {totalRemovedQuantity} Reclaimed / Removed</Text>
          )}
        </View>
        <Text className="text-xs text-slate-500">
          {part.sku ? <Text selectable className="font-semibold text-slate-700">SKU: {part.sku}</Text> : 'No SKU registered'}
          {'  •  '}Registered on {dateOnly(part.created_at)}
          {lastRestockedAt ? `  •  Last restocked ${dateOnly(lastRestockedAt)}` : ''}
        </Text>
        {canManageParts && (
          <TouchableOpacity onPress={() => setRestocking(true)} className="flex-row items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white py-2.5">
            <Icon name="package" color="#059669" size={16} />
            <Text className="text-xs font-bold text-emerald-800">Manage Inventory ({quantity} on hand)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stock health & unit economics */}
      <View className={`rounded-3xl border p-4 ${health.box}`}>
        <View className="flex-row items-end gap-2">
          <Text className="text-4xl font-black text-slate-900">{quantity.toLocaleString()}</Text>
          <Text className="pb-1.5 text-sm font-bold text-slate-500">unit{quantity === 1 ? '' : 's'} available</Text>
        </View>
        <View className="mt-2 flex-row items-center gap-3">
          <View className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <View className={`h-full rounded-full ${health.bar}`} />
          </View>
          <Text className="text-[11px] font-bold text-slate-500">{health.meter}</Text>
        </View>
        <View className="mt-4 flex-row flex-wrap justify-between gap-y-3 border-t border-slate-200 pt-3">
          {[
            ['Unit Cost', money(unitCost), 'Acquisition cost', 'text-slate-900'],
            ['Billing Rate', money(serviceCharge), 'Client charge', 'text-blue-700'],
            ['Gross Margin', money(unitMargin), `${marginPct}% margin`, 'text-emerald-700'],
            ['Inventory Value', money(totalStockValuation), 'Asset on hand', 'text-slate-900'],
          ].map(([l, v, s, c]) => (
            <View key={l} className="w-[48%]">
              <Text className="text-[11px] font-bold uppercase text-slate-500">{l}</Text>
              <Text className={`mt-0.5 font-mono text-base font-black ${c}`}>{v}</Text>
              <Text className="text-[10px] text-slate-400">{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Six metric cards */}
      <View className="flex-row flex-wrap justify-between gap-y-3">
        <Stat label="Stock on Hand" icon="package" value={quantity} sub={isOutOfStock ? 'Depleted' : 'Ready for repair'} tone="good" />
        <Stat label="Active in Fleet" icon="wrench" value={activeQuantity} sub={plural(activeHistory.length, 'active installation')} tone="info" />
        <Stat label="Reclaimed Parts" icon="rotateCcw" value={totalRemovedQuantity} sub={`From ${plural(removedHistory.length, 'battery', 'batteries')} (View →)`} tone="warning" onPress={() => setActiveTab('removed')} />
        <Stat label="Total Restocked" value={`+${totalRestocked}`} sub={plural(stockHistory.length, 'restock batch', 'restock batches')} tone="purple" />
        <Stat label="Batteries Serviced" icon="battery" value={uniqueBatteriesCount} sub={`Across ${plural(uniqueClientsCount, 'client fleet')}`} />
        <Stat label="Supply Runway" icon="clock" value={monthsOfSupplyRemaining === '∞' ? 'Ample' : `${monthsOfSupplyRemaining} mo`} sub={`~${avgMonthlyBurnRate} units/mo burn`} tone="purple" />
      </View>

      <Chips options={TABS} value={activeTab} onChange={setActiveTab} activeClass="bg-emerald-600" />

      {activeTab === 'usage' && (
        <View className="gap-3">
          <SearchBox value={usageSearch} onChangeText={setUsageSearch} placeholder="Search battery code, serial, client, technician, truck…" />
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-bold text-slate-500">Filter:</Text>
            <View className="flex-1">
              <Chips
                value={usageStatusFilter}
                onChange={setUsageStatusFilter}
                options={[
                  { id: 'all', label: `All (${usageHistory.length})` },
                  { id: 'active', label: `Active (${activeHistory.length})` },
                  { id: 'removed', label: `Removed (${removedHistory.length})` },
                  { id: 'returned', label: 'Returned Fleet' },
                  { id: 'in_repair', label: 'In Repair' },
                  { id: 'recycled', label: 'Recycled' },
                ]}
              />
            </View>
          </View>
          {filteredUsage.length === 0 ? (
            <Empty
              title={usageHistory.length === 0 ? 'No repairs logged with this part yet' : 'No repairs match your filter'}
              text={usageHistory.length === 0
                ? 'When technicians assign this part during battery diagnostics or module replacement, complete details will be tracked here.'
                : 'Try clearing your search query or status filter to see all repair records.'}
            />
          ) : (
            <>
              {filteredUsage.map((row, i) => (
                <View key={row.id ?? `${row.battery_code}-${i}`} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <View className="flex-row items-start justify-between gap-2">
                    <TouchableOpacity onPress={() => openBattery(row.battery_code)} className="flex-1">
                      <Text className="text-sm font-bold text-blue-700">{row.battery_code}</Text>
                      {row.serial_number ? <Text className="text-[11px] text-slate-500">SN: {row.serial_number}</Text> : null}
                    </TouchableOpacity>
                    <StatusBadge status={row.battery_status} />
                  </View>
                  <Text className="mt-1.5 text-xs text-slate-600">
                    {row.client_name || '—'}{row.truck_number ? `  ·  Truck #${row.truck_number}` : ''}  ·  {plural(Number(row.quantity_used || 1), 'unit')}
                  </Text>
                  {row.removed_at ? (
                    <Text className="mt-1 text-xs font-semibold text-amber-700">↺ Part Removed / Salvaged · {dateOnly(row.removed_at)} by {row.removed_by_staff_name || 'Staff'}</Text>
                  ) : (
                    <Text className="mt-1 text-xs font-semibold text-emerald-700">✓ Active / Fitted</Text>
                  )}
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="flex-1 text-[11px] text-slate-500">
                      {row.staff_name || 'Workshop'}{row.staff_role ? ` (${row.staff_role})` : ''} · {dateOnly(row.repaired_at)}
                      {row.duration_seconds > 0 ? ` · ${formatDuration(row.duration_seconds)}` : ''}
                    </Text>
                    <TouchableOpacity onPress={() => openBattery(row.battery_code)}>
                      <Text className="text-[11px] font-bold text-blue-600">View Battery ↗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <Text className="text-[11px] text-slate-500">
                Showing {filteredUsage.length} of {usageHistory.length} total repair installation{usageHistory.length === 1 ? '' : 's'} · Active: {activeHistory.length} • Removed: {removedHistory.length}
              </Text>
            </>
          )}
        </View>
      )}

      {activeTab === 'removed' && (
        <View className="gap-3">
          <View className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <Text className="text-sm font-bold text-amber-900">Reclaimed &amp; Disassembled Inventory ({totalRemovedQuantity} units total)</Text>
            <Text className="mt-1 text-xs text-amber-800">
              When batteries are decommissioned, recycled, or unserviceable, working parts previously fitted during diagnosis are reclaimed back into workshop inventory to avoid wasted parts.
            </Text>
          </View>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Stat label="Total Units Reclaimed" value={plural(totalRemovedQuantity, 'unit')} sub="Recovered from repairs" tone="warning" />
            <Stat label="Batteries Disassembled" value={`${new Set(removedHistory.map((h) => h.battery_code)).size} batteries`} sub="Unserviceable or recycled" />
            <Stat className="w-full" label="Recovered Asset Value" value={money(totalRemovedQuantity * unitCost)} sub="Saved component value" tone="good" />
          </View>
          <SearchBox value={removedSearch} onChangeText={setRemovedSearch} placeholder="Search removed battery code, client, staff who removed it…" />
          {filteredRemoved.length === 0 ? (
            <Empty
              title={removedHistory.length === 0 ? 'No removed parts recorded for this component' : 'No records match search'}
              text={removedHistory.length === 0 ? 'All units ever installed on batteries remain actively fitted with client fleets.' : 'Clear the search query above to see all removed records.'}
            />
          ) : (
            <>
              {filteredRemoved.map((row, i) => (
                <View key={row.id ?? `${row.battery_code}-r${i}`} className="rounded-2xl border border-amber-200 bg-white p-3.5">
                  <View className="flex-row items-start justify-between gap-2">
                    <TouchableOpacity onPress={() => openBattery(row.battery_code)} className="flex-1">
                      <Text className="text-sm font-bold text-blue-700">{row.battery_code}</Text>
                      {row.serial_number ? <Text className="text-[11px] text-slate-500">SN: {row.serial_number}</Text> : null}
                    </TouchableOpacity>
                    <StatusBadge status={row.battery_status} />
                  </View>
                  <Text className="mt-1.5 text-xs text-slate-600">{row.client_name || '—'} · <Text className="font-bold text-amber-700">+{row.quantity_used || 1} unit recovered</Text></Text>
                  <Text className="mt-1 text-[11px] text-slate-500">Removed by {row.removed_by_staff_name || row.staff_name || 'Staff'} · {dateTime(row.removed_at)}</Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text className="flex-1 text-[11px] text-slate-500">Originally installed {dateOnly(row.repaired_at)} by {row.staff_name}</Text>
                    <TouchableOpacity onPress={() => openBattery(row.battery_code)}>
                      <Text className="text-[11px] font-bold text-blue-600">Inspect ↗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <Text className="text-[11px] text-slate-500">Total Recovered Records: {filteredRemoved.length} · {totalRemovedQuantity} Total Units Reclaimed</Text>
            </>
          )}
        </View>
      )}

      {activeTab === 'restock' && (
        <View className="gap-3">
          <SearchBox value={restockSearch} onChangeText={setRestockSearch} placeholder="Search restock note, user name, email, or quantity…" />
          {canManageParts && <Btn tone="emerald" label="+ Add Restock Receipt" onPress={() => setRestocking(true)} />}
          {filteredStock.length === 0 ? (
            <Empty title="No restock entries recorded yet" text="Record supplier inventory batches or warehouse replenishments to track stock arrivals and audit trails.">
              {canManageParts && (
                <View className="mt-3">
                  <Btn tone="emerald" label="+ Restock This Part" onPress={() => setRestocking(true)} />
                </View>
              )}
            </Empty>
          ) : (
            filteredStock.map((item) => (
              <View key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-black text-emerald-700">+{item.quantity_added} units <Text className="text-[10px] font-bold text-emerald-600">Stock Inflow</Text></Text>
                  <Text className="text-[11px] text-slate-500">{dateTime(item.adjusted_at)}</Text>
                </View>
                <Text className="mt-1 text-xs text-slate-600">
                  Logged by <Text className="font-bold text-slate-800">{item.adjusted_by_name || 'Admin'}</Text>
                  {item.adjusted_by_role ? ` · ${item.adjusted_by_role}` : ''}
                  {item.adjusted_by_email ? ` (${item.adjusted_by_email})` : ''}
                </Text>
                {item.note ? (
                  <View className="mt-2 rounded-xl bg-slate-50 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">Note / Memo</Text>
                    <Text className="text-xs text-slate-700">{item.note}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === 'specs' && (
        <View className="gap-3">
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="mb-1 text-sm font-bold text-slate-900">Identity &amp; Inventory Profile</Text>
            <Row label="Part Name">{part.name}</Row>
            <Row label="SKU / Catalog Code">{part.sku ? <Text selectable className="font-mono text-xs font-bold text-slate-900">{part.sku}</Text> : 'Not specified'}</Row>
            <Row label="System Database ID">{`#${part.id}`}</Row>
            <Row label="Current Stock Quantity">{plural(quantity, 'unit')}</Row>
            <Row label="Active Units in Fleet">{plural(activeQuantity, 'unit')}</Row>
            <Row label="Reclaimed / Removed Units">{plural(totalRemovedQuantity, 'unit')}</Row>
            <Row label="Inventory Status">
              <Text className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${health.pill}`}>{isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}</Text>
            </Row>
            <Row label="Registered In System">{dateTime(part.created_at)}</Row>
          </View>
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="mb-1 text-sm font-bold text-slate-900">Unit Economics &amp; Pricing</Text>
            <Row label="Unit Purchase Cost (Supplier)">{money(unitCost)}</Row>
            <Row label="Client Service Charge (Billing Rate)">{money(serviceCharge)}</Row>
            <Row label="Gross Margin per Unit">{`${money(unitMargin)} (${marginPct}%)`}</Row>
            <Row label="Current Stock Asset Valuation">{money(totalStockValuation)}</Row>
            <Row label="Potential Retail Billing Value">{money(potentialRevenue)}</Row>
            <Row label="Active Revenue Generated">{money(totalRevenue)}</Row>
            <Row label="Lifetime Units Consumed">{plural(totalQuantityUsed, 'unit')}</Row>
          </View>
        </View>
      )}

      {activeTab === 'analytics' && (
        <View className="gap-3">
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="text-sm font-bold text-slate-900">Monthly Inflow vs Outflow</Text>
            <Text className="mt-0.5 text-xs text-slate-500">Restock top-ups versus repair consumption across the last {MONTHS_SHOWN} calendar months.</Text>
            <View className="mt-2 flex-row gap-4">
              <Text className="text-[11px] font-semibold text-emerald-700">■ Restocked (+units)</Text>
              <Text className="text-[11px] font-semibold text-rose-600">■ Used in Repairs (-units)</Text>
            </View>
            <View className="mt-3 h-40 flex-row items-end justify-between gap-1">
              {monthly.map((m) => (
                <View key={m.key} className="flex-1 items-center">
                  <View className="h-32 w-full flex-row items-end justify-center gap-0.5">
                    <View className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(m.restocked > 0 ? 8 : 2, (m.restocked / maxMonthly) * 100)}%` }} />
                    <View className="w-3 rounded-t bg-rose-500" style={{ height: `${Math.max(m.used > 0 ? 8 : 2, (m.used / maxMonthly) * 100)}%` }} />
                  </View>
                  <Text className="mt-1 text-[9px] font-bold text-slate-500" numberOfLines={1}>{m.label}</Text>
                  <Text className="text-[9px] text-slate-400">+{m.restocked} / -{m.used}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Stat label="Average Monthly Consumption" value={`${avgMonthlyBurnRate} units / month`} sub="Based on past 6 months" />
            <Stat label="Stock Depletion Projection" value={monthsOfSupplyRemaining === '∞' ? 'Ample Supply' : `~${monthsOfSupplyRemaining} months`} sub="Estimated stock runway" tone="purple" />
            <Stat className="w-full" label="Total 6-Month Inflow / Outflow" value={`+${monthly.reduce((s, m) => s + m.restocked, 0)} / -${totalUsedLast6Months}`} sub="Net movement" />
          </View>
        </View>
      )}

      <RestockSheet
        visible={restocking}
        part={part}
        title="Restock Inventory"
        description={`Record fresh stock receipt for "${part.name}".`}
        onSaved={() => { setRestocking(false); load(); }}
        onClose={() => setRestocking(false)}
      />
      <PartFormSheet
        visible={editing}
        part={part}
        title="Edit Part Specifications"
        description={`Update details, SKU, and unit costs for "${part.name}".`}
        onSaved={() => { setEditing(false); load(); }}
        onClose={() => setEditing(false)}
      />
      <ConfirmDialog
        visible={deleting}
        title="Delete Part"
        message={`Are you sure you want to delete "${part.name}"? Note that if this part has already been used in recorded repairs, it cannot be deleted.`}
        confirmLabel="Delete Part"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(false)}
      />
      <AlertDialog visible={Boolean(deleteError)} title="Cannot Delete Part" message={deleteError} onClose={() => setDeleteError(null)} />
    </ScrollView>
  );
}
