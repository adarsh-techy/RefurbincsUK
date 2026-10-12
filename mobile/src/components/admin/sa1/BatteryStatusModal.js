import { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';

// "Correct battery status" — the web BatteryStatusForm: the code and its
// intake stay fixed, only the status changes (PATCH /batteries/:id).
export const STATUS_OPTIONS = [
  ['registered', 'Registered (Not Serviced)'],
  ['in_repair', 'Awaiting Repair'],
  ['in_progress', 'Repair In Progress'],
  ['in_testing', 'In Testing'],
  ['repaired', 'Repair Completed'],
  ['returned', 'Returned to Client'],
  ['unserviceable', 'Unserviceable'],
  ['tested_parts_removed', 'Unserviceable (Test Failed)'],
  ['recycled', 'Recycled'],
];

export default function BatteryStatusModal({ battery, onClose, onSaved }) {
  const [status, setStatus] = useState(battery?.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  if (!battery) return null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/batteries/${battery.id}`, { status });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="max-h-[85%] w-full max-w-sm rounded-3xl bg-white p-5">
          <Text className="text-base font-extrabold text-slate-900">Correct battery status</Text>
          <Text className="mt-3 text-xs font-medium text-slate-500">Battery ID</Text>
          <Text className="font-mono text-sm font-bold text-slate-900">{battery.battery_code}</Text>
          <Text className="mb-1.5 mt-3 text-xs font-medium text-slate-500">Status</Text>
          <ScrollView className="max-h-80" contentContainerClassName="gap-1.5">
            {STATUS_OPTIONS.map(([value, label]) => (
              <TouchableOpacity key={value} onPress={() => setStatus(value)} className={`rounded-xl border px-3 py-2.5 ${status === value ? 'border-violet-600 bg-violet-600' : 'border-slate-200 bg-white'}`}>
                <Text className={`text-xs font-bold ${status === value ? 'text-white' : 'text-slate-700'}`}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {error ? <Text className="mt-2 text-xs font-semibold text-red-600">{error}</Text> : null}
          <View className="mt-4 flex-row justify-end gap-2.5">
            <TouchableOpacity onPress={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5">
              <Text className="text-sm font-medium text-slate-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} className={`rounded-xl bg-violet-600 px-5 py-2.5 ${saving ? 'opacity-60' : ''}`}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-sm font-bold text-white">Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
