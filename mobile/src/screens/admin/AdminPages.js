import { Alert, Linking, Text, View } from 'react-native';
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
  return (
    <AdminListScreen
      endpoint="/ratings"
      params={{ limit: 100 }}
      pick={(res) => res.data}
      icon="award"
      searchKeys={['battery_code', 'client_name', 'custom_feedback']}
      title={(r) => `${'★'.repeat(Number(r.rating) || 0)}${'☆'.repeat(5 - (Number(r.rating) || 0))}  ${r.battery_code || ''}`}
      subtitle={(r) => r.client_name || ''}
      meta={(r) => [Array.isArray(r.preset_tags) && r.preset_tags.length ? r.preset_tags.join(' · ') : null, r.custom_feedback, when(r.created_at)]}
      onPress={(r) => (r.battery_code ? navigation.navigate('BatteryDetail', { code: r.battery_code, fromScan: false }) : null)}
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
      empty="No ratings yet"
    />
  );
}

// ── Certificates & impact ─────────────────────────────────────────────────
export function AdminCertificatesScreen() {
  return (
    <AdminListScreen
      endpoint="/certificates/admin"
      pick={(res) => res.clientProgress || []}
      keyField="clientId"
      icon="award"
      searchKeys={['clientName']}
      title={(c) => c.clientName}
      subtitle={(c) => `${c.servicedCount || 0} batteries serviced · ${c.certificatesCount || 0} certificate${c.certificatesCount === 1 ? '' : 's'}`}
      badge={(c) => (c.nextTier ? { label: `Next: ${c.nextTier.title || c.nextTier.tier}`, tone: 'info' } : { label: 'All tiers reached', tone: 'good' })}
      meta={(c) => [
        c.nextTier ? `${Math.max(0, (c.nextTier.count || 0) - (c.servicedCount || 0))} more to the next milestone` : null,
        Array.isArray(c.certificates) && c.certificates.length ? `Latest: ${c.certificates[c.certificates.length - 1]?.title || c.certificates[c.certificates.length - 1]?.certificate_code || ''}` : null,
      ]}
      header={(rows, extra) => {
        const s = extra?.stats || {};
        return (
          <StatCards
            items={[
              { label: 'Certificates', value: s.totalCertificatesIssued ?? 0 },
              { label: 'CO2 saved', value: `${Math.round(s.totalCo2SavedKg || 0)} kg`, color: 'text-emerald-700' },
              { label: 'E-waste diverted', value: `${Math.round(s.totalEwasteDivertedKg || 0)} kg`, color: 'text-blue-700' },
            ]}
          />
        );
      }}
      empty="No client progress yet"
    />
  );
}

// ── User accounts ─────────────────────────────────────────────────────────
export function AdminUsersScreen() {
  const navigation = useNavigation();
  const me = useSelector((s) => s.auth.user);
  function toggle(u) {
    return new Promise((resolve, reject) => {
      Alert.alert(
        u.active ? 'Deactivate account?' : 'Activate account?',
        `${u.name} (${u.email})${u.active ? ' will no longer be able to sign in.' : ' will be able to sign in again.'}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          { text: u.active ? 'Deactivate' : 'Activate', style: u.active ? 'destructive' : 'default',
            onPress: () => apiClient.patch(`/users/${u.id}`, { active: !u.active }).then(resolve).catch(reject) },
        ]
      );
    });
  }
  return (
    <AdminListScreen
      addLabel="Add admin user"
      onAdd={() => navigation.navigate('AdminForm', { kind: 'user' })}
      onPressRow={(row) => (['admin', 'super_admin'].includes(row.role) ? navigation.navigate('AdminForm', { kind: 'user', row }) : null)}
      endpoint="/users"
      params={{ role: 'all' }}  // the API lists only admin accounts unless asked for all
      icon="user"
      searchKeys={['name', 'email', 'role']}
      filters={[
        { id: 'all', label: 'All' },
        { id: 'admins', label: 'Admins', test: (u) => ['super_admin', 'admin', 'staff'].includes(u.role) },
        { id: 'technicians', label: 'Technicians', test: (u) => u.role === 'technician' },
        { id: 'clients', label: 'Clients', test: (u) => ['client', 'recycle_client'].includes(u.role) },
        { id: 'inactive', label: 'Inactive', test: (u) => u.active === false },
      ]}
      title={(u) => u.name}
      subtitle={(u) => u.email}
      badge={(u) => ({ label: titleCase(u.role), tone: u.role === 'super_admin' ? 'critical' : u.role === 'admin' || u.role === 'staff' ? 'info' : u.role === 'technician' ? 'warning' : 'good' })}
      meta={(u) => [
        u.active === false ? 'Inactive — cannot sign in' : u.must_change_password ? 'Must change password on next login' : `Member since ${day(u.created_at)}`,
        Array.isArray(u.permissions) && u.permissions.length && u.role === 'admin' ? `Modules: ${u.permissions.join(', ')}` : null,
      ]}
      actions={(u) => [u.id === me?.id ? null : { label: u.active === false ? 'Activate' : 'Deactivate', tone: u.active === false ? 'good' : 'danger', onPress: toggle }]}
      empty="No user accounts"
    />
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────
export function AdminAuditLogScreen() {
  return (
    <AdminListScreen
      endpoint="/audit-logs"
      paged
      icon="clock"
      searchKeys={['action', 'entity', 'user_name']}
      searchPlaceholder="Search action, entity, user…"
      title={(l) => `${titleCase(l.action)} · ${titleCase(l.entity)}${l.entity_id ? ` #${l.entity_id}` : ''}`}
      subtitle={(l) => `${l.user_name || 'System'} · ${when(l.created_at)}`}
      meta={(l) => [l.details ? JSON.stringify(l.details).slice(0, 160) : null]}
      empty="No audit entries"
    />
  );
}

// ── Trash bin ─────────────────────────────────────────────────────────────
export function AdminTrashScreen() {
  return (
    <AdminListScreen
      endpoint="/trash"
      params={{ limit: 100 }}
      icon="close"
      searchKeys={['title', 'subtitle', 'item_type', 'deleted_by_name']}
      title={(t) => t.title || `${titleCase(t.item_type)} #${t.original_id}`}
      subtitle={(t) => t.subtitle || ''}
      badge={(t) => ({ label: titleCase(t.item_type), tone: 'neutral' })}
      meta={(t) => [`Deleted by ${t.deleted_by_name || 'unknown'} · ${when(t.deleted_at)}`]}
      header={(rows, extra) => <Text className="text-xs text-slate-500">Deleted records are kept here as a snapshot. Restoring is done on the web admin.</Text>}
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
