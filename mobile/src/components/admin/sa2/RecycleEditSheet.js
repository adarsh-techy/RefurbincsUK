import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { apiError, ErrorBox, GhostButton, Input, Label, PrimaryButton, Sheet } from './ui';

// "Edit Recycle Shipment" (super admin) — the web RecycleEditForm: vehicle
// number and driver; the batteries are fixed. PATCH /recycle/:id.
export default function RecycleEditSheet({ batch, onClose, onSaved }) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!batch) return;
    setVehicleNumber(batch.vehicle_number || '');
    setDriverName(batch.driver_name || '');
    setError(null);
  }, [batch]);

  async function save() {
    if (!vehicleNumber.trim() || !driverName.trim()) return setError('Vehicle number and driver name are required.');
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/recycle/${batch.id}`, { vehicleNumber, driverName });
      onSaved?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(batch)}
      title="Edit Recycle Shipment"
      description="Update the vehicle/driver details for this shipment."
      onClose={onClose}
      footer={
        <View className="flex-row justify-end gap-2.5">
          <GhostButton label="Cancel" onPress={onClose} />
          <PrimaryButton tone="emerald" label={submitting ? 'Saving…' : 'Save Changes'} onPress={save} disabled={submitting} />
        </View>
      }
    >
      <View>
        <Label>Vehicle Number</Label>
        <Input value={vehicleNumber} onChangeText={setVehicleNumber} />
      </View>
      <View>
        <Label>Driver Name</Label>
        <Input value={driverName} onChangeText={setDriverName} />
      </View>
      <View>
        <Label>Batteries</Label>
        <Text className="rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500">
          {batch?.battery_count} (fixed — delete and re-record to change)
        </Text>
      </View>
      <ErrorBox text={error} />
    </Sheet>
  );
}
