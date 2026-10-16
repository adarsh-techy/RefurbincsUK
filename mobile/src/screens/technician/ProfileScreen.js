import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { logout, setUser, setToken } from '../../store/auth-slice';
import SuccessPopup from '../../components/technician/SuccessPopup';
import ZebraScannerCard from '../../components/scan/ZebraScannerCard';
import Icon from '../../components/ui/Icon';
import { hasClientPermission } from '../../utils/permissions';

// Client "Account & More" — mirrors the portal navigation links
const CLIENT_LINKS = [
  {
    to: 'ClientHistory',
    label: 'Service History',
    hint: 'Track repair visits, dispatches & returns',
    icon: 'clock',
    iconColor: '#2563eb',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40',
  },
  {
    to: 'BatterySorting',
    label: 'Battery Sorting',
    hint: 'Categorize batteries by pack requirement',
    permission: 'client_battery_sorting',
    icon: 'battery',
    iconColor: '#059669',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40',
  },
  {
    to: 'Invoices',
    label: 'Invoices & Bills',
    hint: 'Review statements & settlement receipts',
    permission: 'client_invoices',
    icon: 'fileText',
    iconColor: '#7c3aed',
    iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/40',
  },
  {
    to: 'Transactions',
    label: 'Transactions Ledger',
    hint: 'Credit lines, charges and billing logs',
    permission: 'client_transactions',
    icon: 'card',
    iconColor: '#d97706',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40',
  },
  {
    to: 'ClientCertificates',
    label: 'ESG & Eco Certificates',
    hint: 'Verified recycling & environmental credits',
    icon: 'award',
    iconColor: '#0d9488',
    iconBg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/40',
  },
  {
    to: 'ClientParts',
    label: 'Parts Inventory',
    hint: 'Warehouse stock and reorder thresholds',
    icon: 'package',
    iconColor: '#0284c7',
    iconBg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-100 dark:border-sky-900/40',
  },
  {
    to: 'ClientNotifications',
    label: 'Notifications',
    hint: 'Real-time fleet events & status updates',
    permission: 'client_notifications',
    icon: 'bell',
    iconColor: '#4f46e5',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/40',
  },
  {
    to: 'Support',
    label: 'Help & Support Desk',
    hint: 'Reach dedicated engineering support',
    permission: 'client_support',
    icon: 'headphones',
    iconColor: '#059669',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40',
  },
];

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const user = useSelector((state) => state.auth.user);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function closePasswordForm() {
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit() {
    setSuccess(false);
    if (!currentPassword) {
      setError('Enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      if (data.token) await dispatch(setToken(data.token));
      dispatch(setUser(data.user));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your active session and sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ]
    );
  }

  const isClient = user?.role === 'client';
  const isWorkshop =
    !isClient &&
    !['super_admin', 'admin', 'staff', 'recycle_client'].includes(user?.role);
  const canTest =
    (user?.staff_role || user?.staffRole || user?.role || '')
      .trim()
      .toLowerCase() === 'supervisor';
  const clientLinks = CLIENT_LINKS.filter(
    (l) => !l.permission || hasClientPermission(user, l.permission)
  );

  const roleLabel = isClient
    ? 'Client Fleet Account'
    : user?.role === 'super_admin'
      ? 'Super Admin'
      : user?.role === 'admin'
        ? 'Operations Admin'
        : user?.role === 'staff'
          ? 'Office Staff'
          : user?.role === 'recycle_client'
            ? 'Recycle Partner'
            : user?.staff_role
              ? user.staff_role.charAt(0).toUpperCase() + user.staff_role.slice(1)
              : 'Field Technician';

  const userInitials = (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerClassName="p-3.5 pb-20 gap-3"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero Identity Banner */}
      <View className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
        <View className="flex-row items-center gap-4">
          {/* Avatar Initials Badge */}
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/60 shadow-sm">
            <Text className="text-lg font-black tracking-wider text-blue-700 dark:text-blue-300">
              {userInitials || 'U'}
            </Text>
          </View>

          {/* User & Role Details */}
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-extrabold text-slate-900 dark:text-white" numberOfLines={1}>
                {user?.name || 'Account User'}
              </Text>
            </View>

            <View className="mt-1 flex-row items-center gap-2">
              <View className="rounded-full border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5">
                <Text className="text-[10px] font-bold tracking-wide text-blue-700 dark:text-blue-300 uppercase">
                  {roleLabel}
                </Text>
              </View>

              <View className="flex-row items-center gap-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <Text className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Active
                </Text>
              </View>
            </View>

            {user?.email && (
              <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
                {user.email}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Account Details Card */}
      <View className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
        <View className="mb-3 flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
          <View className="flex-row items-center gap-2">
            <Icon name="user" size={15} color="#64748b" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Account Credentials
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon name="shield" size={13} color="#059669" />
            <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Verified
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <View className="flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isWorkshop ? 'Staff Member' : 'Account Name'}
            </Text>
            <Text className="text-xs font-bold text-slate-900 dark:text-white">
              {user?.name || '—'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Account Email
            </Text>
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {user?.email || '—'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Role Authority
            </Text>
            <Text className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {roleLabel}
            </Text>
          </View>

          {isWorkshop && (
            <View className="flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
              <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Testing QA Sign-off
              </Text>
              <View className="flex-row items-center gap-1.5">
                <View
                  className={`h-2 w-2 rounded-full ${canTest ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                <Text
                  className={`text-xs font-bold ${
                    canTest
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {canTest ? 'Authorized (Supervisor)' : 'Supervisor Only'}
                </Text>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between pt-0.5">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Session Encryption
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Icon name="lock" size={12} color="#059669" />
              <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">
                256-Bit SSL
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Jump Shortcuts (Client Only) */}
      {isClient && clientLinks.length > 0 && (
        <View className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <View className="border-b border-slate-100 dark:border-slate-800/80 px-4 py-3">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Portal Shortcuts
            </Text>
            <Text className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Quick access to fleet & account modules
            </Text>
          </View>

          {clientLinks.map((link, i) => (
            <TouchableOpacity
              key={link.to}
              onPress={() => navigation.navigate(link.to)}
              activeOpacity={0.7}
              className={`flex-row items-center justify-between px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800/60 ${
                i < clientLinks.length - 1
                  ? 'border-b border-slate-100 dark:border-slate-800/60'
                  : ''
              }`}
            >
              <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl border ${link.iconBg}`}
                >
                  <Icon name={link.icon} size={16} color={link.iconColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900 dark:text-white">
                    {link.label}
                  </Text>
                  <Text
                    className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400"
                    numberOfLines={1}
                  >
                    {link.hint}
                  </Text>
                </View>
              </View>
              <Icon name="chevronRight" size={14} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Security & Password Card */}
      <View className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
        {showPasswordForm ? (
          <>
            <View className="mb-3.5 flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
              <View className="flex-row items-center gap-2">
                <Icon name="key" size={15} color="#2563eb" />
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Update Password
                </Text>
              </View>
              <TouchableOpacity
                onPress={closePasswordForm}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            <View className="gap-3">
              <View>
                <Text className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Current Password
                </Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="Enter current password"
                  placeholderTextColor="#94a3b8"
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 text-xs text-slate-900 dark:text-white focus:border-blue-500"
                />
              </View>

              <View>
                <Text className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  New Password (min 8 characters)
                </Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Enter new strong password"
                  placeholderTextColor="#94a3b8"
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 text-xs text-slate-900 dark:text-white focus:border-blue-500"
                />
              </View>

              <View>
                <Text className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Confirm New Password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Re-type new password"
                  placeholderTextColor="#94a3b8"
                  className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 text-xs text-slate-900 dark:text-white focus:border-blue-500"
                />
              </View>

              {error && (
                <View className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-2.5">
                  <Text className="text-xs font-medium text-red-600 dark:text-red-400">
                    {error}
                  </Text>
                </View>
              )}

              {success && (
                <View className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
                  <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Password updated successfully.
                  </Text>
                </View>
              )}

              <SuccessPopup
                open={success}
                title="Password Updated"
                message="Your new password is saved. Use it the next time you sign in."
                onClose={() => setSuccess(false)}
              />

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
                className="mt-1 h-11 items-center justify-center rounded-xl bg-blue-600 shadow-sm active:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-xs font-bold text-white">
                    Save New Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => setShowPasswordForm(true)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between py-1"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <Icon name="key" size={16} color="#64748b" />
              </View>
              <View>
                <Text className="text-xs font-bold text-slate-900 dark:text-white">
                  Change Account Password
                </Text>
                <Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Update your authentication credentials
                </Text>
              </View>
            </View>
            <View className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1">
              <Text className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                Modify
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Workshop Zebra Scanner (Preserved for technicians) */}
      <ZebraScannerCard />

      {/* Sign Out Card */}
      <TouchableOpacity
        onPress={handleLogout}
        activeOpacity={0.7}
        className="flex-row items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 py-3.5 shadow-2xs active:bg-red-100 dark:active:bg-red-950/50"
      >
        <Icon name="logOut" size={16} color="#dc2626" />
        <Text className="text-xs font-bold tracking-wide text-red-600 dark:text-red-400">
          Sign Out of Account
        </Text>
      </TouchableOpacity>

      {/* Footer Meta */}
      <View className="mt-2 items-center">
        <Text className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          Refurbnics System • Enterprise Service Suite
        </Text>
      </View>
    </ScrollView>
  );
}
