import { useLayoutEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { CLIENT_PERMISSIONS } from '../../../components/admin/sa3/permissions';
import { capitalizeWords, Checkbox, ErrorBox, errMessage, Input, Label, logoUrl, PrimaryButton } from '../../../components/admin/sa3/ui';

// Add / Edit Client — the web ClientForm: name, invoice email, logo, and the
// "Grant Login Access" block (email, temporary / reset password, active,
// dashboard permissions grouped with Select All / Clear All).
// route.params: { client?, onSaved? }

const ALL_KEYS = CLIENT_PERMISSIONS.map((p) => p.key);

export default function ClientFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const client = route.params?.client || null;
  const isEdit = Boolean(client);
  const hasExistingLogin = Boolean(client?.login_email);

  const [name, setName] = useState(client?.name || '');
  const [invoiceEmail, setInvoiceEmail] = useState(client?.invoice_email || '');
  const [batteryPrefix, setBatteryPrefix] = useState(client?.battery_prefix || '');
  const [grantLogin, setGrantLogin] = useState(hasExistingLogin);
  const [email, setEmail] = useState(client?.login_email || '');
  const [tempPassword, setTempPassword] = useState('');
  const [active, setActive] = useState(client?.user_active ?? true);
  const [permissions, setPermissions] = useState(
    Array.isArray(client?.user_permissions) && client.user_permissions.length > 0 ? client.user_permissions : ALL_KEYS
  );
  const [logoFile, setLogoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Client' : 'Add Client' });
  }, [navigation, isEdit]);

  const logoPreview = logoFile?.uri || logoUrl(client?.logo_path);

  async function pickLogo() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (a.size && a.size > 2 * 1024 * 1024) {
      setError('Logo must be 2MB or smaller.');
      return;
    }
    setLogoFile({ uri: a.uri, name: a.name || 'logo.png', type: a.mimeType || 'image/png' });
  }

  function togglePermission(key) {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Client Name is required.');
    if (grantLogin && !email.trim()) return setError('Email Address is required for login access.');
    if (grantLogin && !hasExistingLogin && !tempPassword) return setError('Temporary Password is required.');
    if (tempPassword && tempPassword.length < 8) return setError('Password must be at least 8 characters.');

    const fields = { name, invoiceEmail: invoiceEmail.trim() };
    // Blank on create = picked automatically; unchanged on edit = not sent
    if (batteryPrefix.trim() && batteryPrefix.trim() !== (client?.battery_prefix || '')) {
      fields.batteryPrefix = batteryPrefix.trim();
    }
    if (grantLogin || hasExistingLogin) {
      if (email) fields.email = email;
      if (tempPassword) fields.tempPassword = tempPassword;
      fields.permissions = JSON.stringify(permissions);
      fields.active = active ? 'true' : 'false';
    }

    setSubmitting(true);
    try {
      const url = isEdit ? `/clients/${client.id}` : '/clients';
      const method = isEdit ? 'patch' : 'post';
      if (logoFile) {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append('logo', logoFile);
        await apiClient[method](url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await apiClient[method](url, fields);
      }
      route.params?.onSaved?.();
      navigation.goBack();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const groups = CLIENT_PERMISSIONS.reduce((acc, p) => {
    (acc[p.group] = acc[p.group] || []).push(p);
    return acc;
  }, {});

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <Text className="text-xs text-slate-500">{isEdit ? 'Update this client’s details.' : 'Add a new client.'}</Text>

        <Input
          label="Client Name"
          required
          value={name}
          onChangeText={(v) => setName(capitalizeWords(v))}
          placeholder="e.g. Apex Fleet Logistics UK"
        />
        <Input
          label="Invoice / Billing Email (optional)"
          value={invoiceEmail}
          onChangeText={setInvoiceEmail}
          placeholder="e.g. accounts@clientfleet.co.uk"
          keyboardType="email-address"
          autoCapitalize="none"
          help="Invoices & statements will be sent to this email."
        />
        <Input
          label={`Battery Code Prefix${isEdit ? '' : ' (optional)'}`}
          value={batteryPrefix}
          onChangeText={(v) => setBatteryPrefix(v.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase())}
          placeholder={isEdit ? '' : 'Picked automatically, e.g. APE'}
          autoCapitalize="characters"
          help={`${batteryPrefix ? `Battery IDs look like ${batteryPrefix}-0000001. ` : ''}2–6 letters, unique to this client. ${isEdit ? 'Can only be changed while the client has no batteries.' : 'Leave blank to use the first free letters of the name.'}`}
        />

        <View>
          <Label>Client Logo</Label>
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {logoPreview ? (
                <Image source={{ uri: logoPreview }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <Icon name="photo" color="#cbd5e1" size={22} />
              )}
            </View>
            <View className="flex-1">
              <TouchableOpacity onPress={pickLogo} className="self-start rounded-lg bg-emerald-50 px-3 py-2">
                <Text className="text-xs font-semibold text-emerald-700">{logoFile ? logoFile.name : 'Choose file'}</Text>
              </TouchableOpacity>
              <Text className="mt-1 text-[11px] text-slate-400">
                PNG, JPEG, WEBP, or SVG, up to 2MB. Shown on this client's own dashboard.
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Checkbox
            checked={grantLogin}
            onPress={() => setGrantLogin((v) => !v)}
            label={hasExistingLogin ? 'Client Portal Login & Permissions' : 'Grant Login Access'}
            sub="Control portal login credentials and configure which dashboard features this client can access."
          />

          {grantLogin && (
            <View className="mt-4 gap-4 border-t border-slate-200 pt-4">
              <Input
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. client@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label={hasExistingLogin ? 'Reset Password (optional)' : 'Temporary Password'}
                value={tempPassword}
                onChangeText={setTempPassword}
                placeholder={hasExistingLogin ? 'Leave blank to keep existing' : 'One-time password'}
                autoCapitalize="none"
              />
              {hasExistingLogin && (
                <Checkbox
                  checked={active}
                  onPress={() => setActive((v) => !v)}
                  label="Account Active (unchecking prevents this client from logging in)"
                />
              )}

              <View className="rounded-lg border border-slate-200 bg-white p-3.5">
                <View className="border-b border-slate-100 pb-2.5">
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-800">Dashboard Access Permissions</Text>
                  <Text className="text-[11px] text-slate-500">Check the tabs and modules visible on this client’s portal.</Text>
                  <View className="mt-2 flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => setPermissions(ALL_KEYS)} hitSlop={6}>
                      <Text className="text-[11px] font-semibold text-emerald-600">Select All</Text>
                    </TouchableOpacity>
                    <Text className="text-slate-300">•</Text>
                    <TouchableOpacity onPress={() => setPermissions([])} hitSlop={6}>
                      <Text className="text-[11px] font-medium text-slate-500">Clear All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {Object.entries(groups).map(([group, perms]) => (
                  <View key={group} className="mt-3.5">
                    <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group}</Text>
                    <View className="gap-2">
                      {perms.map((p) => {
                        const on = permissions.includes(p.key);
                        return (
                          <TouchableOpacity
                            key={p.key}
                            onPress={() => togglePermission(p.key)}
                            className={`flex-row items-start gap-2.5 rounded-lg border p-2 ${on ? 'border-emerald-500/60 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                          >
                            <View className={`mt-0.5 h-4 w-4 items-center justify-center rounded border ${on ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                              {on ? <Icon name="check" color="#fff" size={11} /> : null}
                            </View>
                            <View className="flex-1">
                              <Text className={`text-xs font-semibold ${on ? 'text-emerald-950' : 'text-slate-600'}`}>{p.label}</Text>
                              <Text className="text-[10px] text-slate-500">{p.desc}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

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
              label={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
