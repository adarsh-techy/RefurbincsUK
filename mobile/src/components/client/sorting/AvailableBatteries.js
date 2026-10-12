import { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBadge, clientBatteryStatus } from '../../ui/Badge';

// The web scan box's suggestions dropdown ("Available Fleet Batteries" /
// "Matching Fleet Batteries", N of M, "+ Add") as a panel under the scan box:
// fleet batteries that are with the client and not in any group yet.
const PAGE = 30;

export default function AvailableBatteries({ batteries, onAdd }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return batteries;
    return batteries.filter(
      (b) => b.battery_code.toLowerCase().includes(q) || (b.serial_number && b.serial_number.toLowerCase().includes(q))
    );
  }, [batteries, query]);

  const visible = matches.slice(0, shown);

  return (
    <View className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <TouchableOpacity onPress={() => setOpen((o) => !o)} className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {query.trim() ? 'Matching Fleet Batteries' : 'Available Fleet Batteries'}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="rounded-full bg-slate-200 px-2 py-0.5 dark:bg-slate-700">
            <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
              {matches.length}
              {!query.trim() && batteries.length > matches.length ? ` of ${batteries.length}` : ''}
            </Text>
          </View>
          <Text className="text-xs font-bold text-blue-600">{open ? 'Hide' : 'Show'}</Text>
        </View>
      </TouchableOpacity>

      {open && (
        <View className="mt-2">
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t.toUpperCase());
              setShown(PAGE);
            }}
            placeholder="Filter by battery code / serial…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <View className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            {visible.length === 0 ? (
              <Text className="p-4 text-center text-xs text-slate-500">
                {query.trim() ? `No available battery matches "${query}".` : 'All available batteries are already sorted into groups.'}
              </Text>
            ) : (
              visible.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => onAdd(b.battery_code)}
                  className="flex-row items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <View className="min-w-0 flex-1">
                    <Text className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{b.battery_code}</Text>
                    {b.serial_number ? <Text className="font-mono text-[11px] text-slate-500">(SN: {b.serial_number})</Text> : null}
                  </View>
                  <StatusBadge status={clientBatteryStatus(b)} />
                  <View className="rounded-lg bg-emerald-600 px-2 py-1">
                    <Text className="text-[11px] font-bold text-white">+ Add</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
          {matches.length > visible.length && (
            <TouchableOpacity onPress={() => setShown((n) => n + PAGE)} className="mt-2 items-center rounded-xl border border-slate-200 py-2 dark:border-slate-700">
              <Text className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Show more ({matches.length - visible.length} left)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
