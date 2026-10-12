import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { PERMISSIONS } from '../../../components/admin/sa3/permissions';
import { Checkbox, ErrorBox, errMessage, Input, Label, PrimaryButton } from '../../../components/admin/sa3/ui';

// Add Admin / Edit Admin — the web UserForm: name, email, password (create
// only), role (Admin / Super Admin), module permissions for an admin, and
// the Active checkbox on edit.
// route.params: { user?, onSaved? }

export default function UserFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const target = route.params?.user || null;
  const isEdit = Boolean(target);

  const [form, setForm] = useState({
    name: target?.name || '',
    email: target?.email || '',
    password: '',
    role: target?.role || 'admin',
    permissions: target?.permissions || [],
    active: target?.active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Admin' : 'Add Admin' });
  }, [navigation, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const togglePermission = (key) =>
    setForm((f) => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key] }));

  async function submit() {
    setError(null);
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.email.trim()) return setError('Email is required.');
    if (!isEdit && !form.password) return setError('Password is required.');
    setSubmitting(true);
    try {
      if (isEdit) {
        await apiClient.patch(`/users/${target.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
          permissions: form.permissions,
          active: form.active,
        });
      } else {
        await apiClient.post('/users', form);
      }
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isAdmin = form.role === 'admin';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <Text className="text-xs text-slate-500">
          {isEdit ? 'Update this admin’s role, permissions, or status.' : 'Create an admin account and choose what it can access.'}
        </Text>
        <Input label="Name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Oliver Smith" />
        <Input label="Email" value={form.email} onChangeText={(v) => set('email', v)} placeholder="e.g. oliver.smith@refurbinics.com" keyboardType="email-address" autoCapitalize="none" />
        {!isEdit && (
          <Input label="Password" value={form.password} onChangeText={(v) => set('password', v)} secureTextEntry autoCapitalize="none" />
        )}
        <View>
          <Label>Role</Label>
          <View className="flex-row gap-2">
            {[{ value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super Admin' }].map((o) => (
              <TouchableOpacity key={o.value} onPress={() => set('role', o.value)} className={`flex-1 items-center rounded-xl border py-2.5 ${form.role === o.value ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                <Text className={`text-sm font-bold ${form.role === o.value ? 'text-white' : 'text-slate-700'}`}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isAdmin ? (
          <View>
            <Label>Permissions</Label>
            <Text className="mb-2 text-xs text-slate-500">Which modules this admin can access.</Text>
            <View className="flex-row flex-wrap gap-2">
              {PERMISSIONS.map((p) => {
                const on = form.permissions.includes(p.key);
                return (
                  <TouchableOpacity key={p.key} onPress={() => togglePermission(p.key)} className={`flex-row items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <View className={`h-3.5 w-3.5 items-center justify-center rounded ${on ? 'bg-emerald-600' : 'border border-slate-300'}`}>
                      {on ? <Icon name="check" color="#fff" size={10} /> : null}
                    </View>
                    <Text className={`text-xs font-medium ${on ? 'text-emerald-800' : 'text-slate-600'}`}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : form.role === 'recycle_client' ? (
          <Text className="text-xs text-slate-500">Recycle clients have access to their own dashboard and recycle shipments.</Text>
        ) : (
          <Text className="text-xs text-slate-500">Super admins have access to every module.</Text>
        )}

        {isEdit && (
          <Checkbox checked={form.active} onPress={() => set('active', !form.active)} label="Active (unchecking blocks this account from logging in)" />
        )}

        <ErrorBox message={error} />

        <View className="flex-row justify-end gap-2 border-t border-slate-200 pt-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-xl px-4 py-3">
            <Text className="text-sm font-medium text-slate-600">Cancel</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <PrimaryButton tone="emerald" onPress={submit} disabled={submitting} label={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Admin'} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
