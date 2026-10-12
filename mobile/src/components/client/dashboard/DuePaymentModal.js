import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../../ui/Icon';
import { fmtDate, getDueDaysStatus, isOverdue, openInvoiceFile } from './invoice-file';

// "Pending Due Payment Notice" / "Overdue Payment Action Required" — the web
// dashboard's due-payment popup: every unpaid invoice with its due status,
// view / download buttons, "Remind Me Later" and a link to the invoices page.

export default function DuePaymentModal({ visible, invoices, onDismiss, onOpenInvoices }) {
  const [busyId, setBusyId] = useState(null);
  const unpaid = invoices.filter((inv) => inv.status !== 'paid');
  const overdue = unpaid.filter(isOverdue);
  const hasOverdue = overdue.length > 0;

  async function open(inv, download) {
    setBusyId(inv.id);
    try {
      await openInvoiceFile(inv, { download });
    } catch (err) {
      Alert.alert(download ? 'Download failed' : 'Could not open invoice', err.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal visible={visible && unpaid.length > 0} transparent animationType="slide" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[88%] rounded-t-3xl bg-white p-5 dark:bg-slate-900">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-black text-slate-900 dark:text-white">
                {hasOverdue ? 'Overdue Payment Action Required' : 'Pending Due Payment Notice'}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-500">Official billing statement and settlement reminder for your battery service visits.</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={10}><Icon name="x" color="#64748b" size={20} /></TouchableOpacity>
          </View>

          <View className={`mt-3 flex-row items-center gap-3 rounded-xl border p-3 ${hasOverdue ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
            <Icon name="alertTriangle" color={hasOverdue ? '#e11d48' : '#d97706'} size={18} />
            <View className="flex-1">
              <Text className={`text-xs font-bold ${hasOverdue ? 'text-rose-800' : 'text-amber-900'}`}>
                {hasOverdue
                  ? `${overdue.length} Overdue Invoice${overdue.length > 1 ? 's' : ''} Past Due Date`
                  : `${unpaid.length} Pending Invoice${unpaid.length > 1 ? 's' : ''} Requiring Payment`}
              </Text>
              <Text className={`mt-0.5 text-[11px] ${hasOverdue ? 'text-rose-700' : 'text-amber-800'}`}>
                Please arrange payment remittance for the outstanding invoices listed below to ensure uninterrupted battery logistics and repairs.
              </Text>
            </View>
          </View>

          <ScrollView className="mt-3" contentContainerClassName="gap-2">
            {unpaid.map((inv) => {
              const due = getDueDaysStatus(inv.due_date);
              const busy = busyId === inv.id;
              return (
                <View key={inv.id} className={`rounded-xl border p-3 ${due.isOverdue ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50'}`}>
                  <View className="flex-row items-start gap-2">
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-slate-900 dark:text-white">{inv.invoice_number}</Text>
                      <Text className={`mt-0.5 text-[11px] font-bold ${due.isOverdue ? 'text-rose-600' : due.isDueToday ? 'text-amber-700' : 'text-slate-600'}`}>
                        {due.isOverdue ? `⚠ ${due.text}` : due.isDueToday ? 'Due Today' : inv.due_date ? due.text : 'Pending Payment'}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-slate-500">
                        Issued: {fmtDate(inv.issue_date)}{inv.due_date ? ` • Due: ${fmtDate(inv.due_date)}` : ''}
                      </Text>
                      {inv.notes ? <Text className="mt-1 text-[11px] text-slate-600"><Text className="font-bold">Note: </Text>{inv.notes}</Text> : null}
                    </View>
                    {inv.file_path ? (
                      <View className="flex-row gap-1.5">
                        <TouchableOpacity disabled={busy} onPress={() => open(inv, false)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          {busy ? <ActivityIndicator size="small" /> : <Text className="text-[11px] font-bold text-slate-700">View</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity disabled={busy} onPress={() => open(inv, true)} className="rounded-lg bg-slate-900 px-2.5 py-1.5">
                          <Text className="text-[11px] font-bold text-white">PDF</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Text className="mt-3 text-[11px] text-slate-500">For invoice payment receipts or questions, contact our support desk or message Help & Support.</Text>
          <View className="mt-3 flex-row gap-2">
            <TouchableOpacity onPress={onDismiss} className="flex-1 items-center rounded-2xl border border-slate-200 py-3">
              <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">Remind Me Later</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenInvoices} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3">
              <Text className="text-sm font-bold text-white">Open Invoices & Bills Page</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
