import { Text, TouchableOpacity, View } from 'react-native';
import Icon from '../../ui/Icon';
import { StatusBadge, clientBatteryStatus } from '../../ui/Badge';
import { formatDate, getBatteryPackedDate, isBatteryPackedForRepair } from './sort-utils';

// A battery inside an open sort group, in the web's two views:
//   • "table" row — #, Battery ID, Physical Serial Number, Packed to Service
//     status, History →, remove
//   • "cards" card — code, SN, status badge, Packed to Service + date/truck,
//     remove
export default function SortedBattery({ code, index, match, view, onOpenHistory, onRemove }) {
  const packed = isBatteryPackedForRepair(match);
  const packedDate = getBatteryPackedDate(match);

  const removeButton = (
    <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityLabel="Remove from group" className="rounded-lg p-1.5">
      <Icon name="x" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );

  if (view === 'table') {
    return (
      <View className="flex-row items-center gap-2.5 border-b border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <Text className="w-7 text-[11px] font-semibold text-slate-400">{index + 1}</Text>
        <View className="min-w-0 flex-1">
          <TouchableOpacity onPress={onOpenHistory}>
            <Text className={`font-mono text-xs font-bold ${packed ? 'text-red-700' : 'text-blue-700 dark:text-blue-400'}`}>{code}</Text>
          </TouchableOpacity>
          <Text className="mt-0.5 font-mono text-[11px] text-slate-500" numberOfLines={1}>
            {match?.serial_number ? `SN: ${match.serial_number}` : 'SN: —'}
          </Text>
          {packed ? (
            <View className="mt-1 self-start rounded-md bg-red-100 px-2 py-0.5">
              <Text className="text-[10px] font-extrabold uppercase text-red-800">
                Packed to Service{packedDate ? ` (${formatDate(packedDate)})` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={onOpenHistory} className="flex-row items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">History →</Text>
        </TouchableOpacity>
        {removeButton}
      </View>
    );
  }

  return (
    <View
      className={`rounded-xl sm:rounded-2xl border p-3 sm:p-4 ${
        packed ? 'border-rose-300 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      <View className="flex-row items-start justify-between gap-2.5">
        <View className="min-w-0 flex-1">
          <TouchableOpacity onPress={onOpenHistory}>
            <Text className={`font-mono text-xs sm:text-sm font-black ${packed ? 'text-rose-700' : 'text-slate-900 dark:text-white'}`} numberOfLines={1}>
              {code}
            </Text>
          </TouchableOpacity>
          {match?.serial_number ? <Text className="mt-0.5 font-mono text-[10px] sm:text-[11px] text-slate-500">SN: {match.serial_number}</Text> : null}
        </View>
        {removeButton}
      </View>
      <View className="mt-2.5 sm:mt-3 border-t border-slate-100 pt-2.5 sm:pt-3 dark:border-slate-800">
        <View className="flex-row flex-wrap items-center justify-between gap-1.5 sm:gap-2">
          {match ? (
            <StatusBadge status={clientBatteryStatus(match)} />
          ) : (
            <Text className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-600">Not in your fleet</Text>
          )}
          {packed ? (
            <View className="rounded-full bg-rose-100 px-2 sm:px-2.5 py-0.5">
              <Text className="text-[9px] sm:text-[10px] font-black uppercase text-rose-800">Packed to Service</Text>
            </View>
          ) : null}
        </View>
        {packed && packedDate ? (
          <Text className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] font-semibold text-rose-700">
            Packed to Service: <Text className="font-normal text-slate-600">{formatDate(packedDate)}</Text>
            {match?.truck_number ? ` • Truck ${match.truck_number}` : ''}
          </Text>
        ) : null}
        <TouchableOpacity onPress={onOpenHistory} className="mt-2 sm:mt-2.5 self-start rounded-md sm:rounded-lg bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 dark:bg-slate-800">
          <Text className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200">History →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
