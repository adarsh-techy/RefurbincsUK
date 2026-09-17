import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';

const TYPE_META = {
  intake: { label: 'Intake Verified', tone: 'amber' },
  return: { label: 'Packed for Return', tone: 'emerald' },
  invoice: { label: 'Invoice Issued', tone: 'blue' },
};

const TONE_CLASSES = {
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ClientNotificationsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setError(null);
    try {
      const { data } = await apiClient.get('/clients/me/notifications?limit=100');
      setItems(data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  function onRefresh() {
    setRefreshing(true);
    fetchNotifications();
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" />
          <Text className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Loading notifications…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</Text>
          <TouchableOpacity onPress={fetchNotifications} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5 shadow-sm">
            <Text className="text-xs font-bold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-4 gap-3 pb-16"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" colors={['#38bdf8']} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-sm font-bold text-slate-900 dark:text-white">No notifications yet</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500">Fleet activity will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = TYPE_META[item?.type] || { label: 'Update', tone: 'blue' };
            const tone = TONE_CLASSES[meta.tone] || TONE_CLASSES.blue;
            return (
              <View className={`rounded-2xl border ${tone.border} bg-white dark:bg-slate-900 p-4 shadow-sm`}>
                <View className="flex-row items-center justify-between">
                  <View className={`rounded-full ${tone.bg} px-2.5 py-0.5`}>
                    <Text className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
                      {meta.label}
                    </Text>
                  </View>
                  <Text className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{timeAgo(item.timestamp)}</Text>
                </View>

                <Text className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.title}</Text>
                <Text className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</Text>

                {item.type === 'intake' && (
                  <View className="mt-3 flex-row flex-wrap gap-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                    {item.truck_number && (
                      <View className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1">
                        <Text className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          Truck: {item.truck_number}
                        </Text>
                      </View>
                    )}
                    {item.driver_name && (
                      <View className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1">
                        <Text className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          Driver: {item.driver_name}
                        </Text>
                      </View>
                    )}
                    <View className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1">
                      <Text className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {item.received_shop_at ? 'Received at Workshop' : 'In Transit'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
