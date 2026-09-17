import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { login } from '../../store/auth-slice';
import apiClient, { getBaseUrl } from '../../services/api-client';

function GearIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m3 6 9 6 9-6" />
      <Path d="M3 6h18v12H3V6Z" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 11h14v9H5v-9Z" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

function EyeIcon({ open }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
          <Circle cx={12} cy={12} r={3} />
        </>
      ) : (
        <>
          <Path d="M3 3l18 18" />
          <Path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-3.2 4.2M6.6 6.6C4 8.4 2 12 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.7-.8" />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      )}
    </Svg>
  );
}

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Server Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiClient.defaults.baseURL || getBaseUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('custom_server_url').then((val) => {
      if (val && !val.includes('192.0.0.2')) {
        setServerUrl(val);
        apiClient.defaults.baseURL = val;
      } else {
        const fresh = getBaseUrl();
        setServerUrl(fresh);
        apiClient.defaults.baseURL = fresh;
        if (val) AsyncStorage.removeItem('custom_server_url');
      }
    });
  }, []);

  async function handleTestServer() {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
      const testEndpoint = cleanUrl.endsWith('/api') ? `${cleanUrl}/auth/me` : `${cleanUrl}/api/auth/me`;
      await axios.get(testEndpoint, { timeout: 4000 });
      setTestResult({ success: true, message: 'Server is reachable!' });
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403 || err.response?.data) {
        setTestResult({ success: true, message: 'Server responded successfully!' });
      } else {
        setTestResult({ success: false, message: err.message || 'Cannot reach server' });
      }
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSaveServer() {
    let clean = serverUrl.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api')) clean = `${clean}/api`;
    await AsyncStorage.setItem('custom_server_url', clean);
    apiClient.defaults.baseURL = clean;
    setServerUrl(clean);
    setShowSettings(false);
  }

  function handleSubmit() {
    if (!email.trim() || !password) return;
    dispatch(login({ email: email.trim(), password }));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-50 dark:bg-slate-950"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Right Server Settings Button */}
        <View className="items-end mb-2">
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            className="flex-row items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-2xs"
          >
            <GearIcon />
            <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Server</Text>
          </TouchableOpacity>
        </View>

        {/* ── Brand Mark ────────────────────────────────────────────────── */}
        <View className="mb-9 items-center">
          <View
            className="mb-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-slate-900 px-7 py-6"
            style={{
              shadowColor: '#10b981',
              shadowOpacity: 0.25,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
            }}
          >
            <Image
              source={require('../../../assets/REFURBNICSmobile.png')}
              style={{ width: 220, height: 60 }}
              resizeMode="contain"
            />
          </View>
          <View className="flex-row items-center gap-2">
            <View className="h-px w-6 bg-slate-200 dark:bg-slate-700" />
            <Text className="text-[10px] font-bold uppercase tracking-[3px] text-slate-400 dark:text-slate-500">
              Client &amp; Staff Portal
            </Text>
            <View className="h-px w-6 bg-slate-200 dark:bg-slate-700" />
          </View>
        </View>

        {/* ── Login Card ────────────────────────────────────────────────── */}
        <View
          className="rounded-[28px] border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-7"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
          }}
        >
          <Text className="text-lg font-extrabold text-slate-900 dark:text-white">Welcome back</Text>
          <Text className="mt-1 mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Sign in with your client or staff credentials to continue.
          </Text>

          {/* Quick Fill Accounts */}
          <View className="mb-5">
            <Text className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Quick Fill Logins
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={() => {
                  setEmail('adarsh@gmail.com');
                  setPassword('12345678');
                }}
                className="flex-1 min-w-[45%] rounded-xl border border-dashed border-blue-500/50 bg-blue-500/10 py-2.5 px-2 items-center"
              >
                <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">Adarsh</Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">adarsh@gmail.com</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEmail('akshay@gmail.com');
                  setPassword('12345678');
                }}
                className="flex-1 min-w-[45%] rounded-xl border border-dashed border-indigo-500/50 bg-indigo-500/10 py-2.5 px-2 items-center"
              >
                <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Akshay</Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">akshay@gmail.com</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEmail('akhil@gmail.com');
                  setPassword('12345678');
                }}
                className="flex-1 min-w-[45%] rounded-xl border border-dashed border-violet-500/50 bg-violet-500/10 py-2.5 px-2 items-center"
              >
                <Text className="text-xs font-bold text-violet-600 dark:text-violet-400">Akhil</Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">akhil@gmail.com</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEmail('humanforest@gmail.com');
                  setPassword('12345678');
                }}
                className="flex-1 min-w-[45%] rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/10 py-2.5 px-2 items-center"
              >
                <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">HumanForest</Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">Client Demo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Email Address
              </Text>
              <View
                className={`flex-row items-center gap-2.5 rounded-2xl border bg-slate-50 dark:bg-slate-950 px-4 ${
                  emailFocused ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <MailIcon />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@company.com"
                  placeholderTextColor="#475569"
                  className="flex-1 py-3.5 text-sm font-medium text-slate-900 dark:text-white"
                />
              </View>
            </View>

            <View>
              <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Password
              </Text>
              <View
                className={`flex-row items-center gap-2.5 rounded-2xl border bg-slate-50 dark:bg-slate-950 px-4 ${
                  passwordFocused ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <LockIcon />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#475569"
                  className="flex-1 py-3.5 text-sm font-medium text-slate-900 dark:text-white"
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <EyeIcon open={showPassword} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {error && (
            <View className="mt-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-3">
              <Text className="text-xs font-medium leading-relaxed text-red-600 dark:text-red-300">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={status === 'loading'}
            className="mt-6 overflow-hidden rounded-2xl disabled:opacity-60"
          >
            <LinearGradient
              colors={['#10b981', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}
            >
              {status === 'loading' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-sm font-bold tracking-wide text-white">Sign In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View className="mt-9 items-center">
          <Text className="text-[11px] font-medium text-slate-700 dark:text-slate-600">
            Refurbinics Battery Intelligence &amp; Fleet Management
          </Text>
        </View>
      </ScrollView>

      {/* ── Server Settings Modal ────────────────────────────────────────── */}
      <Modal visible={showSettings} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center p-5">
          <View className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <Text className="text-base font-extrabold text-slate-900 dark:text-white">
              Backend Server Configuration
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Set the backend API URL your phone connects to.
            </Text>

            <View className="mt-4">
              <Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                API Base URL
              </Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.x.x:5000/api"
                placeholderTextColor="#64748b"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
              />
            </View>

            {testResult && (
              <View
                className={`mt-3 rounded-xl p-2.5 ${
                  testResult.success ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    testResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {testResult.message}
                </Text>
              </View>
            )}

            <View className="mt-5 flex-row gap-2">
              <TouchableOpacity
                onPress={handleTestServer}
                disabled={testingConnection}
                className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 py-2.5 items-center justify-center"
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Test</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveServer}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 items-center justify-center"
              >
                <Text className="text-xs font-bold text-white">Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.removeItem('custom_server_url');
                  const fresh = getBaseUrl();
                  setServerUrl(fresh);
                  apiClient.defaults.baseURL = fresh;
                  setTestResult({ success: true, message: `Reset to: ${fresh}` });
                }}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 items-center justify-center"
              >
                <Text className="text-xs font-bold text-slate-600 dark:text-slate-300">Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowSettings(false);
                  setTestResult(null);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 items-center justify-center"
              >
                <Text className="text-xs font-bold text-slate-500">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
