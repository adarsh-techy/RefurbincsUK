import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import apiClient from '../../services/api-client';
import { logout, setUser } from '../../store/auth-slice';

// Forced first-login screen for accounts created with an admin-issued temp
// password. Blocks everything else until a real password is set.
export default function SetPasswordScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', { newPassword });
      dispatch(setUser(data.user));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 justify-center bg-slate-50 px-6">
      <View className="mb-6 items-center">
        <Text className="text-lg font-semibold text-slate-900">Set Your Password</Text>
        <Text className="mt-1 text-center text-sm text-slate-500">
          Welcome{user?.name ? `, ${user.name}` : ''} — choose a permanent password to replace
          your temporary one.
        </Text>
      </View>

      <View className="gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <View>
          <Text className="mb-1.5 text-sm font-medium text-slate-700">New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            className="rounded-md border border-blue-200 bg-white px-3.5 py-3 text-base text-slate-900"
          />
        </View>
        <View>
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Confirm Password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            className="rounded-md border border-blue-200 bg-white px-3.5 py-3 text-base text-slate-900"
          />
        </View>

        {error && <Text className="text-sm text-red-600">{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-1 items-center rounded-md bg-blue-600 py-3.5 disabled:opacity-50"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Set Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => dispatch(logout())} className="items-center py-2">
          <Text className="text-sm font-medium text-slate-500">Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
