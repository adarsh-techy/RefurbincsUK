import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Read-only directory for office roles: fleet clients (GET /clients) and
// workshop staff (GET /staff). Both lists are small, so they're fetched whole
// and filtered on the phone. Editing stays on the web admin.

const TABS = [
  { id: 'clients', label: 'Clients' },
  { id: 'recyclers', label: 'Recyclers' },
  { id: 'staff', label: 'Staff' },
];

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function AdminDirectoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [tab, setTab] = useState(route.params?.tab || 'clients');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([apiClient.get('/clients'), apiClient.get('/staff')]);
      setClients(Array.isArray(c.data) ? c.data : c.data?.data || []);
      setStaff(Array.isArray(s.data) ? s.data : s.data?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const q = search.trim().toLowerCase();
  const fleetClients = clients.filter((c) => c.user_role !== 'recycle_client');
  const recycleClients = clients.filter((c) => c.user_role === 'recycle_client');
  const list = (tab === 'clients' ? fleetClients : tab === 'recyclers' ? recycleClients : staff).filter((row) => {
    if (!q) return true;
    return [row.name, row.login_email, row.email, row.phone, row.role, row.invoice_email]
      .some((v) => v && String(v).toLowerCase().includes(q));
  });

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-3">
        <View className="flex-row rounded-2xl bg-slate-100 p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                className={`flex-1 items-center rounded-xl py-2 ${active ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`text-xs font-bold ${active ? 'text-blue-700' : 'text-slate-500'}`}>
                  {t.label} ({t.id === 'clients' ? fleetClients.length : t.id === 'recyclers' ? recycleClients.length : staff.length})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View className="mt-2.5 flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Icon name="search" color="#94a3b8" size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={tab === 'staff' ? 'Search staff…' : 'Search clients…'}
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            className="flex-1 text-sm text-slate-900"
          />
        </View>
      </View>

      {error && (
        <View className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      <FlatList
        data={list}
        keyExtractor={(row) => `${tab}-${row.id}`}
        contentContainerClassName="p-4 gap-2 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Icon name="user" color="#94a3b8" size={24} />
            <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading…' : 'Nothing found'}</Text>
          </View>
        }
        renderItem={({ item: row }) =>
          tab !== 'staff' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Batteries', { search: row.name })}
              className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
                <Text className="text-sm font-extrabold text-white">{initials(row.name)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{row.name}</Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  {row.login_email || row.invoice_email || 'No login'}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Badge tone={row.user_role === 'recycle_client' ? 'info' : 'good'}>
                  {row.user_role === 'recycle_client' ? 'Recycling' : 'Fleet'}
                </Badge>
                {row.user_active === false && <Badge tone="critical">Inactive</Badge>}
              </View>
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
              <View className={`h-10 w-10 items-center justify-center rounded-xl ${row.role === 'supervisor' ? 'bg-red-600' : 'bg-blue-600'}`}>
                <Text className="text-sm font-extrabold text-white">{initials(row.name)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{row.name}</Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  {row.login_email || row.phone || 'No login'}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text className={`text-xs font-bold ${row.role === 'supervisor' ? 'text-red-600' : 'text-blue-600'}`}>
                  {row.role === 'supervisor' ? 'Supervisor' : 'Technician'}
                </Text>
                {row.active === false && <Badge tone="critical">Inactive</Badge>}
              </View>
            </View>
          )
        }
      />
    </View>
  );
}
