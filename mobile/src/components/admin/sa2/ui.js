import { Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Icon from '../../ui/Icon';
import { resolveImageUrl } from '../../../utils/imageUrl';

// Small building blocks shared by the super admin Truck Intake, Returns and
// Recycle screens (the phone versions of the web TruckIntakePage,
// ReturnsPage, RecyclePage and their detail pages / forms).

export const useIsSuperAdmin = () => useSelector((s) => s.auth.user?.role === 'super_admin');
export const useRole = () => useSelector((s) => s.auth.user?.role);

export const money = (v) => `£${Number(v || 0).toFixed(2)}`;
export const dateTime = (v) => (v ? new Date(v).toLocaleString() : '—');
export const dateOnly = (v) => (v ? new Date(v).toLocaleDateString() : '—');
export const timeOnly = (v) => (v ? new Date(v).toLocaleTimeString() : '—');
export const ukDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const shortTime = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

// YYYY-MM-DD in the phone's own timezone — what the web date filters compare
export function localYmd(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const apiError = (err) => err?.response?.data?.message || err?.message || 'Something went wrong';

// Opens an uploaded document (return note etc.) in the browser / viewer,
// with the login token for protected uploads — the web's resolveImageUrl link.
export function openUpload(path) {
  const url = resolveImageUrl(path);
  if (url) Linking.openURL(url);
}

export function PageIntro({ title, description, action }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-2xl font-bold tracking-tight text-green-600">{title}</Text>
        {description ? <Text className="mt-0.5 text-xs text-slate-500">{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, tone = 'violet', small = false, icon }) {
  const bg = { violet: 'bg-violet-700', emerald: 'bg-emerald-600', rose: 'bg-rose-600', slate: 'bg-slate-800', blue: 'bg-blue-600' }[tone];
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-1.5 rounded-xl ${bg} ${small ? 'px-3 py-2' : 'px-4 py-3'} ${disabled ? 'opacity-50' : ''}`}
    >
      {icon ? <Icon name={icon} color="#fff" size={14} /> : null}
      <Text className={`${small ? 'text-xs' : 'text-sm'} font-bold text-white`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ label, onPress, disabled, tone = 'slate', small = false }) {
  const text = { slate: 'text-slate-700', blue: 'text-blue-700', rose: 'text-rose-600', emerald: 'text-emerald-700' }[tone];
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      className={`items-center justify-center rounded-xl border border-slate-300 bg-white ${small ? 'px-2.5 py-1.5' : 'px-4 py-3'} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`${small ? 'text-[11px]' : 'text-sm'} font-bold ${text}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Label({ children, right }) {
  return (
    <View className="mb-1.5 flex-row items-center justify-between">
      <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">{children}</Text>
      {right}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      autoCorrect={false}
      {...props}
      className={`rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 ${props.editable === false ? 'bg-slate-100 text-slate-500' : ''} ${props.className || ''}`}
    />
  );
}

export function SearchBox({ value, onChangeText, placeholder }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <Icon name="search" color="#94a3b8" size={15} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        className="min-w-0 flex-1 text-xs text-slate-900"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Text className="text-xs font-bold text-slate-400">✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Feedback({ feedback }) {
  if (!feedback) return null;
  const box = { good: 'border-emerald-200 bg-emerald-50', warn: 'border-amber-200 bg-amber-50' }[feedback.tone] || 'border-red-200 bg-red-50';
  const text = { good: 'text-emerald-900', warn: 'text-amber-900' }[feedback.tone] || 'text-red-900';
  const icon = feedback.tone === 'good' ? '✅' : feedback.tone === 'warn' ? '⚠️' : '❌';
  return (
    <View className={`flex-row items-start gap-2 rounded-xl border px-3 py-2 ${box}`}>
      <Text className="text-xs">{icon}</Text>
      <Text className={`flex-1 text-xs font-semibold ${text}`}>{feedback.message}</Text>
    </View>
  );
}

export function ErrorBox({ text }) {
  if (!text) return null;
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <Icon name="alertTriangle" color="#b91c1c" size={14} />
      <Text className="flex-1 text-xs font-semibold text-red-700">{text}</Text>
    </View>
  );
}

export function StatTile({ label, value, tone = 'slate', onPress, active, badge }) {
  const valueCls = { slate: 'text-slate-900', blue: 'text-blue-700', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700', sky: 'text-sky-700', purple: 'text-purple-700', orange: 'text-orange-700' }[tone];
  const activeCls = {
    slate: 'border-slate-500 bg-slate-50', blue: 'border-blue-500 bg-blue-50', emerald: 'border-emerald-500 bg-emerald-50', amber: 'border-amber-500 bg-amber-50',
    rose: 'border-rose-500 bg-rose-50', sky: 'border-sky-500 bg-sky-50', purple: 'border-purple-500 bg-purple-50', orange: 'border-orange-500 bg-orange-50',
  }[tone];
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} className={`min-w-[46%] flex-1 rounded-xl border p-3 ${active ? activeCls : 'border-slate-200 bg-white'}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${active ? valueCls : 'text-slate-500'}`} numberOfLines={1}>{label}</Text>
      <View className="mt-1.5 flex-row items-baseline justify-between gap-1">
        <Text className={`text-2xl font-black ${valueCls}`}>{value}</Text>
        {badge ? <Text className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{badge}</Text> : null}
      </View>
    </Wrap>
  );
}

// Centered confirm / alert dialog (the web ConfirmModal / AlertModal)
export function Dialog({ visible, title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, danger = false, busy = false, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        <View className="w-full max-w-md rounded-3xl bg-white p-5">
          <Text className="text-base font-extrabold text-slate-900">{title}</Text>
          {message ? <Text className="mt-2 text-sm leading-5 text-slate-600">{message}</Text> : null}
          {children}
          <View className="mt-5 flex-row justify-end gap-2">
            {onCancel && cancelLabel ? <GhostButton label={cancelLabel} onPress={onCancel} disabled={busy} /> : null}
            {onConfirm ? (
              <PrimaryButton label={busy ? 'Working…' : confirmLabel || 'OK'} onPress={onConfirm} disabled={busy} tone={danger ? 'rose' : 'violet'} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Full-screen form sheet (the web Modal with title + description)
export function Sheet({ visible, title, description, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
        <View className="border-b border-slate-200 bg-white px-4 pb-3" style={{ paddingTop: Math.max(48, insets.top + 12) }}>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-base font-extrabold text-slate-900">{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="x" color="#64748b" size={20} />
            </TouchableOpacity>
          </View>
          {description ? <Text className="mt-0.5 text-xs text-slate-500">{description}</Text> : null}
        </View>
        <ScrollView contentContainerClassName="w-full max-w-2xl self-center p-4 gap-4 pb-10" keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer ? <View className="border-t border-slate-200 bg-white p-4" style={{ paddingBottom: Math.max(32, insets.bottom + 12) }}><View className="w-full max-w-2xl self-center">{footer}</View></View> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Client picker rendered as a tappable list (web <select>)
export function ClientSelect({ clients, value, onChange, placeholder = 'Select a client' }) {
  return (
    <View className="overflow-hidden rounded-xl border border-slate-300 bg-white">
      {clients.length === 0 ? <Text className="px-3.5 py-3 text-xs text-slate-400">{placeholder} — loading…</Text> : null}
      {clients.map((c, i) => {
        const on = String(c.id) === String(value);
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => onChange(String(c.id), c)}
            className={`flex-row items-center justify-between px-3.5 py-2.5 ${i ? 'border-t border-slate-100' : ''} ${on ? 'bg-emerald-50' : ''}`}
          >
            <Text className={`text-sm ${on ? 'font-bold text-emerald-800' : 'font-medium text-slate-800'}`}>{c.name}</Text>
            {on ? <Text className="text-xs font-bold text-emerald-600">✓ Selected</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Row actions (web RowActions: Edit / Delete)
export function RowActions({ onEdit, onDelete }) {
  return (
    <View className="flex-row gap-2">
      <TouchableOpacity onPress={onEdit} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5">
        <Text className="text-[11px] font-bold text-blue-700">Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5">
        <Text className="text-[11px] font-bold text-rose-600">Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

export function Field({ label, value, valueClass = 'text-blue-700' }) {
  return (
    <Text className="text-xs text-slate-500">
      {label}: <Text className={`font-semibold ${valueClass}`}>{value}</Text>
    </Text>
  );
}
