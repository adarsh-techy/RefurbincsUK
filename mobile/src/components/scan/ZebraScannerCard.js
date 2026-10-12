import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from '../ui/Icon';
import {
  addSetupResultListener,
  hardwareScannerAvailable,
  hardwareScannerStatus,
  setupHardwareScanner,
  useHardwareScan,
} from '../../services/hardware-scanner';

// Profile → "Zebra RFID reader": shows DataWedge's answer to the profile
// setup (live, as each result arrives), explains failures in plain words, and
// echoes the last trigger read with its source (RFID or barcode) so the
// reader can be tested without opening a scan screen. Renders nothing on
// phones without DataWedge or in Expo Go (no native module there).

// DataWedge SET_CONFIG result codes → what the user should do
const RESULT_HELP = {
  PLUGIN_NOT_SUPPORTED: "This device's DataWedge doesn't accept RFID input. Check the reader model (RFD40 / TC22R) and update DataWedge.",
  PARAMETER_INVALID: "DataWedge rejected one of the RFID settings — this DataWedge version may not support RFID input.",
  APP_ALREADY_ASSOCIATED: 'Another DataWedge profile already uses this app. In DataWedge, delete that profile (or remove the app from it), then tap "Set up reader again".',
  UNLICENSED_FEATURE: 'DataWedge reports this feature is not licensed on this device.',
  PROFILE_NOT_FOUND: 'The "Refurbnics" profile was not created. Tap "Set up reader again".',
};

const LABELS = { profile_setup: 'Profile (app link, QR, output)', rfid_setup: 'RFID input' };

export default function ZebraScannerCard() {
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState({}); // { command: { result, info } }
  const [lastRead, setLastRead] = useState(null);
  const available = hardwareScannerAvailable();

  useEffect(() => {
    if (!available) return undefined;
    const sub = addSetupResultListener(({ command, result, info }) => {
      setResults((prev) => ({ ...prev, [command]: { result, info } }));
      setStatus(hardwareScannerStatus());
    });
    const t = setTimeout(() => setStatus(hardwareScannerStatus()), 1500);
    return () => {
      clearTimeout(t);
      sub?.remove?.();
    };
  }, [available]);

  useHardwareScan((v, meta) => setLastRead({ value: v, source: meta?.source, labelType: meta?.labelType, at: new Date() }), available);

  if (!available) return null;

  function rerun() {
    setResults({});
    setStatus(null);
    setupHardwareScanner();
    setTimeout(() => setStatus(hardwareScannerStatus()), 1500);
  }

  const entries = Object.entries(results);
  const failures = entries.filter(([, r]) => /FAILURE/i.test(r.result));
  const state = !entries.length ? (status ? 'Waiting for DataWedge…' : 'Checking…') : failures.length ? 'Setup problem' : 'Ready';
  const helpFor = (info = '') => {
    const code = Object.keys(RESULT_HELP).find((k) => info.includes(k));
    return code ? RESULT_HELP[code] : null;
  };
  const isRfidRead = lastRead && /rfid/i.test(`${lastRead.source || ''} ${lastRead.labelType || ''}`);

  return (
    <View className="mb-6 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-800/50 dark:bg-slate-900">
      <View className="flex-row items-center gap-2">
        <Icon name="rfid" color="#047857" size={18} />
        <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white">Zebra RFID reader</Text>
        <Text className={`text-[11px] font-bold ${state === 'Ready' ? 'text-emerald-600' : state === 'Setup problem' ? 'text-red-600' : 'text-slate-400'}`}>
          {state}
        </Text>
      </View>
      <Text className="mt-1 text-xs text-slate-500">
        DataWedge {status?.version || ''} profile "Refurbnics": RFID + QR scanning straight into this app. Pull the trigger to test.
      </Text>

      {entries.map(([command, r]) => {
        const bad = /FAILURE/i.test(r.result);
        const help = bad ? helpFor(r.info || '') : null;
        return (
          <View key={command} className="mt-2">
            <Text className={`text-[11px] font-semibold ${bad ? 'text-red-600' : 'text-emerald-700'}`}>
              {bad ? '✕' : '✓'} {LABELS[command] || command}: {r.result}
            </Text>
            {bad && r.info ? <Text className="font-mono text-[10px] text-slate-500">{r.info}</Text> : null}
            {help ? <Text className="text-[11px] text-slate-600">{help}</Text> : null}
          </View>
        );
      })}

      <View className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
        <Text className="text-[10px] font-bold uppercase text-slate-400">Last read</Text>
        <Text className="mt-0.5 font-mono text-xs font-bold text-slate-900 dark:text-white" selectable>
          {lastRead ? `${lastRead.value}  (${lastRead.at.toLocaleTimeString()})` : 'Nothing yet — pull the trigger'}
        </Text>
        {lastRead ? (
          <Text className={`mt-0.5 text-[10px] font-semibold ${isRfidRead ? 'text-emerald-700' : 'text-slate-500'}`}>
            {isRfidRead ? 'Source: RFID reader' : `Source: ${lastRead.source || 'scanner'}${lastRead.labelType ? ` · ${lastRead.labelType}` : ''} (barcode / QR)`}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={rerun} className="mt-3 items-center rounded-xl border border-emerald-300 py-2.5">
        <Text className="text-xs font-bold text-emerald-700">Set up reader again</Text>
      </TouchableOpacity>
    </View>
  );
}
