import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { Field, FormButtons, Input, Sheet } from './ui';

// The web PartForm (add / edit) and RestockForm, as bottom sheets.
//   add      POST  /parts             { clientId, minStock, name, sku, quantity, repairCost, serviceCharge }
//   edit     PATCH /parts/:id         (same payload, super_admin only)
//   restock  PATCH /parts/:id/restock { quantityAdded, note }

// "bms board" → "Bms Board" (first letter of each word, rest untouched)
const capitalizeWords = (val) => (val ? val.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase()) : '');

export function PartFormSheet({ visible, part, title, description, onSaved, onClose, defaultClientId }) {
  const isEdit = Boolean(part);
  const [form, setForm] = useState({});
  const [allParts, setAllParts] = useState([]);
  const [clients, setClients] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setForm({
      // every part's stock belongs to one fleet client and has its own minimum
      clientId: part?.client_id ? String(part.client_id) : defaultClientId ? String(defaultClientId) : '',
      minStock: part ? String(part.min_stock ?? 5) : '5',
      name: part?.name || '',
      sku: part?.sku || '',
      quantity: part ? String(part.quantity) : '0',
      repairCost: part ? String(part.repair_cost) : '0',
      serviceCharge: part ? String(part.service_charge || 0) : '0',
    });
    setError(null);
    apiClient.get('/parts').then(({ data }) => setAllParts(data || [])).catch(() => {});
    apiClient.get('/parts/clients').then(({ data }) => setClients(data || [])).catch(() => {});
  }, [visible, part, defaultClientId]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // name suggestions from the chosen client's own parts
  const names = [...new Set(allParts.filter((p) => !form.clientId || String(p.client_id) === form.clientId).map((p) => p.name))];
  // the web's <datalist> of existing part names
  const q = (form.name || '').trim().toLowerCase();
  const suggestions = q ? names.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 5) : [];

  async function submit() {
    if (!form.clientId) {
      setError('Select the client these parts belong to.');
      return;
    }
    if (!form.name?.trim()) {
      setError('Part Name is required.');
      return;
    }
    if (!/^\d+$/.test(String(form.minStock || '').trim())) {
      setError('Minimum stock must be a whole number of 0 or more.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        clientId: Number(form.clientId),
        minStock: Number(form.minStock),
        name: capitalizeWords(form.name.trim()),
        sku: form.sku?.trim() || undefined,
        quantity: Number(form.quantity) || 0,
        repairCost: Number(form.repairCost) || 0,
        serviceCharge: Number(form.serviceCharge) || 0,
      };
      if (isEdit) await apiClient.patch(`/parts/${part.id}`, payload);
      else await apiClient.post('/parts', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={title || (isEdit ? 'Edit Part' : 'Add Part')}
      description={description || (isEdit ? 'Update this part’s details.' : 'Add a new part to inventory.')}
      onClose={onClose}
    >
      <Field label="Client *">
        <View className="flex-row flex-wrap gap-2">
          {clients.map((c) => {
            const on = String(c.id) === form.clientId;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => update('clientId', String(c.id))}
                className={`rounded-full border px-3 py-1.5 ${on ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}
              >
                <Text className={`text-xs font-semibold ${on ? 'text-white' : 'text-slate-700'}`}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
          {clients.length === 0 ? <Text className="text-xs text-slate-400">No fleet clients yet.</Text> : null}
        </View>
        <Text className="mt-1 text-[11px] text-slate-500">Only this client's battery repairs can use these parts.</Text>
      </Field>
      <Field label="Part Name">
        <Input value={form.name} onChangeText={(v) => update('name', capitalizeWords(v))} placeholder="e.g. 12V Cell Module" />
        {suggestions.length > 0 && (
          <View className="mt-1 rounded-xl border border-slate-200 bg-slate-50">
            {suggestions.map((n) => (
              <TouchableOpacity key={n} onPress={() => update('name', n)} className="border-b border-slate-100 px-3 py-2">
                <Text className="text-xs text-slate-700">{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Field>
      <Field label="SKU (optional)">
        <Input value={form.sku} onChangeText={(v) => update('sku', v)} placeholder="e.g. CELL-12V-01" autoCapitalize="characters" />
      </Field>
      <Field label={isEdit ? 'Quantity' : 'Starting Quantity'}>
        <Input value={form.quantity} onChangeText={(v) => update('quantity', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
      </Field>
      <Field label="Minimum Stock Limit">
        <Input value={form.minStock} onChangeText={(v) => update('minStock', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        <Text className="mt-1 text-[11px] text-slate-500">A low-stock alert shows when the quantity reaches this number or below.</Text>
      </Field>
      <Field label="Service Charge (optional / £)">
        <Input value={form.serviceCharge} onChangeText={(v) => update('serviceCharge', v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <FormButtons onCancel={onClose} onSubmit={submit} submitting={submitting} label={isEdit ? 'Save Changes' : 'Add Part'} />
    </Sheet>
  );
}

export function RestockSheet({ visible, part, title = 'Restock Part', description, onSaved, onClose }) {
  const [quantityAdded, setQuantityAdded] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setQuantityAdded('');
      setNote('');
      setError(null);
    }
  }, [visible]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/parts/${part.id}/restock`, { quantityAdded: Number(quantityAdded), note: note.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const qty = Number(part?.quantity || 0);
  return (
    <Sheet visible={visible} title={title} description={description || `Add stock for "${part?.name}".`} onClose={onClose}>
      <Text className="text-sm text-slate-500">
        {part?.name} currently has <Text className="font-semibold text-slate-700">{qty}</Text> unit{qty === 1 ? '' : 's'} in stock.
      </Text>
      <Field label="Quantity to Add">
        <Input value={quantityAdded} onChangeText={(v) => setQuantityAdded(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="e.g. 20" autoFocus />
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChangeText={setNote} placeholder="e.g. Delivery from supplier" />
      </Field>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <FormButtons onCancel={onClose} onSubmit={submit} submitting={submitting} disabled={!quantityAdded} label="Add Stock" />
    </Sheet>
  );
}
