import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import { Badge } from '../../../components/ui/Badge';
import { PERMISSIONS } from '../../../components/admin/sa3/permissions';
import { confirm, dateOnly, ErrorBox, errMessage, listOf, PageTitle, Pill, PrimaryButton, RowActions, SearchBox } from '../../../components/admin/sa3/ui';

// Admin Users — the web UsersPage (super admin only): admin / super admin
// accounts with role, permissions and status; + Add Admin, Edit, Delete
// (never yourself), Deactivate (with confirm) / Activate. "Create Super
// Admin Account" opens the web's Create an Account page.
// Phone extra kept from before: an "All Logins" view to find any login
// (clients, partners, workshop) and activate / deactivate or edit it where
// its record lives.

const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const isWorkshop = (u) => ['technician', 'supervisor', 'staff'].includes(u.role);

export default function UsersScreen() {
  const navigation = useNavigation();
  const me = useSelector((s) => s.auth.user);
  const [view, setView] = useState('admins');
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
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    load();
  }, [load]));

  const clientFor = (u) => clients.find((c) => Number(c.user_id) === Number(u.id));
  const staffFor = (u) => staff.find((st) => Number(st.user_id) === Number(u.id));
  const isOffice = (u) => u.role === 'admin' || u.role === 'super_admin';

  // web setActive: the full body, the API writes every field
  async function setActive(u, active) {
    setActionError(null);
    try {
      if (isOffice(u) || u.role === 'recycle_client') {
        await apiClient.patch(`/users/${u.id}`, { name: u.name, email: u.email, role: u.role, permissions: u.permissions, active });
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
      if (!c) return Alert.alert('Client record not found', `${u.email} isn't linked to a client record.`);
      return navigation.navigate(u.role === 'client' ? 'SAClientForm' : 'SARecycleClientForm', { client: c, onSaved: load });
    }
    if (isWorkshop(u)) {
      const st = staffFor(u);
      if (!st) return Alert.alert('Staff record not found', `${u.email} isn't linked to a staff record.`);
      return navigation.navigate('SAStaffForm', { staff: st, onSaved: load });
    }
    return null;
  }

  const q = search.trim().toLowerCase();
  const rows = users
    .filter((u) => (view === 'admins' ? isOffice(u) : true))
    .filter((u) => !q || [u.name, u.email, u.role].some((v) => String(v || '').toLowerCase().includes(q)));

  const permissionsText = (u) =>
    u.role === 'super_admin'
      ? 'All'
      : isOffice(u)
        ? PERMISSIONS.filter((p) => (u.permissions || []).includes(p.key)).map((p) => p.label).join(', ') || '—'
        : null;

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      data={rows}
      keyExtractor={(u) => String(u.id)}
      contentContainerClassName="p-4 gap-2 pb-16"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View className="mb-2 gap-3">
          <PageTitle title="Admin Users" description="Super admin only: manage admin accounts and role permissions." />
          <PrimaryButton label="+ Add Admin" onPress={() => navigation.navigate('SAUserForm', { onSaved: load })} />
          <TouchableOpacity onPress={() => navigation.navigate('SACreateAccount')} className="items-center rounded-2xl border border-amber-300 bg-amber-50 py-2.5">
            <Text className="text-xs font-bold text-amber-900">👑 Create Super Admin Account</Text>
          </TouchableOpacity>
          <View className="flex-row gap-1.5">
            <Pill label={`Admin Users (${users.filter(isOffice).length})`} active={view === 'admins'} onPress={() => setView('admins')} />
            <Pill label={`All Logins (${users.length})`} active={view === 'all'} onPress={() => setView('all')} />
          </View>
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search name, email or role…" />
          <ErrorBox message={error} />
          <ErrorBox message={actionError} onClose={() => setActionError(null)} />
        </View>
      }
      ListEmptyComponent={<Text className="py-8 text-center text-xs text-slate-400">{loading ? 'Loading…' : 'No user accounts'}</Text>}
      renderItem={({ item: u, index }) => {
        const self = u.id === me?.id;
        const office = isOffice(u);
        const perms = permissionsText(u);
        return (
          <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900"><Text className="text-slate-400">{index + 1}. </Text>{u.name}</Text>
                <Text className="text-xs text-slate-500" selectable>{u.email}</Text>
              </View>
              <View className="items-end gap-1">
                <Badge tone={u.role === 'super_admin' ? 'info' : 'neutral'}>
                  {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : titleCase(u.role)}
                </Badge>
                <Badge tone={u.active ? 'good' : 'neutral'}>{u.active ? 'Active' : 'Inactive'}</Badge>
              </View>
            </View>
            {perms != null ? (
              <Text className="mt-1.5 text-xs text-slate-600"><Text className="font-semibold">Permissions: </Text>{perms}</Text>
            ) : (
              <Text className="mt-1.5 text-[11px] text-slate-400">
                {u.must_change_password ? 'Must change password on next login · ' : ''}Member since {dateOnly(u.created_at)}
              </Text>
            )}
            <RowActions onEdit={() => edit(u)} onDelete={office && !self ? () => remove(u) : undefined}>
              {!self ? (
                u.active ? (
                  <TouchableOpacity onPress={() => deactivate(u)} hitSlop={6} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
                    <Text className="text-xs font-bold text-amber-700">Deactivate</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setActive(u, true)} hitSlop={6} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                    <Text className="text-xs font-bold text-emerald-700">Activate</Text>
                  </TouchableOpacity>
                )
              ) : null}
            </RowActions>
          </View>
        );
      }}
    />
  );
}
