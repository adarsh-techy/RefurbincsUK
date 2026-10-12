import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { StatusBadge } from '../../components/ui/Badge';
import { getTierForCertificate, shareCertificate } from '../../utils/print-milestone-certificate';
import { calculateMaterialBreakdown } from '../../components/client/records/material-breakdown';
import CompositionTable from '../../components/client/records/CompositionTable';
import CertificateViewModal from '../../components/client/records/CertificateViewModal';
import { Banner, ClientLogo, SmallButton } from '../../components/admin/sa5/common';
import { TierPill, tierStyle } from '../../components/admin/sa5/tiers';

// One client's milestone & sustainability profile — the web
// ClientMilestoneDetailPage: GET /certificates/admin/client/:clientId. Hero
// card with "Evaluate & Award Milestones" (POST
// /certificates/admin/evaluate/:clientId) and Refresh, four impact metrics
// (15.2 kg CO2 and 2.8 kg e-waste per pack), the progress bar, the 6-tier
// roadmap, the awarded certificates (View Certificate / Download PDF), the
// recently serviced batteries, and the 14-element technical annex.

const day = (v) => (v ? new Date(v).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function Metric({ label, value, unit, note, cls, tone }) {
  return (
    <View className={`min-w-[46%] flex-1 rounded-2xl border p-3.5 ${cls}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${tone}`}>{label}</Text>
      <Text className="mt-1.5 text-xl font-black text-slate-900">{value} <Text className={`text-xs font-bold ${tone}`}>{unit}</Text></Text>
      <Text className={`mt-1 text-[10px] font-medium ${tone}`}>{note}</Text>
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
  const [selectedCert, setSelectedCert] = useState(null);
  const [showAnnex, setShowAnnex] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const msgTimer = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: name || 'Client Milestones' });
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
    return () => clearTimeout(msgTimer.current);
  }, [load]);

  async function evaluate() {
    if (!data?.client) return;
    setEvaluating(true);
    setEvalMsg(null);
    try {
      const { data: res } = await apiClient.post(`/certificates/admin/evaluate/${data.client.id}`);
      const n = res?.newlyAwarded?.length || 0;
      setEvalMsg(n > 0
        ? `🎉 Awarded ${n} new milestone certificate(s)!`
        : `✅ Milestones are up to date (${res?.servicedCount || 0} serviced packs).`);
      clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setEvalMsg(null), 5000);
      load();
    } catch (err) {
      setEvalMsg(`Could not evaluate: ${err.response?.data?.message || err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  async function download(cert, clientName) {
    setDownloadingId(cert.id);
    try {
      await shareCertificate(cert, clientName);
    } catch (err) {
      Alert.alert('Could not create the certificate PDF', err.message || 'Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#059669" />
        <Text className="mt-2 text-xs text-slate-500">Loading client milestone & sustainability impact profile…</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-3">
          <Text className="text-xs font-bold text-blue-600">← Back to Milestone Certificates</Text>
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
  const breakdownCount = servicedCount > 0 ? servicedCount : 100;
  const materialBreakdown = calculateMaterialBreakdown(breakdownCount);

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-16"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={6}>
            <Text className="text-xs font-bold text-blue-600">← Back to Milestone Certificates</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('AdminDetail', { kind: 'client', id: client.id })} hitSlop={6}>
            <Text className="text-xs font-bold text-slate-600">View Client Operations Hub ↗</Text>
          </TouchableOpacity>
        </View>

        {/* Hero profile */}
        <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-start gap-3">
            <ClientLogo path={client.logo_path} name={client.name} size={56} />
            <View className="flex-1">
              <Text className="text-lg font-black text-slate-900">{client.name}</Text>
              <Text className="mt-1 self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">🏅 Fleet Sustainability Profile</Text>
              {client.login_email ? <Text className="mt-1.5 font-mono text-[11px] text-slate-500">Login: <Text className="font-bold text-slate-700">{client.login_email}</Text></Text> : null}
              {client.invoice_email ? <Text className="font-mono text-[11px] text-slate-500">Billing: <Text className="font-bold text-slate-700">{client.invoice_email}</Text></Text> : null}
              <Text className="font-mono text-[11px] text-slate-400">Client ID #{client.id}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <SmallButton tone="dark" className="flex-1" disabled={evaluating} onPress={evaluate} label={evaluating ? '⚡ Evaluating…' : '⚡ Evaluate & Award Milestones'} />
            <SmallButton label="↻ Refresh" onPress={() => { setRefreshing(true); load(); }} />
          </View>
          <Banner text={evalMsg} tone={evalMsg?.startsWith('Could not') ? 'bad' : 'good'} onClose={() => setEvalMsg(null)} />
        </View>

        {/* Key impact metrics */}
        <View className="flex-row flex-wrap gap-2">
          <Metric label="CO₂ Saved" value={`~${co2Tons}`} unit="Metric Tons" note="15.2 kg CO₂ prevented per repaired pack" cls="border-emerald-200 bg-emerald-50/60" tone="text-emerald-800" />
          <Metric label="E-Waste Diverted" value={ewasteKg} unit="kg" note="Toxic landfill contamination prevented" cls="border-blue-200 bg-blue-50/60" tone="text-blue-800" />
          <Metric label="Packs Received & Serviced" value={servicedCount.toLocaleString()} unit="Packs" note="Packs dispatched & received at workshop for service" cls="border-amber-200 bg-amber-50/60" tone="text-amber-800" />
          <Metric label="Certificates Issued" value={certificates.length} unit="Awarded" note="Official ISO-compliant ESG certificates" cls="border-purple-200 bg-purple-50/60" tone="text-purple-800" />
        </View>

        {/* Milestone status */}
        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Milestone Status</Text>
          <Text className="text-base font-black text-slate-900">
            {nextTier ? `Leveling Up to ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} Batteries)` : '🎉 Top Milestone Tier Achieved!'}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <Text className="font-mono text-xs font-bold text-slate-500">{servicedCount.toLocaleString()} / {targetUnits.toLocaleString()} units</Text>
            <Text className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700">{progressPct}%</Text>
          </View>
          <View className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <View className="h-3 rounded-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
          </View>
          <View className="mt-2 gap-0.5">
            <Text className="text-xs text-slate-500">{servicedCount.toLocaleString()} units completed</Text>
            {nextTier ? (
              <Text className="text-xs font-semibold text-slate-700">{neededUnits.toLocaleString()} more units to unlock {nextTier.badge} Certificate</Text>
            ) : null}
          </View>
        </View>

        {/* 6-tier roadmap */}
        <View className="gap-2">
          <Text className="text-base font-black text-slate-900">Client Milestone Roadmap</Text>
          <Text className="text-xs text-slate-500">
            Certificates unlock automatically as batteries are packed & received at the workshop (100, 500, 1,000, 5,000, 10,000, 20,000 units).
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {milestoneTiers.map((t) => {
              const reached = servicedCount >= t.count;
              const s = tierStyle(t.badge);
              const tierProgress = Math.min(100, Math.round((servicedCount / t.count) * 100));
              return (
                <View key={t.count} className={`min-w-[46%] flex-1 overflow-hidden rounded-2xl border ${reached ? `${s.card} ${s.soft}` : 'border-slate-200 bg-white'}`}>
                  <View className={`h-1 ${s.bar}`} />
                  <View className="p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-800">🏅 {t.badge}</Text>
                      {!reached ? <Text className="text-[10px] text-slate-400">{Math.max(0, t.count - servicedCount).toLocaleString()} to go</Text> : null}
                    </View>
                    <Text className="mt-2 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Target Milestone</Text>
                    <Text className="text-lg font-black text-slate-900">{t.count.toLocaleString()} <Text className="text-xs font-semibold text-slate-500">Units</Text></Text>
                    <View className="mt-2 border-t border-slate-100 pt-2">
                      {reached ? (
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[11px] font-bold text-emerald-700">● Active Certificate</Text>
                          <Text className="text-xs font-black text-emerald-700">✓</Text>
                        </View>
                      ) : (
                        <View>
                          <View className="mb-1 flex-row items-center justify-between">
                            <Text className="text-[10px] font-semibold text-slate-400">Progress</Text>
                            <Text className="text-[10px] font-bold text-slate-600">{tierProgress}%</Text>
                          </View>
                          <View className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <View className="h-full rounded-full bg-emerald-500" style={{ width: `${tierProgress}%` }} />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Awarded certificates */}
        <View className="gap-2 border-t border-slate-200 pt-4">
          <Text className="text-base font-black text-slate-900">Awarded Milestone Certificates ({certificates.length})</Text>
          <Text className="text-xs text-slate-500">Verified ESG sustainability certificates awarded to this fleet client.</Text>
          {certificates.length === 0 ? (
            <View className="items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
              <Text className="text-3xl text-slate-300">🏅</Text>
              <Text className="text-sm font-bold text-slate-900">No Milestone Certificates Earned Yet</Text>
              <Text className="text-center text-xs text-slate-500">
                This client has serviced {servicedCount} batteries. The first Bronze Milestone Certificate unlocks automatically once 100 units are serviced.
              </Text>
            </View>
          ) : (
            certificates.map((cert) => {
              const tier = getTierForCertificate(cert);
              const s = tierStyle(tier.badge);
              const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);
              const ewaste = Math.round(Number(cert.ewaste_diverted_kg || 0)).toLocaleString();
              const cleanTitle = cert.title?.split('—')[0]?.trim() || cert.title;
              return (
                <View key={cert.id} className={`overflow-hidden rounded-2xl border bg-white ${s.card}`}>
                  <View className={`h-1 ${s.bar}`} />
                  <View className="gap-2.5 p-4">
                    <View className="flex-row items-center justify-between gap-2">
                      <TierPill badge={tier.badge}>{tier.badge.toUpperCase()} TIER • {Number(cert.milestone_count || 0).toLocaleString()}</TierPill>
                      <Text className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500">{cert.certificate_code}</Text>
                    </View>
                    <View>
                      <Text className="text-base font-black text-slate-900">{cleanTitle}</Text>
                      <Text className="text-[11px] font-medium text-slate-500">Official 2-Page ESG Sustainability Award</Text>
                    </View>
                    <View className="flex-row rounded-xl border border-slate-200 bg-white p-2.5">
                      <View className="flex-1 items-center">
                        <Text className="text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-700">CO₂ Prevented</Text>
                        <Text className="text-sm font-black text-slate-900">~{co2} Tons</Text>
                      </View>
                      <View className="flex-1 items-center border-l border-slate-100">
                        <Text className="text-[9.5px] font-extrabold uppercase tracking-wider text-blue-700">E-Waste Diverted</Text>
                        <Text className="text-sm font-black text-slate-900">{ewaste} kg</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[11px] text-slate-500">Issued: {day(cert.issued_at)}</Text>
                      <Text className="text-[10.5px] font-bold text-emerald-600">✓ Verified Seal</Text>
                    </View>
                    <View className="flex-row justify-between gap-2 border-t border-slate-100 pt-3">
                      <SmallButton label="👁 View Certificate" onPress={() => setSelectedCert(cert)} />
                      <SmallButton
                        tone="green"
                        label={downloadingId === cert.id ? 'Preparing…' : '↓ Download PDF'}
                        disabled={downloadingId === cert.id}
                        onPress={() => download(cert, client.name)}
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent serviced batteries (only when there are any, like the web) */}
        {recentBatteries.length > 0 ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="mb-3 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              🔋 Recent Serviced Batteries for {client.name} ({recentBatteries.length})
            </Text>
            {recentBatteries.map((b, i) => (
              <View key={b.id} className={`flex-row items-center gap-2 py-2.5 ${i ? 'border-t border-slate-100' : ''}`}>
                <View className="flex-1">
                  <Text className="font-mono text-sm font-bold text-blue-600">{b.battery_code}</Text>
                  <Text className="font-mono text-[11px] text-slate-500">S/N {b.serial_number || '—'}</Text>
                  <Text className="text-[11px] text-slate-500">Last serviced {day(b.last_repaired_at || b.created_at)}</Text>
                </View>
                <View className="items-end gap-1.5">
                  <StatusBadge status={b.status} />
                  <TouchableOpacity onPress={() => navigation.navigate('BatteryDetail', { code: b.battery_code, fromScan: false })} hitSlop={6}>
                    <Text className="text-xs font-bold text-blue-600">Inspect ↗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Technical annex */}
        <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <TouchableOpacity onPress={() => setShowAnnex((v) => !v)} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">Technical Annex: 14-Element Chemical Recovery Audit ({breakdownCount.toLocaleString()} Packs)</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Audited metallurgical mass breakdown for ISO 14001, RoHS, and EU Battery Passport compliance.</Text>
            </View>
            <Text className="text-xs font-bold text-slate-600">{showAnnex ? 'Hide ▲' : 'Show Details ▼'}</Text>
          </TouchableOpacity>
          {showAnnex ? <CompositionTable rows={materialBreakdown} /> : null}
        </View>
      </ScrollView>

      {selectedCert ? (
        <CertificateViewModal certificate={selectedCert} clientName={client.name} onClose={() => setSelectedCert(null)} />
      ) : null}
    </View>
  );
}
