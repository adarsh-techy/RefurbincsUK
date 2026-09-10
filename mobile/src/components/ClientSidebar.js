import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { logout } from '../store/auth-slice';
import { navigate } from '../navigation/navigationRef';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(300, SCREEN_WIDTH * 0.82);

const NAV_GROUPS = [
  {
    heading: 'Overview',
    links: [
      { key: 'dashboard', label: 'Dashboard', screen: 'Dashboard' },
      { key: 'all', label: 'All Batteries', screen: 'MyBatteries', params: { initialBucket: 'all' } },
    ],
  },
  {
    heading: 'Repair Service',
    links: [
      { key: 'packed', label: 'Packed', screen: 'MyBatteries', params: { initialBucket: 'packed' } },
      { key: 'pending', label: 'In Service', screen: 'MyBatteries', params: { initialBucket: 'pending' } },
      { key: 'received', label: 'Received', screen: 'MyBatteries', params: { initialBucket: 'received' } },
      { key: 'scan', label: 'Scan QR', screen: 'ScanQR' },
    ],
  },
  {
    heading: 'Sorting',
    links: [{ key: 'sorting', label: 'Battery Sorting', screen: 'BatterySorting' }],
  },
  {
    heading: 'Billing',
    links: [
      { key: 'invoices', label: 'Invoices & Bills', screen: 'Invoices' },
      { key: 'transactions', label: 'Transactions', screen: 'Transactions' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { key: 'support', label: 'Help & Support', screen: 'Support' },
      { key: 'notifications', label: 'Notifications', screen: 'ClientNotifications' },
      { key: 'profile', label: 'Profile', screen: 'Profile' },
    ],
  },
];

function MenuCloseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Svg>
  );
}

export default function ClientSidebar({ visible, onClose }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : PANEL_WIDTH,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, backdropOpacity]);

  function go(link) {
    onClose();
    // navigationRef sidesteps React context entirely — this Modal's
    // children can lose it on Android (see navigationRef.js), so no
    // navigation object obtained via a hook or a prop is trustworthy here.
    navigate(link.screen, link.params);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 flex-row">
        <Animated.View style={{ flex: 1, opacity: backdropOpacity }}>
          <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1 bg-black/60" />
        </Animated.View>

        <Animated.View
          style={{ width: PANEL_WIDTH, transform: [{ translateX }] }}
          className="h-full border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
        >
          <View className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 px-5 pb-4 pt-14">
            <View>
              <Text className="text-sm font-extrabold text-slate-900 dark:text-white" numberOfLines={1}>
                {user?.name || 'Client'}
              </Text>
              <Text className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} className="rounded-full bg-white dark:bg-slate-900 p-2">
              <MenuCloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" contentContainerClassName="px-3 py-4 gap-5">
            {NAV_GROUPS.map((group) => (
              <View key={group.heading}>
                <Text className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.heading}
                </Text>
                <View className="gap-0.5">
                  {group.links.map((link) => (
                    <TouchableOpacity
                      key={link.key}
                      onPress={() => go(link)}
                      className="rounded-xl px-3 py-2.5 active:bg-white dark:active:bg-slate-900"
                    >
                      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <View className="border-t border-slate-200/80 dark:border-slate-800/80 p-4">
            <TouchableOpacity
              onPress={() => {
                onClose();
                dispatch(logout());
              }}
              className="items-center rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 py-3 active:bg-red-50 dark:active:bg-red-950/40"
            >
              <Text className="text-xs font-bold tracking-wide text-red-600 dark:text-red-400">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
