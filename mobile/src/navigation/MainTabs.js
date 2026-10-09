import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import ServiceScreen from '../screens/technician/ServiceScreen';
import DashboardScreen from '../screens/technician/DashboardScreen';
import HistoryScreen from '../screens/technician/HistoryScreen';
import ProfileScreen from '../screens/technician/ProfileScreen';
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import ClientBatteriesScreen from '../screens/client/ClientBatteriesScreen';
import ClientScanScreen from '../screens/client/ClientScanScreen';
import ClientSidebar from '../components/client/ClientSidebar';
import AdminSidebar from '../components/admin/AdminSidebar';
import { hasClientPermission } from '../utils/permissions';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminBatteriesScreen from '../screens/admin/AdminBatteriesScreen';
import AdminIntakesScreen from '../screens/admin/AdminIntakesScreen';
import RecycleShipmentsScreen from '../screens/recycle/RecycleShipmentsScreen';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

function iconProps(color, size) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
}

function ServiceIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  );
}

function DashboardIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Rect width="7" height="9" x="3" y="3" rx="1" />
      <Rect width="7" height="5" x="14" y="3" rx="1" />
      <Rect width="7" height="9" x="14" y="12" rx="1" />
      <Rect width="7" height="5" x="3" y="16" rx="1" />
    </Svg>
  );
}

function HistoryIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="12 7 12 12 15.5 14" />
    </Svg>
  );
}

function ProfileIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function BatteryIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Rect width="17" height="11" x="2" y="6" rx="2" ry="2" />
      <Line x1="22" x2="22" y1="10" y2="13" />
    </Svg>
  );
}

function TruckIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <Path d="M15 18H9" />
      <Path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <Circle cx="17" cy="18" r="2" />
      <Circle cx="7" cy="18" r="2" />
    </Svg>
  );
}

function ScanIcon({ color, size }) {
  return (
    <Svg {...iconProps(color, size)}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx="12" cy="13" r="3" />
    </Svg>
  );
}

const TAB_ICONS = {
  Service: ServiceIcon,
  Dashboard: DashboardIcon,
  History: HistoryIcon,
  Profile: ProfileIcon,
  MyBatteries: BatteryIcon,
  ScanQR: ScanIcon,
  Batteries: BatteryIcon,
  Scan: ScanIcon,
  Intakes: TruckIcon,
  Shipments: TruckIcon,
};

// Which tab set a login gets. Office roles (super_admin / admin / staff) used
// to fall into the technician tabs, whose screens call /staff/me and fail
// with "not linked to a staff record" — they now get an admin set, and
// recycling partners get their shipments.
const OFFICE_ROLES = ['super_admin', 'admin', 'staff'];

function MenuIcon({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6h16" />
      <Path d="M4 12h16" />
      <Path d="M4 18h16" />
    </Svg>
  );
}

// Fully custom header (rather than relying on headerStyle's border, which
// react-navigation doesn't reliably render on the web target) so the border
// is guaranteed to show on every platform. For a client, it also carries
// the menu button that opens ClientSidebar. Always black regardless of the
// rest of the (light) app theme, by design.
//
// Deliberately dumb: no hooks that touch navigation or open the sidebar
// itself. bottom-tabs calls this once per tab (all four mount at once, not
// just the focused one), so anything stateful or context-sensitive placed
// here runs four times over.
function Header({ showMenu, onMenuPress }) {
  return (
    <View
      style={{
        height: 92,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 14,
        paddingBottom: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e2e8f0',
      }}
    >
      <Image
        source={require('../../assets/LogoREFURBNICSBlack.png')}
        style={{ width: 140, height: 38 }}
        resizeMode="contain"
      />

      {showMenu && (
        <TouchableOpacity onPress={onMenuPress} hitSlop={10} style={{ padding: 8 }}>
          <MenuIcon color="#0f172a" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function MainTabs() {
  const user = useSelector((state) => state.auth.user);
  const isClient = user?.role === 'client';
  const isOffice = OFFICE_ROLES.includes(user?.role);
  const isRecycle = user?.role === 'recycle_client';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Tab.Navigator
        detachInactiveScreens={!isClient}
        screenOptions={({ route }) => ({
          headerShown: true,
          header: () => <Header showMenu={isClient || isOffice} onMenuPress={() => setSidebarOpen(true)} />,
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#64748b',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#e2e8f0',
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          tabBarIcon: ({ color, size }) => {
            const IconComponent = TAB_ICONS[route.name] || DashboardIcon;
            return <IconComponent color={color} size={size ?? 20} />;
          },
        })}
      >
        {isClient ? (
          <>
            {/* Tabs follow the client's module permissions like the web menu;
                a module the admin switched off simply has no tab. */}
            {hasClientPermission(user, 'client_dashboard') && (
              <Tab.Screen
                name="Dashboard"
                component={ClientDashboardScreen}
                options={{ title: 'Dashboard' }}
              />
            )}
            {(hasClientPermission(user, 'client_all_batteries') ||
              hasClientPermission(user, 'client_packed') ||
              hasClientPermission(user, 'client_received')) && (
              <Tab.Screen
                name="MyBatteries"
                component={ClientBatteriesScreen}
                options={{ title: 'My Batteries' }}
                initialParams={{
                  initialBucket: hasClientPermission(user, 'client_all_batteries')
                    ? 'all'
                    : hasClientPermission(user, 'client_packed') ? 'packed' : 'received',
                }}
              />
            )}
            <Tab.Screen
              name="ScanQR"
              component={ClientScanScreen}
              options={{ title: 'Scan QR' }}
            />
            <Tab.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Profile' }}
            />
          </>
        ) : isOffice ? (
          <>
            <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
            <Tab.Screen name="Batteries" component={AdminBatteriesScreen} />
            <Tab.Screen name="Scan" component={ClientScanScreen} options={{ title: 'Scan' }} />
            <Tab.Screen name="Intakes" component={AdminIntakesScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : isRecycle ? (
          <>
            <Tab.Screen name="Shipments" component={RecycleShipmentsScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          <>
            <Tab.Screen name="Service" component={ServiceScreen} />
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Tab.Navigator>

      {isClient && <ClientSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      {isOffice && <AdminSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
    </>
  );
}

