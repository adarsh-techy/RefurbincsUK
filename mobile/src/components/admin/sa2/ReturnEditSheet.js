import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { apiError, ClientSelect, ErrorBox, GhostButton, Input, Label, PrimaryButton, Sheet } from './ui';
import useFleetClients from './useFleetClients';
import DateTimeField, { DocumentBox, pickDocument } from './DateTimeField';

// "Edit Return" (super admin) — the web ReturnEditForm: truck, driver,
// client, return date & time and the dispatch document; the batteries are
// fixed. PATCH /returns/:id as multipart (docFile optional).
export default function ReturnEditSheet({ record, onClose, onSaved }) {
  const clients = useFleetClients(Boolean(record));
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [clientId, setClientId] = useState('');
  const [returnedAt, setReturnedAt] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!record) return;
    setTruckNumber(record.truck_number || '');
    setDriverName(record.driver_name || '');
    setClientId(record.client_id ? String(record.client_id) : '');
    setReturnedAt(record.returned_at ? new Date(record.returned_at) : new Date());
    setDocFile(null);
    setError(null);
  }, [record]);

  async function save() {
    if (!clientId) return setError('Select a client.');
    if (!truckNumber.trim() || !driverName.trim()) return setError('Truck number and driver name are required.');
    if (!returnedAt) return setError('Enter a valid return date and time.');
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('truckNumber', truckNumber);
      fd.append('driverName', driverName);
      fd.append('clientId', clientId);
      fd.append('returnedAt', returnedAt.toISOString());
      if (docFile) fd.append('docFile', { uri: docFile.uri, name: docFile.name, type: docFile.type });
      await apiClient.patch(`/returns/${record.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSaved?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(record)}
      title="Edit Return"
      description="Update the truck/driver details for this return."
      onClose={onClose}
      footer={
        <View className="flex-row justify-end gap-2.5">
          <GhostButton label="Cancel" onPress={onClose} />
          <PrimaryButton tone="emerald" label={submitting ? 'Saving…' : 'Save Changes'} onPress={save} disabled={submitting} />
        </View>
      }
    >
      <View>
        <Label>Truck Number</Label>
        <Input value={truckNumber} onChangeText={(t) => setTruckNumber(t.toUpperCase())} autoCapitalize="characters" />
      </View>
      <View>
        <Label>Driver Name</Label>
        <Input value={driverName} onChangeText={setDriverName} />
      </View>
      <View>
        <Label>Client</Label>
        <ClientSelect clients={clients} value={clientId} onChange={(v) => setClientId(v)} />
      </View>
      <View>
        <Label>Return Date & Time</Label>
        <DateTimeField value={returnedAt} onChange={setReturnedAt} />
      </View>
      <View>
        <Label>Dispatch Document / Receipt File</Label>
        <DocumentBox
          file={docFile}
          onPick={async () => setDocFile(await pickDocument())}
          onRemove={() => setDocFile(null)}
          emptyLabel={record?.document_name ? 'Replace Document File' : 'Upload Delivery Note / Photo'}
          hint=""
        />
        {record?.document_url && !docFile ? (
          <Text className="mt-1 text-xs text-slate-500">Current file: <Text className="font-bold">{record.document_name || 'Attached document'}</Text></Text>
        ) : null}
      </View>
      <View>
        <Label>Batteries</Label>
        <Text className="rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500">
          {record?.battery_count} (fixed — delete and re-record to change)
        </Text>
      </View>
      <ErrorBox text={error} />
    </Sheet>
  );
}
