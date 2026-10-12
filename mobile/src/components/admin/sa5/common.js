import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { resolveImageUrl } from '../../../utils/imageUrl';

// Small building blocks shared by the super-admin Ratings, Certificates,
// Audit Log and Trash screens (web: features/ratings, certificates,
// audit-log, trash).

// web utils/logo-url: client logos live under /uploads/client-logos/
export function logoUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:|file:)/.test(path) || path.startsWith('/')) return resolveImageUrl(path);
  return resolveImageUrl(`/uploads/client-logos/${path}`);
}

export function initials(name, fallback = 'U') {
  if (!name) return fallback;
  return name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

// web Trash formatRelativeTime (the detail page says "N days ago")
export function relativeTime(value, longDays = false) {
  if (!value) return '';
  const date = new Date(value);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const dayN = Math.floor(hour / 24);
  if (sec < 60) return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  if (dayN === 1) return 'Yesterday';
  if (dayN < 30) return longDays ? `${dayN} days ago` : `${dayN}d ago`;
  return date.toLocaleDateString();
}

export function Card({ children, className = '' }) {
  return <View className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</View>;
}

export function ClientLogo({ path, name, size = 44, className = '' }) {
  const uri = logoUrl(path);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        resizeMode="contain"
        style={{ width: size, height: size }}
        className={`rounded-xl border border-slate-200 bg-white ${className}`}
      />
    );
  }
  return (
    <View style={{ width: size, height: size }} className={`items-center justify-center rounded-xl bg-blue-600 ${className}`}>
      <Text className="font-black text-white" style={{ fontSize: size * 0.36 }}>{(name || 'C')[0]?.toUpperCase()}</Text>
    </View>
  );
}

// Tappable pill row (web chips / selects)
export function Chips({ options, value, onChange, activeClass = 'bg-blue-600' }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const active = String(value) === String(o.id);
        return (
          <TouchableOpacity key={String(o.id)} onPress={() => onChange(o.id)} className={`flex-row items-center gap-1 rounded-xl px-3 py-1.5 ${active ? activeClass : 'border border-slate-200 bg-white'}`}>
            <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{o.label}</Text>
            {o.count != null ? (
              <Text className={`rounded-md px-1.5 text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{o.count}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function SmallButton({ label, onPress, tone = 'light', disabled, className = '' }) {
  const styles = {
    light: ['border border-slate-200 bg-white', 'text-slate-700'],
    dark: ['bg-slate-900', 'text-white'],
    primary: ['bg-blue-600', 'text-white'],
    green: ['bg-emerald-600', 'text-white'],
    danger: ['border border-red-300 bg-red-50', 'text-red-700'],
  }[tone];
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} className={`items-center justify-center rounded-xl px-3.5 py-2 ${styles[0]} ${disabled ? 'opacity-50' : ''} ${className}`}>
      <Text className={`text-xs font-bold ${styles[1]}`}>{label}</Text>
    </TouchableOpacity>
  );
}

// Dismissable success / error strip (web eval message, etc.)
export function Banner({ text, tone = 'good', onClose }) {
  if (!text) return null;
  const cls = tone === 'bad' ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50';
  const txt = tone === 'bad' ? 'text-red-800' : 'text-emerald-900';
  return (
    <View className={`flex-row items-center gap-2 rounded-2xl border p-3 ${cls}`}>
      <Text className={`flex-1 text-xs font-bold ${txt}`}>{text}</Text>
      {onClose ? (
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text className={`text-sm font-bold ${txt}`}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Loading({ text }) {
  return (
    <View className="items-center justify-center py-16">
      <ActivityIndicator color="#2563eb" />
      {text ? <Text className="mt-2 text-xs text-slate-500">{text}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = '★', title, text, action }) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10">
      <Text className="text-3xl text-slate-300">{icon}</Text>
      <Text className="mt-2 text-center text-sm font-bold text-slate-800">{title}</Text>
      {text ? <Text className="mt-1 text-center text-xs leading-5 text-slate-500">{text}</Text> : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

// web ConfirmModal (tone="critical")
export function ConfirmModal({ open, title, description, confirmLabel, cancelLabel = 'Cancel', loading, onConfirm, onCancel }) {
  return (
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-md rounded-3xl bg-white p-5">
          <Text className="text-base font-black text-slate-900">{title}</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-600">{description}</Text>
          <View className="mt-5 flex-row justify-end gap-2">
            <SmallButton label={cancelLabel} onPress={onCancel} disabled={loading} />
            <TouchableOpacity disabled={loading} onPress={onConfirm} className={`flex-row items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 ${loading ? 'opacity-60' : ''}`}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Text className="text-xs font-bold text-white">{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
