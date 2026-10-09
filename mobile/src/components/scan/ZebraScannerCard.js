import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Icon from '../ui/Icon';
import { hardwareScannerAvailable, hardwareScannerStatus, setupHardwareScanner, useHardwareScan } from '../../services/hardware-scanner';

// Profile → "Zebra RFID reader": shows whether the DataWedge profile was set
// up, lets the user run the setup again, and echoes the last trigger read so
// the reader can be tested without opening a scan screen. Renders nothing on
// phones without DataWedge.
export default function ZebraScannerCard() {
  const [status, setStatus] = useState(null);
  const [lastRead, setLastRead] = useState(null);
  const available = hardwareScannerAvailable();

  useEffect(() => {
    if (!available) return undefined;
    const t = setTimeout(() => setStatus(hardwareScannerStatus()), 1500);
    return () => clearTimeout(t);
  }, [available]);

  useHardwareScan((v) => setLastRead({ value: v, at: new Date() }), available);

  if (!available) return null;

  function rerun() {
    setupHardwareScanner();
    setStatus(null);
    setTimeout(() => setStatus(hardwareScannerStatus()), 1500);
  }

  const results = status?.results || '';
  const failed = /FAILURE/i.test(results);

  return (
    <View className="mb-6 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-800/50 dark:bg-slate-900">
      <View className="flex-row items-center gap-2">
        <Icon name="rfid" color="#047857" size={18} />
        <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white">Zebra RFID reader</Text>
        <Text className={`text-[11px] font-bold ${!status ? 'text-slate-400' : failed ? 'text-red-600' : 'text-emerald-600'}`}>
          {!status ? 'Checking…' : failed ? 'Setup problem' : 'Ready'}
        </Text>
      </View>
      <Text className="mt-1 text-xs text-slate-500">
        DataWedge {status?.version || ''} profile "Refurbnics": RFID + QR scanning straight into this app. Pull the trigger to test.
      </Text>
      {results ? <Text className="mt-2 font-mono text-[10px] text-slate-500">{results}</Text> : null}
      <View className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
        <Text className="text-[10px] font-bold uppercase text-slate-400">Last read</Text>
        <Text className="mt-0.5 font-mono text-xs font-bold text-slate-900 dark:text-white" selectable>
          {lastRead ? `${lastRead.value}  (${lastRead.at.toLocaleTimeString()})` : 'Nothing yet — pull the trigger'}
        </Text>
      </View>
      <TouchableOpacity onPress={rerun} className="mt-3 items-center rounded-xl border border-emerald-300 py-2.5">
        <Text className="text-xs font-bold text-emerald-700">Set up reader again</Text>
      </TouchableOpacity>
    </View>
  );
}
