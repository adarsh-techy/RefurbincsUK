import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { hasPermission } from '../../components/admin/sa3/permissions';
import { confirm, ErrorBox, errMessage, listOf, openUpload } from '../../components/admin/sa3/ui';

// Fleet Clients / Recycling Partners / Staff Directory
// Classic, timeless design with zero horizontal scrolling and responsive compact cards.

const TABS = [
  { id: 'clients', label: 'Clients' },
  { id: 'recyclers', label: 'Recyclers' },
  { id: 'staff', label: 'Staff' },
];

const added = (v) => (v ? new Date(v).toLocaleDateString() : '—');

function getInitials(name, fallback = 'FC') {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Field({ label, children }) {
  return (
    <View className="mt-1 flex-row gap-1.5">
      <Text className="w-24 text-[11px] font-semibold uppercase text-slate-400">{label}</Text>
      <View className="flex-1">{children}</View>
    </View>
  );
}

export default function AdminDirectoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const me = useSelector((s) => s.auth.user);
  const isSuperAdmin = me?.role === 'super_admin';
  const canManageStaff = isSuperAdmin || me?.role === 'admin' || hasPermission(me, 'staff');

  const [tab, setTab] = useState(route.params?.tab || 'clients');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [staffDeleteError, setStaffDeleteError] = useState(null);

  // Filter states per tab (all wrapping, zero horizontal scrolling)
  const [fleetStatusFilter, setFleetStatusFilter] = useState('ALL');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL');
  const [recyclerStatusFilter, setRecyclerStatusFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([apiClient.get('/clients'), apiClient.get('/staff')]);
      setClients(listOf(c.data));
      setStaff(listOf(s.data));
      setError(null);
    } catch (err) {
      setError(errMessage(err));
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
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      load();
    }, [load])
  );

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const q = search.trim().toLowerCase();
  const fleetClients = useMemo(() => clients.filter((c) => c.user_role !== 'recycle_client'), [clients]);
  const recycleClients = useMemo(() => clients.filter((c) => c.user_role === 'recycle_client'), [clients]);

  // Fleet metrics
  const fleetMetrics = useMemo(() => {
    const total = fleetClients.length;
    const withLogin = fleetClients.filter((c) => Boolean(c.login_email)).length;
    const active = fleetClients.filter((c) => c.user_active !== false && Boolean(c.login_email)).length;
    const inactive = fleetClients.filter((c) => c.user_active === false).length;
    const withPrefix = fleetClients.filter((c) => Boolean(c.battery_prefix)).length;
    const noLogin = total - withLogin;
    return { total, withLogin, active, inactive, withPrefix, noLogin };
  }, [fleetClients]);

  // Recycler metrics
  const recyclerMetrics = useMemo(() => {
    const total = recycleClients.length;
    const withLogin = recycleClients.filter((c) => Boolean(c.login_email)).length;
    const active = recycleClients.filter((c) => c.user_active !== false && Boolean(c.login_email)).length;
    const inactive = recycleClients.filter((c) => c.user_active === false).length;
    const noLogin = total - withLogin;
    return { total, withLogin, active, inactive, noLogin };
  }, [recycleClients]);

  // Staff metrics
  const staffMetrics = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.active !== false).length;
    const technicians = staff.filter((s) => (s.role || '').toLowerCase() === 'technician' || !s.role).length;
    const supervisors = staff.filter((s) => (s.role || '').toLowerCase() === 'supervisor').length;
    return { total, active, technicians, supervisors };
  }, [staff]);

  // Filtered lists
  const list = useMemo(() => {
    if (tab === 'clients') {
      return fleetClients.filter((row) => {
        // Status filter
        if (fleetStatusFilter === 'ACTIVE' && (row.user_active === false || !row.login_email)) return false;
        if (fleetStatusFilter === 'INACTIVE' && row.user_active !== false) return false;
        if (fleetStatusFilter === 'NO_LOGIN' && row.login_email) return false;
        if (fleetStatusFilter === 'WITH_PREFIX' && !row.battery_prefix) return false;

        // Search query
        if (!q) return true;
        const keys = [row.name, row.login_email, row.email, row.phone, row.role, row.invoice_email, row.battery_prefix];
        return keys.some((v) => v && String(v).toLowerCase().includes(q));
      });
    }

    if (tab === 'recyclers') {
      return recycleClients.filter((row) => {
        // Status filter
        if (recyclerStatusFilter === 'ACTIVE' && (row.user_active === false || !row.login_email)) return false;
        if (recyclerStatusFilter === 'INACTIVE' && row.user_active !== false) return false;
        if (recyclerStatusFilter === 'NO_LOGIN' && row.login_email) return false;

        // Search query
        if (!q) return true;
        const keys = [row.name, row.login_email];
        return keys.some((v) => v && String(v).toLowerCase().includes(q));
      });
    }

    // Staff tab filtering
    return staff.filter((row) => {
      // Role filter
      const role = (row.role || 'technician').toLowerCase();
      if (staffRoleFilter !== 'ALL' && role !== staffRoleFilter.toLowerCase()) return false;

      // Status filter
      if (staffStatusFilter === 'ACTIVE' && row.active === false) return false;
      if (staffStatusFilter === 'INACTIVE' && row.active !== false) return false;

      // Search query
      if (q) {
        const keys = [
          row.name,
          row.login_email,
          row.email,
          row.phone,
          row.role,
          row.ni_number,
          row.passport_number,
        ];
        return keys.some((v) => v && String(v).toLowerCase().includes(q));
      }

      return true;
    });
  }, [tab, fleetClients, recycleClients, staff, q, fleetStatusFilter, staffRoleFilter, staffStatusFilter, recyclerStatusFilter]);

  function openAdd() {
    if (tab === 'staff') navigation.navigate('SAStaffForm', { onSaved: load });
    else if (tab === 'recyclers') navigation.navigate('SARecycleClientForm', { onSaved: load });
    else navigation.navigate('SAClientForm', { onSaved: load });
  }

  function deleteClient(row, partner) {
    confirm(
      partner ? 'Delete Recycle Client' : 'Delete Client',
      partner
        ? `Delete "${row.name}"? If this client is tagged on existing shipments, deactivating their account is recommended instead.`
        : `Delete client "${row.name}"? This can't be undone.`,
      'Delete',
      async () => {
        try {
          await apiClient.delete(`/clients/${row.id}`);
          load();
        } catch (err) {
          Alert.alert(partner ? 'Delete Failed' : 'Cannot Delete Client', errMessage(err));
        }
      }
    );
  }

  function deleteStaff(row) {
    setStaffDeleteError(null);
    confirm('Delete Staff', `Delete staff member "${row.name}"?`, 'Delete', async () => {
      try {
        await apiClient.delete(`/staff/${row.id}`);
        load();
      } catch (err) {
        setStaffDeleteError(errMessage(err));
      }
    });
  }

  function clearFleetFilters() {
    setSearch('');
    setFleetStatusFilter('ALL');
  }

  function clearStaffFilters() {
    setSearch('');
    setStaffRoleFilter('ALL');
    setStaffStatusFilter('ALL');
  }

  function clearRecyclerFilters() {
    setSearch('');
    setRecyclerStatusFilter('ALL');
  }

  const hasActiveFleetFilters = search || fleetStatusFilter !== 'ALL';
  const hasActiveStaffFilters = search || staffRoleFilter !== 'ALL' || staffStatusFilter !== 'ALL';
  const hasActiveRecyclerFilters = search || recyclerStatusFilter !== 'ALL';

  // -------------------------------------------------------------
  // Card Renderers
  // -------------------------------------------------------------

  function renderClient(row, index) {
    const initials = getInitials(row.name, 'CL');
    const hasLogin = Boolean(row.login_email);
    const isActive = row.user_active !== false && hasLogin;

    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        {/* Header: Initials + Client Name + Status Badge */}
        <View className="flex-row items-start justify-between gap-2.5">
          <View className="flex-1 flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <Text className="text-xs font-black text-blue-700">{initials}</Text>
            </View>
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => navigation.navigate('SAClientDetail', { id: row.id, row })}
                hitSlop={4}
              >
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                  <Text className="font-mono text-xs text-slate-400">#{index + 1} </Text>
                  {row.name}
                </Text>
              </TouchableOpacity>
              <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                {row.battery_prefix ? (
                  <View className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5">
                    <Text className="font-mono text-[10px] font-bold text-blue-700">
                      {row.battery_prefix}-
                    </Text>
                  </View>
                ) : null}
                {hasLogin ? (
                  <Badge tone={isActive ? 'good' : 'critical'}>
                    {isActive ? 'Portal Active' : 'Login Inactive'}
                  </Badge>
                ) : (
                  <Badge tone="neutral">No Login</Badge>
                )}
                <Text className="text-[10px] text-slate-400">
                  Added {added(row.created_at)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Credentials & Billing Section */}
        <View className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-xs">
          <Field label="Login Account">
            {row.login_email ? (
              <View className="flex-row items-center gap-1">
                <Icon name="mail" color="#2563eb" size={12} />
                <Text className="font-mono text-xs text-slate-700">{row.login_email}</Text>
              </View>
            ) : (
              <Text className="text-xs italic text-slate-400">No portal login</Text>
            )}
          </Field>

          <Field label="Invoice / Billing">
            {row.invoice_email ? (
              <Text className="font-mono text-xs font-medium text-emerald-700">{row.invoice_email}</Text>
            ) : (
              <Text className="text-xs italic text-slate-400">Same as login</Text>
            )}
          </Field>
        </View>

        {/* Action Buttons Row */}
        <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
          <TouchableOpacity
            onPress={() => navigation.navigate('SAClientDetail', { id: row.id, row })}
            className="flex-row items-center gap-1"
            hitSlop={6}
          >
            <Icon name="eye" color="#2563eb" size={13} />
            <Text className="text-xs font-bold text-blue-600">Client Profile</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-1.5">
            <TouchableOpacity
              onPress={() => navigation.navigate('SAClientForm', { client: row, onSaved: load })}
              className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1"
              hitSlop={4}
            >
              <Icon name="edit" color="#475569" size={12} />
              <Text className="text-xs font-bold text-slate-700">Edit</Text>
            </TouchableOpacity>

            {isSuperAdmin ? (
              <TouchableOpacity
                onPress={() => deleteClient(row, false)}
                className="rounded-lg border border-red-200 bg-red-50 p-1.5"
                hitSlop={4}
              >
                <Icon name="trash" color="#dc2626" size={12} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  function renderPartner(row, index) {
    const initials = getInitials(row.name, 'RP');
    const hasLogin = Boolean(row.login_email);
    const isActive = row.user_active !== false && hasLogin;

    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        {/* Header: Initials + Partner Name + Status Badge */}
        <View className="flex-row items-start justify-between gap-2.5">
          <View className="flex-1 flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
              <Text className="text-xs font-black text-emerald-800">{initials}</Text>
            </View>
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => navigation.navigate('SARecycleClientDetail', { id: row.id, row })}
                hitSlop={4}
              >
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                  <Text className="font-mono text-xs text-slate-400">#{index + 1} </Text>
                  {row.name}
                </Text>
              </TouchableOpacity>
              <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                {hasLogin ? (
                  <Badge tone={isActive ? 'good' : 'critical'}>
                    {isActive ? 'Portal Active' : 'Login Inactive'}
                  </Badge>
                ) : (
                  <Badge tone="neutral">No Login</Badge>
                )}
                <Text className="text-[10px] text-slate-400">
                  Added {added(row.created_at)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-xs">
          <Field label="Login Account">
            {row.login_email ? (
              <View className="flex-row items-center gap-1">
                <Icon name="mail" color="#059669" size={12} />
                <Text className="font-mono text-xs text-slate-700">{row.login_email}</Text>
              </View>
            ) : (
              <Text className="text-xs italic text-slate-400">No portal login assigned</Text>
            )}
          </Field>

          <Field label="Consignment">
            <View className="flex-row items-center gap-1">
              <Icon name="truck" color="#059669" size={12} />
              <Text className="text-xs text-slate-700">E-Waste Battery Consignee</Text>
            </View>
          </Field>
        </View>

        {/* Action Buttons Row */}
        <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
          <TouchableOpacity
            onPress={() => navigation.navigate('SARecycleClientDetail', { id: row.id, row })}
            className="flex-row items-center gap-1"
            hitSlop={6}
          >
            <Icon name="eye" color="#059669" size={13} />
            <Text className="text-xs font-bold text-emerald-700">View Shipments</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-1.5">
            <TouchableOpacity
              onPress={() => navigation.navigate('SARecycleClientForm', { client: row, onSaved: load })}
              className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1"
              hitSlop={4}
            >
              <Icon name="edit" color="#475569" size={12} />
              <Text className="text-xs font-bold text-slate-700">Edit</Text>
            </TouchableOpacity>

            {isSuperAdmin ? (
              <TouchableOpacity
                onPress={() => deleteClient(row, true)}
                className="rounded-lg border border-red-200 bg-red-50 p-1.5"
                hitSlop={4}
              >
                <Icon name="trash" color="#dc2626" size={12} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  function renderStaff(row, index) {
    const isSupervisor = (row.role || '').toLowerCase() === 'supervisor';
    const roleLabel = row.role ? row.role.charAt(0).toUpperCase() + row.role.slice(1) : 'Technician';
    const initials = getInitials(row.name, 'ST');

    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
        {/* Top Header: Initials + Name + Badges */}
        <View className="flex-row items-start justify-between gap-2.5">
          <View className="flex-1 flex-row items-center gap-2.5">
            <View
              className={`h-9 w-9 items-center justify-center rounded-xl ${
                isSupervisor ? 'bg-purple-100' : 'bg-blue-100'
              }`}
            >
              <Text
                className={`text-xs font-black ${
                  isSupervisor ? 'text-purple-700' : 'text-blue-700'
                }`}
              >
                {initials}
              </Text>
            </View>
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => navigation.navigate('SAStaffDetail', { id: row.id, row })}
                hitSlop={4}
              >
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                  <Text className="font-mono text-xs text-slate-400">#{index + 1} </Text>
                  {row.name}
                </Text>
              </TouchableOpacity>
              <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
                <View
                  className={`rounded-md px-1.5 py-0.5 ${
                    isSupervisor ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      isSupervisor ? 'text-purple-700' : 'text-blue-700'
                    }`}
                  >
                    {roleLabel}
                  </Text>
                </View>
                <Badge tone={row.active ? 'good' : 'neutral'}>
                  {row.active ? 'Active' : 'Inactive'}
                </Badge>
              </View>
            </View>
          </View>
        </View>

        {/* Credentials & Contact Details */}
        <View className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-xs">
          <Field label="Email / Login">
            {row.email || row.login_email ? (
              <Text className="font-mono text-xs text-slate-700">{row.email || row.login_email}</Text>
            ) : (
              <Text className="text-xs italic text-slate-400">No email</Text>
            )}
          </Field>

          {row.phone ? (
            <Field label="Phone">
              <Text className="font-mono text-xs text-slate-700">{row.phone}</Text>
            </Field>
          ) : null}

          <Field label="NI / Passport">
            <View className="flex-row flex-wrap gap-1">
              {row.ni_number ? (
                <View className="rounded bg-slate-100 px-1.5 py-0.5">
                  <Text className="font-mono text-[11px] font-bold text-slate-800">NI: {row.ni_number}</Text>
                </View>
              ) : null}
              {row.passport_number ? (
                <View className="rounded bg-slate-100 px-1.5 py-0.5">
                  <Text className="font-mono text-[11px] text-slate-600">Pass: {row.passport_number}</Text>
                </View>
              ) : null}
              {!row.ni_number && !row.passport_number ? (
                <Text className="text-xs text-slate-400">—</Text>
              ) : null}
            </View>
          </Field>

          <Field label="Compliance Doc">
            {row.document_path ? (
              <TouchableOpacity
                onPress={() => openUpload(`/uploads/staff-docs/${row.document_path}`)}
                className="flex-row items-center gap-1"
                hitSlop={6}
              >
                <Icon name="fileText" color="#2563eb" size={13} />
                <Text className="text-xs font-bold text-blue-600">View Document</Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-xs text-slate-400">—</Text>
            )}
          </Field>
        </View>

        {/* Action Buttons Row */}
        <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
          <TouchableOpacity
            onPress={() => navigation.navigate('SAStaffDetail', { id: row.id, row })}
            className="flex-row items-center gap-1"
            hitSlop={6}
          >
            <Icon name="eye" color="#2563eb" size={13} />
            <Text className="text-xs font-bold text-blue-600">View Profile</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-1.5">
            {canManageStaff ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('SAStaffForm', { staff: row, onSaved: load })}
                className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1"
                hitSlop={4}
              >
                <Icon name="edit" color="#475569" size={12} />
                <Text className="text-xs font-bold text-slate-700">Edit</Text>
              </TouchableOpacity>
            ) : null}

            {isSuperAdmin ? (
              <TouchableOpacity
                onPress={() => deleteStaff(row)}
                className="rounded-lg border border-red-200 bg-red-50 p-1.5"
                hitSlop={4}
              >
                <Icon name="trash" color="#dc2626" size={12} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const counts = { clients: fleetClients.length, recyclers: recycleClients.length, staff: staff.length };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Tabs Bar */}
      <View className="border-b border-slate-200 bg-white px-4 pb-2.5 pt-2.5">
        <View className="flex-row rounded-2xl bg-slate-100 p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  setTab(t.id);
                  setSearch('');
                  setFleetStatusFilter('ALL');
                  setStaffRoleFilter('ALL');
                  setStaffStatusFilter('ALL');
                  setRecyclerStatusFilter('ALL');
                }}
                className={`flex-1 items-center rounded-xl py-2 ${
                  active ? 'bg-white shadow-xs' : 'shadow-none'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    active ? 'text-blue-700' : 'text-slate-500'
                  }`}
                >
                  {t.label} ({counts[t.id]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(row) => `${tab}-${row.id}`}
        contentContainerClassName="p-4 gap-2.5 pb-20"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            {/* Header Content per Tab */}
            {tab === 'clients' ? (
              <>
                {/* Executive Header Card for Fleet Clients */}
                <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <View className="flex-row items-center gap-1.5">
                    <View className="flex-row items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5">
                      <Icon name="truck" color="#1d4ed8" size={12} />
                      <Text className="text-[10px] font-bold text-blue-700">FLEET OPERATORS & ACCOUNTS</Text>
                    </View>
                    <Text className="text-xs text-slate-400">•</Text>
                    <Text className="text-xs text-slate-500">Commercial Fleets</Text>
                  </View>

                  <Text className="mt-1 text-lg font-black text-slate-900">
                    Fleet Clients
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Commercial clients batteries are collected, sorted, and repaired for.
                  </Text>

                  {/* Live strip */}
                  <View className="mt-2 flex-row flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                    <Text className="text-[11px] font-medium text-slate-600">
                      Total: <Text className="font-bold text-slate-900">{fleetMetrics.total}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-emerald-700">
                      Active: <Text className="font-bold">{fleetMetrics.active}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-blue-700">
                      With Prefix: <Text className="font-bold">{fleetMetrics.withPrefix}</Text>
                    </Text>
                  </View>

                  {/* Actions */}
                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      onPress={openAdd}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-violet-700 py-2.5 shadow-xs"
                    >
                      <Icon name="plus" color="#ffffff" size={14} />
                      <Text className="text-xs font-bold text-white">+ Add Client</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={load}
                      className="flex-row items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <Icon name="refresh" color="#475569" size={13} />
                      <Text className="text-xs font-bold text-slate-700">Sync</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 4 Compact KPI Cards (2x2 Grid) */}
                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">Total Fleets</Text>
                    <Text className="mt-0.5 text-lg font-black text-slate-900">{fleetMetrics.total}</Text>
                    <Text className="text-[10px] text-slate-500">Commercial operators</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-emerald-700">Active Portals</Text>
                    <Text className="mt-0.5 text-lg font-black text-emerald-700">{fleetMetrics.active}</Text>
                    <Text className="text-[10px] text-emerald-600">Authorized logins</Text>
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-blue-700">Prefixes</Text>
                    <Text className="mt-0.5 text-lg font-black text-blue-700">{fleetMetrics.withPrefix}</Text>
                    <Text className="text-[10px] text-blue-600">Dedicated codes</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-amber-200 bg-amber-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-amber-700">Pending Setup</Text>
                    <Text className="mt-0.5 text-lg font-black text-amber-700">{fleetMetrics.inactive + fleetMetrics.noLogin}</Text>
                    <Text className="text-[10px] text-amber-600">No login / inactive</Text>
                  </View>
                </View>

                {/* Filter Toolbar for Fleet Clients */}
                <View className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                  <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Icon name="search" color="#94a3b8" size={14} />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search fleet name, login email, prefix..."
                      placeholderTextColor="#94a3b8"
                      className="flex-1 text-xs text-slate-900"
                    />
                    {search ? (
                      <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
                        <Icon name="x" color="#94a3b8" size={14} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Status Filter Pills (Wrapping) */}
                  <View className="mt-2.5">
                    <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">Filter Status</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {[
                        { id: 'ALL', label: `All Fleets (${fleetMetrics.total})` },
                        { id: 'ACTIVE', label: `Active (${fleetMetrics.active})` },
                        { id: 'WITH_PREFIX', label: `With Prefix (${fleetMetrics.withPrefix})` },
                        { id: 'INACTIVE', label: `Inactive (${fleetMetrics.inactive})` },
                        { id: 'NO_LOGIN', label: `No Login (${fleetMetrics.noLogin})` },
                      ].map((item) => {
                        const active = fleetStatusFilter === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => setFleetStatusFilter(item.id)}
                            className={`rounded-lg px-2.5 py-1 ${
                              active ? 'bg-blue-600' : 'bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-bold ${
                                active ? 'text-white' : 'text-slate-600'
                              }`}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {hasActiveFleetFilters && (
                    <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
                      <Text className="text-[11px] text-blue-600 font-medium">Filtered results</Text>
                      <TouchableOpacity onPress={clearFleetFilters} hitSlop={6}>
                        <Text className="text-xs font-bold text-rose-600">✕ Clear all</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            ) : tab === 'recyclers' ? (
              <>
                {/* Executive Header Card for Recyclers */}
                <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <View className="flex-row items-center gap-1.5">
                    <View className="flex-row items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5">
                      <Icon name="refresh" color="#059669" size={12} />
                      <Text className="text-[10px] font-bold text-emerald-700">SUSTAINABLE LIFECYCLE</Text>
                    </View>
                    <Text className="text-xs text-slate-400">•</Text>
                    <Text className="text-xs text-slate-500">Recycling Partners</Text>
                  </View>

                  <Text className="mt-1 text-lg font-black text-slate-900">
                    Recycling Partners
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Licensed recovery facilities receiving decommissioned battery consignments.
                  </Text>

                  {/* Live strip */}
                  <View className="mt-2 flex-row flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                    <Text className="text-[11px] font-medium text-slate-600">
                      Total: <Text className="font-bold text-slate-900">{recyclerMetrics.total}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-emerald-700">
                      Active: <Text className="font-bold">{recyclerMetrics.active}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-blue-700">
                      With Login: <Text className="font-bold">{recyclerMetrics.withLogin}</Text>
                    </Text>
                  </View>

                  {/* Actions */}
                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      onPress={openAdd}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 shadow-xs"
                    >
                      <Icon name="plus" color="#ffffff" size={14} />
                      <Text className="text-xs font-bold text-white">+ Add Recycle Client</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={load}
                      className="flex-row items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <Icon name="refresh" color="#475569" size={13} />
                      <Text className="text-xs font-bold text-slate-700">Sync</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 4 Compact KPI Cards (2x2 Grid) */}
                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">Total Partners</Text>
                    <Text className="mt-0.5 text-lg font-black text-slate-900">{recyclerMetrics.total}</Text>
                    <Text className="text-[10px] text-slate-500">Consignees</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-emerald-700">Active Portals</Text>
                    <Text className="mt-0.5 text-lg font-black text-emerald-700">{recyclerMetrics.active}</Text>
                    <Text className="text-[10px] text-emerald-600">Ready to receive</Text>
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-blue-700">With Login</Text>
                    <Text className="mt-0.5 text-lg font-black text-blue-700">{recyclerMetrics.withLogin}</Text>
                    <Text className="text-[10px] text-blue-600">Portal credentials</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-amber-200 bg-amber-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-amber-700">Pending Setup</Text>
                    <Text className="mt-0.5 text-lg font-black text-amber-700">{recyclerMetrics.inactive + recyclerMetrics.noLogin}</Text>
                    <Text className="text-[10px] text-amber-600">No login / inactive</Text>
                  </View>
                </View>

                {/* Filter Toolbar for Recyclers */}
                <View className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                  {/* Search Input */}
                  <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Icon name="search" color="#94a3b8" size={14} />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search partner name or login email..."
                      placeholderTextColor="#94a3b8"
                      className="flex-1 text-xs text-slate-900"
                    />
                    {search ? (
                      <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
                        <Icon name="x" color="#94a3b8" size={14} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Status Filter Pills (Wrapping) */}
                  <View className="mt-2.5">
                    <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">Portal Status</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {[
                        { id: 'ALL', label: `All (${recyclerMetrics.total})` },
                        { id: 'ACTIVE', label: `Active (${recyclerMetrics.active})` },
                        { id: 'INACTIVE', label: `Inactive (${recyclerMetrics.inactive})` },
                        { id: 'NO_LOGIN', label: `No Login (${recyclerMetrics.noLogin})` },
                      ].map((item) => {
                        const active = recyclerStatusFilter === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => setRecyclerStatusFilter(item.id)}
                            className={`rounded-lg px-2.5 py-1 ${
                              active ? 'bg-emerald-600' : 'bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-bold ${
                                active ? 'text-white' : 'text-slate-600'
                              }`}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {hasActiveRecyclerFilters && (
                    <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
                      <Text className="text-[11px] text-emerald-700 font-medium">Filtered results</Text>
                      <TouchableOpacity onPress={clearRecyclerFilters} hitSlop={6}>
                        <Text className="text-xs font-bold text-rose-600">✕ Clear all</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <>
                {/* Executive Header Card for Staff */}
                <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <View className="flex-row items-center gap-1.5">
                    <View className="flex-row items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5">
                      <Icon name="shield" color="#1d4ed8" size={12} />
                      <Text className="text-[10px] font-bold text-blue-700">WORKFORCE & ROSTER</Text>
                    </View>
                    <Text className="text-xs text-slate-400">•</Text>
                    <Text className="text-xs text-slate-500">Workshop Staff</Text>
                  </View>

                  <Text className="mt-1 text-lg font-black text-slate-900">
                    Staff & Technicians
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Battery repair specialists, diagnostic technicians, and supervisors.
                  </Text>

                  {/* Live strip */}
                  <View className="mt-2 flex-row flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                    <Text className="text-[11px] font-medium text-slate-600">
                      Total: <Text className="font-bold text-slate-900">{staffMetrics.total}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-emerald-700">
                      Active: <Text className="font-bold">{staffMetrics.active}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-blue-700">
                      Techs: <Text className="font-bold">{staffMetrics.technicians}</Text>
                    </Text>
                    <Text className="text-slate-300">•</Text>
                    <Text className="text-[11px] font-medium text-purple-700">
                      Leads: <Text className="font-bold">{staffMetrics.supervisors}</Text>
                    </Text>
                  </View>

                  {/* Actions */}
                  <View className="mt-3 flex-row gap-2">
                    {canManageStaff && (
                      <TouchableOpacity
                        onPress={openAdd}
                        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-violet-700 py-2.5 shadow-xs"
                      >
                        <Icon name="plus" color="#ffffff" size={14} />
                        <Text className="text-xs font-bold text-white">+ Add Staff</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={load}
                      className="flex-row items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <Icon name="refresh" color="#475569" size={13} />
                      <Text className="text-xs font-bold text-slate-700">Sync</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 4 Compact KPI Cards (2x2 Grid) */}
                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-slate-400">Total Roster</Text>
                    <Text className="mt-0.5 text-lg font-black text-slate-900">{staffMetrics.total}</Text>
                    <Text className="text-[10px] text-slate-500">Registered</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-emerald-700">Active Roster</Text>
                    <Text className="mt-0.5 text-lg font-black text-emerald-700">{staffMetrics.active}</Text>
                    <Text className="text-[10px] text-emerald-600">Ready on duty</Text>
                  </View>
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-blue-700">Technicians</Text>
                    <Text className="mt-0.5 text-lg font-black text-blue-700">{staffMetrics.technicians}</Text>
                    <Text className="text-[10px] text-blue-600">Battery specialists</Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-purple-200 bg-purple-50/40 p-2.5">
                    <Text className="text-[10px] font-bold uppercase text-purple-700">Supervisors</Text>
                    <Text className="mt-0.5 text-lg font-black text-purple-700">{staffMetrics.supervisors}</Text>
                    <Text className="text-[10px] text-purple-600">QA / Team leads</Text>
                  </View>
                </View>

                {/* Filter Toolbar for Staff */}
                <View className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                  <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <Icon name="search" color="#94a3b8" size={14} />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search by name, email, NI or phone..."
                      placeholderTextColor="#94a3b8"
                      className="flex-1 text-xs text-slate-900"
                    />
                    {search ? (
                      <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
                        <Icon name="x" color="#94a3b8" size={14} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Role Filter Pills (Wrapping) */}
                  <View className="mt-2.5">
                    <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">Filter Role</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {[
                        { id: 'ALL', label: `All Roles (${staffMetrics.total})` },
                        { id: 'technician', label: `Technicians (${staffMetrics.technicians})` },
                        { id: 'supervisor', label: `Supervisors (${staffMetrics.supervisors})` },
                      ].map((item) => {
                        const active = staffRoleFilter === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => setStaffRoleFilter(item.id)}
                            className={`rounded-lg px-2.5 py-1 ${
                              active ? 'bg-blue-600' : 'bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-bold ${
                                active ? 'text-white' : 'text-slate-600'
                              }`}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Status Filter Pills (Wrapping) */}
                  <View className="mt-2">
                    <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">Filter Status</Text>
                    <View className="flex-row flex-wrap gap-1">
                      {[
                        { id: 'ALL', label: 'All Status' },
                        { id: 'ACTIVE', label: `Active (${staffMetrics.active})` },
                        { id: 'INACTIVE', label: `Inactive (${staffMetrics.total - staffMetrics.active})` },
                      ].map((item) => {
                        const active = staffStatusFilter === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => setStaffStatusFilter(item.id)}
                            className={`rounded-lg px-2.5 py-1 ${
                              active ? 'bg-slate-800' : 'bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <Text
                              className={`text-[11px] font-bold ${
                                active ? 'text-white' : 'text-slate-600'
                              }`}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {hasActiveStaffFilters && (
                    <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2">
                      <Text className="text-[11px] text-blue-600 font-medium">Filtered results</Text>
                      <TouchableOpacity onPress={clearStaffFilters} hitSlop={6}>
                        <Text className="text-xs font-bold text-rose-600">✕ Clear all</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}

            <ErrorBox message={error} />
            {tab === 'staff' ? (
              <ErrorBox message={staffDeleteError} onClose={() => setStaffDeleteError(null)} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="user" color="#94a3b8" size={24} />
            <Text className="mt-2 text-center text-sm font-semibold text-slate-800">
              {loading
                ? 'Loading…'
                : tab === 'staff'
                  ? hasActiveStaffFilters
                    ? 'No staff members match the selected filters.'
                    : 'No staff members found. Tap "+ Add Staff" to register one.'
                  : tab === 'recyclers'
                    ? hasActiveRecyclerFilters
                      ? 'No recycling partners match the selected filters.'
                      : "No recycling partners found. Tap '+ Add Recycle Client' above to create one."
                    : hasActiveFleetFilters
                      ? 'No fleet clients match the selected filters.'
                      : "No fleet clients found. Tap '+ Add Client' above to create one."}
            </Text>
            {hasActiveFleetFilters && tab === 'clients' && (
              <TouchableOpacity
                onPress={clearFleetFilters}
                className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <Text className="text-xs font-bold text-slate-700">Clear filters</Text>
              </TouchableOpacity>
            )}
            {hasActiveRecyclerFilters && tab === 'recyclers' && (
              <TouchableOpacity
                onPress={clearRecyclerFilters}
                className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <Text className="text-xs font-bold text-slate-700">Clear filters</Text>
              </TouchableOpacity>
            )}
            {hasActiveStaffFilters && tab === 'staff' && (
              <TouchableOpacity
                onPress={clearStaffFilters}
                className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <Text className="text-xs font-bold text-slate-700">Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item, index }) =>
          tab === 'clients'
            ? renderClient(item, index)
            : tab === 'recyclers'
              ? renderPartner(item, index)
              : renderStaff(item, index)
        }
      />
    </View>
  );
}
