import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, clientBatteryStatus } from '../../ui/Badge';
import SharedDateField from '../../ui/DateField';

// Helpers and small building blocks shared by the client battery screens
// (All / Packed / Received / In Service) — same rules as the web
// ClientBatteriesPage, so both apps filter, group and label alike.

export function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// YYYY-MM-DD in the phone's own timezone
export function toLocalDateValue(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// Already in the repair pipeline (or unserviceable): can't be packed again
export const NOT_RETURNABLE_STATUSES = new Set(['in_repair', 'in_progress', 'in_testing', 'repaired', 'unserviceable']);

export function hasBeenServiced(row) {
  return Boolean(row.truck_intake_id || row.intake_id || row.last_repaired_at || row.return_id);
}

export const normalizeTruck = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// A grouped batch (optionally with one of its battery rows) → the
// truck_intake id its API calls need; null for an awaiting-pickup group.
export function resolveBatchIntakeId(batch, battery = null) {
  if (!batch) return null;
  if (batch.intakeId) return batch.intakeId;
  if (battery?.truck_intake_id || battery?.intake_id) return battery.truck_intake_id || battery.intake_id;
  const tagged = batch.batteries?.find((b) => b.truck_intake_id || b.intake_id);
  if (tagged) return tagged.truck_intake_id || tagged.intake_id;
  if (typeof batch.key === 'string' && batch.key.startsWith('truck_')) {
    const n = Number(batch.key.replace('truck_', ''));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

// Driver names start with a capital, like the web form
export const capitalizeFirst = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

// Labels the client sees (web ClientStatusBadge): "In Service (Repairing)",
// "Received Back" once a return is confirmed, etc.
const CLIENT_STATUS_MAP = {
  registered: { tone: 'neutral', label: 'Registered (Not Serviced)' },
  with_client: { tone: 'info', label: 'With Client' },
  in_repair: { tone: 'warning', label: 'In Service (Awaiting Repair)' },
  in_progress: { tone: 'warning', label: 'In Service (Repairing)' },
  in_testing: { tone: 'testing', label: 'In Testing & QA' },
  testing: { tone: 'testing', label: 'In Testing & QA' },
  repair_testing: { tone: 'testing', label: 'In Testing & QA' },
  repaired: { tone: 'good', label: 'Service Completed' },
  returned: { tone: 'info', label: 'Returned' },
  unserviceable: { tone: 'critical', label: 'Unserviceable' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  unserviceable_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  recycled: { tone: 'black', label: 'Recycled' },
};

export function clientStatusLabel(row, { isVerified } = {}) {
  const status = clientBatteryStatus(row) || 'registered';
  if (status === 'returned') {
    const verified = isVerified === true || row.return_status === 'verified' || Boolean(row.return_verified_at);
    return verified ? { tone: 'good', label: 'Received Back' } : { tone: 'info', label: 'Returned' };
  }
  return CLIENT_STATUS_MAP[status] || { tone: 'neutral', label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export function ClientStatusBadge({ row, isVerified }) {
  const meta = clientStatusLabel(row, { isVerified });
  if (meta.subLabel) {
    return (
      <View className="flex-row items-center self-start gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1">
        <View className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <Text className="text-xs font-medium text-red-700 dark:text-red-400">{meta.label}</Text>
        <Text className="text-xs text-red-400">·</Text>
        <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">{meta.subLabel}</Text>
      </View>
    );
  }
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function Notice({ tone = 'good', children }) {
  if (!children) return null;
  const cls = tone === 'good'
    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/40'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/40'
      : 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/40';
  const text = tone === 'good' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'warn' ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  return (
    <View className={`rounded-2xl border p-3 ${cls}`}>
      <Text className={`text-xs font-semibold ${text}`}>{children}</Text>
    </View>
  );
}

export const inputClass =
  'rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-slate-900 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-white';

export function FieldLabel({ children, required, optional }) {
  return (
    <Text className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
      {children}
      {required ? <Text className="font-bold text-red-500"> *</Text> : null}
      {optional ? <Text className="font-normal text-slate-400"> (Optional)</Text> : null}
    </Text>
  );
}

// Full-screen sheet with a title bar — the phone version of the web Modal.
// `footer` stays pinned at the bottom (the web's sticky actions bar).
export function Sheet({ visible, title, description, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50 dark:bg-slate-950">
        <View className="border-b border-slate-200 bg-white px-4 pb-3 dark:border-slate-800 dark:bg-slate-900" style={{ paddingTop: Math.max(48, insets.top + 12) }}>
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-base font-extrabold text-slate-900 dark:text-white">{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text className="text-sm font-bold text-slate-500">Close</Text>
            </TouchableOpacity>
          </View>
          {description ? <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</Text> : null}
        </View>
        <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center p-4 gap-4 pb-10" keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? (
          <View className="border-t border-slate-200 bg-white px-4 pt-3 dark:border-slate-800 dark:bg-slate-900" style={{ paddingBottom: Math.max(32, insets.bottom + 12) }}>
            <View className="w-full max-w-2xl self-center">{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Small centred dialog — confirmations and short forms
export function Dialog({ visible, title, description, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full max-w-md rounded-3xl bg-white p-5 dark:bg-slate-900">
          {title ? <Text className="text-base font-extrabold text-slate-900 dark:text-white">{title}</Text> : null}
          {description ? <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function Btn({ label, onPress, disabled, tone = 'primary', className = '' }) {
  const bg = {
    primary: 'bg-emerald-600',
    blue: 'bg-blue-600',
    danger: 'bg-red-600',
    amber: 'bg-amber-500',
    ghost: 'bg-slate-100 dark:bg-slate-800',
    outline: 'border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900',
  }[tone];
  const text = tone === 'ghost' || tone === 'outline' ? 'text-slate-700 dark:text-slate-200' : 'text-white';
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      className={`items-center justify-center rounded-xl px-4 py-3 ${bg} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      <Text className={`text-sm font-bold ${text}`}>{label}</Text>
    </TouchableOpacity>
  );
}

// Exact-day filter (web <input type="date">): native date picker or
// type YYYY-MM-DD, plus Today / Clear
export function DateField({ label, value, onChange }) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</Text>
      <View className="flex-row items-center gap-1.5">
        <View className="flex-1">
          <SharedDateField value={value || ''} onChange={onChange} quick={false} clearable={false} />
        </View>
        {value ? (
          <TouchableOpacity onPress={() => onChange('')} className="rounded-xl bg-slate-100 px-2.5 py-2 dark:bg-slate-800">
            <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Clear</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => onChange(toLocalDateValue(new Date()))} className="rounded-xl bg-slate-100 px-2.5 py-2 dark:bg-slate-800">
            <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Today</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
