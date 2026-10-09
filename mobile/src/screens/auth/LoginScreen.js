import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { login } from '../../store/auth-slice';
import apiClient, { getBaseUrl } from '../../services/api-client';

function GearIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m3 6 9 6 9-6" />
      <Path d="M3 6h18v12H3V6Z" />
    </Svg>
  );
}

function LockIcon({ size = 16, color = '#64748b' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 11h14v9H5v-9Z" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

function EyeIcon({ open }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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

// Demo quick-fill accounts exist only in development builds; a release APK
// gets an empty list so no working credentials ship inside the app.
// No password in source (the repo is public): set EXPO_PUBLIC_DEMO_PASSWORD
// in mobile/.env (git-ignored) to make the quick-fill buttons log in.
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD || '';

const PRESETS = !__DEV__ ? [] : [
  {
    id: 'superadmin',
    name: 'Super Admin',
    role: 'Administrator',
    email: 'superadmin@gmail.com',
    password: DEMO_PASSWORD,
    initials: 'SA',
    iconBg: '#1e3a8a',
    activeBg: '#eff6ff',
    activeBorder: '#2563eb',
  },
  {
    id: 'humanforest',
    name: 'HumanForest',
    role: 'Fleet Client',
    email: 'humanforest@gmail.com',
    password: DEMO_PASSWORD,
    initials: 'HF',
    iconBg: '#065f46',
    activeBg: '#ecfdf5',
    activeBorder: '#059669',
  },
  {
    id: 'recycle',
    name: 'Recycle Client',
    role: 'Recycling Partner',
    email: 'recycle@gmail.com',
    password: DEMO_PASSWORD,
    initials: 'RC',
    iconBg: '#0f766e',
    activeBg: '#f0fdfa',
    activeBorder: '#0d9488',
  },
  {
    id: 'akhil',
    name: 'Akhil Tech',
    role: 'Technician',
    email: 'akhil@gmail.com',
    password: DEMO_PASSWORD,
    initials: 'AT',
    iconBg: '#0a4d3c',
    activeBg: '#f0f6f3',
    activeBorder: '#0a4d3c',
  },
  {
    id: 'akshay',
    name: 'Akshay Sup',
    role: 'Supervisor',
    email: 'akshay@gmail.com',
    password: DEMO_PASSWORD,
    initials: 'AS',
    iconBg: '#52796f',
    activeBg: '#f2f6f4',
    activeBorder: '#4a6b5e',
  },
];

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);
  const [email, setEmail] = useState(__DEV__ ? 'superadmin@gmail.com' : '');
  const [password, setPassword] = useState(__DEV__ ? DEMO_PASSWORD : '');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Server Settings Modal State
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiClient.defaults.baseURL || getBaseUrl());
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!__DEV__) return;
    AsyncStorage.getItem('custom_server_url').then((val) => {
      if (val && !val.includes(':5000') && !val.includes('onrender.com') && !val.includes('192.0.0.2')) {
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
    dispatch(login({ email: email.trim().toLowerCase(), password: password.trim() }));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#f8fafc]"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-5 py-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Right Server Settings Button — dev builds only */}
        {__DEV__ && (
          <View className="items-end mb-2">
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              className="flex-row items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1.5 shadow-2xs"
            >
              <GearIcon />
              <Text className="text-[11px] font-bold text-slate-600">Server</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Brand Mark ────────────────────────────────────────────────── */}
        <View className="mb-6 items-center">
          <Image
            source={require('../../../assets/REFURBNICS.png')}
            style={{ width: 220, height: 48 }}
            resizeMode="contain"
          />
          <View className="flex-row items-center justify-center gap-3 mt-4 w-full max-w-[280px]">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-[10px] font-bold uppercase tracking-[2.5px] text-slate-400">
              CLIENT &amp; STAFF PORTAL
            </Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>
        </View>

        {/* ── Login Card ────────────────────────────────────────────────── */}
        <View className="rounded-[32px] border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
          <Text
            className="text-3xl font-bold text-[#0c2e25] leading-tight"
            style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
          >
            Welcome back.
          </Text>
          <Text className="mt-1 mb-5 text-xs text-slate-500 font-medium leading-relaxed">
            Sign in to access your workspace.
          </Text>

          {/* Quick Access */}
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold text-slate-600">
              Quick access
            </Text>
            <View className="gap-2">
              {[0, 2, 4].map((startIndex) => {
                const row = PRESETS.slice(startIndex, startIndex + 2);
                if (row.length === 0) return null;
                return (
                  <View key={startIndex} className="flex-row gap-2">
                    {row.map((item) => {
                      const isSelected = email.toLowerCase() === item.email.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setEmail(item.email);
                            setPassword(item.password);
                          }}
                          style={isSelected ? { borderColor: item.activeBorder, backgroundColor: item.activeBg } : {}}
                          className={`flex-1 flex-row items-center gap-2 rounded-2xl border p-2.5 ${
                            isSelected ? '' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <View
                            style={{ backgroundColor: item.iconBg }}
                            className="h-8 w-8 rounded-full items-center justify-center shrink-0"
                          >
                            <Text className="text-[11px] font-bold text-white tracking-wider">{item.initials}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-xs font-bold text-slate-900" numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text className="text-[10px] font-medium text-slate-400" numberOfLines={1}>
                              {item.role}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {row.length === 1 && <View className="flex-1" />}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Divider */}
          <View className="my-4 flex-row items-center justify-center gap-3">
            <View className="h-px flex-1 bg-slate-100" />
            <Text className="text-[11px] font-medium text-slate-400">
              or sign in with email
            </Text>
            <View className="h-px flex-1 bg-slate-100" />
          </View>

          {/* Inputs */}
          <View className="gap-3.5">
            <View>
              <Text className="mb-1.5 text-xs font-medium text-slate-700">
                Email address
              </Text>
              <View
                className={`flex-row items-center gap-2.5 rounded-2xl border px-3.5 ${
                  emailFocused ? 'border-[#0a4d3c] bg-white' : 'border-slate-200 bg-[#f8fafc]'
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
                  placeholderTextColor="#94a3b8"
                  className="flex-1 py-3 text-sm font-medium text-slate-900"
                />
              </View>
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-medium text-slate-700">
                Password
              </Text>
              <View
                className={`flex-row items-center gap-2.5 rounded-2xl border px-3.5 ${
                  passwordFocused ? 'border-[#0a4d3c] bg-white' : 'border-slate-200 bg-[#f8fafc]'
                }`}
              >
                <LockIcon />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 py-3 text-sm font-medium text-slate-900"
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <EyeIcon open={showPassword} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {error && (
            <View className="mt-3.5 rounded-xl border border-red-200 bg-red-50 p-2.5">
              <Text className="text-xs font-medium text-red-600">{error}</Text>
            </View>
          )}

          {/* Sign in Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={status === 'loading'}
            className="mt-5 rounded-2xl bg-[#0a4d3c] active:bg-[#073b2e] py-3.5 items-center justify-center flex-row gap-2 shadow-xs disabled:opacity-60"
          >
            {status === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-sm font-bold text-white">Sign in</Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14" />
                  <Path d="m12 5 7 7-7 7" />
                </Svg>
              </View>
            )}
          </TouchableOpacity>

          {/* Footer inside card */}
          <View className="mt-4 flex-row items-center justify-center gap-1.5">
            <LockIcon size={12} color="#64748b" />
            <Text className="text-xs font-medium text-slate-500">
              Client &amp; staff access
            </Text>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View className="mt-8 items-center">
          <View className="h-px w-28 bg-slate-200 mb-5" />
          <Text
            className="text-base font-semibold text-slate-800 tracking-tight"
            style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
          >
            Battery Intelligence
          </Text>
          <Text className="text-[10px] font-bold uppercase tracking-[3px] text-slate-400 mt-1">
            FLEET MANAGEMENT
          </Text>
        </View>
      </ScrollView>

      {/* ── Server Settings Modal ────────────────────────────────────────── */}
      <Modal visible={showSettings} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center p-5">
          <View className="w-full max-w-sm rounded-3xl bg-white p-6 border border-slate-200 shadow-2xl">
            <Text className="text-base font-extrabold text-slate-900">
              Backend Server Configuration
            </Text>
            <Text className="mt-1 text-xs text-slate-500">
              Set the backend API URL your phone connects to.
            </Text>

            <View className="mt-4">
              <Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                API Base URL
              </Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.x.x:5001/api"
                placeholderTextColor="#64748b"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900"
              />
            </View>

            {testResult && (
              <View
                className={`mt-3 rounded-xl p-2.5 ${
                  testResult.success ? 'bg-emerald-50 border border-emerald-300' : 'bg-red-50 border border-red-300'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    testResult.success ? 'text-emerald-700' : 'text-red-700'
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
                className="flex-1 rounded-xl bg-slate-100 py-2.5 items-center justify-center"
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Text className="text-xs font-bold text-slate-700">Test</Text>
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
                className="rounded-xl bg-slate-100 px-3 py-2.5 items-center justify-center"
              >
                <Text className="text-xs font-bold text-slate-600">Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowSettings(false);
                  setTestResult(null);
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 items-center justify-center"
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
