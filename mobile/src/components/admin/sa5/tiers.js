import { Text, View } from 'react-native';

// Tier colours of the web Certificates / ClientMilestoneDetail pages
// (Bronze … Emerald) as phone classes.
export const TIER_STYLE = {
  Bronze: { badge: 'border-amber-300 bg-amber-100', text: 'text-amber-900', bar: 'bg-amber-500', card: 'border-amber-300', soft: 'bg-amber-50' },
  Silver: { badge: 'border-slate-300 bg-slate-200', text: 'text-slate-800', bar: 'bg-slate-400', card: 'border-slate-300', soft: 'bg-slate-100' },
  Gold: { badge: 'border-yellow-400 bg-yellow-100', text: 'text-yellow-900', bar: 'bg-yellow-500', card: 'border-yellow-400', soft: 'bg-yellow-50' },
  Platinum: { badge: 'border-indigo-300 bg-indigo-100', text: 'text-indigo-900', bar: 'bg-indigo-500', card: 'border-indigo-300', soft: 'bg-indigo-50' },
  Diamond: { badge: 'border-cyan-300 bg-cyan-100', text: 'text-cyan-900', bar: 'bg-cyan-500', card: 'border-cyan-300', soft: 'bg-cyan-50' },
  Emerald: { badge: 'border-emerald-300 bg-emerald-100', text: 'text-emerald-900', bar: 'bg-emerald-500', card: 'border-emerald-300', soft: 'bg-emerald-50' },
};

export const tierStyle = (badge) => TIER_STYLE[badge] || TIER_STYLE.Gold;

export function TierPill({ badge, children }) {
  const s = tierStyle(badge);
  return (
    <View className={`flex-row items-center self-start rounded-full border px-2.5 py-0.5 ${s.badge}`}>
      <Text className={`text-[10.5px] font-extrabold ${s.text}`}>🏅 {children}</Text>
    </View>
  );
}
