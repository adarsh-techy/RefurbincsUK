import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../../ui/Icon';

// Small building blocks for the super admin Parts / Services / Issue Reasons
// / Invoices / Finance screens — the phone versions of the web Modal,
// ConfirmModal, AlertModal, form inputs and stat cards those pages use.

export const money = (v) => `£${Number(v || 0).toFixed(2)}`;
export const dateOnly = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (v) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return (user.permissions || []).includes(permission);
}

// Web <Modal title description> → bottom sheet with a scrolling body
export function Sheet({ visible, title, description, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[92%] rounded-t-3xl bg-white">
          <View className="flex-row items-start gap-3 border-b border-slate-100 px-5 pb-3 pt-5">
            <View className="flex-1">
              <Text className="text-base font-extrabold text-slate-900">{title}</Text>
              {description ? <Text className="mt-0.5 text-xs text-slate-500">{description}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <Icon name="x" color="#475569" size={16} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="p-5 pb-10 gap-4">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Web ConfirmModal: optional "type the word" guard (requireTyping)
export function ConfirmDialog({ visible, title, message, confirmLabel = 'Delete', confirmWord = 'delete', requireTyping = false, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  const ok = !requireTyping || typed.trim().toLowerCase() === confirmWord.toLowerCase();
  const close = () => { setTyped(''); onCancel(); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full rounded-3xl bg-white p-5">
          <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <Icon name="alertTriangle" color="#dc2626" size={20} />
          </View>
          <Text className="text-base font-extrabold text-slate-900">{title}</Text>
          <Text className="mt-1 text-sm text-slate-600">{message}</Text>
          {requireTyping && (
            <>
              <Text className="mt-3 text-xs text-slate-500">Type <Text className="font-bold text-slate-800">{confirmWord}</Text> to confirm.</Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={confirmWord}
                placeholderTextColor="#94a3b8"
                className="mt-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900"
              />
            </>
          )}
          <View className="mt-4 flex-row gap-2">
            <TouchableOpacity onPress={close} className="flex-1 items-center rounded-2xl bg-slate-100 py-3">
              <Text className="text-sm font-bold text-slate-700">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!ok || busy}
              onPress={async () => { await onConfirm(); setTyped(''); }}
              className={`flex-1 items-center rounded-2xl bg-red-600 py-3 ${!ok || busy ? 'opacity-50' : ''}`}
            >
              <Text className="text-sm font-bold text-white">{busy ? 'Working…' : confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Web AlertModal
export function AlertDialog({ visible, title, message, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full rounded-3xl bg-white p-5">
          <Text className="text-base font-extrabold text-slate-900">{title}</Text>
          <Text className="mt-1 text-sm text-slate-600">{message}</Text>
          <TouchableOpacity onPress={onClose} className="mt-4 items-center rounded-2xl bg-slate-900 py-3">
            <Text className="text-sm font-bold text-white">OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function Field({ label, help, error, children }) {
  return (
    <View>
      <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text>
      {children}
      {help ? <Text className="mt-1 text-[11px] text-slate-500">{help}</Text> : null}
      {error ? <Text className="mt-1 text-[11px] font-semibold text-red-600">{error}</Text> : null}
    </View>
  );
}

export function Input({ multiline, className = '', ...props }) {
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={`rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 ${multiline ? 'min-h-[80px]' : ''} ${className}`}
      {...props}
    />
  );
}

export function CheckRow({ value, onChange, label }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.8} className="flex-row items-center gap-3">
      <Switch value={value} onValueChange={onChange} />
      <Text className="flex-1 text-sm text-slate-700">{label}</Text>
    </TouchableOpacity>
  );
}

export function FormButtons({ onCancel, onSubmit, submitting, label, disabled, color = 'bg-emerald-600' }) {
  return (
    <View className="flex-row justify-end gap-2 border-t border-slate-100 pt-4">
      {onCancel && (
        <TouchableOpacity onPress={onCancel} className="rounded-xl px-4 py-2.5">
          <Text className="text-sm font-medium text-slate-600">Cancel</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity disabled={submitting || disabled} onPress={onSubmit} className={`rounded-xl px-4 py-2.5 ${color} ${submitting || disabled ? 'opacity-50' : ''}`}>
        <Text className="text-sm font-bold text-white">{submitting ? 'Saving…' : label}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function Chips({ options, value, onChange, activeClass = 'bg-slate-900', wrap = false }) {
  const body = options.map((o) => {
    const active = value === o.id;
    return (
      <TouchableOpacity key={String(o.id)} onPress={() => onChange(o.id)} className={`rounded-full px-3 py-1.5 ${active ? activeClass : 'bg-slate-100'}`}>
        <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>{o.label}</Text>
      </TouchableOpacity>
    );
  });
  if (wrap) return <View className="flex-row flex-wrap gap-1.5">{body}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
      {body}
    </ScrollView>
  );
}

const STAT_TONES = {
  good: 'text-emerald-700',
  neutral: 'text-slate-900',
  info: 'text-blue-700',
  warning: 'text-amber-700',
  purple: 'text-violet-700',
  critical: 'text-red-700',
};

// Web StatCard (icon, label, value, sub, tone)
export function Stat({ label, value, sub, tone = 'neutral', icon, onPress, className = 'w-[48%]' }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.85} className={`${className} rounded-2xl border border-slate-200 bg-white p-3.5`}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</Text>
        {icon ? <Icon name={icon} color="#94a3b8" size={14} /> : null}
      </View>
      <Text className={`mt-1 text-lg font-black ${STAT_TONES[tone] || STAT_TONES.neutral}`}>{value}</Text>
      {sub ? <Text className="mt-0.5 text-[10px] text-slate-500">{sub}</Text> : null}
    </Wrap>
  );
}

export function SearchBox({ value, onChangeText, placeholder }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Icon name="search" color="#94a3b8" size={15} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
        autoCapitalize="none"
        className="flex-1 text-sm text-slate-900"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10}>
          <Icon name="x" color="#94a3b8" size={14} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Empty({ title, text, children }) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6">
      <Text className="text-center text-sm font-bold text-slate-800">{title}</Text>
      {text ? <Text className="mt-1 text-center text-xs text-slate-500">{text}</Text> : null}
      {children}
    </View>
  );
}

export function PageHead({ title, description, color = 'text-green-600', children }) {
  return (
    <View className="gap-1">
      <Text className={`text-2xl font-bold tracking-tight ${color}`}>{title}</Text>
      {description ? <Text className="text-xs text-slate-500">{description}</Text> : null}
      {children ? <View className="mt-2 flex-row flex-wrap gap-2">{children}</View> : null}
    </View>
  );
}

export function Btn({ label, onPress, tone = 'violet', disabled, small }) {
  const bg = {
    violet: 'bg-violet-800',
    primary: 'bg-blue-600',
    secondary: 'bg-amber-100 border border-amber-300',
    emerald: 'bg-emerald-600',
    outline: 'bg-white border border-slate-300',
    danger: 'bg-white border border-red-300',
  }[tone];
  const text = { secondary: 'text-amber-900', outline: 'text-slate-700', danger: 'text-red-600' }[tone] || 'text-white';
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} className={`rounded-xl ${small ? 'px-3 py-1.5' : 'px-4 py-2.5'} ${bg} ${disabled ? 'opacity-50' : ''}`}>
      <Text className={`${small ? 'text-[11px]' : 'text-xs'} font-bold ${text}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ErrorBox({ text }) {
  if (!text) return null;
  return (
    <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
      <Text className="text-xs font-semibold text-red-700">{text}</Text>
    </View>
  );
}
