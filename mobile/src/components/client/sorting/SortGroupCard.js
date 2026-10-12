import { Text, TouchableOpacity, View } from 'react-native';
import Icon from '../../ui/Icon';
import { formatDate, groupStats } from './sort-utils';

// One sort group on the groups list — the web card: "Sort Group" label,
// "N In Service" pill, units badge, Available / Inventory-or-In Repair tiles,
// readiness bar, created + packed dates, Delete and Open Group.
export default function SortGroupCard({ group, codeToBattery, onOpen, onDelete }) {
  const { total, packed, ready, latestPackedDate } = groupStats(group, codeToBattery);
  const hasPacked = packed.length > 0;
  const readyPct = total ? Math.round((ready / total) * 100) : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onOpen}
      className={`overflow-hidden rounded-3xl border bg-white pl-2 dark:bg-slate-900 ${
        hasPacked ? 'border-rose-200 dark:border-rose-900/40' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <View className={`absolute bottom-0 left-0 top-0 w-2 ${hasPacked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            <View
              className={`h-11 w-11 items-center justify-center rounded-2xl border ${
                hasPacked ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <Icon name="grid" size={20} color={hasPacked ? '#e11d48' : '#059669'} />
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sort Group</Text>
                {hasPacked && (
                  <View className="flex-row items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5">
                    <View className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <Text className="text-[10px] font-extrabold text-rose-700">{packed.length} In Service</Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-base font-black text-slate-900 dark:text-white" numberOfLines={1}>
                {group.name}
              </Text>
            </View>
          </View>
          <View
            className={`flex-row items-center gap-1 rounded-xl border px-2.5 py-1.5 ${
              hasPacked ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <Text className={`font-mono text-sm font-black ${hasPacked ? 'text-rose-800' : 'text-slate-700 dark:text-slate-200'}`}>{total}</Text>
            <Text className="text-[10px] font-bold uppercase text-slate-400">{total === 1 ? 'Unit' : 'Units'}</Text>
          </View>
        </View>

        <View className="mt-3.5 flex-row gap-2.5">
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/70">
            <View className="h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
              <Icon name="package" size={16} color="#1d4ed8" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available</Text>
              <Text className="text-xs font-black text-slate-900 dark:text-white" numberOfLines={1}>
                {ready} {ready === 1 ? 'Battery' : 'Batteries'}
              </Text>
            </View>
          </View>
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/70">
            <View className={`h-8 w-8 items-center justify-center rounded-xl ${hasPacked ? 'bg-rose-100' : 'bg-emerald-100'}`}>
              <Icon name={hasPacked ? 'truck' : 'checkCircle'} size={16} color={hasPacked ? '#be123c' : '#047857'} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{hasPacked ? 'In Repair' : 'Inventory'}</Text>
              <Text className={`text-xs font-black ${hasPacked ? 'text-rose-700' : 'text-emerald-700'}`} numberOfLines={1}>
                {hasPacked ? `${packed.length} Dispatched` : 'Ready to Pack'}
              </Text>
            </View>
          </View>
        </View>

        {total > 0 && (
          <View className="mt-3.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-semibold text-slate-500">Readiness</Text>
              <Text className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{readyPct}% Available</Text>
            </View>
            <View className="mt-1.5 h-1.5 w-full flex-row overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <View style={{ width: `${(ready / total) * 100}%` }} className="h-full bg-emerald-500" />
              {hasPacked && <View style={{ width: `${(packed.length / total) * 100}%` }} className="h-full bg-rose-500" />}
            </View>
          </View>
        )}

        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Icon name="calendar" size={13} color="#94a3b8" />
            <Text className="text-[11px] text-slate-500">Created {formatDate(group.createdAt)}</Text>
          </View>
          {hasPacked && latestPackedDate ? (
            <Text className="text-[11px] font-semibold text-rose-600">Packed {formatDate(latestPackedDate)}</Text>
          ) : null}
        </View>

        <View className="mt-3.5 flex-row items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <TouchableOpacity onPress={onDelete} hitSlop={8} className="flex-row items-center gap-1.5 rounded-xl px-1 py-1">
            <Icon name="x" size={13} color="#94a3b8" />
            <Text className="text-xs font-semibold text-slate-400">Delete</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <Text className={`text-xs font-black ${hasPacked ? 'text-rose-600' : 'text-emerald-600'}`}>Open Group</Text>
            <Icon name="arrowRight" size={13} color={hasPacked ? '#e11d48' : '#059669'} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
