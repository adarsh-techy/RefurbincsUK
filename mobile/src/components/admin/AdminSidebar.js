import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { logout } from '../../store/auth-slice';
import { navigate } from '../../navigation/navigationRef';

// Admin side menu — the same groups and pages as the web Sidebar for
// super_admin / admin / staff. Items marked superAdminOnly / adminOnly /
// permission are hidden exactly like the web (super_admin sees everything).

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(310, SCREEN_WIDTH * 0.84);

const NAV_GROUPS = [
  {
    heading: 'Overview',
    links: [
      { key: 'dashboard', label: 'Dashboard', screen: 'Dashboard' },
      { key: 'notifications', label: 'Notifications', screen: 'AdminNotifications' },
      { key: 'messages', label: 'Support Messages', screen: 'Support' },
    ],
  },
  {
    heading: 'Battery Operations',
    links: [
      { key: 'intakes', label: 'Truck Intake', screen: 'Intakes', permission: 'truck_intakes' },
      { key: 'fleet', label: 'Battery Fleet', screen: 'Batteries', params: { status: '', search: '' } },
      { key: 'scan', label: 'Scan Battery', screen: 'Scan' },
      { key: 'qr', label: 'QR Codes (Generate)', screen: 'GenerateQr' },
      { key: 'repairs', label: 'Repairs', screen: 'Repairs', permission: 'repairs' },
      { key: 'returns', label: 'Returns Dispatch', screen: 'Returns', permission: 'returns' },
    ],
  },
  {
    heading: 'Workshop & Services',
    links: [
      { key: 'parts', label: 'Parts & Inventory', screen: 'Parts', permission: 'parts' },
      { key: 'services', label: 'Services & Rates', screen: 'Services', permission: 'services' },
      { key: 'issues', label: 'Issue Reasons', screen: 'IssueReasons', permission: 'issue_reasons' },
    ],
  },
  {
    heading: 'Recycling',
    links: [
      { key: 'unserviceable', label: 'Unserviceable Batteries', screen: 'Batteries', params: { status: 'unserviceable', search: '' } },
      { key: 'recycled', label: 'Recycled Batteries', screen: 'Batteries', params: { status: 'recycled', search: '' } },
      { key: 'recycle', label: 'Recycle Shipments', screen: 'RecycleShipmentsAdmin', permission: 'recycle' },
    ],
  },
  {
    heading: 'Clients & Staff',
    links: [
      { key: 'clients', label: 'Fleet Clients', screen: 'Directory', params: { tab: 'clients' }, permission: 'clients' },
      { key: 'recyclers', label: 'Recycling Partners', screen: 'Directory', params: { tab: 'recyclers' }, permission: 'clients' },
      { key: 'staff', label: 'Staff Directory', screen: 'Directory', params: { tab: 'staff' }, permission: 'staff' },
    ],
  },
  {
    heading: 'Administration',
    links: [
      { key: 'invoices', label: 'Invoices', screen: 'AdminInvoices', superAdminOnly: true },
      { key: 'finance', label: 'Finance', screen: 'Finance', superAdminOnly: true },
      { key: 'ratings', label: 'Ratings & Reviews', screen: 'Ratings' },
      { key: 'certificates', label: 'Certificates & Impact', screen: 'Certificates' },
      { key: 'users', label: 'User Accounts', screen: 'Users', superAdminOnly: true },
      { key: 'audit', label: 'Audit Log', screen: 'AuditLog', permission: 'audit_logs' },
      { key: 'trash', label: 'Trash Bin', screen: 'Trash', adminOnly: true },
    ],
  },
  {
    heading: 'Account',
    links: [{ key: 'profile', label: 'Account Profile', screen: 'Profile' }],
  },
];

function canSee(link, user) {
  const role = user?.role;
  if (role === 'super_admin') return true;
  if (link.superAdminOnly) return false;
  if (link.adminOnly && role !== 'admin') return false;
  if (link.permission && !(user?.permissions || []).includes(link.permission)) return false;
  return true;
}

function MenuCloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Svg>
  );
}

export default function AdminSidebar({ visible, onClose }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: visible ? 0 : PANEL_WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: visible ? 1 : 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [visible, translateX, backdropOpacity]);

  function go(link) {
    onClose();
    // navigationRef: this Modal's children can lose the navigation context
    // on Android, so never use a hook/prop navigation object here.
    navigate(link.screen, link.params);
  }

  const roleLabel = (user?.role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 flex-row">
        <Animated.View style={{ flex: 1, opacity: backdropOpacity }}>
          <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1 bg-black/60" />
        </Animated.View>

        <Animated.View
          style={{ width: PANEL_WIDTH, transform: [{ translateX }] }}
          className="h-full border-l border-slate-200 bg-slate-50"
        >
          <View className="flex-row items-center justify-between border-b border-slate-200/80 px-5 pb-4 pt-14">
            <View className="flex-1 pr-2">
              <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>{user?.name || 'Admin'}</Text>
              <View className="mt-1 flex-row items-center gap-2">
                <View className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{roleLabel}</Text>
                </View>
                <Text className="flex-1 text-[11px] text-slate-400" numberOfLines={1}>{user?.email}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} className="rounded-full bg-white p-2">
              <MenuCloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerClassName="px-3 py-4 gap-5">
            {NAV_GROUPS.map((group) => {
              const links = group.links.filter((l) => canSee(l, user));
              if (links.length === 0) return null;
              return (
                <View key={group.heading}>
                  <Text className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.heading}</Text>
                  <View className="gap-0.5">
                    {links.map((link) => (
                      <TouchableOpacity key={link.key} onPress={() => go(link)} className="rounded-xl px-3 py-2.5 active:bg-white">
                        <Text className="text-sm font-semibold text-slate-700">{link.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View className="border-t border-slate-200/80 p-4">
            <TouchableOpacity
              onPress={() => { onClose(); dispatch(logout()); }}
              className="items-center rounded-2xl border border-red-200 bg-red-50 py-3 active:bg-red-100"
            >
              <Text className="text-xs font-bold tracking-wide text-red-600">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
