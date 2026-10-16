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
  money,
} from '../../../components/admin/sa4/ui';

// Services & Pricing — workshop testing rates, custom labor pricing, and mandatory battery intake fees
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

  const title = !target
    ? ''
    : target.mode === 'new'
    ? target.isMandatory
      ? 'New Mandatory Intake Fee'
      : 'New Service'
    : `Edit — ${service?.name}`;

  return (
    <Sheet visible={Boolean(target)} title={title} onClose={onClose}>
      <Field label={form.isMandatory ? 'Mandatory Fee Name *' : 'Service Name *'}>
        <Input
          value={form.name}
          onChangeText={(v) => update('name', v)}
          placeholder={
            form.isMandatory
              ? 'e.g. Mandatory Intake & Diagnostic Fee'
              : 'e.g. Cell Balancing & Calibration'
          }
        />
      </Field>
      <Field
        label={form.isMandatory ? 'Mandatory Fee Rate (£) *' : 'Service Rate (£) *'}
        help={
          form.isMandatory
            ? 'This fixed fee will be automatically attached to every battery received on truck intake.'
            : 'Standard rate charged when this service is applied to a battery during testing or maintenance.'
        }
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-bold text-slate-500">£</Text>
          <View className="flex-1">
            <Input
              value={form.rate}
              onChangeText={(v) => update('rate', v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
        </View>
      </Field>
      <Field label="Description (Optional)">
        <Input
          multiline
          value={form.description}
          onChangeText={(v) => update('description', v)}
          placeholder={
            form.isMandatory
              ? 'Describe the purpose of this mandatory intake fee...'
              : 'Describe what this service entails...'
          }
        />
      </Field>
      {isEdit && (
        <CheckRow
          value={form.active}
          onChange={(v) => update('active', v)}
          label={`Active ${
            form.isMandatory
              ? '(auto-applied on new battery intakes)'
              : '(available for technicians during testing)'
          }`}
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

  // Filter & Search
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'workshop' | 'mandatory'
  const [search, setSearch] = useState('');

  // Modals
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const standard = useMemo(() => (data || []).filter((s) => !s.is_mandatory), [data]);
  const mandatory = useMemo(() => (data || []).filter((s) => s.is_mandatory), [data]);

  const searchLower = search.toLowerCase().trim();
  const filterFn = (s) =>
    !searchLower ||
    s.name?.toLowerCase().includes(searchLower) ||
    s.description?.toLowerCase().includes(searchLower);

  const filteredStandard = useMemo(() => standard.filter(filterFn), [standard, searchLower]);
  const filteredMandatory = useMemo(() => mandatory.filter(filterFn), [mandatory, searchLower]);

  const totalVisibleCount =
    (activeTab === 'all' || activeTab === 'workshop' ? filteredStandard.length : 0) +
    (activeTab === 'all' || activeTab === 'mandatory' ? filteredMandatory.length : 0);

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

  function renderCard(s, idx, isMandatory) {
    return (
      <View
        key={s.id}
        className="rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xs gap-1.5"
      >
        {/* Top Header: Avatar + Title & Badges */}
        <View className="flex-row items-start justify-between gap-1.5">
          <View className="flex-1 flex-row items-center gap-1.5 min-w-0">
            <View
              className={`h-6 w-6 rounded-md items-center justify-center shrink-0 border ${
                isMandatory
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-blue-50 border-blue-100'
              }`}
            >
              <Icon
                name={isMandatory ? 'shield' : 'wrench'}
                size={12}
                color={isMandatory ? '#b45309' : '#2563eb'}
              />
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-[10px] font-bold font-mono text-slate-400">
                  #{idx + 1}
                </Text>
                <Text className="font-bold text-xs text-slate-900 truncate">
                  {s.name}
                </Text>
                {isMandatory && (
                  <View className="rounded bg-amber-100 px-1 py-0.2">
                    <Text className="font-mono text-[8.5px] font-bold text-amber-800">
                      Auto-Applied
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Status Badge */}
          <View
            className={`flex-row items-center gap-1 rounded-full px-1.5 py-0.2 border ${
              s.active
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-slate-100'
            }`}
          >
            <View
              className={`h-1.5 w-1.5 rounded-full ${
                s.active ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <Text
              className={`text-[9.5px] font-bold ${
                s.active ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              {s.active ? 'Active' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* Description text */}
        {s.description ? (
          <Text className="text-[10px] text-slate-500 leading-tight">
            {s.description}
          </Text>
        ) : null}

        {/* Compact Combined Price & Actions Container */}
        <View className="rounded-lg border border-slate-100 bg-slate-50/70 px-2 py-1 flex-row items-center justify-between gap-2">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-[9px] uppercase font-bold text-slate-400 leading-none">
              {isMandatory ? 'Intake Fee:' : 'Rate:'}
            </Text>
            <Text
              className={`text-xs font-extrabold font-mono leading-none ${
                isMandatory ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {money(s.rate)}
            </Text>
            <Text className="text-[9.5px] text-slate-400">
              {isMandatory ? '/ intake' : '/ test'}
            </Text>
          </View>

          {/* Compact Actions inside the row */}
          {canManage && (
            <View className="flex-row items-center gap-1">
              <TouchableOpacity
                onPress={() => setFormTarget({ mode: 'edit', service: s })}
                className="flex-row items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-0.5 shadow-2xs"
              >
                <Icon name="edit" size={10} color="#64748b" />
                <Text className="text-[10px] font-semibold text-slate-700">Edit</Text>
              </TouchableOpacity>
              {isSuperAdmin && (
                <TouchableOpacity
                  onPress={() => setDeleteTarget(s)}
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
    );
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
              Services & Pricing
            </Text>
            <View className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5">
              <Text className="text-[9.5px] font-bold text-blue-700">
                Workshop & Intake Rates
              </Text>
            </View>
          </View>
          <Text className="text-[11px] text-slate-500">
            Workshop testing rates, custom labor pricing, and mandatory intake fees.
          </Text>
        </View>

        {/* Action Buttons */}
        {canManage && (
          <View className="flex-row items-center gap-1.5 pt-0.5 flex-wrap">
            <TouchableOpacity
              onPress={() => setFormTarget({ mode: 'new', isMandatory: true })}
              className="flex-row items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 shadow-2xs"
            >
              <Icon name="shield" size={11} color="#b45309" />
              <Text className="text-[11px] font-bold text-amber-800">+ Fee</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFormTarget({ mode: 'new', isMandatory: false })}
              className="flex-row items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1 shadow-xs"
            >
              <Icon name="plus" size={11} color="#ffffff" />
              <Text className="text-[11px] font-bold text-white">Add Service</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live Counters Strip */}
        <View className="flex-row items-center gap-2 pt-1.5 border-t border-slate-100 flex-wrap">
          <Text className="text-[10.5px] text-slate-500">
            Total: <Text className="font-bold text-slate-900">{data?.length || 0}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-blue-700">
            Workshop: <Text className="font-bold">{standard.length}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-amber-700">
            Mandatory: <Text className="font-bold">{mandatory.length}</Text>
          </Text>
        </View>
      </View>

      {/* Toolbar: Search & Tab Chips — COMPACT */}
      <View className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-2xs gap-1.5">
        {/* Search input */}
        <View className="flex-row items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1">
          <Icon name="search" size={13} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search services…"
            placeholderTextColor="#94a3b8"
            className="flex-1 p-0 text-xs text-slate-800"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" size={12} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Tab Chips */}
        <View className="flex-row flex-wrap items-center gap-1">
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            className={`rounded-lg border px-2 py-0.5 ${
              activeTab === 'all'
                ? 'border-slate-900 bg-slate-900'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                activeTab === 'all' ? 'text-white' : 'text-slate-600'
              }`}
            >
              All ({data?.length || 0})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('workshop')}
            className={`flex-row items-center gap-0.5 rounded-lg border px-2 py-0.5 ${
              activeTab === 'workshop'
                ? 'border-blue-600 bg-blue-600'
                : 'border-blue-200 bg-blue-50'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                activeTab === 'workshop' ? 'text-white' : 'text-blue-700'
              }`}
            >
              Workshop ({standard.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('mandatory')}
            className={`flex-row items-center gap-0.5 rounded-lg border px-2 py-0.5 ${
              activeTab === 'mandatory'
                ? 'border-amber-600 bg-amber-600'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <Text
              className={`text-[10.5px] font-bold ${
                activeTab === 'mandatory' ? 'text-white' : 'text-amber-800'
              }`}
            >
              Mandatory ({mandatory.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ErrorBox text={error} />
      {deleteError && (
        <View className="rounded-xl border border-rose-200 bg-rose-50 p-2.5">
          <Text className="text-xs font-semibold text-rose-700">{deleteError}</Text>
        </View>
      )}

      {!data ? (
        <Text className="py-6 text-center text-xs text-slate-400">Loading services…</Text>
      ) : totalVisibleCount === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200/90 bg-white p-8">
          <Icon name="wrench" size={24} color="#94a3b8" />
          <Text className="mt-2 text-xs font-semibold text-slate-800">
            {search ? 'No services match your search.' : 'No records found.'}
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {/* Workshop Section */}
          {(activeTab === 'all' || activeTab === 'workshop') && filteredStandard.length > 0 && (
            <View className="gap-2">
              {activeTab === 'all' && (
                <View className="flex-row items-center gap-1.5 px-1 pt-1">
                  <Icon name="wrench" size={13} color="#2563eb" />
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Workshop & Testing Services ({filteredStandard.length})
                  </Text>
                </View>
              )}
              {filteredStandard.map((s, idx) => renderCard(s, idx, false))}
            </View>
          )}

          {/* Mandatory Fees Section */}
          {(activeTab === 'all' || activeTab === 'mandatory') && filteredMandatory.length > 0 && (
            <View className="gap-2">
              {activeTab === 'all' && (
                <View className="flex-row items-center gap-1.5 px-1 pt-2">
                  <Icon name="shield" size={13} color="#b45309" />
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Mandatory Intake Fees ({filteredMandatory.length})
                  </Text>
                </View>
              )}
              {filteredMandatory.map((s, idx) => renderCard(s, idx, true))}
            </View>
          )}
        </View>
      )}

      {/* Sheets & Dialogs */}
      <ServiceFormSheet
        target={formTarget}
        onSaved={() => {
          setFormTarget(null);
          load();
        }}
        onClose={() => setFormTarget(null)}
      />

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title={deleteTarget?.is_mandatory ? 'Delete Mandatory Fee' : 'Delete Service'}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Past batteries with this service logged will retain their history.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AlertDialog
        visible={Boolean(deleteError)}
        title="Cannot Delete Service"
        message={deleteError}
        onClose={() => setDeleteError(null)}
      />
    </ScrollView>
  );
}
