import { useRef, useState } from 'react';
import { Alert, Modal, Text, TouchableOpacity, Vibration, View } from 'react-native';
import apiClient from '../../services/api-client';
import extractBatteryCode from '../../utils/extract-battery-code';
import Icon from '../ui/Icon';
import ScanBatteryInput from './ScanBatteryInput';
import { useHardwareScan } from '../../services/hardware-scanner';

// "Scan RFID tag" for lookup screens (battery search, technician scan) that
// already have their own camera and typed search: opens a small panel in RFID
// mode, and the tag the reader types goes to onScan(raw). The backend resolves
// a tag to its battery, and refuses a tag nobody has assigned. On a Zebra
// device the trigger works on the screen directly, no panel needed.
// Checks the battery / tag exists before the screen navigates, so an
// unassigned tag gets a clear popup instead of an empty detail page.
async function checkBattery(raw) {
  const code = extractBatteryCode(raw) || String(raw).trim();
  try {
    await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
    return null;
  } catch (err) {
    if (!err.response) return "Can't reach the server to look this up. Check the Wi-Fi / server address.";
    return err.response.data?.message || `No battery found for ${code}.`;
  }
}

export default function RfidLookupButton({ onScan, label = 'Scan RFID tag', className = '' }) {
  const [open, setOpen] = useState(false);
  // Zebra trigger on this screen opens the battery directly (the panel's own
  // scan box takes over while it is open)
  // One trigger pull can read several tags — open only the first.
  const lockRef = useRef(0);
  useHardwareScan(async (raw) => {
    if (Date.now() - lockRef.current < 1500) return;
    lockRef.current = Date.now();
    const problem = await checkBattery(raw);
    if (problem && /not assigned/i.test(problem)) return; // unregistered tag: ignored
    if (problem) {
      Vibration.vibrate([0, 160, 90, 160]);
      Alert.alert('Battery not found', `${problem}\n\nScanned: ${raw}`);
      return;
    }
    onScan?.(raw);
  }, !open);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        className={`flex-row items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 dark:border-emerald-800/60 dark:bg-emerald-950/40 ${className}`}
      >
        <Icon name="rfid" color="#047857" size={18} />
        <Text className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{label}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full rounded-3xl bg-white p-5 dark:bg-slate-900">
            <View className="flex-row items-center gap-2">
              <Icon name="rfid" color="#047857" size={20} />
              <Text className="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Scan RFID tag</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Text className="text-sm font-bold text-slate-500">Close</Text>
              </TouchableOpacity>
            </View>
            <Text className="mb-3 mt-1 text-xs text-slate-500">
              Hold the tag to your RFID reader (Bluetooth / USB, keyboard mode). The battery opens as soon as the tag is read.
            </Text>
            <ScanBatteryInput
              startInRfidMode
              showCamera={false}
              compact
              submitLabel="Open"
              onSubmit={async (raw) => {
                const problem = await checkBattery(raw);
                if (problem) return { tone: 'bad', message: problem };
                setOpen(false);
                onScan?.(raw);
                return { tone: 'good', message: 'Opening battery…' };
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
