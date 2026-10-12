import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import DateField from '../../../components/admin/DateField';
import { Btn, Chips, ConfirmDialog, ErrorBox, PageHead, SearchBox, dateOnly } from '../../../components/admin/sa4/ui';
import InvoiceUploadSheet from '../../../components/admin/sa4/InvoiceUploadSheet';
import InvoicePreviewModal from '../../../components/client/records/InvoicePreviewModal';
import { downloadInvoice, isImageFile, viewInvoice } from '../../../components/client/records/invoice-file';

// Invoices (super_admin) — the phone version of the web InvoicesPage:
// GET /invoices + GET /clients; search / client / payment status / upload
// date filters with Clear all; per invoice a Paid / Unpaid / Overdue switch
// (PATCH /invoices/:id { status }), View, Download and Delete (type
// "delete" to confirm); "+ Upload & Send Invoice" (InvoiceUploadSheet).

function isOverdue(inv) {
  if (inv.status === 'paid' || !inv.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(inv.due_date) < today;
}

// YYYY-MM-DD in local time — the date the admin sees on the row
function localKey(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_OPTIONS = [
  { id: '', label: 'All Statuses' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid / Pending' },
  { id: 'overdue', label: 'Overdue' },
];

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [updatingPaidId, setUpdatingPaidId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    try {
      const [inv, cl] = await Promise.all([apiClient.get('/invoices'), apiClient.get('/clients')]);
      setInvoices(inv.data || []);
      setClients(Array.isArray(cl.data) ? cl.data : cl.data?.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function togglePaid(invoice) {
    const newStatus = invoice.status === 'paid' ? 'sent' : 'paid';
    setUpdatingPaidId(invoice.id);
    setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, status: newStatus } : i)));
    try {
      await apiClient.patch(`/invoices/${invoice.id}`, { status: newStatus });
    } catch (err) {
      setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, status: invoice.status } : i)));
      Alert.alert('Payment status', err.response?.data?.message || err.message || 'Failed to update payment status.');
    } finally {
      setUpdatingPaidId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/invoices/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      Alert.alert('Delete Invoice', err.response?.data?.message || err.message);
    }
  }

  async function handleView(inv) {
    setBusyId(`v${inv.id}`);
    try {
      const res = await viewInvoice(inv);
      if (res.kind === 'image') setPreview({ invoice: inv, uri: res.uri });
    } catch (err) {
      Alert.alert('View Invoice', err.message || 'Failed to access invoice file.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(inv) {
    setBusyId(`d${inv.id}`);
    try {
      await downloadInvoice(inv);
    } catch (err) {
      Alert.alert('Download Invoice', err.message || 'Failed to access invoice file.');
    } finally {
      setBusyId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = invoices.filter((inv) => {
    const matchesSearch = !q || [inv.invoice_number, inv.file_name, inv.client_name, inv.notes].some((v) => v && String(v).toLowerCase().includes(q));
    const matchesClient = !clientFilter || String(inv.client_id) === String(clientFilter);
    const matchesDate = !dateFilter || localKey(inv.issue_date) === dateFilter;
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'paid' && inv.status === 'paid') ||
      (statusFilter === 'unpaid' && inv.status !== 'paid') ||
      (statusFilter === 'overdue' && isOverdue(inv));
    return matchesSearch && matchesClient && matchesDate && matchesStatus;
  });
  const anyFilter = Boolean(search || clientFilter || statusFilter || dateFilter);

  const header = (
    <View className="mb-2 gap-3">
      <PageHead title="Invoices" description="Upload and send invoices (PDF / Images) directly to client dashboards, track due dates and mark payments.">
        <Btn label="+ Upload & Send Invoice" onPress={() => setFormOpen(true)} />
      </PageHead>
      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <Text className="text-[10px] font-bold uppercase text-slate-500">Search Invoice</Text>
        <SearchBox value={search} onChangeText={setSearch} placeholder="Search title, client or notes…" />
        <Text className="text-[10px] font-bold uppercase text-slate-500">Payment Status</Text>
        <Chips options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} activeClass="bg-blue-600" />
        <TouchableOpacity onPress={() => setShowFilters((v) => !v)}>
          <Text className="text-xs font-bold text-blue-600">{showFilters ? '▴ Hide client & date filters' : '▾ Client & upload date filters'}{clientFilter || dateFilter ? ' (active)' : ''}</Text>
        </TouchableOpacity>
        {showFilters && (
          <>
            <Text className="text-[10px] font-bold uppercase text-slate-500">Client</Text>
            <Chips
              options={[{ id: '', label: 'All Fleet Clients' }, ...clients.map((c) => ({ id: String(c.id), label: c.name }))]}
              value={clientFilter}
              onChange={setClientFilter}
              activeClass="bg-blue-600"
            />
            <DateField label="Upload Date" value={dateFilter} onChange={setDateFilter} />
          </>
        )}
        {anyFilter && (
          <TouchableOpacity onPress={() => { setSearch(''); setClientFilter(''); setStatusFilter(''); setDateFilter(''); }} className="self-start rounded-lg border border-slate-300 px-3 py-1.5">
            <Text className="text-xs font-bold text-slate-700">Clear all</Text>
          </TouchableOpacity>
        )}
      </View>
      <ErrorBox text={error} />
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50">
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={header}
        contentContainerClassName="p-4 gap-2.5 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <Text className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            {loading ? 'Loading invoices…' : 'No invoices found.'}
          </Text>
        }
        renderItem={({ item: inv, index }) => {
          const img = isImageFile(inv.file_name, inv.file_path);
          const paid = inv.status === 'paid';
          const overdue = isOverdue(inv);
          return (
            <View className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <View className="flex-row items-start gap-2.5">
                <Text className="w-5 pt-2 text-xs font-bold text-slate-400">{index + 1}</Text>
                <View className={`h-9 w-9 items-center justify-center rounded-lg border ${img ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
                  <Icon name={img ? 'photo' : 'card'} color={img ? '#2563eb' : '#dc2626'} size={18} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{inv.invoice_number}</Text>
                  {inv.file_name ? <Text className="text-[11px] text-slate-500" numberOfLines={1}>{inv.file_name}</Text> : null}
                  <Text className="mt-0.5 text-xs font-semibold text-slate-700" numberOfLines={1}>{inv.client_name}</Text>
                </View>
              </View>
              <View className="ml-7 mt-2.5 flex-row flex-wrap items-center gap-3">
                <TouchableOpacity
                  disabled={updatingPaidId === inv.id}
                  onPress={() => togglePaid(inv)}
                  className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${paid ? 'border-emerald-300 bg-emerald-50' : overdue ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'} ${updatingPaidId === inv.id ? 'opacity-50' : ''}`}
                >
                  <View className={`h-4 w-4 items-center justify-center rounded border ${paid ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                    {paid ? <Icon name="check" color="#fff" size={10} /> : null}
                  </View>
                  <Text className={`text-xs font-bold ${paid ? 'text-emerald-700' : overdue ? 'text-rose-700' : 'text-slate-700'}`}>{paid ? 'Paid' : overdue ? 'Overdue' : 'Unpaid'}</Text>
                </TouchableOpacity>
                <View>
                  <Text className="text-[11px] text-slate-500">Issued: <Text className="font-semibold text-slate-700">{dateOnly(inv.issue_date)}</Text></Text>
                  {inv.due_date ? (
                    <Text className="text-[11px] text-slate-500">
                      Due: <Text className={`font-semibold ${overdue ? 'text-rose-700' : 'text-slate-700'}`}>{dateOnly(inv.due_date)}</Text>
                      {overdue ? <Text className="font-bold text-rose-600">  Overdue</Text> : null}
                    </Text>
                  ) : null}
                </View>
              </View>
              {inv.notes ? <Text className="ml-7 mt-1.5 text-[11px] text-slate-500" numberOfLines={2}>{inv.notes}</Text> : null}
              <View className="ml-7 mt-2.5 flex-row flex-wrap gap-2">
                {inv.file_path ? (
                  <>
                    <Btn small tone="outline" label={busyId === `v${inv.id}` ? 'Opening…' : 'View'} disabled={Boolean(busyId)} onPress={() => handleView(inv)} />
                    <Btn small tone="outline" label={busyId === `d${inv.id}` ? 'Preparing…' : 'Download'} disabled={Boolean(busyId)} onPress={() => handleDownload(inv)} />
                  </>
                ) : null}
                <Btn small tone="danger" label="Delete" onPress={() => setDeleteTarget(inv)} />
              </View>
            </View>
          );
        }}
      />

      <InvoiceUploadSheet visible={formOpen} clients={clients} onSaved={() => { setFormOpen(false); load(); }} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice "${deleteTarget?.invoice_number}" for ${deleteTarget?.client_name}? This action cannot be undone.`}
        confirmWord="delete"
        confirmLabel="Delete Invoice"
        requireTyping
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <InvoicePreviewModal
        preview={preview}
        downloading={busyId === `d${preview?.invoice?.id}`}
        onDownload={handleDownload}
        onClose={() => setPreview(null)}
      />
    </View>
  );
}
