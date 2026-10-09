import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../services/api-client';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Detail pages for admin records — the mobile versions of the web
// ClientDetailPage, RecycleClientDetailPage, StaffDetailPage, PartDetailPage,
// TruckIntakeDetailPage, ReturnDetailPage and RecycleDetailPage.
// route.params: { kind, id, row? }

const money = (v) => `£${Number(v || 0).toFixed(2)}`;
const when = (v) => (v ? new Date(v).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const KINDS = {
  client: { title: 'Fleet Client', url: (id) => `/clients/${id}`, form: 'client', record: (d) => d.client },
  recycleClient: { title: 'Recycling Partner', url: (id) => `/clients/${id}`, form: 'recycleClient', record: (d) => d.client },
  staff: { title: 'Staff Member', url: (id) => `/staff/${id}`, form: 'staff', record: (d) => d.staff },
  part: { title: 'Part', url: (id) => `/parts/${id}`, form: 'part', record: (d) => d.part },
  intake: { title: 'Truck Intake', url: (id) => `/truck-intakes/${id}`, record: (d) => d.intake },
  return: { title: 'Return Dispatch', url: (id) => `/returns/${id}`, record: (d) => d.returnRecord },
  recycle: { title: 'Recycle Shipment', url: (id) => `/recycle/${id}`, record: (d) => d.batch },
};

function Card({ children, className = '' }) {
  return <View className={`rounded-3xl border border-slate-200 bg-white p-4 ${className}`}>{children}</View>;
}
function Row({ label, value }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-100 py-2.5">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-sm font-semibold text-slate-900" numberOfLines={2}>{value ?? '—'}</Text>
    </View>
  );
}
function Stat({ label, value, tone = 'text-slate-800' }) {
  return (
    <View className="min-w-[30%] flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className={`mt-0.5 text-lg font-black ${tone}`}>{value}</Text>
    </View>
  );
}
function SectionTitle({ children, right }) {
  return (
    <View className="mt-1 flex-row items-center justify-between">
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{children}</Text>
      {right}
    </View>
  );
}

export default function AdminDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { kind, id } = route.params || {};
  const meta = KINDS[kind];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => { navigation.setOptions({ title: meta?.title || 'Details' }); }, [navigation, meta]);

  const load = useCallback(async () => {
    try {
      const { data: d } = await apiClient.get(meta.url(id));
      setData(d);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [meta, id]);

  useEffect(() => { load(); }, [load]);
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => { if (firstFocus.current) { firstFocus.current = false; return; } load(); }, [load]));

  const record = data ? meta.record(data) : null;
  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  async function openDoc(path) {
    const token = await AsyncStorage.getItem('token');
    const origin = apiClient.defaults.baseURL.replace(/\/api\/?$/, '');
    await Linking.openURL(`${origin}${path.startsWith('/') ? '' : '/'}${path}?token=${encodeURIComponent(token || '')}`);
  }

  async function verifyArrival() {
    Alert.alert('Verify truck arrival?', `${record.battery_count || 0} batteries will move to "awaiting repair".`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Verify', onPress: async () => {
        try { await apiClient.patch(`/truck-intakes/${id}/verify-arrival`); load(); }
        catch (err) { Alert.alert('Could not verify', err.response?.data?.message || err.message); }
      } },
    ]);
  }

  function batteryList(list, extra) {
    if (!list?.length) return <Card><Text className="text-center text-xs text-slate-400">No batteries</Text></Card>;
    return (
      <View className="gap-2">
        {list.map((b) => (
          <TouchableOpacity key={b.id} onPress={() => openBattery(b.battery_code)} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-bold text-blue-700">{b.battery_code}</Text>
              <Text className="text-[11px] text-slate-500" numberOfLines={1}>{extra ? extra(b) : (b.serial_number ? `SN ${b.serial_number}` : b.client_name || '')}</Text>
            </View>
            <StatusBadge status={b.status} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-4 pb-16 gap-3" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {error && <View className="rounded-2xl border border-red-200 bg-red-50 p-3"><Text className="text-xs font-semibold text-red-700">{error}</Text></View>}
      {loading && !data ? <Text className="py-8 text-center text-xs text-slate-400">Loading…</Text> : null}

      {record && (kind === 'client' || kind === 'recycleClient') && (
        <>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-lg font-extrabold text-slate-900">{record.name}</Text>
              <Badge tone={record.user_active === false ? 'critical' : 'good'}>{record.user_active === false ? 'Login inactive' : record.login_email ? 'Login active' : 'No login'}</Badge>
            </View>
            <Row label="Portal login" value={record.login_email} />
            <Row label="Invoice email" value={record.invoice_email} />
            <Row label="Client since" value={when(record.created_at)} />
          </Card>
          {data.isRecycleClient ? (
            <>
              <View className="flex-row gap-2"><Stat label="Shipments" value={data.stats?.shipment_count ?? 0} /><Stat label="Batteries" value={data.stats?.battery_count ?? 0} /></View>
              <SectionTitle>Shipments received</SectionTitle>
              {(data.shipments || []).map((s) => (
                <TouchableOpacity key={s.id} onPress={() => navigation.push('AdminDetail', { kind: 'recycle', id: s.id })} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <Text className="text-sm font-bold text-slate-900">Vehicle {s.vehicle_number}</Text>
                  <Text className="text-[11px] text-slate-500">{s.battery_count} batteries · {when(s.recycled_at)}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              <View className="flex-row flex-wrap gap-2">
                <Stat label="Batteries" value={Number(data.stats?.battery_count || 0)} />
                <Stat label="Repaired" value={Number(data.stats?.repaired_count || 0)} tone="text-emerald-700" />
                <Stat label="Balance" value={money(data.stats?.balance)} tone="text-amber-700" />
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Batteries', { search: record.name, status: '' })} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5">
                <Text className="text-sm font-bold text-slate-800">View this client's batteries</Text>
                <Icon name="arrowRight" color="#94a3b8" size={16} />
              </TouchableOpacity>
              <SectionTitle>Recent transactions</SectionTitle>
              {(data.transactions || []).slice(0, 30).map((t) => (
                <View key={t.id} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-slate-900">{t.battery_code}</Text>
                    <Text className="text-[11px] text-slate-500" numberOfLines={1}>{t.description || t.part_name} · {t.staff_name}</Text>
                  </View>
                  <Text className="text-sm font-black text-slate-800">{money(t.amount)}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {record && kind === 'staff' && (
        <>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-lg font-extrabold text-slate-900">{record.name}</Text>
              <Text className={`text-xs font-bold ${record.role === 'supervisor' ? 'text-red-600' : 'text-blue-600'}`}>{record.role === 'supervisor' ? 'Supervisor' : 'Technician'}</Text>
            </View>
            <Row label="Email / login" value={record.email || record.login_email} />
            <Row label="Phone" value={record.phone} />
            <Row label="Salary" value={record.salary != null ? money(record.salary) : null} />
            <Row label="Passport" value={record.passport_number} />
            <Row label="NI number" value={record.ni_number} />
            <Row label="Share code" value={record.share_code} />
            {record.document_path ? (
              <TouchableOpacity onPress={() => openDoc(`/uploads/staff-docs/${record.document_path}`)} className="mt-2 items-center rounded-xl bg-slate-800 py-2.5"><Text className="text-xs font-bold text-white">Open ID document</Text></TouchableOpacity>
            ) : null}
          </Card>
          <View className="flex-row gap-2">
            <Stat label="Repairs" value={(data.repairs || []).length} />
            <Stat label="Tests" value={(data.tests || []).length} tone="text-violet-700" />
            <Stat label="Issues" value={(data.issues || []).length} tone="text-rose-700" />
          </View>
          <SectionTitle>Recent work</SectionTitle>
          {[...(data.repairs || []).map((r) => ({ ...r, k: 'Repair', at: r.repaired_at, info: r.part_name })), ...(data.tests || []).map((t) => ({ ...t, k: t.passed_back ? 'Passed back' : 'Tested', at: t.tested_at, info: t.service_name })), ...(data.issues || []).map((i) => ({ ...i, k: 'Issue', at: i.reported_at, info: i.reason_label }))]
            .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 40)
            .map((w, i) => (
              <TouchableOpacity key={`${w.k}-${w.id}-${i}`} onPress={() => openBattery(w.battery_code)} className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-blue-700">{w.battery_code}</Text>
                  <Text className="text-[11px] text-slate-500" numberOfLines={1}>{w.k} · {w.info || '—'} · {when(w.at)}</Text>
                </View>
                {w.price != null ? <Text className="text-xs font-bold text-slate-700">{money(Number(w.price) + Number(w.labor_charge || 0))}</Text> : null}
              </TouchableOpacity>
            ))}
        </>
      )}

      {record && kind === 'part' && (
        <>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-lg font-extrabold text-slate-900">{record.name}</Text>
              <Badge tone={Number(record.quantity) > 0 ? 'good' : 'critical'}>{Number(record.quantity) > 0 ? `${record.quantity} in stock` : 'Out of stock'}</Badge>
            </View>
            <Row label="SKU" value={record.sku} />
            <Row label="Part cost" value={money(record.repair_cost)} />
            <Row label="Labour charge" value={money(record.service_charge)} />
          </Card>
          <SectionTitle>Used in repairs ({(data.usageHistory || []).length})</SectionTitle>
          {(data.usageHistory || []).slice(0, 30).map((u) => (
            <TouchableOpacity key={u.id} onPress={() => openBattery(u.battery_code)} className="rounded-2xl border border-slate-200 bg-white p-3">
              <Text className="text-sm font-bold text-blue-700">{u.battery_code}</Text>
              <Text className="text-[11px] text-slate-500">Qty {u.quantity_used} · {u.staff_name} · {when(u.repaired_at)}{u.removed_at ? ' · removed' : ''}</Text>
            </TouchableOpacity>
          ))}
          <SectionTitle>Restock history ({(data.stockHistory || []).length})</SectionTitle>
          {(data.stockHistory || []).slice(0, 30).map((s) => (
            <View key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <Text className="text-sm font-bold text-emerald-700">+{s.quantity_added}</Text>
              <Text className="text-[11px] text-slate-500">{s.adjusted_by_name || '—'} · {when(s.adjusted_at)}{s.note ? ` · ${s.note}` : ''}</Text>
            </View>
          ))}
        </>
      )}

      {record && kind === 'intake' && (
        <>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-lg font-extrabold text-slate-900">Truck {record.truck_number}</Text>
              <Badge tone={record.status === 'verified' || record.verified_at ? 'good' : 'warning'}>{record.status === 'verified' || record.verified_at ? 'Verified' : 'Pending arrival'}</Badge>
            </View>
            <Row label="Client" value={record.client_name} />
            <Row label="Driver" value={record.driver_name} />
            <Row label="Batteries" value={record.battery_count} />
            <Row label="Packed / intake" value={when(record.intake_at)} />
            <Row label="Verified" value={record.verified_at ? when(record.verified_at) : 'Not yet'} />
            {!(record.status === 'verified' || record.verified_at) && (
              <TouchableOpacity onPress={verifyArrival} className="mt-3 items-center rounded-xl bg-emerald-600 py-3"><Text className="text-sm font-bold text-white">Verify arrival</Text></TouchableOpacity>
            )}
          </Card>
          <SectionTitle>Batteries on this truck ({(data.batteries || []).length})</SectionTitle>
          {batteryList(data.batteries)}
        </>
      )}

      {record && kind === 'return' && (
        <>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-lg font-extrabold text-slate-900">Truck {record.truck_number}</Text>
              <Badge tone={record.status === 'verified' || record.verified_at ? 'good' : 'warning'}>{record.status === 'verified' || record.verified_at ? 'Received by client' : 'In transit'}</Badge>
            </View>
            <Row label="Client" value={record.client_name} />
            <Row label="Driver" value={record.driver_name} />
            <Row label="Dispatched" value={when(record.returned_at)} />
            <Row label="Client confirmed" value={record.verified_at ? when(record.verified_at) : 'Not yet'} />
            {record.document_url ? (
              <TouchableOpacity onPress={() => openDoc(record.document_url)} className="mt-2 items-center rounded-xl bg-slate-800 py-2.5"><Text className="text-xs font-bold text-white">Open {record.document_name || 'document'}</Text></TouchableOpacity>
            ) : null}
          </Card>
          <SectionTitle>Batteries returned ({(data.batteries || []).length})</SectionTitle>
          {batteryList(data.batteries, (b) => (b.last_repaired_parts ? `Parts: ${b.last_repaired_parts}` : b.serial_number ? `SN ${b.serial_number}` : ''))}
        </>
      )}

      {record && kind === 'recycle' && (
        <>
          <Card>
            <Text className="text-lg font-extrabold text-slate-900">Vehicle {record.vehicle_number}</Text>
            <Row label="Recycling partner" value={record.recycle_client_name} />
            <Row label="Driver" value={record.driver_name} />
            <Row label="Batteries" value={record.battery_count} />
            <Row label="Weight" value={record.total_weight_kg ? `${Number(record.total_weight_kg).toFixed(1)} kg` : null} />
            <Row label="Price / kg" value={record.price_per_kg ? money(record.price_per_kg) : null} />
            <Row label="Value" value={record.total_weight_kg && record.price_per_kg ? money(Number(record.total_weight_kg) * Number(record.price_per_kg)) : null} />
            <Row label="Shipped" value={when(record.recycled_at)} />
          </Card>
          <SectionTitle>Batteries recycled ({(data.batteries || []).length})</SectionTitle>
          {batteryList(data.batteries, (b) => [b.client_name, b.issue_reason].filter(Boolean).join(' · '))}
        </>
      )}

      {record && meta.form && (
        <TouchableOpacity onPress={() => navigation.navigate('AdminForm', { kind: meta.form, row: record })} className="mt-2 items-center rounded-2xl bg-violet-600 py-3.5">
          <Text className="text-sm font-bold text-white">Edit {meta.title.toLowerCase()}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
