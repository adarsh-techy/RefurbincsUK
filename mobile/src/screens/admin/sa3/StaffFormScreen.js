import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { capitalizeWords, ErrorBox, errMessage, Input, Label, PrimaryButton } from '../../../components/admin/sa3/ui';

// Add Staff Member / Edit Staff Details — the web StaffForm:
//   1. Personal & Employment Profile (active toggle on edit, name, role, email, phone)
//   2. Right to Work & Compliance Credentials (passport, NI, share code, document)
//   3. Portal Access & Login Credentials (create only: login email, temp password,
//      Generate, show/hide)
// Section 1 also has the Monthly / Contract Wage field (same as the web form;
// blank = Standard Hourly).
// route.params: { staff?, onSaved? }

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let out = '';
  for (let i = 0; i < 10; i += 1) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function SectionHeader({ number, title, sub, right }) {
  return (
    <View className="flex-row items-center justify-between gap-2 border-b border-slate-200 pb-3">
      <View className="flex-1">
        <Text className="text-xs font-black uppercase tracking-wider text-slate-900">{number}. {title}</Text>
        {sub ? <Text className="text-[11px] text-slate-500">{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export default function StaffFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const staff = route.params?.staff || null;
  const isEdit = Boolean(staff);

  const [form, setForm] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    email: staff?.email || staff?.login_email || '',
    role: staff?.role || 'technician',
    active: staff?.active ?? true,
    passportNumber: staff?.passport_number || '',
    niNumber: staff?.ni_number || '',
    shareCode: staff?.share_code || '',
    salary: staff?.salary != null && Number(staff.salary) > 0 ? String(staff.salary) : '',
  });
  const [docFile, setDocFile] = useState(null);
  const [grantLogin, setGrantLogin] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: route.params?.title || (isEdit ? 'Edit Staff Details' : 'Add Staff Member'),
    });
  }, [navigation, isEdit, route.params?.title]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function pickDoc() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (a.size && a.size > 15 * 1024 * 1024) {
      setError('The document must be 15MB or smaller.');
      return;
    }
    setDocFile({ uri: a.uri, name: a.name || 'document', type: a.mimeType || 'application/octet-stream', size: a.size });
  }

  async function submit() {
    setError(null);
    if (!form.name.trim()) return setError('Staff Full Name is required.');
    if (!isEdit && grantLogin) {
      if (!form.email.trim()) return setError('Login Email is required.');
      if (tempPassword.trim().length < 8) return setError('Temp Password must be at least 8 characters.');
    }
    if (form.salary !== '' && !Number.isFinite(Number(form.salary))) return setError('Wage must be a number.');

    const fields = { name: form.name.trim(), role: form.role || 'technician' };
    if (form.phone) fields.phone = form.phone.trim();
    if (form.email) fields.email = form.email.trim().toLowerCase();
    if (form.passportNumber) fields.passportNumber = form.passportNumber.trim();
    if (form.niNumber) fields.niNumber = form.niNumber.trim().toUpperCase();
    if (form.shareCode) fields.shareCode = form.shareCode.trim().toUpperCase();
    if (form.salary !== '') fields.salary = String(Number(form.salary));
    else if (isEdit && Number(staff?.salary) > 0) fields.salary = '0';
    if (isEdit) {
      fields.active = String(form.active);
    } else if (grantLogin) {
      fields.loginEmail = (form.email || '').trim().toLowerCase();
      fields.tempPassword = tempPassword.trim();
    }

    setSubmitting(true);
    try {
      const url = isEdit ? `/staff/${staff.id}` : '/staff';
      const method = isEdit ? 'patch' : 'post';
      if (docFile) {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
        fd.append('docFile', { uri: docFile.uri, name: docFile.name, type: docFile.type });
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


  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-5" keyboardShouldPersistTaps="handled">
        <Text className="text-xs text-slate-500">
          {isEdit
            ? 'Update this staff member’s profile and compliance credentials.'
            : 'Enroll a new technician or workshop employee with role permissions and compliance docs.'}
        </Text>

        {/* 1. Personal & Employment */}
        <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <SectionHeader
            number={1}
            title="Personal & Employment Profile"
            right={isEdit ? (
              <TouchableOpacity onPress={() => set('active', !form.active)} className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                <View className={`h-4 w-4 items-center justify-center rounded ${form.active ? 'bg-emerald-600' : 'border border-slate-300'}`}>
                  {form.active ? <Icon name="check" color="#fff" size={11} /> : null}
                </View>
                <Text className={`text-xs font-bold ${form.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {form.active ? 'Active Employee' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            ) : null}
          />
          <Input label="Staff Full Name" required value={form.name} onChangeText={(v) => set('name', capitalizeWords(v))} placeholder="e.g. Harry Taylor" />
          <View>
            <Label required>Workshop Role</Label>
            <View className="gap-2">
              {[
                { value: 'technician', label: 'Technician — Workshop Repairs only', on: 'border-blue-600 bg-blue-50', text: 'text-blue-600' },
                { value: 'supervisor', label: 'Supervisor — Repairs & Testing Signoff', on: 'border-red-600 bg-red-50', text: 'text-red-600' },
              ].map((o) => (
                <TouchableOpacity key={o.value} onPress={() => set('role', o.value)} className={`rounded-xl border px-3.5 py-3 ${form.role === o.value ? o.on : 'border-slate-200 bg-white'}`}>
                  <Text className={`text-sm font-semibold ${o.text}`}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Input label="Email Address" value={form.email} onChangeText={(v) => set('email', v)} placeholder="e.g. harry.taylor@refurbinics.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone Number" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="e.g. +44 7700 900123" keyboardType="phone-pad" />
          <Input label="Monthly / Contract Wage (£)" value={form.salary} onChangeText={(v) => set('salary', v)} placeholder="Leave blank for Standard Hourly" keyboardType="decimal-pad" />
        </View>

        {/* 2. Right to Work */}
        <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <SectionHeader number={2} title="Right to Work & Compliance Credentials" />
          <Input label="Passport Number" value={form.passportNumber} onChangeText={(v) => set('passportNumber', v)} placeholder="e.g. 123456789" autoCapitalize="characters" />
          <Input label="National Insurance (NI)" value={form.niNumber} onChangeText={(v) => set('niNumber', v.toUpperCase())} placeholder="e.g. QQ 12 34 56 A" autoCapitalize="characters" />
          <Input label="Share Code (Right to Work)" value={form.shareCode} onChangeText={(v) => set('shareCode', v.toUpperCase())} placeholder="e.g. W12 345 678" autoCapitalize="characters" />
          <View>
            <Label>Compliance / Identity Document (PDF or Photo)</Label>
            <TouchableOpacity onPress={pickDoc} className="items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5">
              <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Icon name="package" color="#2563eb" size={20} />
              </View>
              <Text className="text-xs font-bold text-slate-800">{docFile ? docFile.name : 'Tap to choose a compliance file'}</Text>
              <Text className="mt-1 text-[11px] text-slate-400">Supported formats: PDF, PNG, JPG, WebP (Max 15MB)</Text>
            </TouchableOpacity>
            {docFile ? (
              <View className="mt-2.5 flex-row items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2">
                <Text className="flex-1 text-xs font-semibold text-blue-900" numberOfLines={1}>
                  {docFile.name}{docFile.size ? ` (${(docFile.size / 1024 / 1024).toFixed(2)} MB)` : ''}
                </Text>
                <TouchableOpacity onPress={() => setDocFile(null)} hitSlop={8}>
                  <Text className="text-xs font-bold text-red-600">Remove</Text>
                </TouchableOpacity>
              </View>
            ) : isEdit && staff.document_path ? (
              <View className="mt-2.5 flex-row items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2">
                <Text className="flex-1 text-xs text-slate-700" numberOfLines={1}>
                  Saved Document: <Text className="font-bold">{staff.document_name || staff.document_path}</Text>
                </Text>
                <Text className="text-[11px] font-bold text-emerald-600">Verified On File</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 3. Portal access (create only) */}
        {!isEdit && (
          <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <SectionHeader
              number={3}
              title="Portal Access & Login Credentials"
              sub="Enable technician access to log in, scan QR codes, and record repairs."
              right={<Switch value={grantLogin} onValueChange={setGrantLogin} trackColor={{ true: '#2563eb' }} />}
            />
            {grantLogin && (
              <>
                <Input label="Login Email" required value={form.email} onChangeText={(v) => set('email', v)} placeholder="e.g. technician@refurbinics.com" keyboardType="email-address" autoCapitalize="none" />
                <View>
                  <View className="mb-1.5 flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wide text-slate-700">Temp Password<Text className="text-red-500"> *</Text></Text>
                    <TouchableOpacity onPress={() => setTempPassword(generatePassword())} hitSlop={6} className="flex-row items-center gap-1">
                      <Icon name="rotateCcw" color="#2563eb" size={12} />
                      <Text className="text-[11px] font-bold text-blue-600">Generate</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-center rounded-xl border border-slate-200 bg-white pr-3">
                    <TextInput
                      value={tempPassword}
                      onChangeText={setTempPassword}
                      placeholder="Min 8 characters"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="min-w-0 flex-1 px-3.5 py-3 font-mono text-sm text-slate-900"
                    />
                    <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                      <Icon name="eye" color={showPassword ? '#2563eb' : '#94a3b8'} size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        <ErrorBox message={error} />

        <View className="flex-row justify-end gap-2 border-t border-slate-200 pt-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="rounded-xl px-4 py-3">
            <Text className="text-xs font-bold text-slate-600">Cancel</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <PrimaryButton
              tone="blue"
              onPress={submit}
              disabled={submitting}
              label={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
