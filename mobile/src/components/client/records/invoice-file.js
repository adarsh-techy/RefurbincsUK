import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../../services/api-client';

// Invoice documents for the client Invoices screen — the phone's version of
// the web page's "View Invoice Document" (preview) and "Download Invoice
// File" buttons. Both fetch GET /invoices/:id/download (download=true for
// the download, like the web); the file lands in the app cache under its
// real name, then:
//   view      image → shown in the app; PDF → system PDF preview (print view)
//   download  share sheet (save to Files / Drive, email, WhatsApp…)

export function isImageFile(fileName = '', filePath = '') {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName || filePath || '');
}

function mimeFor(invoice) {
  const name = (invoice.file_name || invoice.file_path || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  return 'application/pdf';
}

function localName(invoice) {
  const ext = (invoice.file_path || '').match(/\.[a-z0-9]+$/i)?.[0] || '.pdf';
  const base = invoice.file_name || `Invoice-${invoice.invoice_number}${ext}`;
  return base.replace(/[\\/:*?"<>|]/g, '_');
}

// The server's own message (e.g. "File is no longer on disk.") when the
// native download fails, like the web's parseErrorMessage.
async function serverMessage(invoice, fallback) {
  try {
    await apiClient.get(`/invoices/${invoice.id}/download`, { responseType: 'text' });
  } catch (err) {
    const body = err.response?.data;
    if (body && typeof body === 'object' && body.message) return body.message;
    if (typeof body === 'string') {
      try {
        return JSON.parse(body).message || fallback;
      } catch {
        // not JSON
      }
    }
  }
  return fallback;
}

async function downloadToCache(invoice, attachment) {
  const token = await AsyncStorage.getItem('token');
  const url = `${apiClient.defaults.baseURL}/invoices/${invoice.id}/download${attachment ? '?download=true' : ''}`;
  const destination = new File(Paths.cache, localName(invoice));
  if (destination.exists) destination.delete();
  try {
    return await File.downloadFileAsync(url, destination, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      idempotent: true,
    });
  } catch (err) {
    throw new Error(await serverMessage(invoice, err.message || 'Failed to access invoice file.'));
  }
}

// Expo web: same as the browser portal (blob → new tab / download link)
async function webBlobUrl(invoice, attachment) {
  const res = await apiClient.get(`/invoices/${invoice.id}/download${attachment ? '?download=true' : ''}`, { responseType: 'blob' });
  return URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] || mimeFor(invoice) }));
}

// → { kind: 'image', uri } for the in-app viewer, or { kind: 'shown' } when
// the system preview was opened
export async function viewInvoice(invoice) {
  if (Platform.OS === 'web') {
    const url = await webBlobUrl(invoice, false);
    if (isImageFile(invoice.file_name, invoice.file_path)) return { kind: 'image', uri: url };
    window.open(url, '_blank');
    return { kind: 'shown' };
  }
  const file = await downloadToCache(invoice, false);
  if (isImageFile(invoice.file_name, invoice.file_path)) return { kind: 'image', uri: file.uri };
  try {
    // PDF: the system print preview renders it (and offers Save as PDF / print)
    await require('expo-print').printAsync({ uri: file.uri });
  } catch {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
  return { kind: 'shown' };
}

export async function downloadInvoice(invoice) {
  if (Platform.OS === 'web') {
    const url = await webBlobUrl(invoice, true);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', invoice.file_name || `Invoice-${invoice.invoice_number}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const file = await downloadToCache(invoice, true);
  if (!(await Sharing.isAvailableAsync())) throw new Error(`Sharing isn't available on this device. Saved at ${file.uri}`);
  const mimeType = mimeFor(invoice);
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    dialogTitle: invoice.file_name || invoice.invoice_number,
  });
}
