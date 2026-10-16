import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { PERMISSIONS } from '../../../components/admin/sa3/permissions';
import { confirm, dateOnly, ErrorBox, errMessage, listOf } from '../../../components/admin/sa3/ui';

// Admin Users — mobile version of UsersPage (super admin only):
// Manage admin & super admin accounts with role, permissions, and status.

const titleCase = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const isWorkshop = (u) => ['technician', 'supervisor', 'staff'].includes(u.role);

function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UsersScreen() {
  const navigation = useNavigation();
  const me = useSelector((s) => s.auth.user);
  const [view, setView] = useState('admins'); // 'admins' | 'all'
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [u, c, s] = await Promise.all([
        apiClient.get('/users', { params: { role: 'all' } }),
        apiClient.get('/clients').catch(() => ({ data: [] })),
        apiClient.get('/staff').catch(() => ({ data: [] })),
      ]);
      setUsers(listOf(u.data));
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

  const clientFor = (u) => clients.find((c) => Number(c.user_id) === Number(u.id));
  const staffFor = (u) => staff.find((st) => Number(st.user_id) === Number(u.id));
  const isOffice = (u) => u.role === 'admin' || u.role === 'super_admin';

  async function setActive(u, active) {
    setActionError(null);
    try {
      if (isOffice(u) || u.role === 'recycle_client') {
        await apiClient.patch(`/users/${u.id}`, {
          name: u.name,
          email: u.email,
          role: u.role,
          permissions: u.permissions,
          active,
        });
      } else if (u.role === 'client') {
        const c = clientFor(u);
        if (!c) throw new Error('Client record not found for this login.');
        await apiClient.patch(`/clients/${c.id}`, { name: c.name, active: String(active) });
      } else {
        const st = staffFor(u);
        if (st) await apiClient.patch(`/staff/${st.id}`, { active: String(active) });
        else await apiClient.patch(`/users/${u.id}`, { active });
      }
      load();
    } catch (err) {
      setActionError(errMessage(err));
    }
  }

  function deactivate(u) {
    confirm(
      isOffice(u) ? 'Deactivate Admin' : 'Deactivate Account',
      `Deactivate "${u.name}"? They will no longer be able to log in, but can be reactivated any time.`,
      'Deactivate',
      () => setActive(u, false)
    );
  }

  function remove(u) {
    confirm(
      'Delete Admin',
      `Delete "${u.name}"? Accounts with any activity history can't be deleted — deactivate them instead.`,
      'Delete',
      async () => {
        setActionError(null);
        try {
          await apiClient.delete(`/users/${u.id}`);
          load();
        } catch (err) {
          setActionError(errMessage(err));
        }
      }
    );
  }

  function edit(u) {
    if (isOffice(u)) return navigation.navigate('SAUserForm', { user: u, onSaved: load });
    if (u.role === 'client' || u.role === 'recycle_client') {
      const c = clientFor(u);
      if (!c)
        return Alert.alert('Client record not found', `${u.email} isn't linked to a client record.`);
      return navigation.navigate(
        u.role === 'client' ? 'SAClientForm' : 'SARecycleClientForm',
        { client: c, onSaved: load }
      );
    }
    if (isWorkshop(u)) {
      const st = staffFor(u);
      if (!st)
        return Alert.alert('Staff record not found', `${u.email} isn't linked to a staff record.`);
      return navigation.navigate('SAStaffForm', { staff: st, onSaved: load });
    }
    return null;
  }

  const q = search.trim().toLowerCase();
  const rows = users
    .filter((u) => (view === 'admins' ? isOffice(u) : true))
    .filter(
      (u) =>
        !q || [u.name, u.email, u.role].some((v) => String(v || '').toLowerCase().includes(q))
    );

  const permissionsText = (u) =>
    u.role === 'super_admin'
      ? 'All Full Access'
      : isOffice(u)
      ? PERMISSIONS.filter((p) => (u.permissions || []).includes(p.key))
          .map((p) => p.label)
          .join(', ') || 'No permissions assigned'
      : null;

  const officeCount = users.filter(isOffice).length;
  const activeCount = users.filter((u) => (view === 'admins' ? isOffice(u) && u.active : u.active)).length;

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={rows}
        keyExtractor={(u) => String(u.id)}
        contentContainerClassName="p-2.5 pb-16 gap-2"
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
          <View className="gap-2 pb-1">
            {/* Executive Header Card — COMPACT */}
            <View className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs gap-2">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-base font-extrabold tracking-tight text-slate-900">
                      Admin Users & Access
                    </Text>
                    <View className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5">
                      <Text className="text-[9.5px] font-bold text-violet-700">
                        Access Control
                      </Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-slate-500">
                    Super admin only: manage administrative accounts, roles, and granular feature permissions.
                  </Text>
                </View>

                {/* Primary Action Button */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('SAUserForm', { onSaved: load })}
                  className="flex-row items-center gap-1 rounded-xl bg-violet-600 px-2.5 py-1 shadow-xs"
                >
                  <Icon name="plus" size={11} color="#ffffff" />
                  <Text className="text-[11px] font-bold text-white">Add Admin</Text>
                </TouchableOpacity>
              </View>

              {/* Super Admin Creator Link */}
              <TouchableOpacity
                onPress={() => navigation.navigate('SACreateAccount')}
                className="flex-row items-center justify-center rounded-xl border border-amber-200 bg-amber-50/80 py-1.5 px-2"
              >
                <Text className="text-[10.5px] font-bold text-amber-900">
                  👑 Create Super Admin Account
                </Text>
              </TouchableOpacity>

              {/* Live Counters Strip */}
              <View className="flex-row items-center gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
                <Text className="text-[10.5px] text-slate-500">
                  Total Admins: <Text className="font-bold text-slate-900">{officeCount}</Text>
                </Text>
                <Text className="text-slate-300">•</Text>
                <Text className="text-[10.5px] text-violet-700">
                  All Logins: <Text className="font-bold">{users.length}</Text>
                </Text>
                <Text className="text-slate-300">•</Text>
                <Text className="text-[10.5px] text-emerald-700">
                  Active: <Text className="font-bold">{activeCount}</Text>
                </Text>
              </View>
            </View>

            {/* Toolbar: Search & Tab Chips — COMPACT & WRAPPING */}
            <View className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs gap-1.5">
              {/* Search input */}
              <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1">
                <Icon name="search" size={13} color="#94a3b8" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, email, or role…"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  className="flex-1 p-0 text-xs text-slate-800"
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Icon name="x" size={12} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* View Tab Chips — Wrapping */}
              <View className="flex-row flex-wrap items-center gap-1">
                <TouchableOpacity
                  onPress={() => setView('admins')}
                  className={`flex-row items-center gap-1 rounded-lg border px-2 py-0.5 ${
                    view === 'admins'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Text
                    className={`text-[10.5px] font-bold ${
                      view === 'admins' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    Admin Users ({officeCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setView('all')}
                  className={`flex-row items-center gap-1 rounded-lg border px-2 py-0.5 ${
                    view === 'all'
                      ? 'border-violet-600 bg-violet-600'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Text
                    className={`text-[10.5px] font-bold ${
                      view === 'all' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    All System Logins ({users.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ErrorBox message={error} />
            <ErrorBox message={actionError} onClose={() => setActionError(null)} />
          </View>
        }
        ListEmptyComponent={
          <View className="rounded-xl border border-slate-200/90 bg-white p-6 items-center justify-center gap-1 shadow-2xs">
            <Icon name="user" size={20} color="#94a3b8" />
            <Text className="text-xs font-semibold text-slate-800">
              {loading ? 'Loading user accounts…' : 'No user accounts found.'}
            </Text>
          </View>
        }
        renderItem={({ item: u, index }) => {
          const self = u.id === me?.id;
          const office = isOffice(u);
          const perms = permissionsText(u);

          return (
            <View
              key={u.id}
              className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs gap-1.5"
            >
              {/* Top Row: Avatar + Name + Badges */}
              <View className="flex-row items-start justify-between gap-1.5">
                <View className="flex-1 flex-row items-center gap-1.5 min-w-0">
                  <View className="h-6 w-6 rounded-full bg-violet-100 border border-violet-200 items-center justify-center shrink-0">
                    <Text className="text-[9.5px] font-bold text-violet-700">
                      {getInitials(u.name)}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] font-bold font-mono text-slate-400">
                        #{index + 1}
                      </Text>
                      <Text className="font-bold text-xs text-slate-900 truncate">
                        {u.name}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Role & Status Badges */}
                <View className="flex-row items-center gap-1 shrink-0">
                  <Badge tone={u.role === 'super_admin' ? 'info' : 'neutral'}>
                    {u.role === 'super_admin'
                      ? 'Super Admin'
                      : u.role === 'admin'
                      ? 'Admin'
                      : titleCase(u.role)}
                  </Badge>
                  <Badge tone={u.active ? 'good' : 'neutral'}>
                    {u.active ? 'Active' : 'Inactive'}
                  </Badge>
                </View>
              </View>

              {/* Email */}
              <Text className="text-[11px] text-slate-500 font-mono truncate" selectable>
                {u.email}
              </Text>

              {/* Permissions Container */}
              {perms != null ? (
                <View className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1">
                  <Text className="text-[10px] text-slate-600 truncate">
                    <Text className="font-bold text-slate-400">Permissions: </Text>
                    {perms}
                  </Text>
                </View>
              ) : (
                <Text className="text-[10px] text-slate-400">
                  {u.must_change_password ? 'Must change password on next login · ' : ''}Member since {dateOnly(u.created_at)}
                </Text>
              )}

              {/* Action Buttons Row */}
              <View className="flex-row flex-wrap items-center justify-between gap-1 pt-0.5">
                <TouchableOpacity
                  onPress={() => edit(u)}
                  className="flex-row items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs"
                >
                  <Icon name="edit" size={10} color="#64748b" />
                  <Text className="text-[10px] font-semibold text-slate-700">Edit</Text>
                </TouchableOpacity>

                <View className="flex-row items-center gap-1">
                  {!self ? (
                    <>
                      {u.active ? (
                        <TouchableOpacity
                          onPress={() => deactivate(u)}
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 shadow-2xs"
                        >
                          <Text className="text-[10px] font-bold text-amber-700">
                            Deactivate
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setActive(u, true)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 shadow-2xs"
                        >
                          <Text className="text-[10px] font-bold text-emerald-700">
                            Activate
                          </Text>
                        </TouchableOpacity>
                      )}

                      {office && (
                        <TouchableOpacity
                          onPress={() => remove(u)}
                          className="flex-row items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 shadow-2xs"
                        >
                          <Icon name="trash" size={10} color="#e11d48" />
                          <Text className="text-[10px] font-bold text-rose-700">Delete</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <View className="rounded bg-slate-100 px-1.5 py-0.5">
                      <Text className="text-[9.5px] font-bold text-slate-500">
                        Your Account
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
