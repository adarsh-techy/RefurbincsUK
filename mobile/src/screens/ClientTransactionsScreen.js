import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../services/api-client';

export default function ClientTransactionsScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setError(null);
    try {
      const { data: result } = await apiClient.get('/clients/me/transactions');
      setData(result.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function onRefresh() {
    setRefreshing(true);
    fetchTransactions();
  }

  const total = data.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading transactions…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchTransactions} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => String(item.batch_id || i)}
          contentContainerClassName="p-4 gap-3 pb-16"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListHeaderComponent={
            <View className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total Billed</Text>
              <Text className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-300">£{total.toFixed(2)}</Text>
              <Text className="mt-0.5 text-[10px] text-amber-600/80 dark:text-amber-500/80">Across every repair visit</Text>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">No transactions yet</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">Your billing history will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('BatteryDetail', { code: item.battery_code, fromScan: false })
              }
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-slate-850"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{item.battery_code}</Text>
                <Text className="text-sm font-extrabold text-slate-900 dark:text-white">£{Number(item.amount).toFixed(2)}</Text>
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">{item.part_name || '—'}</Text>
                <Text className="text-[11px] text-slate-400 dark:text-slate-500">
                  {item.repaired_at ? new Date(item.repaired_at).toLocaleDateString() : '—'}
                </Text>
              </View>
              {item.staff_name && (
                <Text className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Technician: {item.staff_name}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
