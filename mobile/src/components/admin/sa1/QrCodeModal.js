import { useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { qrContentFor, qrSvg, shareQrSheet } from '../../../utils/print-qr-sheet';

// One battery's QR code: what the web shows in its QR viewer (code, client,
// the link it encodes) with "Download" — on a phone, a one-code PDF handed to
// the share sheet (save to Files, print, WhatsApp…).
export function QrImage({ code, size = 200 }) {
  const xml = useMemo(() => (code ? qrSvg(qrContentFor(code)) : null), [code]);
  if (!xml) return null;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export async function shareSingleQr(code) {
  await shareQrSheet([code], 1);
}

export default function QrCodeModal({ battery, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!battery) return null;
  const code = battery.battery_code;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await shareSingleQr(code);
    } catch (err) {
      setError(err.message || 'Could not build the QR file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full max-w-sm items-center rounded-3xl bg-white p-5">
          <View className="w-full flex-row items-center justify-between">
            <Text className="text-base font-extrabold text-slate-900">{code}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text className="text-sm font-bold text-slate-500">Close</Text>
            </TouchableOpacity>
          </View>
          <View className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
            <QrImage code={code} size={210} />
          </View>
          {battery.client_name ? <Text className="mt-3 text-sm text-slate-600">Client: {battery.client_name}</Text> : null}
          {battery.serial_number ? <Text className="mt-1 text-sm text-slate-600">Battery Number: {battery.serial_number}</Text> : null}
          <Text className="mt-1 text-center text-[11px] text-slate-400" selectable>{qrContentFor(code)}</Text>
          {error ? <Text className="mt-2 text-xs font-semibold text-red-600">{error}</Text> : null}
          <TouchableOpacity disabled={busy} onPress={download} className={`mt-4 w-full items-center rounded-xl bg-violet-600 py-3 ${busy ? 'opacity-60' : ''}`}>
            <Text className="text-sm font-bold text-white">{busy ? 'Building…' : 'Download (PDF)'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
