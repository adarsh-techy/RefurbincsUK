import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';

// Admin "Battery Number — CODE" modal from the web Generate QR / battery
// detail pages: PATCH /batteries/:id/serial-number. The number is typed
// twice; changing an existing one (client-set or not) needs CONFIRM typed
// first. Blank clears it.
export default function SerialNumberModal({ battery, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [retype, setRetype] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!battery) return;
    setValue(battery.serial_number || '');
    setRetype(battery.serial_number || '');
    setConfirm('');
    setError(null);
  }, [battery]);

  if (!battery) return null;
  const existing = Boolean(battery.serial_number);
  const mismatch = Boolean(value.trim()) && value.trim() !== retype.trim();
  const locked = existing && confirm.trim().toUpperCase() !== 'CONFIRM';

  async function save() {
    if (mismatch) {
      setError('The two battery numbers you typed don’t match. Please re-check and try again.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}/serial-number`, { serialNumber: value.trim() });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  const input = 'rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-900';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-sm rounded-3xl bg-white p-5">
          <Text className="text-base font-extrabold text-slate-900">Battery Number — {battery.battery_code}</Text>
          {existing && (
            <Text className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {battery.serial_number_added_by_role === 'client'
                ? 'Client-set number: the client can no longer edit this themselves. Changing it is an admin override — type CONFIRM below to unlock Save.'
                : "You're changing an existing Battery Number. Type CONFIRM below to unlock Save."}
            </Text>
          )}
          <Text className="mb-1 mt-3 text-sm font-medium text-slate-700">Battery Number (manufacturer serial)</Text>
          <TextInput value={value} onChangeText={setValue} placeholder="e.g. SN-88213" placeholderTextColor="#94a3b8" autoCorrect={false} className={input} />
          <Text className="mt-1 text-[11px] text-slate-400">Leave blank to clear the Battery Number.</Text>
          {value.trim() ? (
            <>
              <Text className="mb-1 mt-3 text-sm font-medium text-slate-700">Re-type to Confirm</Text>
              <TextInput value={retype} onChangeText={setRetype} placeholder="Type the battery number again" placeholderTextColor="#94a3b8" autoCorrect={false} className={input} />
              <Text className={`mt-1 text-[11px] ${mismatch && retype ? 'text-red-600' : 'text-slate-400'}`}>
                {mismatch && retype ? 'The two numbers don’t match yet.' : 'Typed twice to catch typos.'}
              </Text>
            </>
          ) : null}
          {existing && (
            <>
              <Text className="mb-1 mt-3 text-sm font-medium text-slate-700">Type <Text className="font-black">CONFIRM</Text> to change it</Text>
              <TextInput value={confirm} onChangeText={setConfirm} placeholder="CONFIRM" placeholderTextColor="#94a3b8" autoCapitalize="characters" autoCorrect={false} className={input} />
            </>
          )}
          {error ? <Text className="mt-2 text-xs font-semibold text-red-600">{error}</Text> : null}
          <View className="mt-5 flex-row justify-end gap-2.5">
            <TouchableOpacity onPress={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5">
              <Text className="text-sm font-medium text-slate-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving || mismatch || locked} className={`rounded-xl bg-blue-600 px-5 py-2.5 ${saving || mismatch || locked ? 'opacity-50' : ''}`}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-sm font-bold text-white">Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
