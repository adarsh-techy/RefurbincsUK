import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import apiClient from '../../services/api-client';
import Icon from '../../components/ui/Icon';
import InvoicePreviewModal from '../../components/client/records/InvoicePreviewModal';
import { downloadInvoice, isImageFile, viewInvoice } from '../../components/client/records/invoice-file';

// Invoices & Bills — the mobile version of the web ClientInvoicesPage
// (GET /clients/me/invoices): search, Payment Status filter (Paid / Pending
// Payment / Overdue), Date Received filter, Clear all; each invoice shows
// its payment status, received / due dates and notes, and has the web's two
// actions — View (image in the app, PDF in the system preview) and
// Download (share sheet), both via GET /invoices/:id/download.

const STATUS_FILTERS = [
  { id: '', label: 'All Invoices' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Pending Payment' },
  { id: 'overdue', label: 'Overdue' },
];

// the local calendar day of a timestamp (issue_date arrives as UTC, so
// slicing the string would give the previous day east of Greenwich)
function localDay(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function isOverdue(inv) {
  if (inv.status === 'paid' || !inv.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(inv.due_date) < today;
}

function PaymentBadge({ invoice }) {
  if (invoice.status === 'paid') {
    return (
      <View className="flex-row items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
        <Icon name="checkCircle" color="#10b981" size={12} />
        <Text className="text-[11px] font-bold text-emerald-700">Paid</Text>
      </View>
    );
  }
  if (isOverdue(invoice)) {
    return (
      <View className="flex-row items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1">
        <Icon name="alertTriangle" color="#f43f5e" size={12} />
        <Text className="text-[11px] font-bold text-rose-700">Overdue</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">
      <Icon name="clock" color="#f59e0b" size={12} />
      <Text className="text-[11px] font-bold text-amber-700">Pending Payment</Text>
    </View>
  );
}

export default function ClientInvoicesScreen() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD of issue_date
  const [actionLoading, setActionLoading] = useState(null); // `${id}:view` | `${id}:download`
  const [preview, setPreview] = useState(null); // { invoice, uri }

  const fetchInvoices = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get('/clients/me/invoices');
      setInvoices(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function onRefresh() {
    setRefreshing(true);
    fetchInvoices();
  }

  async function handleView(invoice) {
    if (!invoice.file_path) return;
    setActionLoading(`${invoice.id}:view`);
    try {
      const res = await viewInvoice(invoice);
      if (res.kind === 'image') setPreview({ invoice, uri: res.uri });
    } catch (err) {
      Alert.alert('Could not open invoice', err.message || 'Failed to access invoice file.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownload(invoice) {
    if (!invoice.file_path) return;
    setActionLoading(`${invoice.id}:download`);
    try {
      await downloadInvoice(invoice);
    } catch (err) {
      Alert.alert('Download failed', err.message || 'Failed to access invoice file.');
    } finally {
      setActionLoading(null);
    }
  }

  // the dates invoices were received on, newest first — the phone's
  // stand-in for the web's date picker
  const receivedDates = useMemo(() => {
    const set = new Set(invoices.map((inv) => localDay(inv.issue_date)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const filtered = invoices.filter((inv) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.file_name?.toLowerCase().includes(q) ||
      inv.notes?.toLowerCase().includes(q);
    const matchesDate = !dateFilter || localDay(inv.issue_date) === dateFilter;
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'paid' && inv.status === 'paid') ||
      (statusFilter === 'unpaid' && inv.status !== 'paid') ||
      (statusFilter === 'overdue' && isOverdue(inv));
    return matchesSearch && matchesDate && matchesStatus;
  });

  const anyFilter = Boolean(search || statusFilter || dateFilter);

  const header = (
    <View className="gap-2.5 pb-1">
      <Text className="text-[11px] text-slate-500">
        Official billing statements, payment due dates, and downloadable invoices (PDF / Images) issued for your battery fleet.
      </Text>
      <View className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-3">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Search Invoice / PDF</Text>
        <View className="flex-row items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
          <Icon name="search" color="#94a3b8" size={15} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, file name or notes…"
            placeholderTextColor="#94a3b8"
            className="flex-1 text-xs text-slate-900"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" color="#64748b" size={15} />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Payment Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const on = statusFilter === f.id;
            return (
              <TouchableOpacity key={f.id || 'all'} onPress={() => setStatusFilter(f.id)} className={`rounded-xl px-3 py-1.5 ${on ? 'bg-blue-600' : 'bg-slate-100'}`}>
                <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {receivedDates.length > 0 && (
          <>
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Date Received</Text>
              {dateFilter ? (
                <TouchableOpacity onPress={() => setDateFilter('')}>
                  <Text className="text-[11px] font-bold text-slate-500">Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              {receivedDates.map((d) => {
                const on = dateFilter === d;
                return (
                  <TouchableOpacity key={d} onPress={() => setDateFilter(on ? '' : d)} className={`rounded-xl px-3 py-1.5 ${on ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <Text className={`text-[11px] font-bold ${on ? 'text-white' : 'text-slate-600'}`}>{fmtDate(`${d}T12:00:00`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {anyFilter ? (
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              setStatusFilter('');
              setDateFilter('');
            }}
            className="self-start rounded-xl border border-slate-300 px-3 py-1.5"
          >
            <Text className="text-[11px] font-bold text-slate-600">Clear all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading invoices…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchInvoices} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-4 gap-3 pb-16"
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white py-12">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">
                {anyFilter ? 'No invoices match these filters' : 'No invoice PDF files have been sent yet.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isImg = isImageFile(item.file_name, item.file_path);
            const overdue = isOverdue(item);
            const busy = actionLoading?.startsWith(`${item.id}:`);
            return (
              <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <View className="flex-row items-start gap-3">
                  <View className={`h-10 w-10 items-center justify-center rounded-xl border ${isImg ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
                    <Icon name={isImg ? 'photo' : 'card'} color={isImg ? '#2563eb' : '#dc2626'} size={18} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-mono text-[10px] text-slate-400">#{index + 1}</Text>
                    <Text className="text-sm font-extrabold text-slate-900 dark:text-white">{item.invoice_number}</Text>
                    {item.file_name ? (
                      <Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>{item.file_name}</Text>
                    ) : null}
                  </View>
                  <PaymentBadge invoice={item} />
                </View>

                <View className="mt-3 gap-0.5">
                  <Text className="text-xs text-slate-700">
                    <Text className="text-[10px] text-slate-400">Received: </Text>
                    {fmtDate(item.issue_date)}
                  </Text>
                  {item.due_date ? (
                    <Text className={`text-xs font-semibold ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                      <Text className="text-[10px] font-bold uppercase">Due: </Text>
                      {fmtDate(item.due_date)}
                      {overdue ? '  · Overdue' : ''}
                    </Text>
                  ) : null}
                </View>

                <Text className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400" numberOfLines={3}>
                  {item.notes || '—'}
                </Text>

                <View className="mt-3.5 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                  {item.file_path ? (
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => handleView(item)}
                        disabled={busy}
                        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 ${busy ? 'opacity-60' : ''}`}
                      >
                        {actionLoading === `${item.id}:view` ? <ActivityIndicator color="#059669" size="small" /> : <Icon name="eye" color="#059669" size={14} />}
                        <Text className="text-xs font-bold text-emerald-700">View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDownload(item)}
                        disabled={busy}
                        className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 ${isImg ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'} ${busy ? 'opacity-60' : ''}`}
                      >
                        {actionLoading === `${item.id}:download` ? (
                          <ActivityIndicator color={isImg ? '#2563eb' : '#dc2626'} size="small" />
                        ) : (
                          <Text className={`text-xs font-bold ${isImg ? 'text-blue-700' : 'text-red-600'}`}>⤓</Text>
                        )}
                        <Text className={`text-xs font-bold ${isImg ? 'text-blue-700' : 'text-red-600'}`}>Download</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text className="text-center text-xs text-slate-400 dark:text-slate-500">No file attached</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <InvoicePreviewModal
        preview={preview}
        downloading={Boolean(preview && actionLoading === `${preview.invoice.id}:download`)}
        onDownload={handleDownload}
        onClose={() => setPreview(null)}
      />
    </View>
  );
}
