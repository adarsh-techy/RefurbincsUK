import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import LoginScreen from '../screens/auth/LoginScreen';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import BatteryDetailScreen from '../screens/shared/BatteryDetailScreen';
import ClientSortingScreen from '../screens/client/ClientSortingScreen';
import ClientInvoicesScreen from '../screens/client/ClientInvoicesScreen';
import ClientTransactionsScreen from '../screens/client/ClientTransactionsScreen';
import ClientNotificationsScreen from '../screens/client/ClientNotificationsScreen';
import ClientSupportScreen from '../screens/client/ClientSupportScreen';
import ClientHistoryScreen from '../screens/client/ClientHistoryScreen';
import ClientCertificatesScreen from '../screens/client/ClientCertificatesScreen';
import AdminDirectoryScreen from '../screens/admin/AdminDirectoryScreen';
import AdminPartsScreen from '../screens/admin/AdminPartsScreen';
import AdminFinanceScreen from '../screens/admin/AdminFinanceScreen';
import AdminGenerateQrScreen from '../screens/admin/AdminGenerateQrScreen';
import {
  AdminRepairsScreen, AdminReturnsScreen, AdminServicesScreen, AdminIssueReasonsScreen,
  AdminRecycleScreen, AdminInvoicesScreen, AdminRatingsScreen, AdminCertificatesScreen,
  AdminUsersScreen, AdminAuditLogScreen, AdminTrashScreen, AdminNotificationsScreen,
} from '../screens/admin/AdminPages';

// Admin side-menu pages (see components/admin/AdminSidebar.js). Registered
// for every signed-in role; the backend rejects anyone without the right
// role/permission, and the sidebar hides what the user can't open.
const ADMIN_SCREENS = [
  ['AdminNotifications', AdminNotificationsScreen, 'Notifications'],
  ['GenerateQr', AdminGenerateQrScreen, 'Generate QR Codes'],
  ['Repairs', AdminRepairsScreen, 'Repairs'],
  ['Returns', AdminReturnsScreen, 'Returns Dispatch'],
  ['Parts', AdminPartsScreen, 'Parts & Inventory'],
  ['Services', AdminServicesScreen, 'Services & Rates'],
  ['IssueReasons', AdminIssueReasonsScreen, 'Issue Reasons'],
  ['RecycleShipmentsAdmin', AdminRecycleScreen, 'Recycle Shipments'],
  ['AdminInvoices', AdminInvoicesScreen, 'Invoices'],
  ['Finance', AdminFinanceScreen, 'Finance'],
  ['Ratings', AdminRatingsScreen, 'Ratings & Reviews'],
  ['Certificates', AdminCertificatesScreen, 'Certificates & Impact'],
  ['Users', AdminUsersScreen, 'User Accounts'],
  ['AuditLog', AdminAuditLogScreen, 'Audit Log'],
  ['Trash', AdminTrashScreen, 'Trash Bin'],
];
import MainTabs from './MainTabs';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

const clientScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: '#ffffff' },
  headerTintColor: '#0f172a',
  headerTitleStyle: { color: '#0f172a', fontWeight: 'bold' },
  headerShadowVisible: false,
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    primary: '#2563eb',
    text: '#0f172a',
  },
};

function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator color="#2563eb" />
      <Text className="mt-3 text-sm text-slate-500">Checking session…</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { user, token, bootstrapped, authChecked } = useSelector((state) => state.auth);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!bootstrapped || (token && !authChecked) ? (
          <Stack.Screen name="Loading" component={LoadingScreen} />
        ) : !user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.must_change_password ? (
          <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="BatteryDetail"
              component={BatteryDetailScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: '#ffffff' }, headerTintColor: '#0f172a', headerTitleStyle: { color: '#0f172a', fontWeight: 'bold' }, headerShadowVisible: false, title: 'Battery Details' }}
            />
            <Stack.Screen
              name="Directory"
              component={AdminDirectoryScreen}
              options={{ ...clientScreenOptions, title: 'Clients & Staff' }}
            />
            {ADMIN_SCREENS.map(([name, component, title]) => (
              <Stack.Screen key={name} name={name} component={component} options={{ ...clientScreenOptions, title }} />
            ))}
            <Stack.Screen
              name="BatterySorting"
              component={ClientSortingScreen}
              options={{ ...clientScreenOptions, title: 'Battery Sorting' }}
            />
            <Stack.Screen
              name="Invoices"
              component={ClientInvoicesScreen}
              options={{ ...clientScreenOptions, title: 'Invoices & Bills' }}
            />
            <Stack.Screen
              name="Transactions"
              component={ClientTransactionsScreen}
              options={{ ...clientScreenOptions, title: 'Transactions' }}
            />
            <Stack.Screen
              name="ClientNotifications"
              component={ClientNotificationsScreen}
              options={{ ...clientScreenOptions, title: 'Notifications' }}
            />
            <Stack.Screen
              name="Support"
              component={ClientSupportScreen}
              options={{ ...clientScreenOptions, title: 'Help & Support' }}
            />
            <Stack.Screen
              name="ClientHistory"
              component={ClientHistoryScreen}
              options={{ ...clientScreenOptions, title: 'Service History' }}
            />
            <Stack.Screen
              name="ClientCertificates"
              component={ClientCertificatesScreen}
              options={{ ...clientScreenOptions, title: 'Certificates & Impact' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
