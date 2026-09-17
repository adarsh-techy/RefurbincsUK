import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../services/api-client';

export default function ClientInvoicesScreen() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

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

  async function handleDownload(invoice) {
    if (!invoice.file_path) return;
    setDownloadingId(invoice.id);
    try {
      const token = await AsyncStorage.getItem('token');
      const url = `${apiClient.defaults.baseURL}/invoices/${invoice.id}/download`;
      const fileName = invoice.file_name || `invoice-${invoice.invoice_number}.pdf`;
      const destination = new File(Paths.cache, fileName);
      if (destination.exists) destination.delete();

      const file = await File.downloadFileAsync(url, Paths.cache, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        idempotent: true,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert('Downloaded', `Saved to ${file.uri}`);
      }
    } catch (err) {
      Alert.alert('Download failed', err.message || 'Unable to download invoice.');
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.file_name?.toLowerCase().includes(q) ||
      inv.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 px-4 pt-3 pb-3">
        <View className="flex-row items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoice number or file…"
            placeholderTextColor="#64748b"
            className="flex-1 text-xs text-slate-900 dark:text-white"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text className="text-xs text-slate-500 dark:text-slate-400">Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">No invoices found</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {search ? 'Try a different search term' : 'No billing documents issued yet'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-extrabold text-slate-900 dark:text-white">{item.invoice_number}</Text>
                  {item.file_name && (
                    <Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400" numberOfLines={1}>
                      {item.file_name}
                    </Text>
                  )}
                </View>
                <Text className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {item.issue_date ? new Date(item.issue_date).toLocaleDateString() : '—'}
                </Text>
              </View>

              {item.notes && (
                <Text className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400" numberOfLines={2}>
                  {item.notes}
                </Text>
              )}

              <View className="mt-3.5 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                {item.file_path ? (
                  <TouchableOpacity
                    onPress={() => handleDownload(item)}
                    disabled={downloadingId === item.id}
                    className="flex-row items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/40 py-2.5 disabled:opacity-60"
                  >
                    {downloadingId === item.id ? (
                      <ActivityIndicator color="#f87171" size="small" />
                    ) : (
                      <Text className="text-xs font-bold text-red-600 dark:text-red-300">View / Download PDF</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text className="text-center text-xs text-slate-400 dark:text-slate-500">No PDF attached</Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
