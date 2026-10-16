import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import Icon from '../../../components/ui/Icon';
import DateField from '../../../components/admin/DateField';
import { ConfirmDialog, ErrorBox, dateOnly } from '../../../components/admin/sa4/ui';
import InvoiceUploadSheet from '../../../components/admin/sa4/InvoiceUploadSheet';
import InvoicePreviewModal from '../../../components/client/records/InvoicePreviewModal';
import { downloadInvoice, isImageFile, viewInvoice } from '../../../components/client/records/invoice-file';

// Invoices (super_admin)
// Polished executive redesign with zero horizontal scrolling, live counters strip,
// 4-stat KPI grid, wrapping status & client filter pills, and compact invoice cards.

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

  const totalCount = invoices.length;
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const overdueCount = invoices.filter((i) => isOverdue(i)).length;
  const unpaidCount = totalCount - paidCount;

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
      {/* Executive Header Card with Live Counters Strip */}
      <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-base font-black text-slate-900">Client Invoices</Text>
              <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-emerald-800">Billing & Accounts</Text>
              </View>
            </View>
            <Text className="mt-0.5 text-[11px] text-slate-500 leading-4">
              Upload and send invoices (PDF / Images) directly to client dashboards, track due dates and mark payments.
            </Text>
          </View>

          <View className="flex-row items-center gap-1.5">
            <TouchableOpacity
              onPress={() => setFormOpen(true)}
              className="flex-row items-center gap-1 rounded-xl bg-slate-900 px-2.5 py-1.5 shadow-2xs"
            >
              <Icon name="plus" size={11} color="#34d399" />
              <Text className="text-[10.5px] font-bold text-white">Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setLoading(true); load(); }}
              className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-2xs"
            >
              <Icon name="refresh" size={11} color="#64748b" />
              <Text className="text-[10.5px] font-semibold text-slate-700">Sync</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Counters Strip */}
        <View className="flex-row items-center gap-2 pt-2 mt-2 border-t border-slate-100 flex-wrap">
          <Text className="text-[10.5px] text-slate-500">
            Total: <Text className="font-black text-slate-900">{totalCount}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-emerald-700">
            Paid: <Text className="font-bold">{paidCount}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-blue-700">
            Pending: <Text className="font-bold">{unpaidCount}</Text>
          </Text>
          <Text className="text-slate-300">•</Text>
          <Text className="text-[10.5px] text-rose-700">
            Overdue: <Text className="font-bold">{overdueCount}</Text>
          </Text>
        </View>
      </View>

      {/* 4 Compact KPI Cards (2x2 Grid) */}
      <View className="gap-2">
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
            <Text className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Total Invoices</Text>
            <Text className="mt-1 text-lg font-black text-slate-900">{totalCount}</Text>
            <Text className="mt-0.5 text-[9px] text-slate-400 font-medium">Documents logged</Text>
          </View>
          <View className="flex-1 rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-2.5 shadow-2xs">
            <Text className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800">Settled (Paid)</Text>
            <Text className="mt-1 text-lg font-black text-emerald-700">{paidCount}</Text>
            <Text className="mt-0.5 text-[9px] text-emerald-600 font-medium">Cleared payments</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-xl border border-blue-200/90 bg-blue-50/70 p-2.5 shadow-2xs">
            <Text className="text-[9.5px] font-bold uppercase tracking-wider text-blue-800">Pending</Text>
            <Text className="mt-1 text-lg font-black text-blue-700">{unpaidCount}</Text>
            <Text className="mt-0.5 text-[9px] text-blue-600 font-medium">Awaiting payment</Text>
          </View>
          <View className="flex-1 rounded-xl border border-rose-200/90 bg-rose-50/70 p-2.5 shadow-2xs">
            <Text className="text-[9.5px] font-bold uppercase tracking-wider text-rose-800">Overdue</Text>
            <Text className="mt-1 text-lg font-black text-rose-700">{overdueCount}</Text>
            <Text className="mt-0.5 text-[9px] text-rose-600 font-medium">Requires follow-up</Text>
          </View>
        </View>
      </View>

      {/* Filter Toolbar — WRAPPING (Zero Horizontal Scrolling) */}
      <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
        {/* Search Input */}
        <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
          <Icon name="search" size={13} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, client or notes…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            className="ml-1.5 flex-1 p-0 text-xs text-slate-900"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}>
              <Icon name="x" size={12} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status Filter Pills — WRAPPING */}
        <View className="flex-row flex-wrap gap-1">
          {STATUS_OPTIONS.map((o) => {
            const active = statusFilter === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                onPress={() => setStatusFilter(active && o.id ? '' : o.id)}
                className={`rounded-lg border px-2 py-1 ${
                  active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toggle Client & Date Filters */}
        <View className="flex-row items-center justify-between pt-0.5 border-t border-slate-100">
          <TouchableOpacity onPress={() => setShowFilters((v) => !v)} hitSlop={6}>
            <Text className="text-[11px] font-bold text-blue-600">
              {showFilters ? '▴ Hide client & upload date' : '▾ Client & upload date filters'}
              {clientFilter || dateFilter ? ' (active)' : ''}
            </Text>
          </TouchableOpacity>
          {anyFilter && (
            <TouchableOpacity
              onPress={() => { setSearch(''); setClientFilter(''); setStatusFilter(''); setDateFilter(''); }}
              hitSlop={6}
            >
              <Text className="text-[11px] font-bold text-rose-600">✕ Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Expandable Client & Date Filters */}
        {showFilters && (
          <View className="gap-2 pt-1 border-t border-slate-100">
            <Text className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Fleet Client</Text>
            <View className="flex-row flex-wrap gap-1">
              <TouchableOpacity
                onPress={() => setClientFilter('')}
                className={`rounded-lg border px-2 py-0.5 ${
                  !clientFilter ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'
                }`}
              >
                <Text className={`text-[10px] font-bold ${!clientFilter ? 'text-white' : 'text-slate-600'}`}>
                  All Clients
                </Text>
              </TouchableOpacity>
              {clients.map((c) => {
                const active = String(clientFilter) === String(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setClientFilter(active ? '' : String(c.id))}
                    className={`rounded-lg border px-2 py-0.5 ${
                      active ? 'border-blue-600 bg-blue-600' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <DateField label="Upload Date" value={dateFilter} onChange={setDateFilter} quick={false} />
          </View>
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
        contentContainerClassName="p-3.5 gap-2.5 pb-20"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <View className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 items-center">
            <Text className="text-xs text-slate-500 font-medium">
              {loading ? 'Loading invoices…' : 'No invoices match the selected filters.'}
            </Text>
          </View>
        }
        renderItem={({ item: inv, index }) => {
          const img = isImageFile(inv.file_name, inv.file_path);
          const paid = inv.status === 'paid';
          const overdue = isOverdue(inv);

          return (
            <View className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs gap-2">
              {/* Top Row: Index, Icon, Title, Status Toggle */}
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-row items-start gap-2 min-w-0 flex-1">
                  <Text className="w-4 pt-1 font-mono text-[10px] text-slate-400">#{index + 1}</Text>
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-lg border ${
                      img ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'
                    }`}
                  >
                    <Icon name={img ? 'photo' : 'card'} color={img ? '#2563eb' : '#dc2626'} size={15} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                      {inv.invoice_number}
                    </Text>
                    {inv.file_name ? (
                      <Text className="text-[10px] text-slate-400 font-mono truncate" numberOfLines={1}>
                        {inv.file_name}
                      </Text>
                    ) : null}
                    <Text className="mt-0.5 text-[11px] font-bold text-slate-700" numberOfLines={1}>
                      {inv.client_name}
                    </Text>
                  </View>
                </View>

                {/* Status Toggle Button */}
                <TouchableOpacity
                  disabled={updatingPaidId === inv.id}
                  onPress={() => togglePaid(inv)}
                  className={`flex-row items-center gap-1 rounded-lg border px-2 py-1 shrink-0 ${
                    paid
                      ? 'border-emerald-300 bg-emerald-50'
                      : overdue
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-slate-200 bg-slate-50'
                  } ${updatingPaidId === inv.id ? 'opacity-50' : ''}`}
                >
                  <View
                    className={`h-3.5 w-3.5 items-center justify-center rounded border ${
                      paid ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {paid ? <Icon name="check" color="#fff" size={9} /> : null}
                  </View>
                  <Text
                    className={`text-[10.5px] font-black ${
                      paid ? 'text-emerald-700' : overdue ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    {paid ? 'Paid' : overdue ? 'Overdue' : 'Unpaid'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Dates Ribbon */}
              <View className="flex-row flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-1.5 text-[10.5px]">
                <Text className="text-[10.5px] text-slate-500">
                  Issued: <Text className="font-bold text-slate-800">{dateOnly(inv.issue_date)}</Text>
                </Text>
                {inv.due_date ? (
                  <Text className={`text-[10.5px] ${overdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                    • Due: <Text className={`font-bold ${overdue ? 'text-rose-700' : 'text-slate-800'}`}>{dateOnly(inv.due_date)}</Text>
                    {overdue ? ' (Overdue)' : ''}
                  </Text>
                ) : null}
              </View>

              {inv.notes ? (
                <Text className="text-[10.5px] text-slate-500 italic" numberOfLines={2}>
                  Note: “{inv.notes}”
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View className="flex-row items-center justify-end gap-1.5 border-t border-slate-100 pt-1.5">
                {inv.file_path ? (
                  <>
                    <TouchableOpacity
                      disabled={Boolean(busyId)}
                      onPress={() => handleView(inv)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-2xs"
                    >
                      <Text className="text-[10.5px] font-bold text-slate-700">
                        {busyId === `v${inv.id}` ? 'Opening…' : 'View'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={Boolean(busyId)}
                      onPress={() => handleDownload(inv)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-2xs"
                    >
                      <Text className="text-[10.5px] font-bold text-slate-700">
                        {busyId === `d${inv.id}` ? 'Preparing…' : 'Download'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                <TouchableOpacity
                  onPress={() => setDeleteTarget(inv)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 shadow-2xs"
                >
                  <Text className="text-[10.5px] font-bold text-rose-700">Delete</Text>
                </TouchableOpacity>
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
