import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { Btn, Dialog, inputClass } from './common';

// "+ Add Serial" (web Battery Number modal): the number is typed twice to
// catch typos. A client can set it once, while it is still blank — the
// server refuses later changes (PATCH /batteries/:id/serial-number).
export default function SerialNumberModal({ battery, onClose, onSaved }) {
  const [serial, setSerial] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSerial(battery?.serial_number || '');
    setConfirm(battery?.serial_number || '');
    setError(null);
  }, [battery]);

  async function save() {
    if (serial.trim() !== confirm.trim()) {
      setError('The two battery numbers you typed don’t match. Please re-check and try again.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/serial-number`, { serialNumber: serial.trim() });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog visible={Boolean(battery)} title={`Battery Number — ${battery?.battery_code || ''}`} onClose={onClose}>
      <Text className="mb-1.5 mt-4 text-xs font-semibold text-slate-700 dark:text-slate-200">Battery Number (manufacturer serial)</Text>
      <TextInput value={serial} onChangeText={setSerial} placeholder="e.g. SN-88213" placeholderTextColor="#94a3b8" autoCorrect={false} autoCapitalize="characters" className={inputClass} />
      <Text className="mb-1.5 mt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">Re-type to Confirm</Text>
      <TextInput value={confirm} onChangeText={setConfirm} placeholder="Type the battery number again" placeholderTextColor="#94a3b8" autoCorrect={false} autoCapitalize="characters" className={inputClass} />
      <Text className="mt-1.5 text-[11px] text-slate-500">
        Typed twice to catch typos — the number physically printed on the battery. Once saved, this is preserved on your records.
      </Text>
      {error ? <Text className="mt-2 text-xs font-medium text-red-600">{error}</Text> : null}
      <View className="mt-5 flex-row gap-2">
        <Btn label="Cancel" tone="ghost" onPress={onClose} className="flex-1" />
        <Btn
          label={saving ? 'Saving…' : 'Save'}
          onPress={save}
          disabled={saving || !serial.trim() || serial.trim() !== confirm.trim()}
          className="flex-1"
        />
      </View>
    </Dialog>
  );
}
