import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import { ClientLogo } from '../../components/admin/sa5/common';

// One customer review — the web RatingDetailPage: GET /ratings/:id. Client
// banner with "Verified Service Rating", the score and sentiment, the
// associated battery (code, status, serial, return dispatch), the client's
// contact details, the chosen highlights and written comments, and the
// battery's prior refurbishment services.

const SENTIMENT = {
  5: { title: '5.0 · Excellent Quality & Service', cls: 'border-amber-300 bg-amber-50', text: 'text-amber-700' },
  4: { title: '4.0 · Very Good Quality', cls: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-700' },
  3: { title: '3.0 · Satisfactory / Average', cls: 'border-blue-300 bg-blue-50', text: 'text-blue-700' },
  2: { title: '2.0 · Fair / Needs Attention', cls: 'border-orange-300 bg-orange-50', text: 'text-orange-700' },
  1: { title: '1.0 · Unsatisfactory / Critical', cls: 'border-rose-300 bg-rose-50', text: 'text-rose-700' },
};

function tagsOf(r) {
  if (Array.isArray(r.preset_tags)) return r.preset_tags;
  if (typeof r.preset_tags === 'string') {
    try {
      return JSON.parse(r.preset_tags || '[]');
    } catch {
      return [];
    }
  }
  return [];
}

function Section({ title, action, onAction, children }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <Text className="flex-1 text-[11px] font-black uppercase tracking-wider text-slate-800">{title}</Text>
        {action ? (
          <TouchableOpacity onPress={onAction} hitSlop={6}>
            <Text className="text-xs font-bold text-blue-600">{action} ↗</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Tile({ label, children }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
      <View className="mt-1">{children}</View>
    </View>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <View className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
      <Text className={`mt-0.5 text-xs font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`} selectable>{value}</Text>
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

  useLayoutEffect(() => {
    navigation.setOptions({ title: id ? `Feedback ID #${id}` : 'Review' });
  }, [navigation, id]);

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
        <ActivityIndicator color="#2563eb" />
        <Text className="mt-2 text-xs text-slate-500">Loading client rating & review statement…</Text>
      </View>
    );
  }
  if (error || !r) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-center text-sm font-semibold text-red-600">{error || 'Rating record not found.'}</Text>
        <TouchableOpacity onPress={load} className="mt-3 rounded-xl bg-blue-600 px-5 py-2.5">
          <Text className="text-xs font-bold text-white">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-3">
          <Text className="text-xs font-bold text-blue-600">← Back to Ratings & Feedback</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stars = Number(r.rating) || 0;
  const sentiment = SENTIMENT[stars] || SENTIMENT[5];
  const tags = tagsOf(r);
  // the web prefers the stored code, then the one resolved from the return
  const batteryCode = r.battery_code || r.resolved_battery_code;
  const otherCodes = (Array.isArray(r.battery_codes) ? r.battery_codes : []).filter((c) => c !== batteryCode);
  const dateFormatted = r.created_at
    ? new Date(r.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
  const openBattery = (code) => navigation.navigate('BatteryDetail', { code, fromScan: false });

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-4 p-4 pb-16"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View className="flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={6}>
          <Text className="text-xs font-bold text-blue-600">← Back to Ratings & Feedback</Text>
        </TouchableOpacity>
        <Text className="font-mono text-xs text-slate-400">Feedback ID #{r.id}</Text>
      </View>

      {/* Hero banner */}
      <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <View className="flex-row items-start gap-3">
          <ClientLogo path={r.client_logo_path} name={r.client_name} size={56} />
          <View className="flex-1">
            <Text className="text-lg font-black text-slate-900">{r.client_name || 'Client Review'}</Text>
            <Text className="mt-1 self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">🏅 Verified Service Rating</Text>
            <Text className="mt-2 text-xs text-slate-500">
              Submitted by: <Text className="font-bold text-slate-700">{r.user_name || r.user_email || 'Portal User'}</Text>
            </Text>
            <Text className="mt-0.5 font-mono text-[11px] text-slate-500">🕒 {dateFormatted}</Text>
          </View>
        </View>
        <View className="items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <Text className="text-2xl">
            <Text className="text-amber-400">{'★'.repeat(stars)}</Text>
            <Text className="text-slate-200">{'★'.repeat(Math.max(0, 5 - stars))}</Text>
            <Text className="text-lg font-black text-slate-900">  {stars}.0</Text>
          </Text>
          <Text className={`rounded-full border px-3 py-1 text-xs font-bold ${sentiment.cls} ${sentiment.text}`}>{sentiment.title}</Text>
        </View>
      </View>

      {/* Associated battery */}
      <Section title="🔋 Associated Battery Unit" action={batteryCode ? 'Inspect Battery Profile' : null} onAction={() => openBattery(batteryCode)}>
        <View className="flex-row flex-wrap gap-2">
          <Tile label="Battery Code">
            <Text className="font-mono text-sm font-black text-blue-700">{batteryCode || '—'}</Text>
          </Tile>
          <Tile label="Current Status">
            {r.battery_current_status ? <View className="self-start"><StatusBadge status={r.battery_current_status} /></View> : <Text className="text-xs text-slate-500">—</Text>}
          </Tile>
          <Tile label="Serial Number">
            <Text className="font-mono text-xs font-bold text-slate-800">{r.battery_serial_number || 'None assigned'}</Text>
          </Tile>
          <Tile label="Return Dispatch ID">
            {r.return_id ? (
              <TouchableOpacity onPress={() => navigation.navigate('AdminDetail', { kind: 'return', id: r.return_id })}>
                <Text className="font-mono text-xs font-bold text-blue-600">#RET-{r.return_id}</Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-xs text-slate-500">Direct Delivery</Text>
            )}
          </Tile>
        </View>
        {otherCodes.length > 0 ? (
          <View className="mt-3">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Also on this return</Text>
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              {otherCodes.map((c) => (
                <TouchableOpacity key={c} onPress={() => openBattery(c)} className="rounded-lg bg-blue-50 px-2 py-1">
                  <Text className="font-mono text-[11px] font-bold text-blue-700">{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </Section>

      {/* Client */}
      <Section
        title="Client Organization & Contact"
        action={r.client_id ? 'View Client Dashboard' : null}
        onAction={() => navigation.navigate('AdminDetail', { kind: 'client', id: r.client_id })}
      >
        <InfoRow label="Submitted By" value={r.user_name || 'Portal User'} />
        <InfoRow label="User Account Email" value={r.user_email || '—'} mono />
        {r.client_invoice_email ? <InfoRow label="Billing / Invoice Email" value={r.client_invoice_email} mono /> : null}
      </Section>

      {/* Feedback */}
      <Section title="Client Review Details & Feedback Highlights">
        {tags.length > 0 ? (
          <View className="mb-3">
            <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Selected Service Highlights ({tags.length})</Text>
            <View className="flex-row flex-wrap gap-2">
              {tags.map((tag, i) => (
                <Text key={`${tag}${i}`} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">✓ {tag}</Text>
              ))}
            </View>
          </View>
        ) : null}
        <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Written Client Comments</Text>
        {r.custom_feedback ? (
          <View className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Text className="text-sm italic leading-6 text-slate-800">“{r.custom_feedback}”</Text>
          </View>
        ) : (
          <View className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <Text className="text-xs text-slate-400">No written comments were attached to this rating.</Text>
          </View>
        )}
      </Section>

      {/* Prior refurbishment services (only when there are any, like the web) */}
      {Array.isArray(r.recent_repairs) && r.recent_repairs.length > 0 ? (
        <Section title={`Prior Refurbishment Services on this Battery (${r.recent_repairs.length})`}>
          {r.recent_repairs.map((rep, i) => (
            <View key={rep.batch_id || rep.id || i} className={`py-2.5 ${i ? 'border-t border-slate-100' : ''}`}>
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-xs font-bold text-slate-900">
                  Parts Changed: <Text className="text-emerald-600">{rep.part_name || 'Standard Refurbishment'}</Text>
                </Text>
                <Text className="font-mono text-[11px] text-slate-500">
                  {rep.repaired_at ? new Date(rep.repaired_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </Text>
              </View>
              <Text className="mt-0.5 text-[11px] text-slate-400">
                Repaired by {rep.staff_name || 'Technician'}{rep.notes ? ` · Note: ${rep.notes}` : ''}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
