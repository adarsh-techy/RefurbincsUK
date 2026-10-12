import { useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../../../services/api-client';
import DateField, { shiftYmd, todayYmd } from '../DateField';
import Icon from '../../ui/Icon';
import { Field, Input, SearchBox, Sheet } from './ui';

// "Upload & Send Invoice Document" — the web InvoicesPage upload modal:
// client, file (PDF / image, preview), title (defaults to the file name),
// issue / due dates with +7 / +14 / +30 day shortcuts, paid switch, email
// to the client (recipient prefilled from the client's invoice email, else
// login email) and notes → POST /invoices (multipart, field pdfFile).

const isImageFile = (name = '') => /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
const clientEmail = (c) => (c ? c.invoice_email || c.login_email || c.email || '' : '');

export default function InvoiceUploadSheet({ visible, clients, onSaved, onClose }) {
  const [clientId, setClientId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [title, setTitle] = useState('');
  const [issueDate, setIssueDate] = useState(todayYmd());
  const [dueDate, setDueDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // reset like the web's openUploadModal()
  useEffect(() => {
    if (!visible) return;
    setClientId('');
    setClientQuery('');
    setTitle('');
    setIssueDate(todayYmd());
    setDueDate(shiftYmd(todayYmd(), 14));
    setIsPaid(false);
    setSendEmail(true);
    setRecipientEmail('');
    setNotes('');
    setFile(null);
    setFormError(null);
  }, [visible]);

  const selected = clients.find((c) => String(c.id) === String(clientId));

  function chooseClient(c) {
    setClientId(String(c.id));
    setRecipientEmail(clientEmail(c));
  }

  function setQuickDueDate(days) {
    setDueDate(shiftYmd(issueDate || todayYmd(), days));
  }

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (a.size && a.size > 15 * 1024 * 1024) {
      setFormError('File is larger than 15MB.');
      return;
    }
    setFile({ uri: a.uri, name: a.name || 'invoice.pdf', type: a.mimeType || 'application/pdf', size: a.size || 0 });
    if (!title) setTitle((a.name || '').replace(/\.[^/.]+$/, ''));
    setFormError(null);
  }

  async function submit() {
    if (!clientId) {
      setFormError('Please select a client to issue the invoice.');
      return;
    }
    if (!file) {
      setFormError('Please upload an invoice document (PDF or Image file).');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append('clientId', String(clientId));
      fd.append('title', title.trim() || file.name.replace(/\.[^/.]+$/, ''));
      fd.append('issueDate', issueDate);
      if (dueDate) fd.append('dueDate', dueDate);
      fd.append('status', isPaid ? 'paid' : 'sent');
      fd.append('sendEmail', sendEmail ? 'true' : 'false');
      if (recipientEmail) fd.append('recipientEmail', recipientEmail.trim());
      if (notes) fd.append('notes', notes);
      fd.append('pdfFile', { uri: file.uri, name: file.name, type: file.type });
      await apiClient.post('/invoices', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSaved();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  const q = clientQuery.trim().toLowerCase();
  const clientOptions = clients.filter((c) => !q || `${c.name} ${clientEmail(c)}`.toLowerCase().includes(q));
  const saved = clientEmail(selected);

  return (
    <Sheet
      visible={visible}
      title="Upload & Send Invoice Document"
      description="Issue and dispatch an official invoice or billing statement directly to the client's dashboard."
      onClose={onClose}
    >
      {formError ? (
        <View className="rounded-xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{formError}</Text>
        </View>
      ) : null}

      {/* 1. client */}
      <View className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <View className="flex-row flex-wrap items-center justify-between gap-1">
          <Text className="text-sm font-bold text-slate-800">Target Fleet Client Account <Text className="text-red-600">*</Text></Text>
          {selected ? <Text className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Selected: {selected.name}</Text> : null}
        </View>
        <View className="mt-2">
          <SearchBox value={clientQuery} onChangeText={setClientQuery} placeholder="-- Choose a Client Account --" />
        </View>
        <View className="mt-2 max-h-52 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {clientOptions.slice(0, 30).map((c) => {
            const active = String(c.id) === String(clientId);
            const extra = c.invoice_email ? `• Billing: ${c.invoice_email}` : c.email || c.login_email ? `• Login: ${c.email || c.login_email}` : '';
            return (
              <TouchableOpacity key={c.id} onPress={() => chooseClient(c)} className={`border-b border-slate-100 px-3 py-2.5 ${active ? 'bg-emerald-50' : ''}`}>
                <Text className={`text-xs ${active ? 'font-bold text-emerald-800' : 'text-slate-700'}`}>
                  {active ? '✓ ' : ''}{c.name} {c.user_role === 'recycle_client' ? '(Recycling Partner)' : ''} {extra}
                </Text>
              </TouchableOpacity>
            );
          })}
          {clientOptions.length === 0 ? <Text className="p-3 text-xs text-slate-400">No client matches.</Text> : null}
        </View>
      </View>

      {/* 2. file */}
      <Field label="Document File (PDF / Image) *">
        {file ? (
          <View className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/40 p-3">
            {isImageFile(file.name) ? (
              <Image source={{ uri: file.uri }} style={{ width: '100%', height: 180 }} resizeMode="contain" />
            ) : (
              <View className="items-center py-4">
                <Icon name="card" color="#dc2626" size={32} />
              </View>
            )}
            <Text className="mt-2 text-sm font-bold text-slate-800" numberOfLines={1}>{file.name}</Text>
            <Text className="text-[11px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to dispatch</Text>
            <TouchableOpacity onPress={() => setFile(null)} className="mt-2 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5">
              <Text className="text-xs font-bold text-slate-700">Change File</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={pickFile} className="items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6">
            <Icon name="package" color="#10b981" size={26} />
            <Text className="mt-2 text-sm font-bold text-slate-700">Tap to select a file</Text>
            <Text className="text-[11px] text-slate-500">PDF, PNG, JPG, JPEG, WEBP (Max 15MB)</Text>
          </TouchableOpacity>
        )}
      </Field>

      <Field label="Invoice Title / Reference">
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Invoice - August 2026 or INV-2026-081" />
      </Field>

      {/* billing schedule */}
      <View className="rounded-2xl border border-slate-200 p-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-sm font-bold text-slate-800">Billing Schedule</Text>
          <View className="flex-row gap-1.5">
            {[7, 14, 30].map((d) => (
              <TouchableOpacity key={d} onPress={() => setQuickDueDate(d)} className="rounded-lg bg-slate-100 px-2.5 py-1">
                <Text className="text-[11px] font-bold text-slate-700">+{d} Days</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View className="mt-3 gap-3">
          <DateField label="Issue Date *" value={issueDate} onChange={setIssueDate} clearable={false} />
          <DateField label="Payment Due Date" value={dueDate} onChange={setDueDate} quick={false} />
        </View>
      </View>

      {/* paid switch */}
      <TouchableOpacity
        onPress={() => setIsPaid((v) => !v)}
        activeOpacity={0.85}
        className={`flex-row items-center gap-3 rounded-2xl border p-3 ${isPaid ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
      >
        <View className="flex-1">
          <Text className={`text-sm font-bold ${isPaid ? 'text-emerald-800' : 'text-slate-800'}`}>{isPaid ? 'Payment Received & Settled' : 'Payment Pending (Unpaid)'}</Text>
          <Text className="text-[11px] text-slate-500">{isPaid ? 'Invoice will immediately show as Paid on client dashboard' : 'Invoice will show with Pending Due status'}</Text>
        </View>
        <View className={`h-6 w-6 items-center justify-center rounded-md border ${isPaid ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
          {isPaid ? <Icon name="check" color="#fff" size={14} /> : null}
        </View>
      </TouchableOpacity>

      {/* email */}
      <View className="rounded-2xl border border-slate-200 p-3">
        <TouchableOpacity onPress={() => setSendEmail((v) => !v)} className="flex-row items-center gap-2.5">
          <View className={`h-5 w-5 items-center justify-center rounded border ${sendEmail ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'}`}>
            {sendEmail ? <Icon name="check" color="#fff" size={12} /> : null}
          </View>
          <Text className="flex-1 text-sm font-bold text-slate-800">Email Invoice & Attachment to Client</Text>
        </TouchableOpacity>
        {selected && sendEmail ? (
          <Text className="mt-1 text-[10px] font-bold text-slate-500">
            {selected.invoice_email ? 'Auto-prefilled from Client Profile' : selected.login_email || selected.email ? 'Auto-prefilled from Login Email' : 'No Saved Email'}
          </Text>
        ) : null}
        {sendEmail && (
          <View className="mt-3">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-slate-600">Recipient Billing Email:</Text>
              {selected && saved && recipientEmail !== saved ? (
                <TouchableOpacity onPress={() => setRecipientEmail(saved)}>
                  <Text className="text-[11px] font-bold text-blue-600">Reset to client email</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Input value={recipientEmail} onChangeText={setRecipientEmail} keyboardType="email-address" autoCapitalize="none" placeholder="e.g. accounts@clientfleet.co.uk or billing@company.com" />
            <Text className="mt-1 text-[11px] text-slate-500">
              {selected?.invoice_email
                ? "✓ Automatically prefilled from client's configured Invoice / Billing email."
                : selected?.login_email || selected?.email
                  ? `ℹ️ Prefilled from client portal login email (${selected.login_email || selected.email}).`
                  : '⚠️ Client has no email on file. Please enter recipient email manually.'}
            </Text>
          </View>
        )}
      </View>

      <Field label="Optional Notes / Remittance Instructions">
        <Input multiline value={notes} onChangeText={setNotes} placeholder="Add bank transfer reference, terms, or customer remarks (visible on client portal & email)…" />
      </Field>

      <View className="gap-3 border-t border-slate-100 pt-4">
        <Text className="text-[11px] text-slate-500">Document delivered to client portal {sendEmail && recipientEmail ? `and ${recipientEmail}` : ''}.</Text>
        <View className="flex-row justify-end gap-2">
          <TouchableOpacity onPress={onClose} className="rounded-xl px-4 py-2.5">
            <Text className="text-sm font-medium text-slate-600">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={saving || !clientId || !file}
            onPress={submit}
            className={`rounded-xl bg-emerald-600 px-4 py-2.5 ${saving || !clientId || !file ? 'opacity-50' : ''}`}
          >
            <Text className="text-sm font-bold text-white">{saving ? 'Uploading & Dispatching…' : 'Upload & Send Invoice'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Sheet>
  );
}
