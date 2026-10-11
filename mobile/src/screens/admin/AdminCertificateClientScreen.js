import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { resolveImageUrl } from '../../utils/imageUrl';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

// One client's milestone & sustainability profile — the mobile version of the
// web ClientMilestoneDetailPage: GET /certificates/admin/client/:clientId,
// with the same impact figures (15.2 kg CO2 and 2.8 kg e-waste per pack), the
// progress to the next tier, the 6-tier roadmap, awarded certificates and the
// recently serviced batteries. "Evaluate milestones" runs
// POST /certificates/admin/evaluate/:clientId and reloads.

const TIER_COLORS = {
  Bronze: '#b45309', Silver: '#64748b', Gold: '#ca8a04', Platinum: '#0f766e', Diamond: '#2563eb', Emerald: '#059669',
};
const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function Card({ children, className = '' }) {
  return <View className={`rounded-3xl border border-slate-200 bg-white p-4 ${className}`}>{children}</View>;
}
function Metric({ label, value, unit, color }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl border border-slate-200 bg-white p-3">
      <Text className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className={`mt-1 text-xl font-black ${color || 'text-slate-900'}`}>
        {value}
        {unit ? <Text className="text-xs font-bold text-slate-500"> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function AdminCertificateClientScreen() {
  const navigation = useNavigation();
  const { id, name } = useRoute().params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalMsg, setEvalMsg] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: name || 'Client milestones' });
  }, [navigation, name]);

  const load = useCallback(async () => {
    try {
      const { data: d } = await apiClient.get(`/certificates/admin/client/${id}`);
      setData(d);
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

  async function evaluate() {
    setEvaluating(true);
    setEvalMsg(null);
    try {
      const { data: res } = await apiClient.post(`/certificates/admin/evaluate/${data.client.id}`);
      const n = res?.newlyAwarded?.length || 0;
      setEvalMsg(n > 0
        ? `🎉 Awarded ${n} new milestone certificate${n === 1 ? '' : 's'}!`
        : `✅ Milestones are up to date (${res?.servicedCount || 0} packs serviced).`);
      load();
    } catch (err) {
      setEvalMsg(`Could not evaluate: ${err.response?.data?.message || err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#059669" />
        <Text className="mt-2 text-xs text-slate-500">Loading milestone profile…</Text>
      </View>
    );
  }
  if (error || !data?.client) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-center text-sm font-semibold text-red-600">{error || 'Client milestone profile not found.'}</Text>
        <TouchableOpacity onPress={load} className="mt-3 rounded-xl bg-emerald-600 px-5 py-2.5">
          <Text className="text-xs font-bold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { client, servicedCount = 0, certificates = [], nextTier, milestoneTiers = [], recentBatteries = [] } = data;
  // same figures as the web page
  const co2Tons = ((servicedCount * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(servicedCount * 2.8).toLocaleString();
  const prevTierCount = milestoneTiers.slice().reverse().find((t) => t.count <= servicedCount)?.count || 0;
  const targetUnits = nextTier ? nextTier.count : milestoneTiers[milestoneTiers.length - 1]?.count || 100;
  const neededUnits = nextTier ? Math.max(0, nextTier.count - servicedCount) : 0;
  const progressPct = nextTier
    ? Math.min(100, Math.round(((servicedCount - prevTierCount) / (targetUnits - prevTierCount)) * 100))
    : 100;
  const logo = client.logo_path ? resolveImageUrl(client.logo_path) : null;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-16 gap-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Client profile + evaluate */}
      <Card>
        <View className="flex-row items-center gap-3">
          {logo ? (
            <Image source={{ uri: logo }} className="h-12 w-12 rounded-xl bg-slate-100" resizeMode="contain" />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <Text className="text-lg font-black text-emerald-700">{(client.name || '?').slice(0, 1)}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-black text-slate-900">{client.name}</Text>
            <Text className="text-xs text-slate-500">{client.login_email || client.invoice_email || 'No contact email'}</Text>
          </View>
        </View>
        <TouchableOpacity
          disabled={evaluating}
          onPress={evaluate}
          className={`mt-3 items-center rounded-2xl bg-emerald-600 py-3 ${evaluating ? 'opacity-60' : ''}`}
        >
          <Text className="text-sm font-bold text-white">{evaluating ? 'Evaluating…' : 'Evaluate milestones'}</Text>
        </TouchableOpacity>
        {evalMsg ? <Text className="mt-2 text-xs font-semibold text-emerald-800">{evalMsg}</Text> : null}
      </Card>

      {/* Key impact metrics */}
      <View className="flex-row flex-wrap gap-2">
        <Metric label="CO2 saved" value={`~${co2Tons}`} unit="t" color="text-emerald-700" />
        <Metric label="E-waste diverted" value={ewasteKg} unit="kg" color="text-blue-700" />
        <Metric label="Packs serviced" value={servicedCount.toLocaleString()} />
        <Metric label="Certificates" value={certificates.length} color="text-amber-600" />
      </View>

      {/* Progress to the next tier */}
      <Card>
        <Text className="text-sm font-black text-slate-900">
          {nextTier ? `Leveling up to ${nextTier.badge} tier (${nextTier.count.toLocaleString()} batteries)` : 'Every milestone tier reached'}
        </Text>
        <View className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
          <View className="h-3 rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </View>
        <View className="mt-1.5 flex-row justify-between">
          <Text className="text-[11px] text-slate-500">{servicedCount.toLocaleString()} / {targetUnits.toLocaleString()} units</Text>
          <Text className="text-[11px] font-bold text-emerald-700">{progressPct}%</Text>
        </View>
        {nextTier ? (
          <Text className="mt-1 text-[11px] text-slate-500">{neededUnits.toLocaleString()} more units to unlock the {nextTier.badge} certificate</Text>
        ) : null}
      </Card>

      {/* 6-tier roadmap */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Milestone roadmap</Text>
      <View className="gap-2">
        {milestoneTiers.map((t) => {
          const reached = servicedCount >= t.count;
          const isNext = nextTier?.tier === t.tier;
          const color = TIER_COLORS[t.badge] || '#334155';
          return (
            <View key={t.tier} className={`flex-row items-center gap-3 rounded-2xl border bg-white p-3 ${isNext ? 'border-emerald-400' : 'border-slate-200'}`}>
              <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22` }}>
                <Icon name="award" color={color} size={18} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-slate-900">{t.badge} · {t.count.toLocaleString()} batteries</Text>
                <Text className="text-[11px] text-slate-500" numberOfLines={1}>{t.subtitle}</Text>
              </View>
              <Text className={`text-[11px] font-bold ${reached ? 'text-emerald-700' : isNext ? 'text-amber-600' : 'text-slate-400'}`}>
                {reached ? 'Reached' : isNext ? 'Next' : 'Locked'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Awarded certificates */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Awarded certificates ({certificates.length})</Text>
      {certificates.length === 0 ? (
        <Card><Text className="text-center text-xs text-slate-400">No milestone certificates awarded yet.</Text></Card>
      ) : (
        <View className="gap-2">
          {certificates.map((cert) => (
            <Card key={cert.id}>
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] font-bold text-slate-500">{Number(cert.milestone_count || 0).toLocaleString()} tier</Text>
                <Text className="font-mono text-[11px] font-bold text-slate-700">{cert.certificate_code}</Text>
              </View>
              <Text className="mt-1 text-sm font-black text-slate-900">{cert.title?.split('—')[0]?.trim() || cert.title}</Text>
              <View className="mt-2 flex-row gap-4">
                <Text className="text-[11px] text-emerald-700">CO2 {(Number(cert.co2_saved_kg || 0) / 1000).toFixed(1)} t</Text>
                <Text className="text-[11px] text-blue-700">E-waste {Math.round(Number(cert.ewaste_diverted_kg || 0)).toLocaleString()} kg</Text>
              </View>
              <Text className="mt-1 text-[11px] text-slate-500">Issued {day(cert.issued_at)}{cert.acknowledged_at ? ' · acknowledged by client' : ''}</Text>
            </Card>
          ))}
        </View>
      )}

      {/* Recent serviced batteries */}
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recently serviced batteries</Text>
      {recentBatteries.length === 0 ? (
        <Card><Text className="text-center text-xs text-slate-400">No serviced batteries yet.</Text></Card>
      ) : (
        <View className="gap-2">
          {recentBatteries.map((b) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })}
              className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"
            >
              <View>
                <Text className="text-sm font-bold text-blue-700">{b.battery_code}</Text>
                <Text className="text-[11px] text-slate-500">{b.last_repaired_at ? `Repaired ${day(b.last_repaired_at)}` : `Added ${day(b.created_at)}`}</Text>
              </View>
              <StatusBadge status={b.status} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
