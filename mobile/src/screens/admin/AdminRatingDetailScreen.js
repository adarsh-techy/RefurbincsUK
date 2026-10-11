import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';

// One customer review — the mobile version of the web RatingDetailPage:
// GET /ratings/:id. Sentiment banner, the reviewed battery (and the other
// batteries on that return), the client, the chosen feedback tags and written
// review, and the battery's recent repairs.

const SENTIMENT = {
  5: { title: '5.0 · Excellent Quality & Service', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  4: { title: '4.0 · Very Good Quality', cls: 'border-teal-200 bg-teal-50 text-teal-800' },
  3: { title: '3.0 · Satisfactory / Average', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  2: { title: '2.0 · Fair / Needs Attention', cls: 'border-orange-200 bg-orange-50 text-orange-800' },
  1: { title: '1.0 · Unsatisfactory / Critical', cls: 'border-red-200 bg-red-50 text-red-700' },
};
const when = (v) => (v ? new Date(v).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function Card({ title, children }) {
  return (
    <View className="rounded-3xl border border-slate-200 bg-white p-4">
      {title ? <Text className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">{title}</Text> : null}
      {children}
    </View>
  );
}
function Row({ label, value }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-100 py-2">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-sm font-semibold text-slate-900" numberOfLines={2}>{value ?? '—'}</Text>
    </View>
  );
}

export default function AdminRatingDetailScreen() {
  const navigation = useNavigation();
  const { id } = useRoute().params || {};
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`/ratings/${id}`);
      setR(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#d97706" />
      </View>
    );
  }
  if (error || !r) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-center text-sm font-semibold text-red-600">{error || 'Review not found.'}</Text>
        <TouchableOpacity onPress={load} className="mt-3 rounded-xl bg-amber-500 px-5 py-2.5">
          <Text className="text-xs font-bold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stars = Number(r.rating) || 0;
  const sentiment = SENTIMENT[stars] || SENTIMENT[5];
  const batteryCode = r.resolved_battery_code || r.battery_code;
  const otherCodes = (Array.isArray(r.battery_codes) ? r.battery_codes : []).filter((c) => c !== batteryCode);
  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Review banner */}
      <Card>
        <Text className="text-3xl text-amber-400">{'★'.repeat(stars)}<Text className="text-slate-200">{'★'.repeat(5 - stars)}</Text></Text>
        <Text className={`mt-2 self-start rounded-full border px-3 py-1 text-xs font-bold ${sentiment.cls}`}>{sentiment.title}</Text>
        <Text className="mt-3 text-lg font-black text-slate-900">{r.client_name || 'Client'}</Text>
        <Text className="text-xs text-slate-500">
          by {r.user_name || 'client'}{r.user_email ? ` (${r.user_email})` : ''} · {when(r.created_at)}
        </Text>
        <Text className="mt-1 text-[11px] text-slate-400">Review #{r.id}{r.return_id ? ` · Return dispatch #${r.return_id}` : ''}</Text>
      </Card>

      {/* Feedback */}
      <Card title="Feedback">
        {Array.isArray(r.preset_tags) && r.preset_tags.length ? (
          <View className="flex-row flex-wrap gap-1.5">
            {r.preset_tags.map((t) => (
              <Text key={t} className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">{t}</Text>
            ))}
          </View>
        ) : (
          <Text className="text-xs text-slate-400">No feedback tags selected.</Text>
        )}
        <Text className="mt-3 text-[11px] font-bold uppercase text-slate-400">Written review</Text>
        <Text className="mt-1 text-sm text-slate-700">{r.custom_feedback || 'No written comment.'}</Text>
      </Card>

      {/* Battery */}
      <Card title="Reviewed battery">
        {batteryCode ? (
          <TouchableOpacity onPress={() => openBattery(batteryCode)} className="flex-row items-center justify-between py-1">
            <Text className="text-sm font-bold text-blue-700">{batteryCode}</Text>
            {r.battery_current_status ? <StatusBadge status={r.battery_current_status} /> : null}
          </TouchableOpacity>
        ) : (
          <Text className="text-xs text-slate-400">No battery linked.</Text>
        )}
        <Row label="Battery number" value={r.battery_serial_number || '—'} />
        {otherCodes.length > 0 && (
          <View className="mt-2">
            <Text className="text-[11px] font-bold uppercase text-slate-400">Also on this return</Text>
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              {otherCodes.map((c) => (
                <TouchableOpacity key={c} onPress={() => openBattery(c)} className="rounded-lg bg-slate-100 px-2 py-1">
                  <Text className="text-[11px] font-bold text-blue-700">{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* Client */}
      <Card title="Client">
        <Row label="Client" value={r.client_name} />
        <Row label="Invoice email" value={r.client_invoice_email || '—'} />
        <Row label="Submitted by" value={r.user_email || r.user_name} />
      </Card>

      {/* Repairs on file */}
      <Card title="Recent repairs on this battery">
        {Array.isArray(r.recent_repairs) && r.recent_repairs.length ? (
          r.recent_repairs.map((rep) => (
            <View key={rep.id} className="border-b border-slate-100 py-2">
              <Text className="text-sm font-semibold text-slate-900">{rep.part_name || 'Repair'}</Text>
              <Text className="text-[11px] text-slate-500">{rep.staff_name || 'Technician'} · {when(rep.repaired_at)}</Text>
              {rep.notes ? <Text className="text-[11px] text-slate-500">{rep.notes}</Text> : null}
            </View>
          ))
        ) : (
          <Text className="text-xs text-slate-400">No repair history on file.</Text>
        )}
      </Card>
    </ScrollView>
  );
}
