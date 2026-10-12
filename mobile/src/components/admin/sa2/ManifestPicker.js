import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ScanBatteryInput from '../../scan/ScanBatteryInput';
import { resolveBatteryScan, UNASSIGNED_TAG_MESSAGE } from '../../../utils/scan-input';
import { Feedback, SearchBox } from './ui';

// The left/right halves of the web ReturnForm / RecycleForm on one phone
// column: a scan box (RFID / QR / typed code), the web's suggestion
// dropdown as a filterable list with "+ Add", a notice card, and the
// staged manifest with ✕ to remove.

// A scanned value → battery code. QR links and codes pass straight through;
// an RFID tag is looked up (first in `candidates`, then the battery search,
// which matches rfid_tag). Returns { code } or { error }.
export async function resolveScan(raw, candidates = []) {
  const resolved = await resolveBatteryScan(raw, candidates);
  if (resolved.unassignedTag) return { error: `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})` };
  return { code: (resolved.code || '').toUpperCase() };
}

export default function ManifestPicker({
  label,
  countText,
  disabled,
  placeholder,
  candidates,
  added,
  onScan, // async (raw) => { tone, message }
  onRemove, // (battery) => void
  suggestionTitle, // (filtering, count) => string
  sugMeta, // (battery) => string | null — small chip next to the code
  notice, // { title, text }
  manifestTitle,
  stagedBadge, // { label, cls }
  emptyTitle,
  emptyText,
}) {
  const [filter, setFilter] = useState('');
  const [tapFeedback, setTapFeedback] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function flash(result) {
    clearTimeout(timer.current);
    setTapFeedback(result || null);
    if (result) timer.current = setTimeout(() => setTapFeedback(null), 4000);
  }

  function remove(b) {
    onRemove(b);
    flash({ tone: 'warn', message: `${b.battery_code} removed from manifest.` });
  }

  const addedIds = useMemo(() => new Set(added.map((b) => b.id)), [added]);
  const available = useMemo(() => candidates.filter((b) => !addedIds.has(b.id)), [candidates, addedIds]);
  const suggestions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return available.slice(0, 15);
    return available.filter(
      (b) =>
        b.battery_code.toLowerCase().includes(q) ||
        (b.serial_number && b.serial_number.toLowerCase().includes(q)) ||
        (sugMeta && (sugMeta(b) || '').toLowerCase().includes(q))
    );
  }, [available, filter, sugMeta]);

  async function tap(code) {
    flash(await onScan(code));
  }

  return (
    <View className="gap-3">
      <View>
        <View className="mb-1.5 flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-700">{label}</Text>
          {countText ? <Text className="text-[11px] font-bold text-slate-500">{countText}</Text> : null}
        </View>
        <ScanBatteryInput onSubmit={onScan} placeholder={placeholder} submitLabel="Add" disabled={disabled} />
        {tapFeedback ? <View className="mt-2"><Feedback feedback={tapFeedback} /></View> : null}
      </View>

      {!disabled && available.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <View className="border-b border-slate-100 bg-slate-50 px-3.5 py-2">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{suggestionTitle(Boolean(filter.trim()), filter.trim() ? suggestions.length : available.length)}</Text>
            <View className="mt-2"><SearchBox value={filter} onChangeText={setFilter} placeholder="Type to filter…" /></View>
          </View>
          {suggestions.map((b) => (
            <TouchableOpacity key={b.id || b.battery_code} onPress={() => tap(b.battery_code)} className="flex-row items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
              <View className="flex-1 pr-2">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-mono text-sm font-bold text-slate-900">{b.battery_code}</Text>
                  {sugMeta && sugMeta(b) ? <Text className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{sugMeta(b)}</Text> : null}
                </View>
                {b.serial_number ? <Text className="mt-0.5 font-mono text-[11px] text-slate-500">SN: {b.serial_number}</Text> : null}
              </View>
              <Text className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">+ Add</Text>
            </TouchableOpacity>
          ))}
          {suggestions.length === 0 ? <Text className="px-3.5 py-3 text-xs text-slate-400">No battery matches.</Text> : null}
          {!filter.trim() && available.length > suggestions.length ? (
            <Text className="px-3.5 py-2 text-[11px] text-slate-400">+{available.length - suggestions.length} more — type to filter</Text>
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <View className="rounded-xl border border-slate-200 bg-slate-100/60 p-3.5">
          <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-800">{notice.title}</Text>
          <Text className="text-[11px] leading-4 text-slate-500">{notice.text}</Text>
        </View>
      ) : null}

      <View>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">{manifestTitle} ({added.length})</Text>
          <Text className="text-[11px] font-bold text-emerald-700">{added.length} batteries staged</Text>
        </View>
        <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {added.length === 0 ? (
            <View className="items-center p-8">
              <Text className="text-2xl">📦</Text>
              <Text className="mt-2 text-xs font-bold text-slate-700">{emptyTitle}</Text>
              <Text className="mt-1 text-center text-[11px] text-slate-400">{emptyText}</Text>
            </View>
          ) : (
            added.map((b, idx) => (
              <View key={b.id || idx} className={`flex-row items-center justify-between px-3.5 py-2.5 ${idx ? 'border-t border-slate-100' : ''}`}>
                <View className="flex-1 flex-row items-center gap-2.5 pr-2">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                    <Text className="text-[10px] font-bold text-emerald-800">{idx + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="font-mono text-sm font-bold text-slate-900">{b.battery_code}</Text>
                      {sugMeta && sugMeta(b) ? <Text className="rounded bg-slate-100 px-1 text-[9px] font-semibold text-slate-600">{sugMeta(b)}</Text> : null}
                    </View>
                    {b.serial_number ? <Text className="font-mono text-[11px] text-slate-500">SN: {b.serial_number}</Text> : null}
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${stagedBadge.cls}`}>{stagedBadge.label}</Text>
                  <TouchableOpacity onPress={() => remove(b)} hitSlop={8}>
                    <Text className="text-sm font-bold text-slate-400">✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}
