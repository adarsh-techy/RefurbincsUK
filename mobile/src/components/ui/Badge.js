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
  registered: { tone: 'neutral', label: 'Registered' },
  with_client: { tone: 'info', label: 'With Client' },
  in_repair: { tone: 'warning', label: 'Pending' },
  in_progress: { tone: 'critical', label: 'In Progress' },
  in_testing: { tone: 'testing', label: 'In Testing' },
  testing: { tone: 'testing', label: 'In Testing' },
  repair_testing: { tone: 'testing', label: 'Repair Testing' },
  repaired: { tone: 'good', label: 'Completed' },
  returned: { tone: 'info', label: 'Returned' },
  unserviceable: { tone: 'critical', label: 'Unserviceable' },
  tested_parts_removed: { tone: 'critical', label: 'Unserviceable', subLabel: 'Test Failed' },
  recycled: { tone: 'black', label: 'Recycled' },
};

export function Badge({ tone = 'neutral', children }) {
  const { bg, text } = TONES[tone] || TONES.neutral;
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${bg}`}>
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
