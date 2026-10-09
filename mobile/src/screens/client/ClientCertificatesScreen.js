import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// Certificates & Impact — mobile version of the web ClientCertificatesPage:
// GET /certificates/my-milestones → { servicedCount, allCerts, unacknowledged,
// milestoneTiers }. Shows progress to the next tier, every tier, and the
// certificates earned; a newly awarded certificate can be acknowledged
// (POST /certificates/acknowledge/:id), which clears the dashboard prompt.

const day = (v) => (v ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const BADGE_TONE = { Bronze: 'warning', Silver: 'neutral', Gold: 'good', Platinum: 'info', Diamond: 'info' };

export default function ClientCertificatesScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: res } = await apiClient.get('/certificates/my-milestones');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(cert) {
    setBusyId(cert.id);
    try {
      await apiClient.post(`/certificates/acknowledge/${cert.id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusyId(null);
    }
  }

  const serviced = Number(data?.servicedCount || 0);
  const tiers = data?.milestoneTiers || [];
  const certs = data?.allCerts || [];
  const unacknowledgedIds = new Set((data?.unacknowledged || []).map((c) => c.id));
  const nextTier = tiers.find((t) => Number(t.count) > serviced);
  const reached = tiers.filter((t) => Number(t.count) <= serviced);
  const progress = nextTier ? Math.min(100, Math.round((serviced / Number(nextTier.count)) * 100)) : 100;
  const totalCo2 = certs.reduce((s, c) => s + Number(c.co2_saved_kg || 0), 0);
  const totalEwaste = certs.reduce((s, c) => s + Number(c.ewaste_diverted_kg || 0), 0);

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {error && (
        <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <Text className="text-xs font-semibold text-red-700">{error}</Text>
        </View>
      )}

      {/* Progress */}
      <View className="rounded-3xl bg-emerald-600 p-5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Batteries serviced</Text>
        <Text className="mt-1 text-3xl font-black text-white">{serviced.toLocaleString()}</Text>
        {nextTier ? (
          <>
            <View className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-800/60">
              <View style={{ width: `${progress}%` }} className="h-2 rounded-full bg-white" />
            </View>
            <Text className="mt-1.5 text-xs text-emerald-100">
              {Number(nextTier.count) - serviced} more to <Text className="font-bold text-white">{nextTier.badge} · {Number(nextTier.count)} batteries</Text>
            </Text>
          </>
        ) : (
          <Text className="mt-2 text-xs text-emerald-100">{loading ? 'Loading…' : 'Every milestone reached — outstanding.'}</Text>
        )}
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Certificates</Text>
          <Text className="text-xl font-black text-slate-800">{certs.length}</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">CO2 saved</Text>
          <Text className="text-xl font-black text-emerald-700">{Math.round(totalCo2)} kg</Text>
        </View>
        <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3">
          <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">E-waste</Text>
          <Text className="text-xl font-black text-blue-700">{Math.round(totalEwaste)} kg</Text>
        </View>
      </View>

      {/* Certificates earned */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Your certificates</Text>
      {certs.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-6">
          <Icon name="award" color="#94a3b8" size={24} />
          <Text className="mt-2 text-sm font-semibold text-slate-800">{loading ? 'Loading…' : 'No certificates yet'}</Text>
          <Text className="mt-0.5 text-center text-xs text-slate-400">Certificates are awarded automatically as serviced batteries reach each milestone.</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {certs.map((cert) => {
            const isNew = unacknowledgedIds.has(cert.id);
            return (
              <View key={cert.id} className={`rounded-2xl border bg-white p-4 ${isNew ? 'border-amber-300' : 'border-slate-200'}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-slate-900">{cert.title}</Text>
                    <Text className="text-[11px] text-slate-400">{cert.certificate_code} · issued {day(cert.issued_at)}</Text>
                  </View>
                  {isNew ? <Badge tone="warning">New</Badge> : <Badge tone="good">Awarded</Badge>}
                </View>
                <Text className="mt-2 text-xs text-slate-600">
                  {Number(cert.milestone_count || 0).toLocaleString()} batteries · {Math.round(cert.co2_saved_kg || 0)} kg CO2 saved · {Math.round(cert.ewaste_diverted_kg || 0)} kg e-waste diverted
                </Text>
                <Text className="mt-1 text-[11px] text-slate-400">Download the PDF certificate from the web portal.</Text>
                {isNew && (
                  <TouchableOpacity disabled={busyId === cert.id} onPress={() => acknowledge(cert)} className="mt-3 items-center rounded-xl bg-emerald-600 py-2.5">
                    <Text className="text-xs font-bold text-white">{busyId === cert.id ? 'Saving…' : 'Acknowledge certificate'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* All tiers */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Milestone tiers</Text>
      <View className="gap-2">
        {tiers.map((t) => {
          const done = reached.includes(t);
          return (
            <View key={t.tier} className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
              <View className={`h-10 w-10 items-center justify-center rounded-xl ${done ? 'bg-emerald-600' : 'bg-slate-100'}`}>
                <Icon name={done ? 'check' : 'award'} color={done ? '#fff' : '#94a3b8'} size={18} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900">{t.badge} · {Number(t.count).toLocaleString()} batteries</Text>
                <Text className="text-[11px] text-slate-500" numberOfLines={2}>{t.subtitle || t.title}</Text>
              </View>
              <Badge tone={done ? 'good' : BADGE_TONE[t.badge] || 'neutral'}>{done ? 'Reached' : `${Math.round(t.co2Kg || 0)} kg CO2`}</Badge>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
