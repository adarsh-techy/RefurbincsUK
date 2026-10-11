import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { resolveBatteryInput, UNASSIGNED_TAG_MESSAGE } from '../../utils/scan-input';
import ScanBatteryInput from './ScanBatteryInput';

// Battery-by-battery check before confirming a shipment — the mobile twin of
// the web TruckVerifyModal (admin: truck arrival) and ClientReturnVerifyModal
// (client: return received). Every battery on the list has to be scanned
// (RFID tag, QR or typed code/serial) or ticked by hand before Confirm is
// enabled; a tag nobody assigned is refused, a battery that isn't on this
// shipment is flagged.
//
// props: visible, title, subtitle, batteries [{ battery_code, serial_number,
// rfid_tag, intake_count_this_month? }], confirmLabel, onConfirm() (async),
// onClose(), repeatCheck (true for truck arrivals: warns when a battery is
// back for the 2nd+ time this month)

const timeText = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function ScanVerifyModal({
  visible,
  title,
  subtitle,
  batteries = [],
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
  repeatCheck = false,
}) {
  const [scanned, setScanned] = useState({}); // { CODE: Date }
  const [feedback, setFeedback] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const feedbackTimer = useRef(null);
  const listKey = batteries.map((b) => b.battery_code).join('|');

  // a different shipment starts from zero
  useEffect(() => {
    setScanned({});
    setFeedback(null);
  }, [listKey]);

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  const expected = useMemo(() => batteries.map((b) => b.battery_code.toUpperCase()), [batteries]);
  const doneCount = expected.filter((c) => scanned[c]).length;
  const allScanned = expected.length > 0 && doneCount === expected.length;
  const remaining = batteries.filter((b) => !scanned[b.battery_code.toUpperCase()]);
  const verified = batteries
    .filter((b) => scanned[b.battery_code.toUpperCase()])
    .sort((a, b) => scanned[b.battery_code.toUpperCase()] - scanned[a.battery_code.toUpperCase()]);

  // shown by the scan box itself (banner / popup); returned so it knows
  function report(tone, message) {
    return { tone, message };
  }

  function markVerified(battery) {
    const code = battery.battery_code.toUpperCase();
    const now = new Date();
    setScanned((prev) => ({ ...prev, [code]: now }));
    const result = report('good', `✓ ${battery.battery_code}${battery.serial_number ? ` (SN ${battery.serial_number})` : ''} verified at ${timeText(now)}`);
    if (repeatCheck && Number(battery.intake_count_this_month) > 1) {
      Alert.alert(
        'Repeat intake',
        `${battery.battery_code} has come in ${battery.intake_count_this_month} times this month.${battery.last_repaired_parts ? `\nLast parts changed: ${battery.last_repaired_parts}` : ''}`
      );
    }
    return result;
  }

  function handleScan(raw) {
    const resolved = resolveBatteryInput(raw, batteries);
    if (resolved.unassignedTag) {
      return report('bad', `${UNASSIGNED_TAG_MESSAGE} (tag ${resolved.code})`);
    }
    const query = (resolved.code || '').trim().toUpperCase();
    if (!query) return;
    const match = batteries.find(
      (b) => b.battery_code.toUpperCase() === query || (b.serial_number && b.serial_number.toUpperCase() === query)
    );
    if (!match) {
      return report('bad', `"${raw}" is not on this shipment.`);
    }
    if (scanned[match.battery_code.toUpperCase()]) {
      return report('warn', `${match.battery_code} was already verified.`);
    }
    return markVerified(match);
  }

  function undo(battery) {
    const code = battery.battery_code.toUpperCase();
    setScanned((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setFeedback({ tone: 'warn', message: `${battery.battery_code} verification undone.` });
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  }

  async function confirm() {
    setConfirming(true);
    try {
      await onConfirm?.();
      setScanned({});
    } catch (err) {
      Alert.alert('Could not confirm', err.response?.data?.message || err.message);
    } finally {
      setConfirming(false);
    }
  }

  const pct = expected.length ? Math.round((doneCount / expected.length) * 100) : 0;
  const rows = [
    ...remaining.map((b) => ({ ...b, _done: false })),
    ...verified.map((b) => ({ ...b, _done: true })),
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-12 dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-base font-extrabold text-slate-900 dark:text-white" numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text className="text-sm font-bold text-slate-500">Close</Text>
            </TouchableOpacity>
          </View>
          {subtitle ? <Text className="mt-0.5 text-xs text-slate-500">{subtitle}</Text> : null}
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <View className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </View>
          <Text className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {doneCount} of {expected.length} batteries verified ({pct}%)
          </Text>
          <View className="mt-3">
            <ScanBatteryInput onSubmit={handleScan} feedback={feedback} submitLabel="Verify" startInRfidMode />
          </View>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(b) => b.battery_code}
          contentContainerClassName="p-4 gap-2 pb-32"
          ListEmptyComponent={<Text className="py-8 text-center text-xs text-slate-400">No batteries on this shipment.</Text>}
          renderItem={({ item: b }) => (
            <View className={`flex-row items-center justify-between rounded-2xl border p-3 ${b._done ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
              <View className="flex-1 pr-2">
                <Text className={`text-sm font-bold ${b._done ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                  {b._done ? '✓ ' : ''}{b.battery_code}
                </Text>
                <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                  {[b.serial_number && `SN ${b.serial_number}`, b.rfid_tag ? `Tag ${b.rfid_tag}` : 'No RFID tag', b._done && `at ${timeText(scanned[b.battery_code.toUpperCase()])}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {b._done ? (
                <TouchableOpacity onPress={() => undo(b)} className="rounded-lg bg-white px-2.5 py-1.5 dark:bg-slate-800">
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Undo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => markVerified(b)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 dark:border-slate-700">
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Tick</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />

        <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 pb-8 dark:border-slate-800 dark:bg-slate-900">
          <TouchableOpacity
            disabled={!allScanned || confirming}
            onPress={confirm}
            className={`items-center rounded-2xl py-3.5 ${allScanned ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <Text className="text-sm font-bold text-white">
              {confirming ? 'Confirming…' : allScanned ? confirmLabel : `Scan ${expected.length - doneCount} more to confirm`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
