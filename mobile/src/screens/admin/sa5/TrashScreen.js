import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import DateField from '../../../components/admin/DateField';
import { Banner, Chips, ConfirmModal, EmptyState, Loading, SmallButton, initials, relativeTime } from '../../../components/admin/sa5/common';
import RestoreModal from '../../../components/admin/sa5/RestoreModal';
import { ITEM_TYPES, TYPE_CONFIG, typeConfig } from './trash-config';

// Trash Bin — the web TrashPage: GET /trash/stats for the counter cards and
// GET /trash?page=&limit=15&search=&itemType=&startDate=&endDate= for the
// list (Previous / Next pages). Tap a counter to filter by type. Each item
// has Inspect (→ AdminTrashDetail), Restore and Delete Permanently
// (DELETE /trash/:id); the super admin can Empty Trash (DELETE /trash).

const LIMIT = 15;

export default function TrashScreen() {
  const navigation = useNavigation();
  const me = useSelector((s) => s.auth.user);
  const isSuperAdmin = me?.role === 'super_admin';

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, byType: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: LIMIT });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [emptyTrashModal, setEmptyTrashModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/trash/stats');
      setStats(data?.data || { total: 0, byType: {} });
    } catch {
      // counters stay as they were; the list shows its own error
    }
  }, []);

  const fetchTrash = useCallback(async () => {
    const id = ++reqRef.current;
    setError(null);
    try {
      const params = {
        page,
        limit: LIMIT,
        search: debouncedSearch.trim() || undefined,
        itemType: selectedType !== 'all' ? selectedType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const { data } = await apiClient.get('/trash', { params });
      if (id !== reqRef.current) return;
      setItems(data?.data || []);
      setPagination(data?.pagination || { total: 0, totalPages: 1, limit: LIMIT });
    } catch (err) {
      if (id === reqRef.current) setError(err.response?.data?.message || 'Failed to fetch trash items');
    } finally {
      if (id === reqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, debouncedSearch, selectedType, startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    fetchTrash();
  }, [fetchTrash]);

  // back from the detail page (which can delete) → fresh counters and list
  const latest = useRef({ fetchStats, fetchTrash });
  latest.current = { fetchStats, fetchTrash };
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      latest.current.fetchStats();
      if (firstFocus.current) firstFocus.current = false;
      else latest.current.fetchTrash();
    }, [])
  );

  function refreshAll() {
    fetchStats();
    fetchTrash();
  }

  function pickType(type) {
    setSelectedType(type);
    setPage(1);
  }

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  async function permanentDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/trash/${deleteTarget.id}`);
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      Alert.alert('Delete failed', err.response?.data?.message || 'Failed to permanently delete item');
    } finally {
      setActionLoading(false);
    }
  }

  async function emptyTrash() {
    setActionLoading(true);
    try {
      await apiClient.delete('/trash');
      setEmptyTrashModal(false);
      setPage(1);
      refreshAll();
    } catch (err) {
      Alert.alert('Could not empty the trash', err.response?.data?.message || 'Failed to empty trash');
    } finally {
      setActionLoading(false);
    }
  }

  const filtersActive = Boolean(search || selectedType !== 'all' || startDate || endDate);
  const openItem = (item) => navigation.navigate('AdminTrashDetail', { id: item.id });
  const counterCls = (active) => (active ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white');

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-16"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refreshAll(); }} />}
      >
        {/* Header */}
        <View className="gap-3">
          <View>
            <Text className="text-2xl font-bold text-slate-900">🗑 Trash Bin</Text>
            <Text className="text-xs text-slate-500">Audit trail of deleted items with detailed logs of who deleted them and when.</Text>
          </View>
          <View className="flex-row gap-2">
            <SmallButton label="↻ Refresh" onPress={() => { setLoading(true); refreshAll(); }} />
            {isSuperAdmin && stats.total > 0 ? (
              <SmallButton label="Empty Trash" tone="danger" onPress={() => setEmptyTrashModal(true)} />
            ) : null}
          </View>
        </View>

        {/* Counter cards (tap to filter) */}
        <View className="flex-row flex-wrap gap-2">
          <TouchableOpacity onPress={() => pickType('all')} className={`min-w-[30%] flex-1 rounded-xl border p-3 ${counterCls(selectedType === 'all')}`}>
            <Text className="text-[11px] font-medium text-slate-500">Total Deleted</Text>
            <Text className="mt-0.5 text-xl font-bold text-slate-900">{stats.total || 0}</Text>
          </TouchableOpacity>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const selected = selectedType === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => pickType(selected ? 'all' : key)}
                className={`min-w-[30%] flex-1 rounded-xl border p-3 ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}
              >
                <Text className="text-[11px] font-medium text-slate-500" numberOfLines={1}>{cfg.label}s</Text>
                <Text className="mt-0.5 text-xl font-bold text-slate-900">{stats.byType?.[key] || 0}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Filters */}
        <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search deleted items by title, detail, or user..."
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900"
          />
          <Chips options={ITEM_TYPES.map((t) => ({ id: t.value, label: t.label }))} value={selectedType} onChange={pickType} />
          <DateField label="Start date" value={startDate} onChange={(v) => { setStartDate(v); setPage(1); }} quick={false} />
          <DateField label="End date" value={endDate} onChange={(v) => { setEndDate(v); setPage(1); }} quick={false} />
          {filtersActive ? (
            <TouchableOpacity onPress={resetFilters} className="self-start rounded-xl px-2.5 py-1.5">
              <Text className="text-xs font-semibold text-slate-500">Reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? <Banner tone="bad" text={error} /> : null}

        {loading && !refreshing ? (
          <Loading text="Loading trash bin..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon="🗑"
            title={search || selectedType !== 'all' ? 'No matching deleted items' : 'Trash Bin is Empty'}
            text={search || selectedType !== 'all'
              ? 'Try changing your search term or adjusting filters to find what you are looking for.'
              : 'Items deleted across batteries, truck intakes, parts, and staff will appear here with an audit of who deleted them and when.'}
          />
        ) : (
          <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {items.map((item, i) => {
              const cfg = typeConfig(item.item_type);
              return (
                <View key={item.id} className={`gap-2.5 p-3.5 ${i ? 'border-t border-slate-100' : ''}`}>
                  <View className="flex-row items-start gap-2">
                    <TouchableOpacity className="flex-1" onPress={() => openItem(item)}>
                      <Text className="text-sm font-semibold text-slate-900">{item.title}</Text>
                      {item.subtitle ? <Text className="mt-0.5 text-xs text-slate-500">{item.subtitle}</Text> : null}
                      {item.original_id ? (
                        <Text className="mt-1 self-start rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">Original ID: #{item.original_id}</Text>
                      ) : null}
                    </TouchableOpacity>
                    <Text className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.cls} ${cfg.text}`}>{cfg.label}</Text>
                  </View>

                  <View className="flex-row items-center gap-2.5">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                      <Text className="text-xs font-bold text-slate-700">{initials(item.deleted_by_name)}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        <Text className="text-xs font-medium text-slate-900">{item.deleted_by_name || 'System / Admin'}</Text>
                        {item.deleted_by_role ? (
                          <Text className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-600">{item.deleted_by_role.replace('_', ' ')}</Text>
                        ) : null}
                      </View>
                      {item.deleted_by_email ? <Text className="text-[11px] text-slate-500">{item.deleted_by_email}</Text> : null}
                    </View>
                    <View className="items-end">
                      <Text className="text-[11px] font-medium text-slate-800">
                        {new Date(item.deleted_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </Text>
                      <Text className="text-[10px] text-slate-400">{relativeTime(item.deleted_at)}</Text>
                    </View>
                  </View>

                  <View className="flex-row flex-wrap justify-end gap-2">
                    <SmallButton label="👁 Inspect" onPress={() => openItem(item)} />
                    {item.restorable ? (
                      <SmallButton label="↺ Restore" tone="green" onPress={() => setRestoreTarget(item)} />
                    ) : (
                      <SmallButton
                        label="Can’t restore"
                        onPress={() => Alert.alert('Can’t be restored', item.restore_blocked_reason || 'This item can’t be restored.')}
                      />
                    )}
                    <SmallButton label="✕ Delete Permanently" tone="danger" onPress={() => setDeleteTarget(item)} />
                  </View>
                </View>
              );
            })}

            {pagination.totalPages > 1 ? (
              <View className="gap-2 border-t border-slate-200 px-3.5 py-3">
                <Text className="text-xs text-slate-500">
                  Showing <Text className="font-medium text-slate-700">{(page - 1) * pagination.limit + 1}</Text> to{' '}
                  <Text className="font-medium text-slate-700">{Math.min(page * pagination.limit, pagination.total)}</Text> of{' '}
                  <Text className="font-medium text-slate-700">{pagination.total}</Text> items
                </Text>
                <View className="flex-row items-center justify-between">
                  <SmallButton label="Previous" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))} />
                  <Text className="text-xs font-medium text-slate-600">Page {page} of {pagination.totalPages}</Text>
                  <SmallButton label="Next" disabled={page >= pagination.totalPages} onPress={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} />
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <RestoreModal
        item={restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onRestored={() => {
          setRestoreTarget(null);
          refreshAll();
        }}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Permanently Delete Item?"
        description={`Are you sure you want to permanently purge "${deleteTarget?.title || ''}" from the trash bin? This action cannot be undone.`}
        confirmLabel="Permanently Delete"
        loading={actionLoading}
        onConfirm={permanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={emptyTrashModal}
        title="Empty Entire Trash Bin?"
        description="Are you sure you want to permanently delete all archived items in the trash? All deleted history records will be completely removed."
        confirmLabel="Empty Trash"
        loading={actionLoading}
        onConfirm={emptyTrash}
        onCancel={() => setEmptyTrashModal(false)}
      />
    </View>
  );
}
