import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { StatusBadge } from '../../../components/ui/Badge';
import ImageViewerModal from '../../../components/ui/ImageViewerModal';
import DateField from '../../../components/admin/DateField';
import { hasPermission } from '../../../components/admin/sa3/permissions';
import { BackLink, dateOnly, dateTime, ErrorBox, errMessage, openUpload, Pill, SearchBox, Stat } from '../../../components/admin/sa3/ui';

// A staff member's page — the web StaffDetailPage: header (Edit Staff Profile,
// Compliance Doc), hero card, credentials & right-to-work block, six KPI
// cards, the 14-day repair chart, and four tabs (Repairs & Fitted with
// search / status / date filters, Disassembly & Reclaimed, QA Testing &
// Sign-Offs, Reported Issues with photo viewer).
// route.params: { id, row? }

const DAYS_SHOWN = 14;

function toLocalDateValue(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function buildDailyCounts(visits) {
  const byDay = {};
  for (const v of visits) {
    if (v.repaired_at) {
      const d = new Date(v.repaired_at).toDateString();
      byDay[d] = (byDay[d] || 0) + 1;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    series.push({ label: d.toLocaleDateString([], { day: '2-digit', month: 'short' }), count: byDay[d.toDateString()] || 0 });
  }
  return series;
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const s = Math.round(Number(seconds));
  if (s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s % 60}s`;
}

const isRemovedVisit = (v) => Boolean(v.parts_removed) || Boolean(v.removed_at) || v.outcome === 'parts_removed';

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View className="flex-row items-end gap-1" style={{ height: 120 }}>
      {data.map((d, i) => {
        const last = i === data.length - 1;
        return (
          <View key={d.label} className="flex-1 items-center justify-end">
            {d.count > 0 ? <Text className="mb-0.5 text-[9px] font-bold text-slate-600">{d.count}</Text> : null}
            <View
              className={`w-full rounded-t ${last ? 'bg-emerald-700' : 'bg-emerald-500'}`}
              style={{ height: Math.max(2, (d.count / max) * 84) }}
            />
            <Text className="mt-1 text-[8px] text-slate-400" numberOfLines={1}>{i % 2 === (data.length - 1) % 2 ? d.label.split(' ')[0] : ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CopyField({ label, value }) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
      <View className="flex-1">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
        <Text className="mt-0.5 font-mono text-sm font-bold text-slate-900" selectable>{value || '—'}</Text>
      </View>
      {value ? <Text className="text-[10px] text-slate-400">Hold to copy</Text> : null}
    </View>
  );
}

function MiniMetric({ title, value, sub, color = 'text-slate-900' }) {
  return (
    <View className="min-w-[45%] flex-1 rounded-xl border border-slate-200 bg-white p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</Text>
      <Text className={`mt-0.5 text-base font-black ${color}`}>{value}</Text>
      <Text className="text-[10px] text-slate-500">{sub}</Text>
    </View>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6">
      <Text className="text-center text-sm font-bold text-slate-900">{title}</Text>
      <Text className="mt-1 text-center text-xs text-slate-500">{text}</Text>
      {action}
    </View>
  );
}

function RowCard({ code, serial, client, status, onInspect, children }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <TouchableOpacity onPress={onInspect}>
            <Text className="font-mono text-sm font-bold text-blue-700">{code}</Text>
          </TouchableOpacity>
          {serial ? <Text className="text-[10px] text-slate-500">SN: {serial}</Text> : null}
          <Text className="mt-0.5 text-xs font-medium text-slate-700">{client || '—'}</Text>
        </View>
        <StatusBadge status={status} />
      </View>
      <View className="mt-2 gap-1">{children}</View>
      <TouchableOpacity onPress={onInspect} className="mt-2 flex-row items-center gap-1 self-end">
        <Text className="text-xs font-bold text-blue-600">Inspect</Text>
        <Icon name="arrowRight" color="#2563eb" size={12} />
      </TouchableOpacity>
    </View>
  );
}

const Line = ({ label, children }) => (
  <Text className="text-xs text-slate-500">{label}: <Text className="font-semibold text-slate-800">{children}</Text></Text>
);

export default function StaffDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const id = route.params?.id;
  const me = useSelector((s) => s.auth.user);
  const isSuperAdmin = me?.role === 'super_admin';
  const canManageStaff = isSuperAdmin || me?.role === 'admin' || hasPermission(me, 'staff');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('repairs');
  const [datePreset, setDatePreset] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [disassemblySearch, setDisassemblySearch] = useState('');
  const [testsSearch, setTestsSearch] = useState('');
  const [issuesSearch, setIssuesSearch] = useState('');
  const [lightboxImages, setLightboxImages] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/staff/${id}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { staff, repairs = [], issues = [], tests = [] } = data || {};

  useLayoutEffect(() => {
    navigation.setOptions({ title: staff?.name || route.params?.row?.name || 'Staff' });
  }, [navigation, staff?.name, route.params?.row?.name]);

  const removedVisits = useMemo(() => repairs.filter(isRemovedVisit), [repairs]);
  const activeVisits = useMemo(() => repairs.filter((v) => !isRemovedVisit(v)), [repairs]);
  const completedVisits = useMemo(
    () => repairs.filter((v) => (v.battery_status === 'repaired' || v.battery_status === 'returned' || v.outcome === 'completed') && !v.parts_removed),
    [repairs]
  );

  const avgDuration = useMemo(() => {
    const valid = repairs.map((r) => Number(r.duration_seconds)).filter((s) => !Number.isNaN(s) && s > 0);
    return valid.length ? formatDuration(valid.reduce((a, b) => a + b, 0) / valid.length) : '—';
  }, [repairs]);

  const totalLaborValue = useMemo(
    () => repairs.reduce((acc, r) => {
      if (r.parts_removed) return acc;
      const val = Number(r.labor_charge || r.price || 0);
      return acc + (Number.isNaN(val) ? 0 : val);
    }, 0),
    [repairs]
  );

  const dailyCounts = useMemo(() => buildDailyCounts(completedVisits), [completedVisits]);
  const hasRecentActivity = dailyCounts.some((d) => d.count > 0);
  const todayCount = dailyCounts[dailyCounts.length - 1]?.count || 0;
  const recentTotal = dailyCounts.reduce((a, d) => a + d.count, 0);

  const matchesDatePreset = useCallback((dateStr) => {
    if (!dateStr) return false;
    if (datePreset === 'all') return true;
    const target = toLocalDateValue(dateStr);
    const now = new Date();
    if (datePreset === 'today') return target === toLocalDateValue(now);
    if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return target === toLocalDateValue(y);
    }
    if (datePreset === '7days') {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      const d = new Date(dateStr);
      return d >= from && d <= now;
    }
    if (datePreset === 'custom' && customDate) return target === customDate;
    return true;
  }, [datePreset, customDate]);

  const filteredVisits = useMemo(() => repairs.filter((r) => {
    if (statusFilter === 'active_fleet') {
      if (r.parts_removed || r.battery_status === 'recycled' || r.battery_status === 'unserviceable') return false;
    } else if (statusFilter === 'completed') {
      if (r.battery_status !== 'repaired' && r.battery_status !== 'returned' && r.outcome !== 'completed') return false;
    } else if (statusFilter === 'removed') {
      if (!isRemovedVisit(r)) return false;
    }
    if (!matchesDatePreset(r.repaired_at)) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const hay = [r.battery_code, r.serial_number, r.client_name, r.part_name, r.notes, r.batch_id].map((v) => String(v || '').toLowerCase());
      if (!hay.some((v) => v.includes(q))) return false;
    }
    return true;
  }), [repairs, statusFilter, matchesDatePreset, searchQuery]);

  const searchIn = (list, q, keys) => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => keys.some((k) => String(r[k] || '').toLowerCase().includes(s)));
  };
  const filteredDisassembly = useMemo(() => searchIn(removedVisits, disassemblySearch, ['battery_code', 'serial_number', 'client_name', 'part_name', 'notes']), [removedVisits, disassemblySearch]);
  const filteredTests = useMemo(() => searchIn(tests, testsSearch, ['battery_code', 'serial_number', 'client_name', 'service_name', 'notes']), [tests, testsSearch]);
  const filteredIssues = useMemo(() => searchIn(issues, issuesSearch, ['battery_code', 'serial_number', 'client_name', 'reason_label', 'note']), [issues, issuesSearch]);

  const hasActiveFilters = datePreset !== 'all' || customDate !== '' || statusFilter !== 'all' || searchQuery.trim() !== '';
  const clearAllFilters = () => {
    setDatePreset('all');
    setCustomDate('');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const inspect = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-center text-xs text-slate-400">Loading staff profile, repair logs, QA testing and compliance records…</Text>
      </View>
    );
  }

  if (!staff) {
    return (
      <View className="flex-1 gap-4 bg-slate-50 p-4">
        <BackLink label="Back to Staff Directory" onPress={() => navigation.goBack()} />
        <ErrorBox message={error || 'Staff member not found.'} />
      </View>
    );
  }

  const isSupervisor = staff.role?.toLowerCase() === 'supervisor';
  const employeeCode = `EMP-${String(staff.id).padStart(4, '0')}`;
  const salaryNum = Number(staff.salary || 0);
  const docPath = staff.document_path ? `/uploads/staff-docs/${staff.document_path}` : null;
  const contactEmail = staff.email || staff.linked_user_email;

  const openEdit = () => navigation.navigate('SAStaffForm', { staff, title: `Edit Staff Profile — ${staff.name}`, onSaved: load });

  const TABS = [
    { id: 'repairs', label: `Repairs & Fitted (${repairs.length})`, on: 'border-emerald-600', text: 'text-emerald-700' },
    { id: 'disassembly', label: `Disassembly & Reclaimed (${removedVisits.length})`, on: 'border-amber-600', text: 'text-amber-700' },
    { id: 'tests', label: `QA Testing & Sign-Offs (${tests.length})`, on: 'border-blue-600', text: 'text-blue-700' },
    { id: 'issues', label: `Reported Issues (${issues.length})`, on: 'border-red-600', text: 'text-red-700' },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="p-4 pb-16 gap-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* breadcrumb + header actions */}
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center gap-1.5">
            <Icon name="arrowLeft" color="#475569" size={14} />
            <Text className="text-xs font-bold text-slate-600">Staff Directory</Text>
            <Text className="text-xs text-slate-300">/</Text>
            <Text className="font-mono text-xs font-bold text-slate-900">{employeeCode}</Text>
          </TouchableOpacity>
          <View className="flex-row gap-2">
            {canManageStaff && (
              <TouchableOpacity onPress={openEdit} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
                <Text className="text-xs font-bold text-slate-700">Edit Staff Profile</Text>
              </TouchableOpacity>
            )}
            {docPath && (
              <TouchableOpacity onPress={() => openUpload(docPath)} className="rounded-xl bg-blue-600 px-3 py-2">
                <Text className="text-xs font-bold text-white">Compliance Doc</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* hero */}
        <View className="rounded-3xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-start gap-3.5">
            <View>
              <View className={`h-16 w-16 items-center justify-center rounded-3xl ${staff.active ? 'bg-emerald-600' : 'bg-slate-500'}`}>
                <Text className="text-2xl font-black text-white">{staff.name?.[0]?.toUpperCase() || 'S'}</Text>
              </View>
              <View className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${staff.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-black text-slate-900">{staff.name}</Text>
              <View className="mt-1 flex-row flex-wrap gap-1.5">
                <View className="rounded-full bg-slate-100 px-2 py-0.5"><Text className="font-mono text-[11px] font-bold text-slate-600">{employeeCode}</Text></View>
                <View className={`rounded-full border px-2.5 py-0.5 ${isSupervisor ? 'border-purple-200 bg-purple-100' : 'border-emerald-200 bg-emerald-100'}`}>
                  <Text className={`text-[11px] font-bold ${isSupervisor ? 'text-purple-800' : 'text-emerald-800'}`}>{isSupervisor ? 'Workshop Supervisor' : 'Technician'}</Text>
                </View>
                <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-0.5 ${staff.active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                  <View className={`h-1.5 w-1.5 rounded-full ${staff.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <Text className={`text-[11px] font-bold ${staff.active ? 'text-emerald-700' : 'text-slate-600'}`}>{staff.active ? 'Active in Workshop' : 'Inactive'}</Text>
                </View>
              </View>
              <View className="mt-2 gap-1">
                {staff.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${staff.phone}`)}><Text className="text-xs font-semibold text-blue-700">📞 {staff.phone}</Text></TouchableOpacity>
                ) : null}
                {contactEmail ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`mailto:${contactEmail}`)}><Text className="text-xs font-semibold text-blue-700">✉️ {contactEmail}</Text></TouchableOpacity>
                ) : null}
                {staff.created_at ? <Text className="text-xs text-slate-500">📅 Joined {dateOnly(staff.created_at)}</Text> : null}
                {staff.user_id ? <Text className="text-xs font-semibold text-violet-700">🔑 Technician Portal Account Active</Text> : null}
              </View>
            </View>
          </View>
          <View className="mt-3 rounded-2xl bg-slate-900 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Output</Text>
            <Text className="text-lg font-black text-white">{repairs.length + tests.length} Actions</Text>
            <Text className="text-[11px] text-slate-300">{completedVisits.length} repairs • {tests.length} tests</Text>
          </View>
        </View>

        {/* credentials */}
        <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-4">
          <View>
            <Text className="text-sm font-black text-slate-900">Credentials &amp; Right to Work Compliance</Text>
            <Text className="text-[11px] text-slate-500">Official employee credentials, identity, and workshop authorizations.</Text>
          </View>
          <CopyField label="National Insurance (NI)" value={staff.ni_number} />
          <CopyField label="Passport / ID Document" value={staff.passport_number} />
          <CopyField label="Right to Work Share Code" value={staff.share_code} />
          <View className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly / Contract Wage</Text>
            <Text className="mt-0.5 text-sm font-bold text-slate-900">
              {isSuperAdmin || canManageStaff ? (salaryNum > 0 ? `£${salaryNum.toFixed(2)}` : 'Standard Hourly') : 'Restricted'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3">
            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-800">
                {staff.document_name || (docPath ? 'Official Identity & Compliance Document' : 'No document on file')}
              </Text>
              <Text className="text-[11px] text-slate-500">
                {docPath
                  ? 'Secure document stored on server for audit and compliance requirements'
                  : 'Upload an identity card, proof of address, or right-to-work passport file by clicking Edit Staff Profile'}
              </Text>
            </View>
            {docPath ? (
              <TouchableOpacity onPress={() => openUpload(docPath)} className="rounded-lg bg-slate-900 px-3 py-2">
                <Text className="text-[11px] font-bold text-white">Download Document</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* KPIs */}
        <View className="flex-row flex-wrap gap-2">
          <Stat label="Repairs Completed" value={completedVisits.length} tone="good" sub="Finished jobs" />
          <Stat label="Active in Fleet" value={activeVisits.length} tone="info" sub="Running in client fleets" />
          <Stat label="Reclaimed Parts" value={removedVisits.length} tone="warn" sub="Disassembled components" />
          <Stat label="QA Testing Sign-offs" value={tests.length} sub={isSupervisor ? 'Supervisor testing' : 'Signed inspections'} />
          <Stat label="Avg Duration" value={avgDuration} sub="Time per job" />
          <Stat label="Labor Value" value={isSuperAdmin ? `£${totalLaborValue.toFixed(2)}` : 'Active'} tone="good" sub={isSuperAdmin ? 'Total labor billed' : 'Workshop staff'} />
        </View>

        {/* 14-day chart */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="text-sm font-black text-slate-900">Daily Repair Velocity (Last {DAYS_SHOWN} Days)</Text>
          <Text className="text-[11px] text-slate-500">Number of completed repair battery operations logged per calendar day.</Text>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            <View className="rounded-full bg-emerald-50 px-2.5 py-0.5"><Text className="text-[11px] font-bold text-emerald-700">{recentTotal} finished in last 14 days</Text></View>
            {todayCount > 0 ? <View className="rounded-full bg-blue-50 px-2.5 py-0.5"><Text className="text-[11px] font-bold text-blue-700">{todayCount} today</Text></View> : null}
          </View>
          <View className="mt-3">
            {hasRecentActivity ? (
              <BarChart data={dailyCounts} />
            ) : (
              <Text className="py-6 text-center text-xs text-slate-500">No completed repairs logged in the last {DAYS_SHOWN} days.</Text>
            )}
          </View>
        </View>

        {/* tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setActiveTab(t.id)} className={`border-b-2 px-3 py-2.5 ${activeTab === t.id ? t.on : 'border-transparent'}`}>
              <Text className={`text-xs font-bold ${activeTab === t.id ? t.text : 'text-slate-500'}`}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeTab === 'repairs' && (
          <View className="gap-3">
            <SearchBox value={searchQuery} onChangeText={setSearchQuery} placeholder="Search battery code, serial, client fleet, parts, notes…" />
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-[11px] font-bold uppercase text-slate-400">Status:</Text>
              {[
                { id: 'all', label: `All (${repairs.length})` },
                { id: 'active_fleet', label: `Active Fleet (${activeVisits.length})` },
                { id: 'completed', label: `Completed (${completedVisits.length})` },
                { id: 'removed', label: `Parts Reclaimed (${removedVisits.length})` },
              ].map((b) => <Pill key={b.id} label={b.label} active={statusFilter === b.id} onPress={() => setStatusFilter(b.id)} />)}
            </View>
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-[11px] font-bold uppercase text-slate-400">Date:</Text>
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: '7 Days' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => <Pill key={p.id} label={p.label} active={datePreset === p.id} activeClass="bg-emerald-600" onPress={() => setDatePreset(p.id)} />)}
              {hasActiveFilters ? (
                <TouchableOpacity onPress={clearAllFilters} hitSlop={6}><Text className="text-xs font-bold text-rose-600">Reset</Text></TouchableOpacity>
              ) : null}
            </View>
            {datePreset === 'custom' && <DateField value={customDate} onChange={setCustomDate} quick={false} />}

            {filteredVisits.length === 0 ? (
              <EmptyState
                title={repairs.length === 0 ? 'No repairs logged yet for this technician' : 'No repairs match active filters'}
                text={hasActiveFilters ? 'Try adjusting your search query, status, or date range filters above.' : 'Repairs submitted via the workshop app will automatically populate here.'}
                action={hasActiveFilters ? (
                  <TouchableOpacity onPress={clearAllFilters} className="mt-3 rounded-xl bg-slate-900 px-4 py-2"><Text className="text-xs font-bold text-white">Reset all filters</Text></TouchableOpacity>
                ) : null}
              />
            ) : (
              <>
                {filteredVisits.map((row) => {
                  const parts = (row.part_name || '').split(',').map((p) => p.trim()).filter(Boolean);
                  const removed = isRemovedVisit(row);
                  const done = row.outcome === 'completed' || row.battery_status === 'repaired' || row.battery_status === 'returned';
                  return (
                    <RowCard key={row.batch_id || row.id} code={row.battery_code} serial={row.serial_number} client={row.client_name} status={row.battery_status} onInspect={() => inspect(row.battery_code)}>
                      <Text className={`text-xs font-bold ${removed ? 'text-amber-700' : done ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {removed ? '↺ Parts Reclaimed' : done ? '✓ Completed' : '● In Progress'}
                      </Text>
                      <View className="flex-row flex-wrap gap-1">
                        {parts.length ? parts.map((p, i) => (
                          <View key={i} className="rounded-md bg-slate-100 px-1.5 py-0.5"><Text className="text-[10px] font-semibold text-slate-700">{p}</Text></View>
                        )) : <Text className="text-xs text-slate-400">Parts Installed: —</Text>}
                      </View>
                      <Line label="Duration">{formatDuration(row.duration_seconds)}</Line>
                      {isSuperAdmin ? <Line label="Labor Value">£{Number(row.labor_charge || row.price || 0).toFixed(2)}</Line> : null}
                      <Line label="Repaired At">{dateOnly(row.repaired_at)} {row.repaired_at ? new Date(row.repaired_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Line>
                    </RowCard>
                  );
                })}
                <View className="rounded-xl bg-slate-100 p-3">
                  <Text className="text-[11px] text-slate-600">Showing {filteredVisits.length} of {repairs.length} total repair entries</Text>
                  <Text className="text-[11px] text-slate-600">Completed: {completedVisits.length} • Reclaimed: {removedVisits.length}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {activeTab === 'disassembly' && (
          <View className="gap-3">
            <View className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
              <Text className="text-sm font-bold text-amber-900">Workshop Component Salvage &amp; Disassembly Operations ({removedVisits.length} events)</Text>
              <Text className="mt-1 text-xs text-amber-800">When batteries are declared unserviceable, fail QA verification, or are sent to recycling, this technician disassembles and salvages working fitted parts back into active stock.</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <MiniMetric title="Salvaged Disassemblies" value={`${removedVisits.length} batteries`} sub="Components recovered for reuse" color="text-amber-700" />
              <MiniMetric title="Distinct Client Fleets" value={`${new Set(removedVisits.map((r) => r.client_name).filter(Boolean)).size} Fleets`} sub="Salvaged across client pools" />
              <MiniMetric title="Workshop Salvage Status" value="100% Salvage Recorded" sub="Audit trail preserved in parts ledger" color="text-emerald-700" />
            </View>
            <SearchBox value={disassemblySearch} onChangeText={setDisassemblySearch} placeholder="Search battery code, serial, client fleet, parts salvaged…" />
            {filteredDisassembly.length === 0 ? (
              <EmptyState
                title={removedVisits.length === 0 ? 'No disassembled parts recorded for this technician' : 'No records match search'}
                text={removedVisits.length === 0 ? 'All repair jobs installed by this technician currently remain active in fleet.' : 'Clear the search query above to see all disassembly records.'}
              />
            ) : filteredDisassembly.map((row) => (
              <RowCard key={row.batch_id || row.id} code={row.battery_code} serial={row.serial_number} client={row.client_name} status={row.battery_status} onInspect={() => inspect(row.battery_code)}>
                <Line label="Parts Salvaged">{row.part_name || 'Fitted Components'}</Line>
                <Line label="Disassembly Date">{dateTime(row.removed_at || row.repaired_at)}</Line>
                <Line label="Originally Installed">{dateOnly(row.repaired_at)}</Line>
              </RowCard>
            ))}
          </View>
        )}

        {activeTab === 'tests' && (
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              <MiniMetric title="Total Inspections & Tests" value={`${tests.length} tests`} sub="Quality assurance sign-offs" color="text-blue-700" />
              <MiniMetric title="Verified & Passed" value={`${tests.filter((t) => !t.passed_back).length} passed`} sub="Approved for fleet deployment" color="text-emerald-700" />
              <MiniMetric title="Sent Back for Rework" value={`${tests.filter((t) => t.passed_back).length} reworked`} sub="Returned to technicians pool" color="text-amber-700" />
            </View>
            <SearchBox value={testsSearch} onChangeText={setTestsSearch} placeholder="Search battery code, serial, client fleet, test service…" />
            {filteredTests.length === 0 ? (
              <EmptyState
                title={tests.length === 0 ? 'No QA test sign-offs logged for this staff member' : 'No tests match search'}
                text={tests.length === 0 ? 'Supervisors and QA testers log battery test verification and cycling runs before returning batteries to clients.' : 'Clear search to view all logged QA tests.'}
              />
            ) : filteredTests.map((t) => (
              <RowCard key={t.id} code={t.battery_code} serial={t.serial_number} client={t.client_name} status={t.battery_status} onInspect={() => inspect(t.battery_code)}>
                <Line label="Test Service / Verification">{t.service_name || '—'}</Line>
                <Line label="Duration">{formatDuration(t.testing_duration_seconds)}</Line>
                <Text className={`text-xs font-bold ${t.passed_back ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {t.passed_back ? '↺ Passed Back to Tech' : '✓ Verified & Passed'}
                </Text>
                <Line label="Tested At">{dateTime(t.tested_at)}</Line>
                <Line label="Notes">{t.notes || '—'}</Line>
              </RowCard>
            ))}
          </View>
        )}

        {activeTab === 'issues' && (
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              <MiniMetric title="Issues Logged" value={`${issues.length} incidents`} sub="Unserviceable or defect reports" color="text-red-700" />
              <MiniMetric title="Photo Evidence Attached" value={`${issues.filter((i) => (i.photo_urls || []).length > 0).length} reports`} sub="With inspection photos" />
              <MiniMetric title="Failure Categories" value={`${new Set(issues.map((i) => i.reason_label)).size} types`} sub="Distinct defect classifications" />
            </View>
            <SearchBox value={issuesSearch} onChangeText={setIssuesSearch} placeholder="Search battery code, serial, client fleet, failure reason, note…" />
            {filteredIssues.length === 0 ? (
              <EmptyState
                title={issues.length === 0 ? 'No issues reported by this technician' : 'No issues match search'}
                text={issues.length === 0 ? 'All battery operations completed normally without unserviceable escalations.' : 'Clear search to view all reported defect issues.'}
              />
            ) : filteredIssues.map((iss) => {
              const photos = iss.photo_urls || [];
              return (
                <RowCard key={iss.id} code={iss.battery_code} serial={iss.serial_number} client={iss.client_name} status={iss.battery_status} onInspect={() => inspect(iss.battery_code)}>
                  <Line label="Reason / Defect">{iss.reason_label || 'Unserviceable'}</Line>
                  <Line label="Diagnostic Note">{iss.note || '—'}</Line>
                  <Line label="Reported At">{dateTime(iss.reported_at)}</Line>
                  {photos.length > 0 ? (
                    <TouchableOpacity onPress={() => setLightboxImages(photos)} className="mt-1 flex-row items-center gap-1 self-start rounded-lg bg-blue-50 px-2.5 py-1">
                      <Icon name="eye" color="#2563eb" size={12} />
                      <Text className="text-xs font-bold text-blue-700">{photos.length} Photo{photos.length === 1 ? '' : 's'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </RowCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ImageViewerModal
        visible={Boolean(lightboxImages)}
        images={lightboxImages || []}
        title="Diagnostic Defect Photos"
        onClose={() => setLightboxImages(null)}
      />
    </View>
  );
}
