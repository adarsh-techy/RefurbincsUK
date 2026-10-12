import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { ConfirmModal, SmallButton, initials, relativeTime } from '../../../components/admin/sa5/common';
import { typeConfig } from './trash-config';

// One trash record — the web TrashDetailPage: GET /trash/:id. Hero card
// (type, original ID, "Archived / Deleted", trash record #), who deleted it
// and when, and the data snapshot as labelled fields with Show / Hide Raw
// JSON and Copy JSON (the share sheet — there's no clipboard package).
// Permanent Delete → DELETE /trash/:id, then back to the Trash Bin.

const formatKey = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Card({ children, className = '' }) {
  return <View className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</View>;
}

export default function TrashDetailScreen() {
  const navigation = useNavigation();
  const { id } = useRoute().params || {};
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: id ? `Trash Record #${id}` : 'Trash Record' });
  }, [navigation, id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(`/trash/${id}`);
      setItem(data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Trash record not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function permanentDelete() {
    setActionLoading(true);
    try {
      await apiClient.delete(`/trash/${id}`);
      setDeleteModal(false);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Delete failed', err.response?.data?.message || 'Failed to permanently delete item');
      setActionLoading(false);
    }
  }

  async function copyJson() {
    if (!item?.item_data) return;
    try {
      await Share.share({ message: JSON.stringify(item.item_data, null, 2) });
    } catch {
      // share sheet dismissed
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#2563eb" />
        <Text className="mt-2 text-sm text-slate-500">Loading trash item details...</Text>
      </View>
    );
  }
  if (error || !item) {
    return (
      <View className="flex-1 bg-slate-50 p-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm font-medium text-slate-600">‹ Back to Trash Bin</Text>
        </TouchableOpacity>
        <View className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <Text className="text-sm font-semibold text-red-700">{error || 'Item not found'}</Text>
        </View>
      </View>
    );
  }

  const cfg = typeConfig(item.item_type);
  const itemData = typeof item.item_data === 'object' && item.item_data !== null ? item.item_data : {};
  const dataKeys = Object.keys(itemData);

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-16">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={6}>
            <Text className="text-sm font-medium text-slate-600">‹ Back to Trash Bin</Text>
          </TouchableOpacity>
          <SmallButton label="🗑 Permanent Delete" tone="danger" onPress={() => setDeleteModal(true)} />
        </View>

        {/* Hero */}
        <Card className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.cls} ${cfg.text}`}>{cfg.label}</Text>
            {item.original_id ? <Text className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">Original ID: #{item.original_id}</Text> : null}
            <Text className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Archived / Deleted</Text>
          </View>
          <Text className="text-xl font-bold text-slate-900">{item.title}</Text>
          {item.subtitle ? <Text className="text-sm text-slate-500">{item.subtitle}</Text> : null}
          <Text className="self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-500">Trash Record #{item.id}</Text>
        </Card>

        {/* Deletion audit */}
        <Text className="text-sm font-semibold uppercase tracking-wider text-slate-500">Deletion Audit Information</Text>
        <Card>
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">Who Deleted This Item</Text>
            <Text className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Authorized User</Text>
          </View>
          <View className="mt-3 flex-row items-start gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600">
              <Text className="text-base font-bold text-white">{initials(item.deleted_by_name)}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-bold text-slate-900">{item.deleted_by_name || 'System / Administrator'}</Text>
                {item.deleted_by_role ? (
                  <Text className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">{item.deleted_by_role.replace('_', ' ')}</Text>
                ) : null}
              </View>
              <Text className="mt-1 text-sm text-slate-500" selectable>{item.deleted_by_email || 'No email recorded'}</Text>
              {item.deleted_by_user_id ? <Text className="mt-1 font-mono text-xs text-slate-400">Account User ID: #{item.deleted_by_user_id}</Text> : null}
            </View>
          </View>
        </Card>
        <Card>
          <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">When It Was Deleted</Text>
            <Text className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{relativeTime(item.deleted_at, true)}</Text>
          </View>
          <Text className="mt-3 text-base font-bold text-slate-900">
            {new Date(item.deleted_at).toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
          <Text className="mt-1 font-mono text-xs text-slate-500" selectable>ISO: {item.deleted_at}</Text>
          <Text className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">Logged securely at the exact moment of removal from active operations.</Text>
        </Card>

        {/* Snapshot */}
        <Card className="gap-3">
          <View>
            <Text className="text-base font-bold text-slate-900">Deleted Item Data Snapshot</Text>
            <Text className="text-xs text-slate-500">State and properties preserved at the exact time of deletion.</Text>
          </View>
          <View className="flex-row gap-2">
            <SmallButton label={showRawJson ? '</> Hide Raw JSON' : '</> Show Raw JSON'} onPress={() => setShowRawJson((v) => !v)} />
            <SmallButton label="Copy JSON" onPress={copyJson} />
          </View>
          {dataKeys.length === 0 ? (
            <Text className="text-sm text-slate-400">No snapshot attributes stored.</Text>
          ) : (
            <View className="gap-2">
              {dataKeys.map((k) => {
                const val = itemData[k];
                const display = val === null || val === undefined ? '—' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                return (
                  <View key={k} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{formatKey(k)}</Text>
                    <Text className="mt-1 text-sm font-medium text-slate-800" selectable>{display}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {showRawJson ? (
            <ScrollView horizontal className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <Text className="font-mono text-xs text-emerald-400" selectable>{JSON.stringify(item.item_data, null, 2)}</Text>
            </ScrollView>
          ) : null}
        </Card>
      </ScrollView>

      <ConfirmModal
        open={deleteModal}
        title="Permanently Delete Item?"
        description={`Are you sure you want to completely purge this ${cfg.label.toLowerCase()} from the trash bin? This permanently removes the audit archive record.`}
        confirmLabel="Permanently Delete"
        loading={actionLoading}
        onConfirm={permanentDelete}
        onCancel={() => setDeleteModal(false)}
      />
    </View>
  );
}
