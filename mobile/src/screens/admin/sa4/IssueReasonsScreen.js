import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import { Badge } from '../../../components/ui/Badge';
import { AlertDialog, Btn, CheckRow, ConfirmDialog, ErrorBox, Field, FormButtons, Input, PageHead, Sheet, hasPermission } from '../../../components/admin/sa4/ui';

// Issue Reasons — the phone version of the web IssueReasonsPage (GET
// /issue-reasons): the "can't service this battery" reasons technicians pick
// from. + Add Reason / Edit ('issue_reasons' permission), Delete (super_admin).

const capitalizeWords = (v) => v.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());

function ReasonFormSheet({ target, existing, onSaved, onClose }) {
  const reason = target && target !== 'new' ? target : null;
  const isEdit = Boolean(reason);
  const [form, setForm] = useState({ label: '', sortOrder: '', active: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!target) return;
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((r) => Number(r.sort_order) || 0)) + 1 : 1;
    setForm({ label: reason?.label || '', sortOrder: reason ? String(reason.sort_order) : String(nextOrder), active: reason ? reason.active : true });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const sortOrderTaken = existing.some((r) => r.id !== reason?.id && Number(r.sort_order) === (Number(form.sortOrder) || 0));
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.label.trim()) {
      setError('Reason is required.');
      return;
    }
    if (sortOrderTaken) {
      setError('That order number is already used by another reason — pick a different one.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = { label: form.label.trim(), sortOrder: Number(form.sortOrder) || 0, active: form.active };
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
      description={isEdit ? 'Update this reason’s details.' : 'Add a new reason technicians can select.'}
      onClose={onClose}
    >
      <Field label="Reason *">
        <Input value={form.label} onChangeText={(v) => update('label', capitalizeWords(v))} placeholder="Enter issue reason description" />
      </Field>
      <Field label="Sort Order" error={sortOrderTaken ? 'Another reason already uses this order number.' : null}>
        <Input value={form.sortOrder} onChangeText={(v) => update('sortOrder', v.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" />
      </Field>
      {isEdit && <CheckRow value={form.active} onChange={(v) => update('active', v)} label="Active (shown to technicians when reporting unserviceable batteries)" />}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <FormButtons onCancel={onClose} onSubmit={submit} submitting={submitting} disabled={sortOrderTaken} label={isEdit ? 'Save Changes' : 'Add Reason'} />
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={data || []}
        keyExtractor={(r) => String(r.id)}
        contentContainerClassName="p-4 gap-2 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <PageHead title="Issue Reasons" description="Reasons a technician can report when a battery cannot be serviced or repaired.">
              {canManage && <Btn label="+ Add Reason" onPress={() => setFormTarget('new')} />}
            </PageHead>
            <ErrorBox text={error} />
          </View>
        }
        ListEmptyComponent={
          <Text className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            {!data ? 'Loading issue reasons…' : "No issue reasons configured yet. Click '+ Add Reason' to create one."}
          </Text>
        }
        renderItem={({ item: r, index }) => (
          <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <View className="flex-row items-start gap-2">
              <Text className="w-5 text-xs font-bold text-slate-400">{index + 1}</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">{r.label}</Text>
                <Text className="text-[11px] text-slate-500">Order {r.sort_order}</Text>
              </View>
              <Badge tone={r.active ? 'good' : 'neutral'}>{r.active ? 'Active' : 'Disabled'}</Badge>
            </View>
            {canManage && (
              <View className="ml-7 mt-2 flex-row gap-4">
                <TouchableOpacity onPress={() => setFormTarget(r)}><Text className="text-xs font-bold text-blue-600">Edit</Text></TouchableOpacity>
                {isSuperAdmin && <TouchableOpacity onPress={() => setDeleteTarget(r)}><Text className="text-xs font-bold text-red-600">Delete</Text></TouchableOpacity>}
              </View>
            )}
          </View>
        )}
      />
      <ReasonFormSheet target={formTarget} existing={data || []} onSaved={() => { setFormTarget(null); load(); }} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Reason"
        message={`Delete reason "${deleteTarget?.label}"? This can't be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <AlertDialog visible={Boolean(deleteError)} title="Cannot Delete Reason" message={deleteError} onClose={() => setDeleteError(null)} />
    </View>
  );
}
