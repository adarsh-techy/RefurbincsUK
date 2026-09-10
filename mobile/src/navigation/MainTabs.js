import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path } from 'react-native-svg';
import ServiceScreen from '../screens/ServiceScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ClientDashboardScreen from '../screens/ClientDashboardScreen';
import ClientBatteriesScreen from '../screens/ClientBatteriesScreen';
import ClientScanScreen from '../screens/ClientScanScreen';
import ClientSidebar from '../components/ClientSidebar';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

const ICONS = {
  Service: '🔧',
  Dashboard: '📊',
  History: '🕘',
  Profile: '👤',
  MyBatteries: '🔋',
  ScanQR: '📷',
};

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
function Header({ isClient, onMenuPress }) {
  return (
    <View
      style={{
        height: 92,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingLeft: 14,
        paddingRight: 10,
        paddingBottom: 10,
        backgroundColor: '#040509',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#14532d',
      }}
    >
      {isClient ? (
        <Image
          source={require('../../assets/brand-mark.png')}
          style={{ width: 108, height: 35 }}
          resizeMode="contain"
        />
      ) : (
        // Cropped tight to the logo's wordmark (the source PNG has a lot of
        // empty canvas above/below/around it) so it reads as large and sits
        // flush left instead of "contain" centering a small image in a
        // mismatched box.
        <View style={{ width: 124, height: 21, overflow: 'hidden' }}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 134, height: 90, marginTop: -31, marginLeft: -4 }}
          />
        </View>
      )}

      {isClient && (
        <TouchableOpacity onPress={onMenuPress} hitSlop={10} style={{ padding: 8 }}>
          <MenuIcon color="#e5e5e5" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function MainTabs() {
  const user = useSelector((state) => state.auth.user);
  const isClient = user?.role === 'client';
  const { theme } = useTheme();
  const isLight = isClient && theme === 'light';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Tab.Navigator
        // Background tabs are normally frozen/detached from the native tree
        // as a perf optimization, which doesn't play well with a global
        // style change (the theme toggle) re-rendering every mounted screen
        // at once — see the note on Header above.
        detachInactiveScreens={!isClient}
        screenOptions={({ route }) => ({
          headerShown: true,
          header: () => <Header isClient={isClient} onMenuPress={() => setSidebarOpen(true)} />,
          tabBarActiveTintColor: isLight ? '#2563eb' : '#60a5fa',
          tabBarInactiveTintColor: isLight ? '#94a3b8' : '#71717a',
          tabBarStyle: {
            backgroundColor: isLight ? '#ffffff' : '#040509',
            borderTopColor: isLight ? '#e2e8f0' : 'rgba(30, 64, 175, 0.4)',
          },
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>{ICONS[route.name] || '📱'}</Text>,
        })}
      >
        {isClient ? (
          <>
            <Tab.Screen
              name="Dashboard"
              component={ClientDashboardScreen}
              options={{ title: 'Dashboard' }}
            />
            <Tab.Screen
              name="MyBatteries"
              component={ClientBatteriesScreen}
              options={{ title: 'My Batteries' }}
            />
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
    </>
  );
}

