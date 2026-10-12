import { Text, TouchableOpacity, View } from 'react-native';

// One recycle shipment as the partner sees it on the web tables: vehicle,
// driver, "N units", the date, and a "View …" link to the shipment.

export function formatDate(v) {
  return v ? new Date(v).toLocaleDateString() : '—';
}

export function formatDateTime(v) {
  return v ? new Date(v).toLocaleString() : '—';
}

export default function ShipmentRow({ row, index, dateLabel, dateValue, linkLabel, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} className="rounded-2xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center gap-2">
        {index != null && <Text className="text-[11px] font-bold text-slate-400">{index}</Text>}
        <Text className="flex-1 text-base font-extrabold text-emerald-700" numberOfLines={1}>{row.vehicle_number || `#${row.id}`}</Text>
        <Text className="text-sm font-semibold text-slate-800">{row.battery_count || 0} units</Text>
      </View>
      <View className="mt-2 flex-row gap-4">
        <View className="flex-1">
          <Text className="text-[10px] font-bold uppercase text-slate-400">Driver</Text>
          <Text className="text-sm text-slate-800" numberOfLines={1}>{row.driver_name || '—'}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[10px] font-bold uppercase text-slate-400">{dateLabel}</Text>
          <Text className="text-sm text-slate-800">{dateValue}</Text>
        </View>
      </View>
      <Text className="mt-2 text-xs font-semibold text-emerald-700">{linkLabel}</Text>
    </TouchableOpacity>
  );
}
