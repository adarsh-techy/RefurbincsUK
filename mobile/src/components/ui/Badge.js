import { Text, View } from 'react-native';

const TONES = {
  info: { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-400' },
  warning: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  good: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
  testing: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  neutral: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-200' },
  black: { bg: 'bg-black dark:bg-black', text: 'text-white dark:text-white' },
};

// battery/status strings from the API (snake_case) mapped to a tone +
// professional display label.
const STATUS_MAP = {
  registered: { tone: 'neutral', label: 'Registered (Not Serviced)' },
  with_client: { tone: 'info', label: 'With Client' },
  in_repair: { tone: 'warning', label: 'Awaiting Repair' },
  in_progress: { tone: 'critical', label: 'Repair In Progress' },
  in_testing: { tone: 'testing', label: 'In Testing' },
  testing: { tone: 'testing', label: 'In Testing' },
  repair_testing: { tone: 'testing', label: 'Repair Testing' },
  repaired: { tone: 'good', label: 'Repair Completed' },
  returned: { tone: 'info', label: 'Returned to Client' },
  unserviceable: { tone: 'critical', label: 'Unserviceable' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  recycled: { tone: 'black', label: 'Recycled' },
};

// New batteries are stored as 'registered' (never serviced). Older rows from
// before that status existed were stored as 'returned' — those still show as
// "Registered" when the battery was never on a truck, repaired or dispatched.
export function clientBatteryStatus(row) {
  if (!row) return undefined;
  const serviced = Boolean(row.truck_intake_id || row.intake_id || row.last_repaired_at || row.return_id);
  return row.status === 'returned' && !serviced ? 'registered' : row.status;
}

// Plain-text label for a battery status (for sentences and small chips).
export function statusLabel(status) {
  if (!status) return 'Registered';
  const meta = STATUS_MAP[status];
  if (meta) return meta.subLabel ? `${meta.label} · ${meta.subLabel}` : meta.label;
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Badge({ tone = 'neutral', children }) {
  const { bg, text } = TONES[tone] || TONES.neutral;
  return (
    <View className={`max-w-full shrink self-start rounded-full px-2.5 py-1 ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{children}</Text>
    </View>
  );
}

// Convenience wrapper for the battery status enum specifically.
export function StatusBadge({ status }) {
  const meta = STATUS_MAP[status] || { tone: 'neutral', label: status };
  if (meta.subLabel) {
    return (
      <View className="flex-row items-center self-start gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1">
        <View className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <Text className="text-xs font-medium text-red-700 dark:text-red-400">
          {meta.label}
        </Text>
        <Text className="text-xs text-red-400 dark:text-red-600">·</Text>
        <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">
          {meta.subLabel}
        </Text>
      </View>
    );
  }
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
