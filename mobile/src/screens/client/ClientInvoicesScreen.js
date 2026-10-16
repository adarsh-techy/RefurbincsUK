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

// Invoices & Bills — mobile version of the web ClientInvoicesPage
// (GET /clients/me/invoices): search, Payment Status filter (Paid / Pending
// Payment / Overdue), Date Received filter, Clear all; each invoice shows
// its payment status, received / due dates and notes, and has the web's two
// actions — View (image in the app, PDF in the system preview) and
// Download (share sheet), both via GET /invoices/:id/download.

const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Pending' },
  { id: 'overdue', label: 'Overdue' },
];

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
      <View className="flex-row items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 dark:border-emerald-800/50 dark:bg-emerald-950/40">
        <Icon name="checkCircle" color="#10b981" size={10} />
        <Text className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Paid</Text>
      </View>
    );
  }
  if (isOverdue(invoice)) {
    return (
      <View className="flex-row items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 dark:border-rose-800/50 dark:bg-rose-950/40">
        <Icon name="alertTriangle" color="#f43f5e" size={10} />
        <Text className="text-[10px] font-bold text-rose-700 dark:text-rose-300">Overdue</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 dark:border-amber-800/50 dark:bg-amber-950/40">
      <Icon name="clock" color="#f59e0b" size={10} />
      <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Pending</Text>
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
  const [dateFilter, setDateFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [preview, setPreview] = useState(null);

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

  // Summary stats
  const stats = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    invoices.forEach((inv) => {
      if (inv.status === 'paid') {
        paid += 1;
      } else if (isOverdue(inv)) {
        overdue += 1;
      } else {
        pending += 1;
      }
    });

    return {
      total: invoices.length,
      paid,
      pending,
      overdue,
    };
  }, [invoices]);

  const receivedDates = useMemo(() => {
    const set = new Set(invoices.map((inv) => localDay(inv.issue_date)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
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
        (statusFilter === 'unpaid' && inv.status !== 'paid' && !isOverdue(inv)) ||
        (statusFilter === 'overdue' && isOverdue(inv));
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [invoices, search, dateFilter, statusFilter]);

  const anyFilter = Boolean(search || statusFilter || dateFilter);

  const header = (
    <View className="gap-2 pb-1.5">
      {/* Title & Refresh Button */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="text-base font-black text-slate-900 dark:text-white">Invoices & Bills</Text>
            <View className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 dark:border-slate-800 dark:bg-slate-800">
              <Text className="text-[9px] font-bold text-slate-700 dark:text-slate-300">
                {filtered.length} {filtered.length === 1 ? 'Invoice' : 'Invoices'}
              </Text>
            </View>
          </View>
          <Text className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            Official billing statements and downloadable documents.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          className="flex-row items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900 shadow-2xs"
        >
          <Icon name="rotateCcw" size={11} color="#64748b" />
          <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Metric Cards Strip - Compact 2x2 Paired Layout */}
      <View className="gap-1.5">
        <View className="flex-row gap-1.5">
          {/* Total Invoices */}
          <TouchableOpacity
            onPress={() => setStatusFilter('')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              !statusFilter
                ? 'border-blue-400 bg-blue-50/50 dark:border-blue-800/60 dark:bg-blue-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Invoices
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950">
                <Icon name="fileText" size={10} color="#2563eb" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-slate-900 dark:text-white leading-tight">
              {stats.total}
            </Text>
            <Text className="text-[8px] font-medium text-slate-400 dark:text-slate-400 mt-0.5">
              All Statements
            </Text>
          </TouchableOpacity>

          {/* Paid */}
          <TouchableOpacity
            onPress={() => setStatusFilter(statusFilter === 'paid' ? '' : 'paid')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              statusFilter === 'paid'
                ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Paid
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                <Icon name="checkCircle" size={10} color="#059669" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-emerald-600 dark:text-emerald-400 leading-tight">
              {stats.paid}
            </Text>
            <Text className="text-[8px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
              Settled & Cleared
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-1.5">
          {/* Pending */}
          <TouchableOpacity
            onPress={() => setStatusFilter(statusFilter === 'unpaid' ? '' : 'unpaid')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              statusFilter === 'unpaid'
                ? 'border-amber-400 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Pending
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
                <Icon name="clock" size={10} color="#d97706" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-amber-600 dark:text-amber-400 leading-tight">
              {stats.pending}
            </Text>
            <Text className="text-[8px] font-medium text-amber-700 dark:text-amber-400 mt-0.5">
              Awaiting Payment
            </Text>
          </TouchableOpacity>

          {/* Overdue */}
          <TouchableOpacity
            onPress={() => setStatusFilter(statusFilter === 'overdue' ? '' : 'overdue')}
            className={`flex-1 rounded-xl border p-2 shadow-2xs justify-between ${
              statusFilter === 'overdue'
                ? 'border-rose-400 bg-rose-50/50 dark:border-rose-800/60 dark:bg-rose-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[8.5px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Overdue
              </Text>
              <View className="h-4.5 w-4.5 items-center justify-center rounded-md bg-rose-100 dark:bg-rose-950">
                <Icon name="alertTriangle" size={10} color="#e11d48" />
              </View>
            </View>
            <Text className="mt-0.5 text-sm font-black text-rose-600 dark:text-rose-400 leading-tight">
              {stats.overdue}
            </Text>
            <Text className="text-[8px] font-medium text-rose-700 dark:text-rose-400 mt-0.5">
              Action Required
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Overdue Banner */}
      {stats.overdue > 0 && (
        <View className="flex-row items-start gap-1.5 rounded-lg border border-rose-300/80 bg-rose-50/80 p-2 dark:border-rose-900/40 dark:bg-rose-950/30">
          <Icon name="alertTriangle" size={13} color="#e11d48" />
          <Text className="flex-1 text-[10px] leading-3.5 text-rose-900 dark:text-rose-200">
            <Text className="font-bold">{stats.overdue} invoice{stats.overdue === 1 ? '' : 's'} overdue. </Text>
            Please review and clear outstanding statements.
          </Text>
        </View>
      )}

      {/* Search Input - Clean layout with Icon */}
      <View className="relative flex-row items-center rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <Icon name="search" size={12} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice number or file…"
          placeholderTextColor="#94a3b8"
          className="flex-1 py-1.5 px-2 text-[11px] text-slate-900 dark:text-white"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Icon name="close" size={11} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status Filter Chips */}
      <View className="flex-row items-center gap-1 overflow-x-auto py-0.5">
        {STATUS_FILTERS.map((tab) => {
          const active = statusFilter === tab.id;
          const count =
            tab.id === 'paid'
              ? stats.paid
              : tab.id === 'unpaid'
              ? stats.pending
              : tab.id === 'overdue'
              ? stats.overdue
              : stats.total;

          return (
            <TouchableOpacity
              key={tab.id || 'all'}
              onPress={() => setStatusFilter(tab.id)}
              className={`flex-row items-center gap-1 rounded-lg px-2 py-1 ${
                active
                  ? 'bg-slate-900 dark:bg-white'
                  : 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <Text className={`text-[10px] font-bold ${active ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
                {tab.label}
              </Text>
              <View className={`rounded-full px-1.5 py-0.2 ${active ? 'bg-white/20 dark:bg-slate-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Text className={`text-[8.5px] font-bold ${active ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date Filter Chips if any dates */}
      {receivedDates.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1 py-0.5">
          {receivedDates.slice(0, 8).map((d) => {
            const on = dateFilter === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDateFilter(on ? '' : d)}
                className={`rounded-lg px-2 py-0.5 border ${
                  on
                    ? 'border-slate-800 bg-slate-800 dark:border-slate-200 dark:bg-slate-200'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <Text
                  className={`text-[9.5px] font-bold ${
                    on ? 'text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {fmtDate(`${d}T12:00:00`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {anyFilter && (
        <TouchableOpacity
          onPress={() => {
            setSearch('');
            setStatusFilter('');
            setDateFilter('');
          }}
          className="self-start rounded-lg border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <Text className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400">Clear all filters</Text>
        </TouchableOpacity>
      )}

      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading invoices…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchInvoices} className="mt-3 rounded-xl bg-emerald-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-2.5 gap-2 pb-16"
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" colors={['#10b981']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
              <View className="mb-2 h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Icon name="fileText" size={16} color="#94a3b8" />
              </View>
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {anyFilter ? 'No invoices match these filters' : 'No invoice PDF files have been sent yet.'}
              </Text>
              {anyFilter && (
                <TouchableOpacity
                  onPress={() => {
                    setSearch('');
                    setStatusFilter('');
                    setDateFilter('');
                  }}
                  className="mt-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800"
                >
                  <Text className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Reset Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const isImg = isImageFile(item.file_name, item.file_path);
            const overdue = isOverdue(item);
            const busy = actionLoading?.startsWith(`${item.id}:`);

            return (
              <View className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                {/* Header: Icon + Invoice Number + Status Badge */}
                <View className="flex-row items-start gap-2">
                  <View
                    className={`h-7 w-7 items-center justify-center rounded-lg border ${
                      isImg
                        ? 'border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
                        : 'border-red-100 bg-red-50 dark:border-red-900 dark:bg-red-950'
                    }`}
                  >
                    <Icon name={isImg ? 'photo' : 'fileText'} color={isImg ? '#2563eb' : '#dc2626'} size={13} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs font-bold text-slate-900 dark:text-white" numberOfLines={1}>
                      {item.invoice_number}
                    </Text>
                    {item.file_name ? (
                      <Text className="font-mono text-[9px] text-slate-400 dark:text-slate-500 mt-0.5" numberOfLines={1}>
                        {item.file_name}
                      </Text>
                    ) : null}
                  </View>
                  <PaymentBadge invoice={item} />
                </View>

                {/* Dates Row */}
                <View className="mt-2 flex-row items-center justify-between rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                  <View>
                    <Text className="text-[8.5px] font-semibold text-slate-400">Received Date</Text>
                    <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
                      {fmtDate(item.issue_date)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[8.5px] font-semibold text-slate-400">Payment Due</Text>
                    <Text
                      className={`text-[11px] font-bold leading-tight ${
                        overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.due_date ? fmtDate(item.due_date) : '—'}
                    </Text>
                  </View>
                </View>

                {/* Notes if available */}
                {item.notes ? (
                  <Text className="mt-1.5 text-[9.5px] leading-relaxed text-slate-500 dark:text-slate-400" numberOfLines={2}>
                    {item.notes}
                  </Text>
                ) : null}

                {/* Action Buttons */}
                <View className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                  {item.file_path ? (
                    <View className="flex-row gap-1.5">
                      <TouchableOpacity
                        onPress={() => handleView(item)}
                        disabled={busy}
                        className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 dark:border-slate-700 dark:bg-slate-800 ${
                          busy ? 'opacity-60' : ''
                        }`}
                      >
                        {actionLoading === `${item.id}:view` ? (
                          <ActivityIndicator color="#059669" size="small" />
                        ) : (
                          <Icon name="eye" color="#64748b" size={11} />
                        )}
                        <Text className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200">View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDownload(item)}
                        disabled={busy}
                        className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 ${
                          busy ? 'opacity-60' : ''
                        }`}
                      >
                        {actionLoading === `${item.id}:download` ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Icon name="download" color="#ffffff" size={11} />
                        )}
                        <Text className="text-[10.5px] font-bold text-white">Download</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text className="text-center text-[9.5px] text-slate-400 py-0.5">No document attached</Text>
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
