import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import { Btn, ErrorBox, SearchBox, money } from '../../components/admin/sa4/ui';
import { FinanceKpis } from './AdminFinanceScreen';

// Finance statement for one month or day — the phone version of the web
// FinanceDetailPage: GET /finance/period-detail?type=&period= → hero total,
// Previous / Next period, the six KPI cards, Revenue by Client (share bars),
// Technician Output, Services & Intake Fees (+ top parts) and the itemized
// ledger grouped per battery with an expandable list of charge items.
// Route params: { type: 'month' | 'day', period, label, from, to }.

const UNSERVICEABLE = ['unserviceable', 'tested_parts_removed', 'unserviceable_parts_removed', 'recycled'];
function isBatteryUnserviceable(status) {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  return UNSERVICEABLE.includes(s) || s.includes('unserviceable') || s.includes('parts_removed') || s.includes('test failed');
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const s = Math.round(Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s % 60}s`;
}

const pad = (n) => String(n).padStart(2, '0');
const notPassedBack = (s) => (s || '').toLowerCase() !== 'passed back to technician';

// Same per-battery consolidation as the web page
function groupRepairs(repairs = []) {
  const map = new Map();
  repairs.forEach((r, idx) => {
    const bCode = (r.batteryCode || r.battery_code || '').trim().toUpperCase();
    const bId = r.batteryId || r.battery_id;
    const key = bCode ? `code_${bCode}` : bId ? `id_${bId}` : `item_${r.id || idx}`;
    if (!map.has(key)) {
      map.set(key, {
        key, batteryCode: r.batteryCode || r.battery_code || bCode || null, batteryStatus: r.batteryStatus || r.battery_status,
        clientName: r.clientName || r.client_name || 'Direct / Unassigned', staffList: [], services: new Set(), parts: new Set(),
        chargeTypes: new Set(), laborCharge: 0, partsCharge: 0, serviceFee: 0, items: [], latestDate: r.repairedAt || r.charge_date, notes: [],
      });
    }
    const g = map.get(key);
    g.laborCharge += Number(r.laborCharge || r.labor_charge || 0);
    g.partsCharge += Number(r.partsCharge || r.parts_charge || 0);
    g.serviceFee += Number(r.serviceFee || r.service_fee || 0);
    if (Array.isArray(r.services)) r.services.forEach((s) => s && notPassedBack(s) && g.services.add(s));
    if (Array.isArray(r.parts)) r.parts.forEach((p) => g.parts.add(p));
    const isServiceFee = r.chargeType === 'service_fee' || (r.serviceFee > 0 && !r.partsCharge && !r.laborCharge);
    if (isServiceFee) {
      const desc = r.itemDescription || r.partName || 'Service Fee';
      if (desc && notPassedBack(desc)) {
        g.chargeTypes.add('service_fee');
        if (!Array.isArray(r.services)) g.services.add(desc);
      }
    } else {
      g.chargeTypes.add('repair');
      if (!Array.isArray(r.parts)) (r.partName || r.itemDescription || '').split(',').map((p) => p.trim()).filter(Boolean).forEach((p) => g.parts.add(p));
    }
    if (Array.isArray(r.chargeTypes)) r.chargeTypes.forEach((t) => g.chargeTypes.add(t));
    if (Array.isArray(r.staffList) && r.staffList.length > 0) {
      r.staffList.forEach((st) => { if (!g.staffList.some((s) => s.id === st.id && s.name === st.name)) g.staffList.push(st); });
    } else {
      const sName = r.staffName || (r.staffId ? `Staff #${r.staffId}` : 'System Auto');
      if (sName && !g.staffList.some((s) => s.id === r.staffId && s.name === sName)) g.staffList.push({ id: r.staffId, name: sName });
    }
    if (r.batteryStatus || r.battery_status) g.batteryStatus = r.batteryStatus || r.battery_status;
    if ((r.batteryCode || r.battery_code) && !g.batteryCode) g.batteryCode = r.batteryCode || r.battery_code;
    if (r.clientName && r.clientName !== 'Direct / Unassigned') g.clientName = r.clientName;
    const d = r.repairedAt || r.charge_date;
    if (d && (!g.latestDate || new Date(d) > new Date(g.latestDate))) g.latestDate = d;
    if (typeof r.notes === 'string' && r.notes.trim()) g.notes.push(r.notes.trim());
    if (Array.isArray(r.items) && r.items.length > 0) r.items.forEach((it) => notPassedBack(it.itemDescription || it.partName) && g.items.push(it));
    else if (notPassedBack(r.itemDescription || r.partName)) g.items.push(r);
  });
  return Array.from(map.values())
    .map((g) => {
      const isUnserviceable = isBatteryUnserviceable(g.batteryStatus) || g.items.some((it) => it.partsRemoved || it.parts_removed);
      const partsCharge = isUnserviceable ? 0 : g.partsCharge;
      const laborCharge = isUnserviceable ? 0 : g.laborCharge;
      const items = g.items
        .map((it) => {
          const isItemRepair = it.chargeType === 'repair' || (!it.serviceFee && (it.partsCharge > 0 || it.laborCharge > 0 || it.partName));
          const p = isUnserviceable && isItemRepair ? 0 : Number(it.partsCharge || 0);
          const l = isUnserviceable && isItemRepair ? 0 : Number(it.laborCharge || 0);
          const f = Number(it.serviceFee || 0);
          return { ...it, partsRemoved: (isUnserviceable && isItemRepair) || it.partsRemoved || it.parts_removed, partsCharge: p, laborCharge: l, serviceFee: f, totalCharge: p + l + f };
        })
        .sort((a, b) => new Date(b.repairedAt || b.charge_date || 0) - new Date(a.repairedAt || a.charge_date || 0));
      return {
        ...g, isUnserviceable, partsCharge, laborCharge, totalCharge: partsCharge + laborCharge + g.serviceFee,
        services: Array.from(g.services), parts: Array.from(g.parts), chargeTypes: Array.from(g.chargeTypes), items,
      };
    })
    .sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));
}

function Panel({ title, children }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="mb-2 text-sm font-bold text-slate-900">{title}</Text>
      {children}
    </View>
  );
}

export default function AdminFinanceDetailScreen() {
  const navigation = useNavigation();
  const params = useRoute().params || {};
  const [type, setType] = useState(params.type || 'month');
  const [period, setPeriod] = useState(params.period || '');
  const { from = '', to = '' } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const title = useMemo(() => {
    if (type === 'month' && period) {
      const [y, m] = period.split('-').map(Number);
      return `Monthly Statement: ${new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
    }
    if (type === 'day' && period) {
      const [y, m, d] = period.split('-').map(Number);
      return `Daily Statement: ${new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    if (from || to) return `Custom Statement: ${from || 'Start'} to ${to || 'Present'}`;
    return 'Period Financial Statement';
  }, [type, period, from, to]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: type === 'day' ? 'Daily Statement' : 'Monthly Statement' });
  }, [navigation, type]);

  const load = useCallback(async () => {
    try {
      const q = {};
      if (type) q.type = type;
      if (period) q.period = period;
      if (from) q.from = from;
      if (to) q.to = to;
      const { data: res } = await apiClient.get('/finance/period-detail', { params: q });
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type, period, from, to]);

  useEffect(() => {
    setLoading(true);
    setExpanded(new Set());
    load();
  }, [load]);

  // Previous / Next month or day (local dates, no UTC shift)
  function step(direction) {
    if (!period) return;
    if (type === 'month') {
      const [y, m] = period.split('-').map(Number);
      const dt = new Date(y, m - 1 + direction, 1);
      setPeriod(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`);
    } else {
      const [y, m, d] = period.split('-').map(Number);
      const dt = new Date(y, m - 1, d + direction);
      setPeriod(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    }
  }

  const t = data?.totals || {};
  const clientBreakdown = data?.clientBreakdown || [];
  const staffBreakdown = data?.staffBreakdown || [];
  const serviceBreakdown = data?.serviceBreakdown || [];
  const partBreakdown = data?.partBreakdown || [];
  const grouped = useMemo(() => groupRepairs(data?.repairs || []), [data]);
  const q = search.trim().toLowerCase();
  const batteries = q
    ? grouped.filter((b) =>
        [b.batteryCode, b.clientName, b.batteryStatus].some((v) => (v || '').toLowerCase().includes(q)) ||
        [...b.staffList.map((s) => s?.name), ...b.services, ...b.parts, ...b.notes, ...b.chargeTypes].some((v) => (v || '').toLowerCase().includes(q))
      )
    : grouped;
  const toggle = (key) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const openBattery = (code) => code && navigation.navigate('BatteryDetail', { code, fromScan: false });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-xs font-bold text-slate-700">← Back to Finance &amp; Billing</Text>
        </TouchableOpacity>
        {period ? (
          <View className="flex-row gap-2">
            <Btn small tone="outline" label={`‹ Previous ${type === 'month' ? 'Month' : 'Day'}`} onPress={() => step(-1)} />
            <Btn small tone="outline" label={`Next ${type === 'month' ? 'Month' : 'Day'} ›`} onPress={() => step(1)} />
          </View>
        ) : null}
      </View>

      <View className="rounded-3xl bg-emerald-700 p-5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">{type === 'month' ? 'Monthly Statement' : 'Daily Statement'}</Text>
        {data?.period ? (
          <Text className="text-[11px] text-emerald-100">
            {data.period.startDate} {data.period.endDate !== data.period.startDate ? `to ${data.period.endDate}` : ''}
          </Text>
        ) : null}
        <Text className="mt-1 text-lg font-black text-white">{title}</Text>
        <Text className="mt-3 text-[10px] font-bold uppercase text-emerald-100">Total Revenue</Text>
        <Text className="text-3xl font-black text-white">{money(t.totalRevenue)}</Text>
      </View>

      {loading && !refreshing ? <Text className="py-6 text-center text-xs text-slate-400">Loading detailed period financial report…</Text> : null}
      <ErrorBox text={error} />

      {!loading && !error && (
        <>
          <FinanceKpis totals={t} />

          <Panel title={`Revenue by Client (${clientBreakdown.length})`}>
            {clientBreakdown.length === 0 ? (
              <Text className="text-xs text-slate-400">No client activity in this period.</Text>
            ) : clientBreakdown.map((c, i) => {
              const billed = t.totalRevenue || t.repairRevenue || 1;
              const share = billed > 0 ? Math.round((c.totalRevenue / billed) * 100) : 0;
              return (
                <View key={c.id || i} className="border-b border-slate-100 py-2">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>{c.name}</Text>
                    <Text className="text-sm font-black text-emerald-700">{money(c.totalRevenue)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[11px] text-slate-500">{c.repairsCount} repairs · {c.servicesCount || 0} fees ({c.batteriesCount} batteries)</Text>
                    <Text className="text-[11px] font-bold text-slate-600">{share}% share</Text>
                  </View>
                  <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <View className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(2, share))}%` }} />
                  </View>
                </View>
              );
            })}
          </Panel>

          <Panel title={`Technician Output (${staffBreakdown.length})`}>
            {staffBreakdown.length === 0 ? (
              <Text className="text-xs text-slate-400">No technician logged work in this period.</Text>
            ) : staffBreakdown.map((s, i) => (
              <View key={s.id || i} className="border-b border-slate-100 py-2">
                <View className="flex-row items-center justify-between gap-2">
                  <TouchableOpacity className="flex-1" disabled={!s.id} onPress={() => navigation.navigate('AdminDetail', { kind: 'staff', id: s.id })}>
                    <Text className="text-sm font-semibold text-blue-700" numberOfLines={1}>{s.name}</Text>
                  </TouchableOpacity>
                  <Text className="text-sm font-black text-emerald-700">{money(s.totalRevenue)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-slate-500">{s.repairsCount} repairs · {s.servicesCount || 0} services</Text>
                  <Text className="text-[11px] font-bold text-slate-600">{s.avgDurationSeconds ? formatDuration(s.avgDurationSeconds) : 'Fee/Test'}</Text>
                </View>
              </View>
            ))}
          </Panel>

          <Panel title={`Services & Intake Fees (${serviceBreakdown.length})`}>
            {serviceBreakdown.length === 0 && partBreakdown.length === 0 ? (
              <Text className="text-xs text-slate-400">No service fees or parts logged in this period.</Text>
            ) : (
              <>
                {serviceBreakdown.map((s, i) => (
                  <View key={`srv-${s.service_id || i}`} className="flex-row items-center justify-between gap-2 border-b border-slate-100 py-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-slate-900">{s.name}</Text>
                      <Text className="text-[11px] text-slate-500">{s.timesApplied} applied ({s.batteriesCount} batteries) · {money(s.avgRate)}/unit</Text>
                    </View>
                    <Text className="text-sm font-black text-amber-700">{money(s.totalRevenue)}</Text>
                  </View>
                ))}
                {partBreakdown.slice(0, 4).map((p, i) => (
                  <View key={`prt-${p.id || i}`} className="flex-row items-center justify-between gap-2 border-b border-slate-100 py-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-slate-900">{p.name}</Text>
                      <Text className="text-[11px] text-slate-500">{p.quantityUsed} unit{p.quantityUsed === 1 ? '' : 's'} replaced</Text>
                    </View>
                    <Text className="text-sm font-black text-blue-700">{money(p.totalRevenue)}</Text>
                  </View>
                ))}
              </>
            )}
          </Panel>

          <View className="gap-3">
            <View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-bold text-slate-900">Itemized Battery Charges &amp; Fee Ledger</Text>
                <Text className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">{batteries.length} {batteries.length === 1 ? 'Battery' : 'Batteries'}</Text>
              </View>
              <Text className="mt-0.5 text-xs text-slate-500">Clear breakdown of repair parts, labor charges, and diagnostic testing fees per battery.</Text>
            </View>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search battery, client, service, part…" />
            {batteries.length === 0 ? (
              <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
                <Text className="text-center text-sm font-semibold text-slate-700">{q ? 'No batteries match your search query.' : 'No battery fees or repair charges found for this period.'}</Text>
                <Text className="mt-1 text-center text-xs text-slate-400">{q ? 'Try clearing your search filters' : 'Charges will automatically log here as batteries are processed'}</Text>
              </View>
            ) : batteries.map((b, index) => {
              const unserviceable = b.isUnserviceable;
              const hasRepair = b.chargeTypes.includes('repair') || b.partsCharge > 0 || b.laborCharge > 0 || b.parts.length > 0;
              const testing = b.services.filter((s) => s && notPassedBack(s));
              const hasTesting = b.chargeTypes.includes('service_fee') || b.serviceFee > 0 || testing.length > 0;
              const repairCharge = unserviceable ? 0 : b.partsCharge + b.laborCharge;
              const staffNames = b.staffList.map((s) => s?.name).filter((n) => n && !n.toLowerCase().includes('system') && !n.toLowerCase().includes('auto'));
              const partsText = `${b.parts.slice(0, 2).join(', ')}${b.parts.length > 2 ? ` +${b.parts.length - 2}` : ''}`;
              const open = expanded.has(b.key);
              return (
                <View key={b.key} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <View className="flex-row items-start gap-2">
                    <Text className="w-5 pt-0.5 text-xs font-bold text-slate-400">{index + 1}</Text>
                    <View className="flex-1">
                      <View className="flex-row flex-wrap items-center justify-between gap-1">
                        <TouchableOpacity disabled={!b.batteryCode} onPress={() => openBattery(b.batteryCode)}>
                          <Text className="text-sm font-bold text-blue-700">{b.batteryCode || '—'}</Text>
                        </TouchableOpacity>
                        {b.batteryStatus ? <StatusBadge status={b.batteryStatus} /> : null}
                      </View>
                      <Text className="mt-0.5 text-xs text-slate-600" numberOfLines={1}>
                        {b.clientName} · {b.latestDate ? new Date(b.latestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </Text>
                      <View className="mt-1.5 flex-row flex-wrap gap-1">
                        {b.parts.length > 0 && unserviceable ? (
                          <Text className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 line-through">{partsText} <Text className="no-underline">(Removed)</Text></Text>
                        ) : b.parts.length > 0 ? (
                          <Text className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Fitted: {partsText}</Text>
                        ) : null}
                        {hasTesting ? <Text className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{testing[0] || 'Diagnostic Fee'}</Text> : null}
                        {!hasRepair && !hasTesting ? <Text className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Standard Intake Inspection</Text> : null}
                      </View>
                      <Text className="mt-1 text-[11px] text-slate-500" numberOfLines={1}>
                        {staffNames.length > 0 ? `Staff: ${staffNames.join(', ')}` : 'Automated intake scan'}
                      </Text>
                      <View className="mt-2 flex-row flex-wrap items-end justify-between gap-2">
                        <View>
                          <Text className="text-[10px] text-slate-400">Part Service Charge</Text>
                          {unserviceable && (b.parts.length > 0 || b.chargeTypes.includes('repair')) ? (
                            <Text className="text-xs font-bold text-rose-600">£0.00 <Text className="text-[10px]">Parts Removed</Text></Text>
                          ) : repairCharge > 0 ? (
                            <Text className="text-xs font-bold text-slate-800">{money(repairCharge)}</Text>
                          ) : <Text className="text-xs text-slate-400">—</Text>}
                        </View>
                        <View>
                          <Text className="text-[10px] text-slate-400">Service Fees</Text>
                          <Text className="text-xs font-bold text-slate-800">{b.serviceFee > 0 ? money(b.serviceFee) : '—'}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[10px] text-slate-400">Total Billed</Text>
                          <Text className={`rounded-lg border px-2 py-0.5 font-mono text-sm font-black ${b.totalCharge > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{money(b.totalCharge)}</Text>
                        </View>
                      </View>
                      {b.items.length > 1 ? (
                        <TouchableOpacity onPress={() => toggle(b.key)} className="mt-2 self-start rounded-lg border border-slate-200 px-2.5 py-1">
                          <Text className="text-[11px] font-bold text-slate-700">{b.items.length} items {open ? '▴' : '▾'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text className="mt-2 text-[11px] text-slate-400">1 item</Text>
                      )}
                    </View>
                  </View>

                  {open && (
                    <View className="mt-3 rounded-xl bg-slate-50 p-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[11px] font-bold text-slate-700">Individual Charge Items · {b.batteryCode}</Text>
                        <Text className="text-[11px] font-black text-emerald-700">Battery Total: {money(b.totalCharge)}</Text>
                      </View>
                      <Text className="text-[10px] text-slate-400">{b.items.length} logged {b.items.length === 1 ? 'action' : 'actions'}</Text>
                      {b.items.map((it, i) => {
                        const srv = it.chargeType === 'service_fee' || (it.serviceFee > 0 && !it.partsCharge && !it.laborCharge);
                        const removed = it.partsRemoved || Boolean(it.parts_removed) || (unserviceable && !srv);
                        const split = !srv && !removed && it.partsCharge > 0 && it.laborCharge > 0;
                        return (
                          <View key={it.id || i} className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
                            <View className="flex-row items-center justify-between gap-2">
                              <Text className="text-[10px] font-bold text-slate-400">#{i + 1}</Text>
                              <Text className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${srv ? 'bg-amber-100 text-amber-800' : removed ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'}`}>
                                {srv ? 'Service Fee' : removed ? 'Parts Removed' : 'Repair Job'}
                              </Text>
                              <Text className={`flex-1 text-right font-mono text-xs font-black ${removed ? 'text-rose-600' : 'text-slate-900'}`}>{removed ? '£0.00' : money(it.totalCharge)}</Text>
                            </View>
                            <Text className={`mt-1 text-xs font-semibold ${removed ? 'text-rose-700 line-through' : 'text-slate-800'}`}>
                              {it.itemDescription || it.partName || (srv ? 'Service Fee' : 'Workshop Repair')}
                            </Text>
                            {removed ? <Text className="text-[10px] font-bold text-rose-600">Unserviceable · Restocked</Text> : null}
                            {it.notes ? <Text className="text-[10px] italic text-slate-500" numberOfLines={2}>— "{it.notes}"</Text> : null}
                            <Text className="mt-1 text-[10px] text-slate-500">
                              {it.repairedAt ? new Date(it.repairedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} by {it.staffName || 'System Auto'}
                            </Text>
                            {split ? <Text className="text-[10px] text-slate-500">Parts: {money(it.partsCharge)} · Labor: {money(it.laborCharge)}</Text> : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}
