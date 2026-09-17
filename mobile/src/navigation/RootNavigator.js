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
import MainTabs from './MainTabs';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

const clientScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: '#000000' },
  headerTintColor: '#ffffff',
  headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' },
  headerShadowVisible: false,
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
    card: '#000000',
    border: 'rgba(255, 255, 255, 0.1)',
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

  if (!bootstrapped || (token && !authChecked)) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.must_change_password ? (
          <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="BatteryDetail"
              component={BatteryDetailScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: '#000000' }, headerTintColor: '#ffffff', headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' }, headerShadowVisible: false, title: 'Battery Details' }}
            />
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
