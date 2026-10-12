import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { Checkbox, ErrorBox, errMessage, Input, PrimaryButton } from '../../../components/admin/sa3/ui';

// Add Recycle Client / Edit <name> — the web RecycleClientForm. Creating
// needs the partner login (email + temporary password, role recycle_client).
// Editing on the web changes the name only; the phone also keeps the login
// controls it already had (login email, password reset, active).
// route.params: { client?, onSaved? }

const capitalizeFirst = (val) => (val ? val.charAt(0).toUpperCase() + val.slice(1) : '');

export default function RecycleClientFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const client = route.params?.client || null;
  const isEdit = Boolean(client);

  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(isEdit ? client?.login_email || '' : '');
  const [tempPassword, setTempPassword] = useState('');
  const [active, setActive] = useState(client?.user_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? `Edit ${client.name}` : 'Add Recycle Client' });
  }, [navigation, isEdit, client]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Recycle Client Name is required.');
    if (!isEdit && !email.trim()) return setError('Email is required.');
    if (!isEdit && !tempPassword) return setError('Temporary Password is required.');
    if (tempPassword && tempPassword.length < 8) return setError('Password must be at least 8 characters.');
    setSubmitting(true);
    try {
      const formattedName = capitalizeFirst(name.trim());
      if (isEdit) {
        const body = { name: formattedName };
        if (client.login_email) {
          if (email.trim() && email.trim() !== client.login_email) body.email = email.trim();
          if (tempPassword) body.tempPassword = tempPassword;
          body.active = active ? 'true' : 'false';
        }
        await apiClient.patch(`/clients/${client.id}`, body);
      } else {
        await apiClient.post('/clients', { name: formattedName, email, tempPassword, role: 'recycle_client' });
      }
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <Input
          label="Recycle Client Name"
          required
          value={name}
          onChangeText={(v) => setName(capitalizeFirst(v))}
          placeholder="e.g. EcoRecycle Solutions"
        />

        {!isEdit ? (
          <View className="rounded-lg border border-slate-200 bg-white p-3.5">
            <Text className="text-sm font-medium text-slate-700">Partner login</Text>
            <Text className="mt-1 text-xs text-slate-500">
              Required: the partner signs in to see their assigned battery shipments, and the login is what marks this
              account as a recycling partner (not a fleet client).
            </Text>
            <View className="mt-3 gap-3">
              <Input
                label="Email"
                required
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. partner@ecorecycle.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Temporary Password"
                required
                value={tempPassword}
                onChangeText={setTempPassword}
                placeholder="One-time password — they'll set their own on first login"
                autoCapitalize="none"
              />
            </View>
          </View>
        ) : client.login_email ? (
          <View className="rounded-lg border border-slate-200 bg-white p-3.5 gap-3">
            <Text className="text-sm font-medium text-slate-700">Partner login</Text>
            <Input label="Login Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Input
              label="Reset Password (optional)"
              value={tempPassword}
              onChangeText={setTempPassword}
              placeholder="Leave blank to keep existing"
              autoCapitalize="none"
            />
            <Checkbox checked={active} onPress={() => setActive((v) => !v)} label="Account Active (unchecking prevents this partner from logging in)" />
          </View>
        ) : null}

        <ErrorBox message={error} />

        <View className="flex-row justify-end gap-2 border-t border-slate-200 pt-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-xl px-4 py-3">
            <Text className="text-sm font-medium text-slate-600">Cancel</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <PrimaryButton
              tone="emerald"
              onPress={submit}
              disabled={submitting}
              label={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recycle Client'}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
