import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import {
  AlertDialog,
  CheckRow,
  ConfirmDialog,
  ErrorBox,
  Field,
  FormButtons,
  Input,
  Sheet,
  hasPermission,
} from '../../../components/admin/sa4/ui';

// Issue Reasons — mobile version of IssueReasonsPage: the "can't service this battery"
// reasons technicians select when reporting unserviceable batteries.
// Manageable by users with 'issue_reasons' permission, deleted only by 'super_admin'.

const capitalizeWords = (v) => v.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());

function ReasonFormSheet({ target, existing, onSaved, onClose }) {
  const reason = target && target !== 'new' ? target : null;
  const isEdit = Boolean(reason);
  const [form, setForm] = useState({ label: '', sortOrder: '', active: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!target) return;
    const nextOrder =
      existing.length > 0
        ? Math.max(...existing.map((r) => Number(r.sort_order) || 0)) + 1
        : 1;
    setForm({
      label: reason?.label || '',
      sortOrder: reason ? String(reason.sort_order) : String(nextOrder),
      active: reason ? reason.active : true,
    });
    setError(null);
  }, [target, reason, existing]);

  const sortOrderTaken = existing.some(
    (r) => r.id !== reason?.id && Number(r.sort_order) === (Number(form.sortOrder) || 0)
  );
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.label.trim()) {
      setError('Reason description is required.');
      return;
    }
    if (sortOrderTaken) {
      setError('That order number is already used by another reason — pick a different one.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        label: form.label.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      if (isEdit) await apiClient.patch(`/issue-reasons/${reason.id}`, payload);
      else await apiClient.post('/issue-reasons', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(target)}
      title={isEdit ? 'Edit Reason' : 'Add Reason'}
      description={
        isEdit
          ? 'Update this fault reason’s details.'
          : 'Add a new reason technicians can select.'
      }
      onClose={onClose}
    >
      <Field label="Reason Description *">
        <Input
          value={form.label}
          onChangeText={(v) => update('label', capitalizeWords(v))}
          placeholder="e.g. BMS Communication Failure"
        />
      </Field>
      <Field
        label="Sort Order"
        help="Display sequence shown to technicians in the mobile app."
        error={sortOrderTaken ? 'Another reason already uses this order number.' : null}
      >
        <Input
          value={form.sortOrder}
          onChangeText={(v) => update('sortOrder', v.replace(/[^0-9-]/g, ''))}
          keyboardType="number-pad"
          placeholder="1"
        />
      </Field>
      {isEdit && (
        <CheckRow
          value={form.active}
          onChange={(v) => update('active', v)}
          label="Active (shown to technicians when reporting unserviceable batteries)"
        />
      )}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <FormButtons
        onCancel={onClose}
        onSubmit={submit}
        submitting={submitting}
        disabled={sortOrderTaken}
        color="bg-rose-600"
        label={isEdit ? 'Save Changes' : 'Add Reason'}
      />
    </Sheet>
  );
}

export default function IssueReasonsScreen() {
  const user = useSelector((s) => s.auth.user);
  const canManage = hasPermission(user, 'issue_reasons');
  const isSuperAdmin = user?.role === 'super_admin';

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled'
  const [search, setSearch] = useState('');

  // Modals & Action Targets
  const [formTarget, setFormTarget] = useState(null); // null | 'new' | reason
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/issue-reasons');
      setData(Array.isArray(res) ? res : res?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeCount = useMemo(
    () => (data || []).filter((r) => r.active).length,
    [data]
  );
  const disabledCount = useMemo(
    () => (data || []).filter((r) => !r.active).length,
    [data]
  );

  const searchLower = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    return (data || [])
      .filter((r) => {
        if (statusFilter === 'active') return r.active;
        if (statusFilter === 'disabled') return !r.active;
        return true;
      })
      .filter((r) => {
        if (!searchLower) return true;
        return (
          r.label?.toLowerCase().includes(searchLower) ||
          String(r.sort_order || '').includes(searchLower)
        );
      })
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [data, statusFilter, searchLower]);

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/issue-reasons/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-2.5 pb-16 gap-2"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      {/* Executive Header Card — COMPACT */}
      <View className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs gap-2">
        <View className="gap-0.5">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-base font-extrabold tracking-tight text-slate-900">
              Fault & Issue Reasons
            </Text>
            <View className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5">
              <Text className="text-[9.5px] font-bold text-rose-700">
                Unserviceable Criteria
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-slate-500">
            Reasons a technician can report when a battery cannot be serviced or repaired.
          </Text>
        </View>

        {/* Action Button */}
        {canManage && (
          <View className="flex-row items-center gap-1.5 pt-0.5">
            <TouchableOpacity
              onPress={() => setFormTarget('new')}
              className="flex-row items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1 shadow-xs"
            >
              <Icon name="plus" size={11} color="#ffffff" />
              <Text className="text-[11px] font-bold text-white">Add Reason</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live Counters Strip — Ultra-compact Single Line */}
        <View className="flex-row items-center gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
          <Text className="text-[10.5px] text-slate-500">
            Total: <Text className="font-bold text-slate-900">{data?.length || 0}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-emerald-700">
            Active: <Text className="font-bold">{activeCount}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-slate-600">
            Disabled: <Text className="font-bold">{disabledCount}</Text>
          </Text>
        </View>
      </View>

      {/* Toolbar: Search & Tab Chips — COMPACT */}
      <View className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs gap-1.5">
        {/* Search Input */}
        <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1">
          <Icon name="search" size={13} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search fault reasons…"
            placeholderTextColor="#94a3b8"
            className="flex-1 p-0 text-xs text-slate-800"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" size={12} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Filter Tab Chips */}
        <View className="flex-row flex-wrap items-center gap-1">
          <TouchableOpacity
            onPress={() => setStatusFilter('all')}
            className={`rounded-lg border px-2 py-0.5 ${
              statusFilter === 'all'
                ? 'border-slate-900 bg-slate-900'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                statusFilter === 'all' ? 'text-white' : 'text-slate-600'
              }`}
            >
              All ({data?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('active')}
            className={`rounded-lg border px-2 py-0.5 ${
              statusFilter === 'active'
                ? 'border-emerald-600 bg-emerald-600'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                statusFilter === 'active' ? 'text-white' : 'text-emerald-700'
              }`}
            >
              Active ({activeCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatusFilter('disabled')}
            className={`rounded-lg border px-2 py-0.5 ${
              statusFilter === 'disabled'
                ? 'border-slate-600 bg-slate-600'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                statusFilter === 'disabled' ? 'text-white' : 'text-slate-600'
              }`}
            >
              Disabled ({disabledCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ErrorBox text={error} />

      {/* Cards List — ZERO HORIZONTAL SCROLLING */}
      {filtered.length === 0 ? (
        <View className="rounded-xl border border-slate-200/90 bg-white p-5 items-center justify-center gap-1.5 shadow-2xs">
          <Icon name="alertTriangle" size={20} color="#94a3b8" />
          <Text className="text-xs font-semibold text-slate-700">
            {!data
              ? 'Loading issue reasons…'
              : search
              ? 'No reasons match your search.'
              : 'No issue reasons configured yet.'}
          </Text>
        </View>
      ) : (
        filtered.map((r, idx) => (
          <View
            key={r.id}
            className="rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xs gap-1.5"
          >
            {/* Top Header: Avatar + Title & Status */}
            <View className="flex-row items-start justify-between gap-1.5">
              <View className="flex-1 flex-row items-center gap-1.5 min-w-0">
                <View className="h-6 w-6 rounded-md items-center justify-center shrink-0 border bg-rose-50 border-rose-100">
                  <Icon name="alertTriangle" size={12} color="#e11d48" />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-[10px] font-bold font-mono text-slate-400">
                      #{idx + 1}
                    </Text>
                    <Text className="font-bold text-xs text-slate-900 truncate">
                      {r.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status Badge */}
              <View
                className={`flex-row items-center gap-1 rounded-full px-1.5 py-0.2 border ${
                  r.active
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-100'
                }`}
              >
                <View
                  className={`h-1.5 w-1.5 rounded-full ${
                    r.active ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <Text
                  className={`text-[9.5px] font-bold ${
                    r.active ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {r.active ? 'Active' : 'Disabled'}
                </Text>
              </View>
            </View>

            {/* Combined Priority & Compact Actions Row */}
            <View className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[10px] text-slate-500">
                  Order: <Text className="font-bold font-mono text-slate-700">#{r.sort_order}</Text>
                </Text>
                <Text className="text-slate-300">•</Text>
                <Text className="text-[10px] text-slate-500">
                  {r.active ? 'Selectable in app' : 'Hidden'}
                </Text>
              </View>

              {/* Action Buttons */}
              {canManage && (
                <View className="flex-row items-center gap-1">
                  <TouchableOpacity
                    onPress={() => setFormTarget(r)}
                    className="flex-row items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs"
                  >
                    <Icon name="edit" size={10} color="#64748b" />
                    <Text className="text-[10px] font-semibold text-slate-700">Edit</Text>
                  </TouchableOpacity>
                  {isSuperAdmin && (
                    <TouchableOpacity
                      onPress={() => setDeleteTarget(r)}
                      className="flex-row items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 shadow-2xs"
                    >
                      <Icon name="trash" size={10} color="#e11d48" />
                      <Text className="text-[10px] font-bold text-rose-700">Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        ))
      )}

      {/* Sheets & Dialogs */}
      <ReasonFormSheet
        target={formTarget}
        existing={data || []}
        onSaved={() => {
          setFormTarget(null);
          load();
        }}
        onClose={() => setFormTarget(null)}
      />

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Reason"
        message={`Delete reason "${deleteTarget?.label}"? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AlertDialog
        visible={Boolean(deleteError)}
        title="Cannot Delete Reason"
        message={deleteError}
        onClose={() => setDeleteError(null)}
      />
    </ScrollView>
  );
}
