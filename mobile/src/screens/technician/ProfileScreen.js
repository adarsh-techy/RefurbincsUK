import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { logout, setUser } from '../../store/auth-slice';

const CLIENT_LINKS = [
  { to: 'BatterySorting', label: 'Battery Sorting', hint: 'Group batteries by requirement' },
  { to: 'Invoices', label: 'Invoices & Bills', hint: 'Download billing PDFs' },
  { to: 'Transactions', label: 'Transactions', hint: 'Repair billing history' },
  { to: 'ClientNotifications', label: 'Notifications', hint: 'Fleet activity feed' },
  { to: 'Support', label: 'Help & Support', hint: 'Message the service team' },
];

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function closePasswordForm() {
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit() {
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', { newPassword });
      dispatch(setUser(data.user));
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isClient = user?.role === 'client';

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-slate-950" contentContainerClassName="p-5 pb-16">
      <Text className="text-2xl font-black text-slate-900 dark:text-white">Account Profile</Text>
      <Text className="mb-6 text-xs text-slate-500 dark:text-slate-400">Manage your portal credentials and security settings.</Text>

      {/* Account Info Card */}
      <View className="mb-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl">
        <Text className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Account Details</Text>
        
        <View className="mb-3.5 flex-row justify-between items-center border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Name / Company</Text>
          <Text className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</Text>
        </View>

        <View className="mb-3.5 flex-row justify-between items-center border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Account Type</Text>
          <View className="rounded-full bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 border border-blue-200 dark:border-blue-800/40">
            <Text className="text-xs font-bold capitalize text-blue-600 dark:text-blue-400">
              {isClient
                ? 'Client Account'
                : user?.staff_role
                  ? user.staff_role.charAt(0).toUpperCase() + user.staff_role.slice(1)
                  : 'Technician'}
            </Text>
          </View>
        </View>

        {!isClient && (
          <View className="mb-3.5 flex-row justify-between items-center border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Testing Access</Text>
            <Text
              className={`text-xs font-bold ${
                user?.staff_role === 'supervisor' || user?.staff_role === 'manager'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {user?.staff_role === 'supervisor' || user?.staff_role === 'manager'
                ? 'Authorized'
                : 'Supervisors & Managers only'}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between items-center">
          <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Email Address</Text>
          <Text className="text-sm font-medium text-slate-600 dark:text-slate-300">{user?.email}</Text>
        </View>
      </View>

      {/* Quick Links (client only) */}
      {isClient && (
        <View className="mb-5 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          <Text className="px-5 pt-5 pb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Account & More
          </Text>
          {CLIENT_LINKS.map((link, i) => (
            <TouchableOpacity
              key={link.to}
              onPress={() => navigation.navigate(link.to)}
              className={`flex-row items-center justify-between px-5 py-3.5 active:bg-slate-100 dark:active:bg-slate-800 ${
                i < CLIENT_LINKS.length - 1 ? 'border-b border-slate-200/80 dark:border-slate-800/80' : ''
              }`}
            >
              <View>
                <Text className="text-sm font-bold text-slate-900 dark:text-white">{link.label}</Text>
                <Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{link.hint}</Text>
              </View>
              <Text className="text-sm font-bold text-slate-400 dark:text-slate-500">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Password Change Card */}
      <View className="mb-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl">
        {showPasswordForm ? (
          <>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Change Password</Text>
              <TouchableOpacity onPress={closePasswordForm}>
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-400">Cancel</Text>
              </TouchableOpacity>
            </View>
            <View className="gap-3.5">
              <View>
                <Text className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">New Password</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Enter new password"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-blue-500"
                />
              </View>
              <View>
                <Text className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Confirm Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Re-type new password"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-white focus:border-blue-500"
                />
              </View>

              {error && <Text className="text-xs font-medium text-red-600 dark:text-red-400">{error}</Text>}
              {success && <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Password updated successfully.</Text>}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                className="mt-2 items-center rounded-2xl bg-blue-600 py-3.5 shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm font-bold text-white">Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => setShowPasswordForm(true)}
            className="flex-row items-center justify-between py-1"
          >
            <View>
              <Text className="text-sm font-bold text-slate-900 dark:text-white">Change Account Password</Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Update your secure login passkey</Text>
            </View>
            <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">Edit ›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={() => dispatch(logout())}
        className="items-center rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 py-4 shadow-sm active:bg-red-50 dark:active:bg-red-950/40"
      >
        <Text className="text-sm font-bold text-red-600 dark:text-red-400 tracking-wide">Sign Out of Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
