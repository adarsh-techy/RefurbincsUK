import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { apiError, ClientSelect, ErrorBox, GhostButton, Input, Label, PrimaryButton, Sheet } from './ui';
import useFleetClients from './useFleetClients';

// "Edit Truck Intake" (super admin) — the web TruckIntakeForm in edit mode:
// truck number, driver and client; the batteries on the truck are fixed.
// PATCH /truck-intakes/:id { truckNumber, driverName, clientId }.
export default function IntakeEditSheet({ intake, onClose, onSaved }) {
  const clients = useFleetClients(Boolean(intake));
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [clientId, setClientId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!intake) return;
    setTruckNumber(intake.truck_number || '');
    setDriverName(intake.driver_name || '');
    setClientId(intake.client_id ? String(intake.client_id) : '');
    setError(null);
  }, [intake]);

  async function save() {
    if (!clientId) return setError('Please select a client.');
    if (!truckNumber.trim() || !driverName.trim()) return setError('Truck number and driver name are required.');
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/truck-intakes/${intake.id}`, { truckNumber, driverName, clientId });
      onSaved?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(intake)}
      title="Edit Truck Intake"
      description="Update the truck/driver details for this intake."
      onClose={onClose}
      footer={
        <View className="gap-3">
          <Text className="text-xs font-medium text-slate-500">Updating logistics details for intake #{intake?.id}</Text>
          <View className="flex-row gap-2.5">
            <GhostButton label="Cancel" onPress={onClose} />
            <View className="flex-1">
              <PrimaryButton tone="emerald" label={submitting ? 'Saving…' : '✓ Save Changes'} onPress={save} disabled={submitting} />
            </View>
          </View>
        </View>
      }
    >
      <View>
        <Label>Truck / Vehicle Number</Label>
        <Input value={truckNumber} onChangeText={(t) => setTruckNumber(t.toUpperCase())} autoCapitalize="characters" placeholder="e.g. GB21 XYZ" />
      </View>
      <View>
        <Label>Driver Name</Label>
        <Input value={driverName} onChangeText={setDriverName} placeholder="e.g. George Davies" />
      </View>
      <View>
        <Label>Client / Customer</Label>
        <ClientSelect clients={clients} value={clientId} onChange={(v) => setClientId(v)} />
      </View>
      <View className="rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-700">Shipment Battery Allocation</Text>
        <Text className="mt-0.5 text-[11px] text-slate-500">Battery count is fixed to the existing generated battery records.</Text>
        <View className="mt-3 flex-row items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
          <Text className="text-xs font-semibold text-slate-600">Total Batteries in Intake</Text>
          <Text className="text-sm font-black text-slate-900">{intake?.battery_count ?? 0} units</Text>
        </View>
      </View>
      <ErrorBox text={error} />
    </Sheet>
  );
}
