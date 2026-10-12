import { Alert, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../../services/api-client';
import Icon from '../../ui/Icon';

// Small building blocks shared by the super admin directory screens
// (clients, recycling partners, staff, user accounts) — same wording and
// layout cues as the web pages they mirror.

export const money = (v) => `£${Number(v || 0).toFixed(2)}`;

export function dateOnly(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Capitalizes the first letter of every word as it's typed (web ClientForm / StaffForm)
export function capitalizeWords(value) {
  return value.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());
}

export const errMessage = (err) => err?.response?.data?.message || err?.message || 'Something went wrong.';

export const listOf = (data) => (Array.isArray(data) ? data : data?.data || []);

// Opens a protected upload (staff documents) in the browser with the login token
export async function openUpload(path) {
  const token = await AsyncStorage.getItem('token');
  const origin = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
  await Linking.openURL(`${origin}${path.startsWith('/') ? '' : '/'}${path}?token=${encodeURIComponent(token || '')}`);
}

export function logoUrl(logoPath) {
  if (!logoPath) return null;
  const origin = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
  return `${origin}/uploads/client-logos/${logoPath}`;
}

// ConfirmModal equivalent: title + message, Cancel / confirm
export function confirm(title, message, confirmLabel = 'Delete', onConfirm, destructive = true) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function PageTitle({ title, description, children }) {
  return (
    <View className="mb-1">
      <Text className="text-2xl font-bold text-green-600">{title}</Text>
      {description ? <Text className="mt-0.5 text-xs text-slate-500">{description}</Text> : null}
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, tone = 'violet', small }) {
  const bg = { violet: 'bg-violet-700', emerald: 'bg-emerald-600', blue: 'bg-blue-600', dark: 'bg-slate-900', red: 'bg-red-600' }[tone] || 'bg-violet-700';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`items-center rounded-2xl ${bg} ${small ? 'px-3 py-2' : 'py-3'} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`${small ? 'text-xs' : 'text-sm'} font-bold text-white`}>{label}</Text>
    </TouchableOpacity>
  );
}

// RowActions equivalent: Edit / Delete as small text buttons
export function RowActions({ onEdit, onDelete, children }) {
  if (!onEdit && !onDelete && !children) return null;
  return (
    <View className="mt-2.5 flex-row flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
      {children}
      {onEdit ? (
        <TouchableOpacity onPress={onEdit} hitSlop={6} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5">
          <Text className="text-xs font-bold text-blue-700">Edit</Text>
        </TouchableOpacity>
      ) : null}
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} hitSlop={6} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
          <Text className="text-xs font-bold text-red-700">Delete</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ErrorBox({ message, onClose }) {
  if (!message) return null;
  return (
    <View className="flex-row items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
      <Text className="flex-1 text-xs font-semibold text-red-700">{message}</Text>
      {onClose ? (
        <TouchableOpacity onPress={onClose} hitSlop={8}><Icon name="x" color="#b91c1c" size={14} /></TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Label({ children, required }) {
  return (
    <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
      {children}{required ? <Text className="text-red-500"> *</Text> : null}
    </Text>
  );
}

export function Input({ label, required, help, style, ...props }) {
  return (
    <View>
      {label ? <Label required={required}>{label}</Label> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900"
        style={style}
        {...props}
      />
      {help ? <Text className="mt-1 text-[11px] text-slate-400">{help}</Text> : null}
    </View>
  );
}

export function Checkbox({ checked, onPress, label, sub, tone = 'emerald' }) {
  const on = tone === 'emerald' ? 'border-emerald-600 bg-emerald-600' : 'border-blue-600 bg-blue-600';
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-start gap-2.5" hitSlop={4}>
      <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${checked ? on : 'border-slate-300 bg-white'}`}>
        {checked ? <Icon name="check" color="#fff" size={13} /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-800">{label}</Text>
        {sub ? <Text className="text-[11px] text-slate-500">{sub}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function Card({ children, className = '' }) {
  return <View className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</View>;
}

export function Stat({ label, value, sub, tone = 'neutral' }) {
  const color = { good: 'text-emerald-600', info: 'text-sky-600', warn: 'text-amber-600', warning: 'text-amber-600', neutral: 'text-slate-800' }[tone] || 'text-slate-800';
  return (
    <View className="min-w-[45%] flex-1 rounded-2xl border border-slate-200 bg-white p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className={`mt-0.5 text-xl font-black ${color}`}>{value}</Text>
      {sub ? <Text className="mt-0.5 text-[11px] text-slate-400">{sub}</Text> : null}
    </View>
  );
}

export function SearchBox({ value, onChangeText, placeholder, label }) {
  return (
    <View>
      {label ? <Text className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">{label}</Text> : null}
      <View className="flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <Icon name="search" color="#94a3b8" size={16} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
          autoCapitalize="none"
          className="min-w-0 flex-1 text-sm text-slate-900"
        />
        {value ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}><Icon name="x" color="#94a3b8" size={14} /></TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function Pill({ label, active, onPress, activeClass = 'bg-slate-900', activeText = 'text-white' }) {
  return (
    <TouchableOpacity onPress={onPress} className={`rounded-xl px-2.5 py-1.5 ${active ? activeClass : 'bg-slate-100'}`}>
      <Text className={`text-xs font-bold ${active ? activeText : 'text-slate-600'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function BackLink({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-1.5 self-start" hitSlop={8}>
      <Icon name="arrowLeft" color="#047857" size={15} />
      <Text className="text-sm font-semibold text-emerald-700">{label}</Text>
    </TouchableOpacity>
  );
}
