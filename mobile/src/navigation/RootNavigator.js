import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import LoginScreen from '../screens/auth/LoginScreen';
import SetPasswordScreen from '../screens/auth/SetPasswordScreen';
import BatteryDetailScreen from '../screens/shared/BatteryDetailScreen';
import { setupHardwareScanner } from '../services/hardware-scanner';
import AdminFinanceDetailScreen from '../screens/admin/AdminFinanceDetailScreen';
import AdminCertificateClientScreen from '../screens/admin/AdminCertificateClientScreen';
import AdminRatingDetailScreen from '../screens/admin/AdminRatingDetailScreen';
import ClientSortingScreen from '../screens/client/ClientSortingScreen';
import ClientInvoicesScreen from '../screens/client/ClientInvoicesScreen';
import ClientTransactionsScreen from '../screens/client/ClientTransactionsScreen';
import ClientNotificationsScreen from '../screens/client/ClientNotificationsScreen';
import ClientSupportScreen from '../screens/client/ClientSupportScreen';
import ClientHistoryScreen from '../screens/client/ClientHistoryScreen';
import ClientCertificatesScreen from '../screens/client/ClientCertificatesScreen';
import ClientTruckIntakeScreen from '../screens/client/ClientTruckIntakeScreen';
import ClientHistoryDetailScreen from '../screens/client/ClientHistoryDetailScreen';
import AdminDirectoryScreen from '../screens/admin/AdminDirectoryScreen';
import AdminPartsScreen from '../screens/admin/AdminPartsScreen';
import AdminFinanceScreen from '../screens/admin/AdminFinanceScreen';
import AdminGenerateQrScreen from '../screens/admin/AdminGenerateQrScreen';
import AdminFormScreen from '../screens/admin/AdminFormScreen';
import AdminDetailScreen from '../screens/admin/AdminDetailScreen';
import AdminRfidScreen from '../screens/admin/AdminRfidScreen';
import { AdminReturnCreateScreen, AdminRecycleCreateScreen } from '../screens/admin/AdminCreateFlows';
import { AdminRepairsScreen } from '../screens/admin/AdminPages';
import PartDetailScreen from '../screens/admin/sa4/PartDetailScreen';
import ServicesScreen from '../screens/admin/sa4/ServicesScreen';
import IssueReasonsScreen from '../screens/admin/sa4/IssueReasonsScreen';
import InvoicesScreen from '../screens/admin/sa4/InvoicesScreen';
import AdminNotificationsFeedScreen from '../screens/admin/sa1/AdminNotificationsFeedScreen';
import { UnserviceableBatteriesScreen, RecycledBatteriesScreen } from '../screens/admin/sa1/IssueBatteriesScreens';
import ReturnsScreen from '../screens/admin/sa2/ReturnsScreen';
import RecycleScreen from '../screens/admin/sa2/RecycleScreen';
import IntakeDetailScreen from '../screens/admin/sa2/IntakeDetailScreen';
import ReturnDetailScreen from '../screens/admin/sa2/ReturnDetailScreen';
import RecycleDetailScreen from '../screens/admin/sa2/RecycleDetailScreen';
import ClientDetailScreen from '../screens/admin/sa3/ClientDetailScreen';
import ClientFormScreen from '../screens/admin/sa3/ClientFormScreen';
import RecycleClientDetailScreen from '../screens/admin/sa3/RecycleClientDetailScreen';
import RecycleClientFormScreen from '../screens/admin/sa3/RecycleClientFormScreen';
import StaffDetailScreen from '../screens/admin/sa3/StaffDetailScreen';
import StaffFormScreen from '../screens/admin/sa3/StaffFormScreen';
import UserFormScreen from '../screens/admin/sa3/UserFormScreen';
import CreateAccountScreen from '../screens/admin/sa3/CreateAccountScreen';
import UsersScreen from '../screens/admin/sa3/UsersScreen';
import RatingsScreen from '../screens/admin/sa5/RatingsScreen';
import CertificatesScreen from '../screens/admin/sa5/CertificatesScreen';
import AuditLogScreen from '../screens/admin/sa5/AuditLogScreen';
import TrashScreen from '../screens/admin/sa5/TrashScreen';
import TrashDetailScreen from '../screens/admin/sa5/TrashDetailScreen';

// Admin side-menu pages (see components/admin/AdminSidebar.js). Registered
// for every signed-in role; the backend rejects anyone without the right
// role/permission, and the sidebar hides what the user can't open.
const ADMIN_SCREENS = [
  ['AdminNotifications', AdminNotificationsFeedScreen, 'Notifications'],
  ['GenerateQr', AdminGenerateQrScreen, 'Generate QR Codes'],
  ['Repairs', AdminRepairsScreen, 'Repairs'],
  ['Returns', ReturnsScreen, 'Returns Dispatch'],
  ['Parts', AdminPartsScreen, 'Parts & Inventory'],
  ['Services', ServicesScreen, 'Services & Rates'],
  ['IssueReasons', IssueReasonsScreen, 'Issue Reasons'],
  ['RecycleShipmentsAdmin', RecycleScreen, 'Recycle Shipments'],
  ['AdminInvoices', InvoicesScreen, 'Invoices'],
  ['Finance', AdminFinanceScreen, 'Finance'],
  ['Ratings', RatingsScreen, 'Ratings & Reviews'],
  ['Certificates', CertificatesScreen, 'Certificates & Impact'],
  ['Users', UsersScreen, 'User Accounts'],
  ['AuditLog', AuditLogScreen, 'Audit Log'],
  ['Trash', TrashScreen, 'Trash Bin'],
  ['AdminForm', AdminFormScreen, ''],
  ['AdminDetail', AdminDetailScreen, 'Details'],
  ['RfidAssignment', AdminRfidScreen, 'RFID Assignment'],
  ['AdminReturnCreate', AdminReturnCreateScreen, 'New Return Dispatch'],
  ['AdminRecycleCreate', AdminRecycleCreateScreen, 'New Recycle Shipment'],
  ['FinanceDetail', AdminFinanceDetailScreen, 'Finance Statement'],
  ['AdminCertificateClient', AdminCertificateClientScreen, 'Client Milestones'],
  ['AdminRatingDetail', AdminRatingDetailScreen, 'Review'],
  ['UnserviceableBatteries', UnserviceableBatteriesScreen, 'Unserviceable Batteries'],
  ['RecycledBatteries', RecycledBatteriesScreen, 'Recycled Batteries'],
  ['AdminIntakeDetail', IntakeDetailScreen, 'Truck Intake'],
  ['AdminReturnDetail', ReturnDetailScreen, 'Return Dispatch'],
  ['AdminRecycleDetail', RecycleDetailScreen, 'Recycle Shipment'],
  ['SAClientDetail', ClientDetailScreen, 'Client'],
  ['SAClientForm', ClientFormScreen, 'Client'],
  ['SARecycleClientDetail', RecycleClientDetailScreen, 'Recycle Client'],
  ['SARecycleClientForm', RecycleClientFormScreen, 'Recycle Client'],
  ['SAStaffDetail', StaffDetailScreen, 'Staff'],
  ['SAStaffForm', StaffFormScreen, 'Staff'],
  ['SAUserForm', UserFormScreen, 'Admin User'],
  ['SACreateAccount', CreateAccountScreen, 'Create Account'],
  ['AdminTrashDetail', TrashDetailScreen, 'Trash Record'],
  ['AdminPartDetail', PartDetailScreen, 'Part'],
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

  // Zebra devices: create/refresh the DataWedge scan profile (RFID + QR) once
  useEffect(() => {
    setupHardwareScanner();
  }, []);

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
            <Stack.Screen
              name="ClientHistoryDetail"
              component={ClientHistoryDetailScreen}
              options={{ ...clientScreenOptions, title: 'Shipment Details' }}
            />
            <Stack.Screen
              name="ClientTruckIntake"
              component={ClientTruckIntakeScreen}
              options={{ ...clientScreenOptions, title: 'Add Truck Intake' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
