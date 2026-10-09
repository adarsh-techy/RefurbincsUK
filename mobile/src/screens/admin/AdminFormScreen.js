import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import { ADMIN_FORMS } from './adminForms';

// One create/edit screen for every admin entity (see adminForms.js).
// route.params: { kind, row?, onSaved? } — `row` present = edit.

function capitalizeWords(value) {
  return value.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());
}

function SelectField({ field, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));
  if (options.length <= 4) {
    return (
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const on = String(o.value) === String(value);
          return (
            <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} className={`rounded-xl border px-3 py-2 ${on ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
              <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-700'}`}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} className="flex-row items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3">
        <Text className={`text-sm ${selected ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{selected ? selected.label : `Select ${field.label.toLowerCase()}`}</Text>
        <Text className="text-slate-400">▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/50">
          <View className="max-h-[70%] rounded-t-3xl bg-white p-4">
            <Text className="mb-2 text-base font-extrabold text-slate-900">{field.label}</Text>
            <ScrollView>
              {options.map((o) => (
                <TouchableOpacity key={o.value} onPress={() => { onChange(o.value); setOpen(false); }} className={`rounded-xl px-3 py-3 ${String(o.value) === String(value) ? 'bg-violet-50' : ''}`}>
                  <Text className="text-sm font-semibold text-slate-800">{o.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function AdminFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { kind, row } = route.params || {};
  const config = ADMIN_FORMS[kind];
  const isEdit = Boolean(row?.id);
  const [values, setValues] = useState(() => {
    const base = {};
    for (const f of config?.fields || []) {
      base[f.key] = f.type === 'toggle' ? false : f.type === 'multiselect' ? [] : f.type === 'file' ? null : '';
    }
    return { ...base, ...(config?.defaults || {}), ...(isEdit ? config.fromRow(row) : {}) };
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [dynamicOptions, setDynamicOptions] = useState({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: `${isEdit ? 'Edit' : 'Add'} ${config?.title || ''}` });
  }, [navigation, isEdit, config]);

  useEffect(() => {
    if (!config?.fields.some((f) => f.optionsFrom === 'clients')) return;
    apiClient.get('/clients').then(({ data }) => {
      const list = (Array.isArray(data) ? data : data?.data || []).filter((c) => c.user_role !== 'recycle_client');
      setDynamicOptions((o) => ({ ...o, clients: list.map((c) => ({ value: String(c.id), label: c.name })) }));
    }).catch(() => {});
  }, [config]);

  // New service / reason: default the order to the next free number (like the web)
  useEffect(() => {
    if (isEdit || !config?.nextOrderFrom) return;
    apiClient.get(config.nextOrderFrom).then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.data || [];
      const next = list.length ? Math.max(...list.map((r) => Number(r.sort_order) || 0)) + 1 : 0;
      setValues((s) => ({ ...s, sortOrder: String(next) }));
    }).catch(() => {});
  }, [config, isEdit]);

  const visibleFields = useMemo(
    () => (config?.fields || []).filter((f) => !(isEdit && f.createOnly) && !(!isEdit && f.editOnly)),
    [config, isEdit]
  );

  if (!config) {
    return <View className="flex-1 items-center justify-center"><Text>Unknown form</Text></View>;
  }

  function set(key, v) {
    setValues((s) => ({ ...s, [key]: v }));
    setErrors((e) => ({ ...e, [key]: null }));
  }

  async function pickFile(field) {
    const res = await DocumentPicker.getDocumentAsync({ type: field.accept || '*/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    set(field.key, { uri: a.uri, name: a.name || 'upload', type: a.mimeType || 'application/octet-stream', size: a.size });
  }

  function validate() {
    const next = {};
    for (const f of visibleFields) {
      const v = values[f.key];
      const requiredHere = f.required && !(isEdit && f.createRequiredOnly);
      if (requiredHere && (v === '' || v == null || (Array.isArray(v) && v.length === 0))) next[f.key] = `${f.label} is required`;
      if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) next[f.key] = 'Enter a valid email';
      if (f.type === 'password' && v && v.length < 8) next[f.key] = 'At least 8 characters';
      if (f.type === 'number' && v !== '' && v != null && !Number.isFinite(Number(v))) next[f.key] = 'Enter a number';
      if (f.type === 'date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) next[f.key] = 'Use YYYY-MM-DD';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    setServerError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = config.toPayload(values, { isEdit });
      const hasFile = Object.values(payload).some((v) => v && typeof v === 'object' && v.uri);
      const url = isEdit ? `${config.endpoint}/${row.id}` : config.endpoint;
      const method = isEdit ? 'patch' : 'post';
      if (hasFile) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(payload)) {
          if (v === undefined || v === null) continue;
          if (typeof v === 'object' && v.uri) fd.append(k, { uri: v.uri, name: v.name, type: v.type });
          else fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
        }
        await apiClient[method](url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
        await apiClient[method](url, clean);
      }
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (err) {
      setServerError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Delete this ${config.title.toLowerCase()}?`, 'This cannot be undone. A copy is kept in the Trash Bin.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiClient.delete(`${config.endpoint}/${row.id}`);
            route.params?.onSaved?.();
            navigation.goBack();
          } catch (err) {
            setServerError(err.response?.data?.message || err.message);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        {serverError && (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs font-semibold text-red-700">{serverError}</Text>
          </View>
        )}
        {visibleFields.map((f) => {
          const v = values[f.key];
          const err = errors[f.key];
          const options = f.optionsFrom ? dynamicOptions[f.optionsFrom] || [] : f.options || [];
          const requiredHere = f.required && !(isEdit && f.createRequiredOnly);
          return (
            <View key={f.key}>
              {f.type !== 'toggle' && (
                <Text className="mb-1.5 text-xs font-bold text-slate-600">
                  {f.label}{requiredHere ? <Text className="text-red-500"> *</Text> : null}
                </Text>
              )}
              {['text', 'email', 'number', 'password', 'date'].includes(f.type) && (
                <TextInput
                  value={String(v ?? '')}
                  onChangeText={(t) => set(f.key, f.capitalize ? capitalizeWords(t) : t)}
                  placeholder={f.placeholder || (f.type === 'date' ? 'YYYY-MM-DD' : '')}
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={f.type === 'password'}
                  keyboardType={f.type === 'number' ? 'decimal-pad' : f.type === 'email' ? 'email-address' : 'default'}
                  autoCapitalize={f.type === 'email' || f.type === 'password' ? 'none' : 'sentences'}
                  autoCorrect={false}
                  className={`rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 ${err ? 'border-red-400' : 'border-slate-300'}`}
                />
              )}
              {f.type === 'multiline' && (
                <TextInput value={v} onChangeText={(t) => set(f.key, t)} multiline placeholder={f.placeholder} placeholderTextColor="#94a3b8" className="min-h-[90px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" style={{ textAlignVertical: 'top' }} />
              )}
              {f.type === 'select' && <SelectField field={f} value={v} onChange={(x) => set(f.key, x)} options={options} />}
              {f.type === 'toggle' && (
                <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Text className="flex-1 pr-3 text-sm font-semibold text-slate-800">{f.label}</Text>
                  <Switch value={Boolean(v)} onValueChange={(x) => set(f.key, x)} />
                </View>
              )}
              {f.type === 'multiselect' && (
                <View className="flex-row flex-wrap gap-2">
                  {options.map((o) => {
                    const on = (v || []).includes(o.value);
                    return (
                      <TouchableOpacity key={o.value} onPress={() => set(f.key, on ? v.filter((x) => x !== o.value) : [...(v || []), o.value])} className={`rounded-xl border px-3 py-1.5 ${on ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                        <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{on ? '✓ ' : ''}{o.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {f.type === 'file' && (
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity onPress={() => pickFile(f)} className="flex-row items-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3">
                    <Icon name="photo" color="#7c3aed" size={16} />
                    <Text className="text-xs font-bold text-violet-700">{v ? 'Change file' : 'Choose file'}</Text>
                  </TouchableOpacity>
                  {v ? (
                    <View className="flex-1 flex-row items-center gap-2">
                      <Text className="flex-1 text-xs text-slate-600" numberOfLines={1}>{v.name}</Text>
                      <TouchableOpacity onPress={() => set(f.key, null)} hitSlop={8}><Icon name="x" color="#64748b" size={14} /></TouchableOpacity>
                    </View>
                  ) : isEdit ? <Text className="flex-1 text-[11px] text-slate-400">Leave empty to keep the current file</Text> : null}
                </View>
              )}
              {f.help && !err ? <Text className="mt-1 text-[11px] text-slate-400">{f.help}</Text> : null}
              {err ? <Text className="mt-1 text-[11px] font-semibold text-red-600">{err}</Text> : null}
            </View>
          );
        })}

        <TouchableOpacity disabled={saving} onPress={save} className={`mt-2 items-center rounded-2xl bg-emerald-600 py-4 ${saving ? 'opacity-60' : ''}`}>
          <Text className="text-base font-bold text-white">{saving ? 'Saving…' : isEdit ? 'Save changes' : `Add ${config.title.toLowerCase()}`}</Text>
        </TouchableOpacity>
        {isEdit && config.deletable && (
          <TouchableOpacity onPress={confirmDelete} className="items-center rounded-2xl border border-red-200 bg-red-50 py-3">
            <Text className="text-sm font-bold text-red-700">Delete</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
