import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import DateField, { prettyYmd } from '../../../components/admin/DateField';
import { Banner, ConfirmModal, initials, relativeTime } from '../../../components/admin/sa5/common';
import RestoreModal from '../../../components/admin/sa5/RestoreModal';
import { ITEM_TYPES, TYPE_CONFIG, typeConfig } from './trash-config';

// Trash Bin — mobile version of TrashPage:
// Audit trail of deleted items across batteries, truck intakes, staff, parts, etc.

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
  const [showDates, setShowDates] = useState(false);
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
      // keep current stats
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
      if (id === reqRef.current)
        setError(err.response?.data?.message || 'Failed to fetch trash items');
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

  // Back from detail page → refresh
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
    setShowDates(false);
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
      Alert.alert('Could not empty trash', err.response?.data?.message || 'Failed to empty trash');
    } finally {
      setActionLoading(false);
    }
  }

  const filtersActive = Boolean(search || selectedType !== 'all' || startDate || endDate);
  const openItem = (item) => navigation.navigate('AdminTrashDetail', { id: item.id });

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-2.5 pb-16 gap-2"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refreshAll();
            }}
          />
        }
      >
        {/* Executive Header Card — COMPACT */}
        <View className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs gap-2">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-base font-extrabold tracking-tight text-slate-900">
                  Trash Bin
                </Text>
                <View className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5">
                  <Text className="text-[9.5px] font-bold text-rose-700">
                    Audit Archive
                  </Text>
                </View>
              </View>
              <Text className="text-[11px] text-slate-500">
                Audit trail of soft-deleted records across batteries, intakes, staff, and parts.
              </Text>
            </View>

            {/* Actions */}
            <View className="flex-row items-center gap-1.5">
              <TouchableOpacity
                onPress={() => {
                  setLoading(true);
                  refreshAll();
                }}
                className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 shadow-2xs"
              >
                <Icon name="refresh" size={11} color="#64748b" />
                <Text className="text-[10.5px] font-semibold text-slate-700">Sync</Text>
              </TouchableOpacity>

              {isSuperAdmin && stats.total > 0 && (
                <TouchableOpacity
                  onPress={() => setEmptyTrashModal(true)}
                  className="flex-row items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-1 shadow-2xs"
                >
                  <Icon name="trash" size={11} color="#e11d48" />
                  <Text className="text-[10.5px] font-bold text-rose-700">Empty</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Live Counters Strip */}
          <View className="flex-row items-center gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
            <Text className="text-[10.5px] text-slate-500">
              Total Deleted: <Text className="font-bold text-slate-900">{stats.total || 0}</Text>
            </Text>
            <Text className="text-slate-300">•</Text>
            <Text className="text-[10.5px] text-emerald-700">
              Batteries: <Text className="font-bold">{stats.byType?.battery || 0}</Text>
            </Text>
            <Text className="text-slate-300">•</Text>
            <Text className="text-[10.5px] text-blue-700">
              Intakes: <Text className="font-bold">{stats.byType?.truck_intake || 0}</Text>
            </Text>
            <Text className="text-slate-300">•</Text>
            <Text className="text-[10.5px] text-amber-700">
              Parts: <Text className="font-bold">{stats.byType?.part || 0}</Text>
            </Text>
          </View>
        </View>

        {/* Type Filter Pills Bar — WRAPPING (Zero Horizontal Scrolling) */}
        <View className="flex-row flex-wrap gap-1 pb-0.5">
          {ITEM_TYPES.map((t) => {
            const isSelected = selectedType === t.value;
            const count = t.value === 'all' ? stats.total || 0 : stats.byType?.[t.value] || 0;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => pickType(t.value)}
                className={`flex-row items-center gap-1 rounded-lg border px-2 py-0.5 ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isSelected ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {t.label}
                </Text>
                <View
                  className={`rounded px-1 py-0.2 ${
                    isSelected ? 'bg-white/20' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-[9px] font-extrabold ${
                      isSelected ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toolbar: Search & Date Filters — COMPACT */}
        <View className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs gap-1.5">
          {/* Search Input */}
          <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1">
            <Icon name="search" size={13} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by title, detail, or user…"
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

          {/* Date Picker Button & Reset Row */}
          <View className="flex-row items-center justify-between pt-0.5">
            <TouchableOpacity
              onPress={() => setShowDates((v) => !v)}
              className="flex-row items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5"
            >
              <Icon name="clock" size={11} color="#64748b" />
              <Text className="text-[10.5px] font-semibold text-slate-700">
                {startDate || endDate
                  ? `${startDate ? prettyYmd(startDate) : 'Start'} → ${
                      endDate ? prettyYmd(endDate) : 'End'
                    }`
                  : 'Filter by Date'}
              </Text>
              <Text className="text-[9.5px] font-bold text-blue-600">
                {showDates ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {filtersActive && (
              <TouchableOpacity onPress={resetFilters} className="px-1.5 py-0.5">
                <Text className="text-[10.5px] font-bold text-rose-600">Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          {showDates && (
            <View className="pt-1.5 border-t border-slate-100 gap-1.5">
              <DateField
                label="Start Date"
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  setPage(1);
                }}
                compact
              />
              <DateField
                label="End Date"
                value={endDate}
                onChange={(v) => {
                  setEndDate(v);
                  setPage(1);
                }}
                compact
              />
            </View>
          )}
        </View>

        {error ? <Banner tone="bad" text={error} /> : null}

        {/* Main Content Area */}
        {loading && !refreshing ? (
          <View className="rounded-xl border border-slate-200/90 bg-white p-6 items-center justify-center gap-1 shadow-2xs">
            <Text className="text-xs font-semibold text-slate-500">Loading trash bin…</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="rounded-xl border border-slate-200/90 bg-white p-6 items-center justify-center gap-1 shadow-2xs">
            <Icon name="trash" size={20} color="#94a3b8" />
            <Text className="text-xs font-semibold text-slate-800">
              {filtersActive ? 'No matching deleted items' : 'Trash Bin is Empty'}
            </Text>
            <Text className="text-[10.5px] text-slate-400 text-center">
              {filtersActive
                ? 'Try adjusting your search or filters.'
                : 'Items soft-deleted across the system will appear here.'}
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map((item) => {
              const cfg = typeConfig(item.item_type);
              return (
                <View
                  key={item.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs gap-1.5"
                >
                  {/* Top Row: Title + Original ID + Type Badge */}
                  <View className="flex-row items-start justify-between gap-1.5">
                    <TouchableOpacity
                      className="flex-1 min-w-0"
                      onPress={() => openItem(item)}
                    >
                      <Text className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text className="text-[10.5px] text-slate-500 truncate mt-0.5">
                          {item.subtitle}
                        </Text>
                      ) : null}
                      {item.original_id ? (
                        <View className="self-start mt-0.5 rounded bg-slate-100 px-1 py-0.2">
                          <Text className="font-mono text-[9px] text-slate-600">
                            Original ID: #{item.original_id}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>

                    <View className={`rounded-full border px-1.5 py-0.2 ${cfg.cls}`}>
                      <Text className={`text-[9.5px] font-bold ${cfg.text}`}>
                        {cfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Deleted By User & Timestamp Container */}
                  <View className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                      <View className="h-5 w-5 items-center justify-center rounded-full bg-slate-200 shrink-0">
                        <Text className="text-[9px] font-bold text-slate-700">
                          {initials(item.deleted_by_name)}
                        </Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center gap-1 flex-wrap">
                          <Text className="text-[10.5px] font-semibold text-slate-800 truncate">
                            {item.deleted_by_name || 'System / Admin'}
                          </Text>
                          {item.deleted_by_role ? (
                            <View className="rounded bg-slate-200/60 px-1 py-0.2">
                              <Text className="text-[8.5px] font-bold uppercase text-slate-600">
                                {item.deleted_by_role.replace(/_/g, ' ')}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <Text className="text-[10px] text-slate-400 shrink-0">
                      {relativeTime(item.deleted_at)}
                    </Text>
                  </View>

                  {/* Compact Action Buttons Row */}
                  <View className="flex-row items-center justify-between pt-0.5">
                    <TouchableOpacity
                      onPress={() => openItem(item)}
                      className="flex-row items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs"
                    >
                      <Icon name="eye" size={10} color="#64748b" />
                      <Text className="text-[10px] font-semibold text-slate-700">Inspect</Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center gap-1">
                      {item.restorable ? (
                        <TouchableOpacity
                          onPress={() => setRestoreTarget(item)}
                          className="flex-row items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 shadow-2xs"
                        >
                          <Icon name="rotateCcw" size={10} color="#059669" />
                          <Text className="text-[10px] font-bold text-emerald-700">Restore</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              'Cannot Restore',
                              item.restore_blocked_reason || 'This item cannot be restored.'
                            )
                          }
                          className="px-1"
                        >
                          <Text className="text-[9.5px] font-medium text-slate-400">
                            Locked
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => setDeleteTarget(item)}
                        className="flex-row items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 shadow-2xs"
                      >
                        <Icon name="trash" size={10} color="#e11d48" />
                        <Text className="text-[10px] font-bold text-rose-700">Purge</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <View className="flex-row items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs">
                <TouchableOpacity
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  className={`rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs ${
                    page <= 1 ? 'opacity-40' : ''
                  }`}
                >
                  <Text className="text-[10.5px] font-semibold text-slate-700">Prev</Text>
                </TouchableOpacity>

                <Text className="text-[10.5px] font-bold text-slate-600">
                  Page {page} of {pagination.totalPages}
                </Text>

                <TouchableOpacity
                  disabled={page >= pagination.totalPages}
                  onPress={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className={`rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs ${
                    page >= pagination.totalPages ? 'opacity-40' : ''
                  }`}
                >
                  <Text className="text-[10.5px] font-semibold text-slate-700">Next</Text>
                </TouchableOpacity>
              </View>
            )}
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
        open={Boolean(deleteTarget)}
        title="Permanently Delete Item?"
        description={`Are you sure you want to permanently purge "${
          deleteTarget?.title || ''
        }" from the trash bin? This action cannot be undone.`}
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
