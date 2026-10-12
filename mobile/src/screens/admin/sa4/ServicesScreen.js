import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import apiClient from '../../../services/api-client';
import { Badge } from '../../../components/ui/Badge';
import { AlertDialog, Btn, CheckRow, ConfirmDialog, ErrorBox, Field, FormButtons, Input, PageHead, Sheet, hasPermission, money } from '../../../components/admin/sa4/ui';

// Services & Pricing — the phone version of the web ServicesPage (GET
// /services): "Workshop & Testing Services" and "Mandatory Intake Service
// Fees" sections, + Add Service / + Add Mandatory Fee, Edit and Delete.
// Managing is super_admin + 'services' permission, like the web.

function ServiceFormSheet({ target, onSaved, onClose }) {
  const service = target?.mode === 'edit' ? target.service : null;
  const isEdit = Boolean(service);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!target) return;
    setForm({
      name: service?.name || '',
      description: service?.description || '',
      rate: service ? String(service.rate) : '',
      active: service ? service.active : true,
      isMandatory: service ? Boolean(service.is_mandatory) : Boolean(target.isMandatory),
    });
    setError(null);
  }, [target, service]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name?.trim()) {
      setError(`${form.isMandatory ? 'Mandatory Fee Name' : 'Service Name'} is required.`);
      return;
    }
    const rateNum = parseFloat(form.rate);
    if (Number.isNaN(rateNum) || rateNum < 0) {
      setError('Please enter a valid rate amount.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        rate: rateNum,
        sortOrder: 0,
        active: form.active,
        is_mandatory: form.isMandatory,
      };
      if (isEdit) await apiClient.patch(`/services/${service.id}`, payload);
      else await apiClient.post('/services', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const title = !target ? '' : target.mode === 'new' ? (target.isMandatory ? 'New Mandatory Intake Fee' : 'New Service') : `Edit — ${service?.name}`;
  return (
    <Sheet visible={Boolean(target)} title={title} onClose={onClose}>
      <Field label={form.isMandatory ? 'Mandatory Fee Name *' : 'Service Name *'}>
        <Input value={form.name} onChangeText={(v) => update('name', v)} placeholder={form.isMandatory ? 'e.g. Mandatory Intake & Diagnostic Fee' : 'e.g. Cell Balancing & Calibration'} />
      </Field>
      <Field
        label={form.isMandatory ? 'Mandatory Fee Rate (£) *' : 'Service Rate (£) *'}
        help={form.isMandatory
          ? 'This fixed fee will be automatically attached to every battery received on truck intake.'
          : 'Standard rate charged when this service is applied to a battery during testing or maintenance.'}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-bold text-slate-500">£</Text>
          <View className="flex-1">
            <Input value={form.rate} onChangeText={(v) => update('rate', v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>
      </Field>
      <Field label="Description (Optional)">
        <Input multiline value={form.description} onChangeText={(v) => update('description', v)} placeholder={form.isMandatory ? 'Describe the purpose of this mandatory intake fee...' : 'Describe what this service entails...'} />
      </Field>
      {isEdit && (
        <CheckRow
          value={form.active}
          onChange={(v) => update('active', v)}
          label={`Active ${form.isMandatory ? '(auto-applied on new battery intakes)' : '(available for technicians during testing)'}`}
        />
      )}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <FormButtons
        onCancel={onClose}
        onSubmit={submit}
        submitting={submitting}
        color={form.isMandatory ? 'bg-amber-600' : 'bg-blue-600'}
        label={isEdit ? 'Save Changes' : form.isMandatory ? 'Create Mandatory Fee' : 'Create Service'}
      />
    </Sheet>
  );
}

export default function ServicesScreen() {
  const user = useSelector((s) => s.auth.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const canManage = hasPermission(user, 'services') && isSuperAdmin;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // null | { mode: 'new', isMandatory } | { mode: 'edit', service }
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/services');
      setData(Array.isArray(res) ? res : res?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const standard = (data || []).filter((s) => !s.is_mandatory);
  const mandatory = (data || []).filter((s) => s.is_mandatory);

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await apiClient.delete(`/services/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message);
      setDeleteTarget(null);
    }
  }

  function Section({ mandatoryFees }) {
    const rows = mandatoryFees ? mandatory : standard;
    return (
      <View className={`rounded-2xl border bg-white p-4 ${mandatoryFees ? 'border-amber-200' : 'border-slate-200'}`}>
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-base font-bold text-slate-900">{mandatoryFees ? 'Mandatory Intake Service Fees' : 'Workshop & Testing Services'}</Text>
              <Text className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${mandatoryFees ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{rows.length}</Text>
            </View>
            {mandatoryFees && <Text className="mt-1 self-start rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Auto-added to all battery intakes</Text>}
            <Text className="mt-1 text-xs text-slate-500">
              {mandatoryFees
                ? 'Mandatory baseline fees automatically logged and charged against every battery entering the workshop (Truck Intake, Excel import, and client dispatch).'
                : 'Optional diagnostic and refurbishment services selectable by technicians during testing and repairs.'}
            </Text>
          </View>
        </View>
        {canManage && (
          <View className="mt-2 flex-row">
            <Btn small tone={mandatoryFees ? 'secondary' : 'primary'} label={mandatoryFees ? '+ Add Mandatory Fee' : '+ Add Service'} onPress={() => setFormTarget({ mode: 'new', isMandatory: mandatoryFees })} />
          </View>
        )}
        <View className="mt-3 gap-2">
          {rows.length === 0 ? (
            <Text className="py-3 text-center text-xs text-slate-400">
              {mandatoryFees ? "No mandatory intake fees configured. Click '+ Add Mandatory Fee' to create one." : "No workshop services added yet. Click '+ Add Service' to create one."}
            </Text>
          ) : rows.map((row, i) => (
            <View key={row.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <View className="flex-row items-start gap-2">
                <Text className="w-5 text-xs font-bold text-slate-400">{i + 1}</Text>
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <Text className="text-sm font-semibold text-slate-900">{row.name}</Text>
                    {mandatoryFees && <Text className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">Auto-Applied</Text>}
                  </View>
                  {row.description ? <Text className="mt-0.5 text-xs text-slate-500">{row.description}</Text> : null}
                </View>
                <Badge tone={row.active ? 'good' : 'neutral'}>{row.active ? (mandatoryFees ? 'Active (Auto-Intake)' : 'Active') : 'Disabled'}</Badge>
              </View>
              <View className="ml-7 mt-2 flex-row items-center justify-between">
                {isSuperAdmin ? (
                  <Text className="text-xs text-slate-600">
                    {mandatoryFees ? 'Intake Fee Rate' : 'Standard Rate'} <Text className="font-bold text-slate-900">{money(row.rate)}</Text>
                  </Text>
                ) : <View />}
                {canManage && (
                  <View className="flex-row gap-3">
                    <TouchableOpacity onPress={() => setFormTarget({ mode: 'edit', service: row })}><Text className="text-xs font-bold text-blue-600">Edit</Text></TouchableOpacity>
                    {isSuperAdmin && <TouchableOpacity onPress={() => setDeleteTarget(row)}><Text className="text-xs font-bold text-red-600">Delete</Text></TouchableOpacity>}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <PageHead
        title="Services & Pricing"
        color="text-blue-600"
        description="Configure workshop testing rates, custom labor pricing, and mandatory battery intake fees."
      >
        {canManage && <Btn tone="secondary" label="+ Add Mandatory Fee" onPress={() => setFormTarget({ mode: 'new', isMandatory: true })} />}
        {canManage && <Btn tone="primary" label="+ Add Service" onPress={() => setFormTarget({ mode: 'new', isMandatory: false })} />}
      </PageHead>
      <ErrorBox text={error} />
      {!data ? (
        <Text className="py-6 text-center text-xs text-slate-400">Loading services…</Text>
      ) : (
        <>
          <Section mandatoryFees={false} />
          <Section mandatoryFees />
        </>
      )}

      <ServiceFormSheet target={formTarget} onSaved={() => { setFormTarget(null); load(); }} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title={deleteTarget?.is_mandatory ? 'Delete Mandatory Fee' : 'Delete Service'}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Past batteries with this service logged will retain their history.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <AlertDialog visible={Boolean(deleteError)} title="Cannot Delete Service" message={deleteError} onClose={() => setDeleteError(null)} />
    </ScrollView>
  );
}
