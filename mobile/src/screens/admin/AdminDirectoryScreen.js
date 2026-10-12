import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { hasPermission } from '../../components/admin/sa3/permissions';
import { confirm, ErrorBox, errMessage, listOf, openUpload, PageTitle, PrimaryButton, RowActions, SearchBox } from '../../components/admin/sa3/ui';

// Fleet Clients / Recycling Partners / Staff — one screen with three tabs,
// each matching its web page (ClientsPage, RecycleClientsAdminPage,
// StaffPage): the same title, add button, columns, row Edit / Delete,
// confirm wording and errors. Rows open the dedicated detail screens.

const TABS = [
  { id: 'clients', label: 'Clients' },
  { id: 'recyclers', label: 'Recyclers' },
  { id: 'staff', label: 'Staff' },
];

const HEADERS = {
  clients: { title: 'Clients', description: 'Clients batteries are repaired for.', add: '+ Add Client' },
  recyclers: { title: 'Recycle Clients', description: 'Manage recycling partner accounts that receive unserviceable battery shipments.', add: '+ Add Recycle Client' },
  staff: { title: 'Repair Staff', description: 'Technicians who repair batteries.', add: '+ Add Staff' },
};

const added = (v) => (v ? new Date(v).toLocaleDateString() : '—');

function Field({ label, children }) {
  return (
    <View className="mt-1 flex-row gap-1.5">
      <Text className="w-28 text-[11px] font-semibold uppercase text-slate-400">{label}</Text>
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
      if (firstFocus.current) { firstFocus.current = false; return; }
      load();
    }, [load])
  );

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const q = search.trim().toLowerCase();
  const fleetClients = clients.filter((c) => c.user_role !== 'recycle_client');
  const recycleClients = clients.filter((c) => c.user_role === 'recycle_client');
  const source = tab === 'clients' ? fleetClients : tab === 'recyclers' ? recycleClients : staff;
  const list = source.filter((row) => {
    if (!q) return true;
    // the web partner search looks at name + login email only
    const keys = tab === 'recyclers' ? [row.name, row.login_email] : [row.name, row.login_email, row.email, row.phone, row.role, row.invoice_email];
    return keys.some((v) => v && String(v).toLowerCase().includes(q));
  });

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

  const header = HEADERS[tab];

  function renderClient(row, index) {
    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
        <TouchableOpacity onPress={() => navigation.navigate('SAClientDetail', { id: row.id, row })}>
          <Text className="text-sm font-bold text-blue-700"><Text className="text-slate-400">{index + 1}. </Text>{row.name}</Text>
        </TouchableOpacity>
        <Field label="Login Account">
          {row.login_email ? <Text className="text-xs text-slate-600">{row.login_email}</Text> : <Text className="text-xs text-slate-400">No login</Text>}
        </Field>
        <Field label="Invoice / Billing">
          {row.invoice_email ? <Text className="text-xs font-medium text-emerald-600">{row.invoice_email}</Text> : <Text className="text-xs text-slate-400">Same as login</Text>}
        </Field>
        <Field label="Added"><Text className="text-xs text-slate-600">{added(row.created_at)}</Text></Field>
        {row.user_active === false && row.login_email ? <View className="mt-1.5"><Badge tone="critical">Login inactive</Badge></View> : null}
        {isSuperAdmin ? (
          <RowActions
            onEdit={() => navigation.navigate('SAClientForm', { client: row, onSaved: load })}
            onDelete={() => deleteClient(row, false)}
          />
        ) : null}
      </View>
    );
  }

  function renderPartner(row, index) {
    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
        <TouchableOpacity onPress={() => navigation.navigate('SARecycleClientDetail', { id: row.id, row })}>
          <Text className="text-sm font-bold text-blue-700"><Text className="text-slate-400">{index + 1}. </Text>{row.name}</Text>
        </TouchableOpacity>
        <Field label="Login Email">
          {row.login_email ? <Text className="font-mono text-xs text-slate-600">{row.login_email}</Text> : <Text className="text-xs text-slate-400">No login</Text>}
        </Field>
        <Field label="Added Date"><Text className="text-xs text-slate-600">{added(row.created_at)}</Text></Field>
        {row.user_active === false ? <View className="mt-1.5"><Badge tone="critical">Login inactive</Badge></View> : null}
        {isSuperAdmin ? (
          <RowActions
            onEdit={() => navigation.navigate('SARecycleClientForm', { client: row, onSaved: load })}
            onDelete={() => deleteClient(row, true)}
          />
        ) : null}
      </View>
    );
  }

  function renderStaff(row, index) {
    const isSupervisor = row.role === 'supervisor';
    const role = row.role ? row.role.charAt(0).toUpperCase() + row.role.slice(1) : 'Technician';
    return (
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
        <View className="flex-row items-start justify-between gap-2">
          <TouchableOpacity className="flex-1" onPress={() => navigation.navigate('SAStaffDetail', { id: row.id, row })}>
            <Text className="text-sm font-bold text-blue-700"><Text className="text-slate-400">{index + 1}. </Text>{row.name}</Text>
          </TouchableOpacity>
          <Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Badge>
        </View>
        <Field label="Role"><Text className={`text-xs font-semibold ${isSupervisor ? 'text-red-600' : 'text-blue-600'}`}>{role}</Text></Field>
        <Field label="Email / Login">
          {row.email || row.login_email ? <Text className="font-mono text-xs text-slate-600">{row.email || row.login_email}</Text> : <Text className="text-xs text-slate-400">No email</Text>}
        </Field>
        <Field label="NI / Passport">
          {row.ni_number ? <Text className="font-mono text-xs font-bold text-slate-800">NI: {row.ni_number}</Text> : null}
          {row.passport_number ? <Text className="font-mono text-xs text-slate-500">Pass: {row.passport_number}</Text> : null}
          {!row.ni_number && !row.passport_number ? <Text className="text-xs text-slate-400">—</Text> : null}
        </Field>
        <Field label="Doc">
          {row.document_path ? (
            <TouchableOpacity onPress={() => openUpload(`/uploads/staff-docs/${row.document_path}`)}>
              <Text className="text-xs font-bold text-blue-600">View Doc</Text>
            </TouchableOpacity>
          ) : <Text className="text-xs text-slate-400">—</Text>}
        </Field>
        {canManageStaff ? (
          <RowActions
            onEdit={() => navigation.navigate('SAStaffForm', { staff: row, onSaved: load })}
            // DELETE /staff/:id is super admin only on the API
            onDelete={isSuperAdmin ? () => deleteStaff(row) : undefined}
          />
        ) : null}
      </View>
    );
  }

  const counts = { clients: fleetClients.length, recyclers: recycleClients.length, staff: staff.length };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row rounded-2xl bg-slate-100 p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => { setTab(t.id); setSearch(''); }}
                className={`flex-1 items-center rounded-xl py-2 ${active ? 'bg-white shadow-sm' : 'shadow-none'}`}
              >
                <Text className={`text-xs font-bold ${active ? 'text-blue-700' : 'text-slate-500'}`}>{t.label} ({counts[t.id]})</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(row) => `${tab}-${row.id}`}
        contentContainerClassName="p-4 gap-2 pb-16"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <PageTitle title={header.title} description={header.description} />
            <PrimaryButton label={header.add} onPress={openAdd} />
            {tab === 'recyclers' ? (
              <View className="rounded-xl border border-blue-200 p-3">
                <SearchBox label="Search Partner / Email" value={search} onChangeText={setSearch} placeholder="e.g. EcoBattery or recycle@gmail.com" />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} className="mt-2 self-start" hitSlop={6}>
                    <Text className="text-xs font-bold text-rose-600">Clear all</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <SearchBox value={search} onChangeText={setSearch} placeholder={tab === 'staff' ? 'Search staff…' : 'Search clients…'} />
            )}
            <ErrorBox message={error} />
            {tab === 'staff' ? <ErrorBox message={staffDeleteError} onClose={() => setStaffDeleteError(null)} /> : null}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="user" color="#94a3b8" size={24} />
            <Text className="mt-2 text-center text-sm font-semibold text-slate-800">
              {loading
                ? tab === 'recyclers' ? 'Loading recycle clients…' : 'Loading…'
                : tab === 'recyclers'
                  ? "No recycle client partners match these filters. Tap '+ Add Recycle Client' above to create one."
                  : 'Nothing found'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) =>
          tab === 'clients' ? renderClient(item, index) : tab === 'recyclers' ? renderPartner(item, index) : renderStaff(item, index)
        }
      />
    </View>
  );
}
