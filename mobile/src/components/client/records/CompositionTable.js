import { Text, View } from 'react-native';

// The 14-row chemical recovery table (web: Technical Annex table and the
// certificate's "Section 2 Composition Audit"), as stacked rows for a phone.
export default function CompositionTable({ rows }) {
  return (
    <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {rows.map((item, idx) => (
        <View key={item.casNo + idx} className={`px-3 py-2.5 ${idx ? 'border-t border-slate-100' : ''}`}>
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-xs font-bold text-slate-900">{item.nameEn}</Text>
            <Text className="font-mono text-xs font-extrabold text-emerald-700">{item.formattedAmount}</Text>
          </View>
          <Text className="mt-0.5 font-mono text-[10px] text-slate-600" numberOfLines={1}>
            {item.formula} · CAS {item.casNo} · {item.weightPct}
          </Text>
          <Text className="mt-0.5 text-[10px] text-slate-500">{item.role}</Text>
        </View>
      ))}
    </View>
  );
}
