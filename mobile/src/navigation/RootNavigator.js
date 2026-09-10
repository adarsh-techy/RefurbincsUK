import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import LoginScreen from '../screens/LoginScreen';
import SetPasswordScreen from '../screens/SetPasswordScreen';
import BatteryDetailScreen from '../screens/BatteryDetailScreen';
import ClientSortingScreen from '../screens/ClientSortingScreen';
import ClientInvoicesScreen from '../screens/ClientInvoicesScreen';
import ClientTransactionsScreen from '../screens/ClientTransactionsScreen';
import ClientNotificationsScreen from '../screens/ClientNotificationsScreen';
import ClientSupportScreen from '../screens/ClientSupportScreen';
import MainTabs from './MainTabs';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();

const clientScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: '#040509' },
  headerTintColor: '#e5e5e5',
  headerTitleStyle: { color: '#fff' },
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#f8fafc',
    card: '#040509',
    border: 'rgba(30, 64, 175, 0.4)',
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
              options={{ headerShown: true, headerStyle: { backgroundColor: '#040509' }, headerTintColor: '#e5e5e5', title: '' }}
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
