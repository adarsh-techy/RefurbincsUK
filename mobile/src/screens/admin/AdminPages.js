import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminListScreen from '../../components/admin/AdminListScreen';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';

// The admin list pages, each a config over AdminListScreen. Bespoke screens
// (Parts restock, Finance, Generate QR, Dashboard, Batteries, Intakes,
// Directory) live in their own files.

const money = (v) => `£${Number(v || 0).toFixed(2)}`;
const when = (v) => (v ? new Date(v).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const day = (v) => (v ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_TONE = {
  in_repair: 'warning', in_progress: 'critical', in_testing: 'info', repaired: 'good', returned: 'info',
  unserviceable: 'critical', tested_parts_removed: 'critical', recycled: 'neutral',
  open: 'warning', resolved: 'good', closed: 'neutral', sent: 'info', paid: 'good', overdue: 'critical',
  pending_arrival: 'warning', verified: 'good', urgent: 'critical', warning: 'warning', info: 'info',
};
const tone = (s) => STATUS_TONE[s] || 'neutral';

function StatCards({ items }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((it) => (
        <View key={it.label} className="min-w-[30%] flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{it.label}</Text>
          <Text className={`mt-0.5 text-lg font-black ${it.color || 'text-slate-800'}`}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Filter controls (shared by Ratings / Audit log) ──────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

// same presets as the web Ratings page
function presetRange(id) {
  const now = new Date();
  if (id === 'today') return [ymd(now), ymd(now)];
  if (id === 'week') {
    const monday = new Date(now);
    const d = monday.getDay();
    monday.setDate(monday.getDate() - d + (d === 0 ? -6 : 1));
    return [ymd(monday), ymd(now)];
  }
  if (id === 'month') return [`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`, ymd(now)];
  return ['', ''];
}

function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
      {options.map((o) => {
        const active = String(value) === String(o.id);
        return (
          <TouchableOpacity key={String(o.id)} onPress={() => onChange(o.id)} className={`rounded-xl px-3 py-1.5 ${active ? 'bg-violet-600' : 'bg-slate-100'}`}>
            <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// YYYY-MM-DD box (no date-picker package): reports a value only once it is
// a real date, or '' when cleared
function DateInput({ label, value, onChange }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const bad = text !== '' && !isYmd(text);
  return (
    <View className="flex-1">
      <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          const v = t.replace(/[^0-9-]/g, '').slice(0, 10);
          setText(v);
          if (v === '') onChange('');
          else if (isYmd(v)) onChange(v);
        }}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94a3b8"
        keyboardType="numbers-and-punctuation"
        className={`rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-900 ${bad ? 'border-red-400' : 'border-slate-200'}`}
      />
    </View>
  );
}

function useClientOptions() {
  const [clients, setClients] = useState([]);
  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => setClients(Array.isArray(data) ? data : data?.data || [])).catch(() => {});
  }, []);
  return clients;
}

// ── Repairs ───────────────────────────────────────────────────────────────
export function AdminRepairsScreen() {
  const navigation = useNavigation();
  return (
    <AdminListScreen
      endpoint="/repairs"
      paged
      icon="wrench"
      searchKeys={['battery_code', 'staff_name', 'part_name']}
      searchPlaceholder="Search battery, technician, part…"
      title={(r) => r.battery_code}
      subtitle={(r) => `${r.part_name || 'Repair'} · ${r.staff_name || 'Staff'}`}
      badge={(r) => ({ label: titleCase(r.battery_status), tone: tone(r.battery_status) })}
      meta={(r) => [
        `${when(r.repaired_at)}${r.duration_seconds ? ` · ${r.duration_seconds >= 60 ? `${Math.round(r.duration_seconds / 60)} min` : `${r.duration_seconds}s`}` : ''} · ${money(r.price)}`,
        r.notes,
      ]}
      onPress={(r) => navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false })}
      empty="No repairs logged"
    />
  );
}

// ── Returns dispatch ──────────────────────────────────────────────────────
export function AdminReturnsScreen() {
  const navigation = useNavigation();
  return (
    <AdminListScreen
      addLabel="New return dispatch"
      onAdd={() => navigation.navigate('AdminReturnCreate')}
      endpoint="/returns"
      icon="truck"
      searchKeys={['truck_number', 'driver_name', 'client_name']}
      searchPlaceholder="Search truck, driver, client…"
      filters={[
        { id: 'all', label: 'All' },
        { id: 'pending', label: 'Awaiting client receipt', test: (r) => r.status !== 'verified' && !r.verified_at },
        { id: 'verified', label: 'Received', test: (r) => r.status === 'verified' || Boolean(r.verified_at) },
      ]}
      title={(r) => `Truck ${r.truck_number || `#${r.id}`}`}
      subtitle={(r) => `${r.client_name || 'Client'} · ${r.driver_name || 'Driver'}`}
      badge={(r) => (r.status === 'verified' || r.verified_at ? { label: 'Received by client', tone: 'good' } : { label: 'In transit', tone: 'warning' })}
      meta={(r) => [`${r.battery_count || 0} batteries · dispatched ${day(r.returned_at)}`, r.document_name ? `Document: ${r.document_name}` : null]}
      onPress={(r) => navigation.navigate('AdminDetail', { kind: 'return', id: r.id })}
      empty="No return dispatches"
    />
  );
}

// ── Services & rates ──────────────────────────────────────────────────────
export function AdminServicesScreen() {
  const navigation = useNavigation();
  return (
    <AdminListScreen
      addLabel="Add service"
      onAdd={() => navigation.navigate('AdminForm', { kind: 'service' })}
      onPressRow={(row) => navigation.navigate('AdminForm', { kind: 'service', row })}
      endpoint="/services"
      icon="flask"
      searchKeys={['name', 'description']}
      title={(s) => s.name}
      subtitle={(s) => s.description || ''}
      badge={(s) => (s.is_mandatory ? { label: 'Mandatory on intake', tone: 'info' } : s.active === false ? { label: 'Inactive', tone: 'neutral' } : { label: 'Active', tone: 'good' })}
      meta={(s) => [`Rate ${money(s.rate)}`]}
      empty="No services configured"
    />
  );
}

// ── Issue reasons ─────────────────────────────────────────────────────────
export function AdminIssueReasonsScreen() {
  const navigation = useNavigation();
  return (
    <AdminListScreen
      addLabel="Add reason"
      onAdd={() => navigation.navigate('AdminForm', { kind: 'issueReason' })}
      onPressRow={(row) => navigation.navigate('AdminForm', { kind: 'issueReason', row })}
      endpoint="/issue-reasons"
      icon="alertTriangle"
      searchKeys={['label']}
      title={(r) => r.label}
      badge={(r) => (r.active === false ? { label: 'Inactive', tone: 'neutral' } : { label: 'Active', tone: 'good' })}
      meta={(r) => [`Sort order ${r.sort_order ?? '—'}`]}
      empty="No issue reasons"
    />
  );
}

// ── Recycle shipments (all partners) ──────────────────────────────────────
export function AdminRecycleScreen() {
  const navigation = useNavigation();
  return (
    <AdminListScreen
      addLabel="New recycle shipment"
      onAdd={() => navigation.navigate('AdminRecycleCreate')}
      onPress={(r) => navigation.navigate('AdminDetail', { kind: 'recycle', id: r.id })}
      endpoint="/recycle"
      icon="package"
      searchKeys={['vehicle_number', 'driver_name', 'recycle_client_name']}
      searchPlaceholder="Search vehicle, driver, partner…"
      title={(r) => `Vehicle ${r.vehicle_number || `#${r.id}`}`}
      subtitle={(r) => `${r.recycle_client_name || 'Recycling partner'} · ${r.driver_name || 'Driver'}`}
      meta={(r) => [
        `${r.battery_count || 0} batteries · ${day(r.recycled_at)}`,
        r.total_weight_kg ? `${Number(r.total_weight_kg).toFixed(1)} kg · ${money(Number(r.total_weight_kg) * Number(r.price_per_kg || 0))} at ${money(r.price_per_kg)}/kg` : 'Weight not recorded',
      ]}
      empty="No recycle shipments"
    />
  );
}

// ── Invoices ──────────────────────────────────────────────────────────────
export function AdminInvoicesScreen() {
  const navigation = useNavigation();
  async function openPdf(inv) {
    const token = await AsyncStorage.getItem('token');
    const url = `${apiClient.defaults.baseURL}/invoices/${inv.id}/download?token=${encodeURIComponent(token || '')}`;
    await Linking.openURL(url);
  }
  return (
    <AdminListScreen
      addLabel="Upload invoice"
      onAdd={() => navigation.navigate('AdminForm', { kind: 'invoice' })}
      onPressRow={(row) => navigation.navigate('AdminForm', { kind: 'invoice', row })}
      endpoint="/invoices"
      icon="card"
      searchKeys={['invoice_number', 'client_name', 'status']}
      searchPlaceholder="Search invoice no., client…"
      filters={[
        { id: 'all', label: 'All' },
        { id: 'sent', label: 'Sent', test: (i) => i.status === 'sent' },
        { id: 'paid', label: 'Paid', test: (i) => i.status === 'paid' },
        { id: 'overdue', label: 'Overdue', test: (i) => i.status === 'overdue' },
      ]}
      title={(i) => `${i.invoice_number} · ${money(i.amount)}`}
      subtitle={(i) => i.client_name || ''}
      badge={(i) => ({ label: titleCase(i.status), tone: tone(i.status) })}
      meta={(i) => [`Issued ${day(i.issue_date)} · due ${day(i.due_date)}`, i.notes]}
      actions={(i) => [i.file_path ? { label: 'Open PDF', tone: 'primary', onPress: openPdf } : null]}
      header={(rows) => (
        <StatCards
          items={[
            { label: 'Invoices', value: rows.length },
            { label: 'Outstanding', value: money(rows.filter((i) => i.status !== 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)), color: 'text-amber-700' },
            { label: 'Paid', value: money(rows.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)), color: 'text-emerald-700' },
          ]}
        />
      )}
      empty="No invoices"
    />
  );
}

// ── Ratings & reviews ─────────────────────────────────────────────────────
export function AdminRatingsScreen() {
  const navigation = useNavigation();
  const clients = useClientOptions();
  const [rating, setRating] = useState('');
  const [clientId, setClientId] = useState('');
  const [preset, setPreset] = useState('all');
  const [range, setRange] = useState(['', '']);
  const params = { limit: 100 };
  if (rating) params.rating = rating;
  if (clientId) params.clientId = clientId;
  if (range[0]) params.startDate = range[0];
  if (range[1]) params.endDate = range[1];

  const toolbar = (
    <View className="gap-2">
      <Chips options={[{ id: '', label: 'All stars' }, ...[5, 4, 3, 2, 1].map((n) => ({ id: n, label: `${n} ★` }))]} value={rating} onChange={setRating} />
      <Chips options={[{ id: '', label: 'All clients' }, ...clients.filter((c) => c.user_role !== 'recycle_client').map((c) => ({ id: c.id, label: c.name }))]} value={clientId} onChange={setClientId} />
      <Chips
        options={[{ id: 'all', label: 'All time' }, { id: 'today', label: 'Today' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }, { id: 'custom', label: 'Custom' }]}
        value={preset}
        onChange={(id) => { setPreset(id); if (id !== 'custom') setRange(presetRange(id)); }}
      />
      {preset === 'custom' && (
        <View className="flex-row gap-2">
          <DateInput label="From" value={range[0]} onChange={(v) => setRange([v, range[1]])} />
          <DateInput label="To" value={range[1]} onChange={(v) => setRange([range[0], v])} />
        </View>
      )}
    </View>
  );

  return (
    <AdminListScreen
      endpoint="/ratings"
      params={params}
      pick={(res) => res.data}
      icon="award"
      toolbar={toolbar}
      searchKeys={['battery_code', 'client_name', 'custom_feedback']}
      title={(r) => `${'★'.repeat(Number(r.rating) || 0)}${'☆'.repeat(5 - (Number(r.rating) || 0))}  ${r.client_name || ''}`}
      subtitle={(r) => (Array.isArray(r.battery_codes) && r.battery_codes.length ? r.battery_codes.join(', ') : r.battery_code || '')}
      meta={(r) => [Array.isArray(r.preset_tags) && r.preset_tags.length ? r.preset_tags.join(' · ') : null, r.custom_feedback, when(r.created_at)]}
      onPress={(r) => navigation.navigate('AdminRatingDetail', { id: r.id })}
      header={(rows, extra) => {
        const s = extra?.stats || {};
        return (
          <StatCards
            items={[
              { label: 'Reviews', value: s.total_reviews ?? rows.length },
              { label: 'Average', value: s.average_rating ? `${Number(s.average_rating).toFixed(1)} ★` : '—', color: 'text-amber-600' },
              { label: 'Positive', value: s.positive_count ?? '—', color: 'text-emerald-700' },
            ]}
          />
        );
      }}
      empty="No ratings match these filters"
    />
  );
}

// ── Certificates & impact ─────────────────────────────────────────────────
// Same as the web Certificates page: per-client milestone progress, an
// "Evaluate" per client (POST /certificates/admin/evaluate/:clientId) and
// "Evaluate all fleets" (that call for every client); tap a client for its
// milestone profile.
export function AdminCertificatesScreen() {
  const navigation = useNavigation();
  const [evalMsg, setEvalMsg] = useState(null);
  const [evaluatingAll, setEvaluatingAll] = useState(false);

  async function evaluateOne(c) {
    try {
      const { data } = await apiClient.post(`/certificates/admin/evaluate/${c.clientId}`);
      const n = data?.newlyAwarded?.length || 0;
      setEvalMsg(n > 0
        ? `🎉 ${c.clientName}: awarded ${n} new milestone certificate${n === 1 ? '' : 's'}!`
        : `✅ ${c.clientName}: milestones are up to date (${data?.servicedCount || 0} packs serviced).`);
    } catch (err) {
      setEvalMsg(`Could not evaluate ${c.clientName}: ${err.response?.data?.message || err.message}`);
    }
  }

  async function evaluateAll(rows, reload) {
    if (!rows.length) return;
    setEvaluatingAll(true);
    setEvalMsg(null);
    let totalNew = 0;
    for (const c of rows) {
      try {
        const { data } = await apiClient.post(`/certificates/admin/evaluate/${c.clientId}`);
        totalNew += data?.newlyAwarded?.length || 0;
      } catch {
        // one client failing doesn't stop the rest (same as the web)
      }
    }
    setEvalMsg(totalNew > 0
      ? `🎉 Evaluated all ${rows.length} fleets: issued ${totalNew} new milestone certificate${totalNew === 1 ? '' : 's'}!`
      : `✅ Evaluated all ${rows.length} fleets: every milestone certificate is up to date.`);
    setEvaluatingAll(false);
    reload();
  }

  return (
    <AdminListScreen
      endpoint="/certificates/admin"
      pick={(res) => res.clientProgress || []}
      keyField="clientId"
      icon="award"
      searchKeys={['clientName']}
      title={(c) => c.clientName}
      subtitle={(c) => `${c.servicedCount || 0} batteries serviced · ${c.certificatesCount || 0} certificate${c.certificatesCount === 1 ? '' : 's'}`}
      badge={(c) => (c.nextTier ? { label: `Next: ${c.nextTier.badge || c.nextTier.title || c.nextTier.tier}`, tone: 'info' } : { label: 'All tiers reached', tone: 'good' })}
      meta={(c) => [
        c.nextTier ? `${Math.max(0, (c.nextTier.count || 0) - (c.servicedCount || 0))} more to the next milestone` : null,
        Array.isArray(c.certificates) && c.certificates.length ? `Latest: ${c.certificates[c.certificates.length - 1]?.title || c.certificates[c.certificates.length - 1]?.certificate_code || ''}` : null,
      ]}
      onPress={(c) => navigation.navigate('AdminCertificateClient', { id: c.clientId, name: c.clientName })}
      actions={() => [{ label: 'Evaluate', tone: 'primary', onPress: evaluateOne }]}
      header={(rows, extra, reload) => {
        const s = extra?.stats || {};
        return (
          <View className="gap-2">
            <StatCards
              items={[
                { label: 'Certificates', value: s.totalCertificatesIssued ?? 0 },
                { label: 'CO2 saved', value: `${Math.round(s.totalCo2SavedKg || 0)} kg`, color: 'text-emerald-700' },
                { label: 'E-waste diverted', value: `${Math.round(s.totalEwasteDivertedKg || 0)} kg`, color: 'text-blue-700' },
              ]}
            />
            <TouchableOpacity
              disabled={evaluatingAll || rows.length === 0}
              onPress={() => evaluateAll(rows, reload)}
              className={`items-center rounded-2xl bg-emerald-600 py-2.5 ${evaluatingAll || rows.length === 0 ? 'opacity-60' : ''}`}
            >
              <Text className="text-xs font-bold text-white">{evaluatingAll ? 'Evaluating all fleets…' : 'Evaluate all fleets'}</Text>
            </TouchableOpacity>
            {evalMsg ? (
              <TouchableOpacity onPress={() => setEvalMsg(null)} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <Text className="text-xs font-semibold text-emerald-800">{evalMsg}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      }}
      empty="No client progress yet"
    />
  );
}

// ── User accounts ─────────────────────────────────────────────────────────
// Logins are edited where they belong, because PATCH /users rewrites the role
// (anything but super_admin / recycle_client becomes 'admin'):
//   admin / super_admin  → user form (PATCH /users, full body)
//   client               → Fleet Client form (PATCH /clients/:id: login email,
//                          temp password, modules, active)
//   recycle_client       → Recycling Partner form (PATCH /clients/:id)
//   technician / supervisor / staff → Staff form (PATCH /staff/:id)
// Activate/deactivate goes the same way; there's no safe endpoint for a
// workshop login's `active`, so those rows link to the staff record instead.
export function AdminUsersScreen() {
  const navigation = useNavigation();
  const me = useSelector((s) => s.auth.user);
  const [clientRecords, setClientRecords] = useState([]);
  const [staffRecords, setStaffRecords] = useState([]);

  useEffect(() => {
    apiClient.get('/clients').then(({ data }) => setClientRecords(Array.isArray(data) ? data : data?.data || [])).catch(() => {});
    apiClient.get('/staff').then(({ data }) => setStaffRecords(Array.isArray(data) ? data : data?.data || [])).catch(() => {});
  }, []);

  const clientFor = (u) => clientRecords.find((c) => Number(c.user_id) === Number(u.id));
  const staffFor = (u) => staffRecords.find((st) => Number(st.user_id) === Number(u.id));
  const isWorkshop = (u) => ['technician', 'supervisor', 'staff'].includes(u.role);

  function openEditor(u) {
    if (['admin', 'super_admin'].includes(u.role)) return navigation.navigate('AdminForm', { kind: 'user', row: u });
    if (u.role === 'client' || u.role === 'recycle_client') {
      const c = clientFor(u);
      if (!c) return Alert.alert('Client record not found', `${u.email} isn't linked to a client record.`);
      return navigation.navigate('AdminForm', { kind: u.role === 'client' ? 'client' : 'recycleClient', row: c });
    }
    if (isWorkshop(u)) {
      const st = staffFor(u);
      if (!st) return Alert.alert('Staff record not found', `${u.email} isn't linked to a staff record.`);
      return navigation.navigate('AdminForm', { kind: 'staff', row: st });
    }
    return null;
  }

  function setActive(u, active) {
    if (['admin', 'super_admin', 'recycle_client'].includes(u.role)) {
      // full body: the API writes every field (and keeps these roles as-is)
      return apiClient.patch(`/users/${u.id}`, {
        name: u.name, email: u.email, role: u.role, permissions: u.permissions || [], active,
      });
    }
    if (u.role === 'client') {
      const c = clientFor(u);
      if (!c) return Promise.reject(new Error('Client record not found for this login.'));
      return apiClient.patch(`/clients/${c.id}`, { name: c.name, active: String(active) });
    }
    // workshop logins: through the staff record, which keeps the staff row
    // and the login in step (falls back to the login alone)
    const st = staffFor(u);
    if (st) return apiClient.patch(`/staff/${st.id}`, { active: String(active) });
    return apiClient.patch(`/users/${u.id}`, { active });
  }

  function toggle(u) {
    return new Promise((resolve, reject) => {
      Alert.alert(
        u.active ? 'Deactivate account?' : 'Activate account?',
        `${u.name} (${u.email})${u.active ? ' will no longer be able to sign in.' : ' will be able to sign in again.'}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          { text: u.active ? 'Deactivate' : 'Activate', style: u.active ? 'destructive' : 'default',
            onPress: () => setActive(u, !u.active).then(resolve).catch(reject) },
        ]
      );
    });
  }

  return (
    <AdminListScreen
      addLabel="Add admin user"
      onAdd={() => navigation.navigate('AdminForm', { kind: 'user' })}
      onPressRow={openEditor}
      endpoint="/users"
      params={{ role: 'all' }}  // the API lists only admin accounts unless asked for all
      icon="user"
      searchKeys={['name', 'email', 'role']}
      filters={[
        { id: 'all', label: 'All' },
        { id: 'admins', label: 'Admins', test: (u) => ['super_admin', 'admin', 'staff'].includes(u.role) },
        { id: 'technicians', label: 'Workshop', test: (u) => ['technician', 'supervisor'].includes(u.role) },
        { id: 'clients', label: 'Clients', test: (u) => ['client', 'recycle_client'].includes(u.role) },
        { id: 'inactive', label: 'Inactive', test: (u) => u.active === false },
      ]}
      title={(u) => u.name}
      subtitle={(u) => u.email}
      badge={(u) => ({ label: titleCase(u.role), tone: u.role === 'super_admin' ? 'critical' : u.role === 'admin' || u.role === 'staff' ? 'info' : u.role === 'technician' || u.role === 'supervisor' ? 'warning' : 'good' })}
      meta={(u) => [
        u.active === false ? 'Inactive — cannot sign in' : u.must_change_password ? 'Must change password on next login' : `Member since ${day(u.created_at)}`,
        Array.isArray(u.permissions) && u.permissions.length && u.role === 'admin' ? `Modules: ${u.permissions.join(', ')}` : null,
        isWorkshop(u) ? 'Tap to edit in Staff Directory · login can be deactivated here' : u.role === 'client' || u.role === 'recycle_client' ? 'Tap to edit login, password & modules' : 'Tap to edit',
      ]}
      actions={(u) => [
        u.id === me?.id ? null : { label: u.active === false ? 'Activate' : 'Deactivate', tone: u.active === false ? 'good' : 'danger', onPress: toggle },
      ]}
      empty="No user accounts"
    />
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────
// GET /audit-logs?date= (the API's only filter, same as the web). It has no
// ?search=, so the search box filters the loaded entries only.
export function AdminAuditLogScreen() {
  const [date, setDate] = useState('');
  const [preset, setPreset] = useState('any');
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };
  const toolbar = (
    <View className="gap-2">
      <Chips
        options={[{ id: 'any', label: 'Any date' }, { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'pick', label: 'Pick a date' }]}
        value={preset}
        onChange={(id) => {
          setPreset(id);
          if (id === 'any') setDate('');
          if (id === 'today') setDate(ymd(new Date()));
          if (id === 'yesterday') setDate(yesterday());
        }}
      />
      {preset === 'pick' && <DateInput label="Log date" value={date} onChange={setDate} />}
    </View>
  );
  return (
    <AdminListScreen
      endpoint="/audit-logs"
      paged
      serverSearch={false}
      params={date ? { date } : {}}
      toolbar={toolbar}
      icon="clock"
      searchKeys={['action', 'entity', 'user_name']}
      searchPlaceholder="Search loaded entries: action, entity, user…"
      title={(l) => `${titleCase(l.action)} · ${titleCase(l.entity)}${l.entity_id ? ` #${l.entity_id}` : ''}`}
      subtitle={(l) => `${l.user_name || 'System'} · ${when(l.created_at)}`}
      meta={(l) => [l.details ? JSON.stringify(l.details).slice(0, 160) : null]}
      empty={date ? `No audit entries on ${date}` : 'No audit entries'}
    />
  );
}

// ── Trash bin ─────────────────────────────────────────────────────────────
// Same actions as the web Trash page: delete one item for good, or (super
// admin) empty the whole trash. There is no restore — items are snapshots.
export function AdminTrashScreen() {
  const me = useSelector((s) => s.auth.user);
  const isSuper = me?.role === 'super_admin';
  const confirmThen = (title, message, label, action) => new Promise((resolve, reject) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
      { text: label, style: 'destructive', onPress: () => action().then(resolve).catch(reject) },
    ]);
  });
  return (
    <AdminListScreen
      endpoint="/trash"
      paged
      icon="close"
      searchKeys={['title', 'subtitle', 'item_type', 'deleted_by_name']}
      title={(t) => t.title || `${titleCase(t.item_type)} #${t.original_id}`}
      subtitle={(t) => t.subtitle || ''}
      badge={(t) => ({ label: titleCase(t.item_type), tone: 'neutral' })}
      meta={(t) => [`Deleted by ${t.deleted_by_name || 'unknown'} · ${when(t.deleted_at)}`]}
      actions={(t) => [{
        label: 'Delete forever',
        tone: 'danger',
        onPress: () => confirmThen(
          'Delete permanently?',
          `${t.title || `${titleCase(t.item_type)} #${t.original_id}`} will be removed from the trash for good. This cannot be undone.`,
          'Delete',
          () => apiClient.delete(`/trash/${t.id}`)
        ),
      }]}
      header={(rows, extra, reload) => (
        <View className="gap-2">
          <Text className="text-xs text-slate-500">
            Deleted records are kept here as a snapshot for reference{extra?.pagination?.total != null ? ` (${extra.pagination.total} items)` : ''}. They can't be restored.
          </Text>
          {isSuper && rows.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                confirmThen('Empty the trash?', 'Every item in the trash will be deleted for good. This cannot be undone.', 'Empty trash', () => apiClient.delete('/trash'))
                  .then(reload)
                  .catch((err) => Alert.alert('Could not empty the trash', err.response?.data?.message || err.message))
              }
              className="items-center rounded-2xl border border-red-200 bg-red-50 py-2.5"
            >
              <Text className="text-xs font-bold text-red-700">Empty trash</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      empty="Trash is empty"
    />
  );
}

// ── Notifications feed ────────────────────────────────────────────────────
export function AdminNotificationsScreen() {
  const navigation = useNavigation();
  return (
    <AdminListScreen
      endpoint="/notifications/admin"
      pick={(res) => res.feed || []}
      icon="alertTriangle"
      searchKeys={['title', 'message', 'category']}
      filters={[
        { id: 'all', label: 'All' },
        { id: 'urgent', label: 'Urgent', test: (n) => n.severity === 'urgent' },
        { id: 'inventory', label: 'Inventory', test: (n) => n.category === 'inventory' },
        { id: 'logistics', label: 'Logistics', test: (n) => n.category === 'logistics' },
        { id: 'support', label: 'Support', test: (n) => n.category === 'support' },
      ]}
      title={(n) => n.title}
      subtitle={(n) => n.message}
      badge={(n) => ({ label: titleCase(n.severity || n.category), tone: tone(n.severity) })}
      meta={(n) => [when(n.timestamp)]}
      onPress={(n) => {
        const code = n.meta?.batteryCode || n.meta?.battery_code;
        if (code) navigation.navigate('BatteryDetail', { code, fromScan: false });
        else if (n.category === 'support') navigation.navigate('Support');
        else if (n.category === 'logistics') navigation.navigate('Intakes');
        else if (n.category === 'inventory') navigation.navigate('Parts');
      }}
      header={(rows, extra) => {
        const c = extra?.counts || {};
        return (
          <StatCards
            items={[
              { label: 'Total', value: c.total ?? rows.length },
              { label: 'Urgent', value: c.urgent ?? 0, color: 'text-red-600' },
              { label: 'Warnings', value: c.warning ?? 0, color: 'text-amber-600' },
            ]}
          />
        );
      }}
      empty="No notifications"
    />
  );
}

export { Badge };
