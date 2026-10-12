import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import { ErrorBox, errMessage, Input, Label, PrimaryButton } from '../../../components/admin/sa3/ui';

// Create an Account — the web RegisterPage for a signed-in super admin:
// POST /auth/register always creates a Super Admin. It's called directly
// (not through the auth slice) so the current session is never touched.

export default function CreateAccountScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Create an Account' });
  }, [navigation]);

  async function submit() {
    setCreated(null);
    setError(null);
    if (!name.trim() || !email.trim()) return setError('Full Name and Email Address are required.');
    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      setCreated(data?.user?.email || email.trim().toLowerCase());
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const link = (label, screen, params) => (
    <Text className="font-bold text-emerald-800 underline" onPress={() => navigation.navigate(screen, params)}>{label}</Text>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="p-4 pb-24 gap-4" keyboardShouldPersistTaps="handled">
        <View>
          <Text className="text-2xl font-bold text-slate-900">Create an Account</Text>
          <Text className="mt-0.5 text-xs text-slate-500">Register new credentials to access the Refurbnics platform</Text>
        </View>

        {created && (
          <View className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <Text className="text-xs text-emerald-800">
              Account <Text className="font-bold">{created}</Text> created successfully! They can now sign in.
            </Text>
          </View>
        )}

        <Input label="Full Name" value={name} onChangeText={setName} placeholder="e.g. John Doe" />
        <Input label="Email Address" value={email} onChangeText={setEmail} placeholder="name@company.com" keyboardType="email-address" autoCapitalize="none" />
        <View>
          <Label>Password</Label>
          <View className="flex-row items-center rounded-xl border border-slate-200 bg-white pr-3">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 px-3.5 py-3 text-sm text-slate-900"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Icon name="eye" color={showPassword ? '#0d5c3a' : '#94a3b8'} size={16} />
            </TouchableOpacity>
          </View>
          <Text className="mt-1 text-[11px] text-slate-400">Must be at least 8 characters long</Text>
        </View>

        <View className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Text className="text-xs font-bold text-amber-900">👑 Creates a Super Admin account (full platform access)</Text>
          <Text className="mt-1 text-[11px] text-amber-800">
            Other accounts are made where their records live: {link('Fleet Clients', 'Directory', { tab: 'clients' })} (client logins),{' '}
            {link('Staff & Technicians', 'Directory', { tab: 'staff' })} (technicians, supervisors),{' '}
            {link('User Accounts', 'Users')} (admins with selected modules).
          </Text>
        </View>

        <ErrorBox message={error} />

        <PrimaryButton tone="emerald" onPress={submit} disabled={loading} label={loading ? 'Creating Account…' : 'Register Account'} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
