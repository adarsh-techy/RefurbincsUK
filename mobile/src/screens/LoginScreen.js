import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import { login } from '../store/auth-slice';

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
              source={require('../../assets/brand-mark.png')}
              style={{ width: 210, height: 68 }}
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

          {/* Quick Fill Buttons */}
          <View className="mb-5 flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                setEmail('humanforest@gmail.com');
                setPassword('12345678');
              }}
              className="flex-1 rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/10 py-2 items-center"
            >
              <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">⚡ HumanForest</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setEmail('superadmin@gmail.com');
                setPassword('123456');
              }}
              className="flex-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 py-2 items-center"
            >
              <Text className="text-xs font-bold text-slate-600 dark:text-slate-300">Super Admin</Text>
            </TouchableOpacity>
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
    </KeyboardAvoidingView>
  );
}
