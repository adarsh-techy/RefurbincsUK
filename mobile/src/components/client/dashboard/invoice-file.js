import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from '../../../services/api-client';

// Invoice document from the dashboard — the web "View" (GET
// /invoices/:id/download) and "Download PDF" (…?download=true) buttons. On a
// phone both fetch the file with the login token and hand it to the share
// sheet, which offers the PDF / image viewer, Files, WhatsApp, email…

export function isImageFile(fileName = '', filePath = '') {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName || filePath || '');
}

function mimeFor(invoice) {
  const name = (invoice.file_name || invoice.file_path || '').toLowerCase();
  if (!isImageFile(invoice.file_name, invoice.file_path)) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function openInvoiceFile(invoice, { download = false } = {}) {
  if (!invoice?.file_path) throw new Error('No document is attached to this invoice.');
  const token = await AsyncStorage.getItem('token');
  const url = `${apiClient.defaults.baseURL}/invoices/${invoice.id}/download${download ? '?download=true' : ''}`;
  const file = await File.downloadFileAsync(url, Paths.cache, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. File saved at ${file.uri}`);
  await Sharing.shareAsync(file.uri, { mimeType: mimeFor(invoice), dialogTitle: invoice.invoice_number || 'Invoice' });
}

export function getDueDaysStatus(dueDateStr) {
  if (!dueDateStr) return { text: 'No Due Date Set', isOverdue: false, days: null };
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: `Overdue by ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''}`, isOverdue: true, days };
  if (days === 0) return { text: 'Due Today', isOverdue: false, isDueToday: true, days: 0 };
  return { text: `Due in ${days} day${days > 1 ? 's' : ''}`, isOverdue: false, days };
}

export function isOverdue(inv) {
  if (inv.status === 'paid' || !inv.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(inv.due_date) < today;
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
