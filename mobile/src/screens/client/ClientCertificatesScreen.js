import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { getTierForCertificate, printCertificate, shareCertificate } from '../../utils/print-milestone-certificate';
import { calculateMaterialBreakdown } from '../../components/client/records/material-breakdown';
import CompositionTable from '../../components/client/records/CompositionTable';
import CertificateViewModal from '../../components/client/records/CertificateViewModal';

// Milestone Certificates & Sustainability Impact — the mobile version of the
// web ClientCertificatesPage: GET /certificates/my-milestones → { client,
// servicedCount, allCerts, unacknowledged, milestoneTiers }. Same four
// impact figures, milestone progress bar, roadmap of every tier, the
// certificates earned (View Certificate / Download PDF, plus Print), a
// template preview before the first one, and the collapsible Technical
// Annex. A newly awarded certificate can be acknowledged
// (POST /certificates/acknowledge/:id), which clears the dashboard prompt.

const DEFAULT_TIERS = [
  { count: 100, badge: 'Bronze', title: 'Bronze Eco Champion', subtitle: '100 Refurbished Packs', co2Kg: 1520, ewasteKg: 280 },
  { count: 500, badge: 'Silver', title: 'Silver Circular Pioneer', subtitle: '500 Refurbished Packs', co2Kg: 7600, ewasteKg: 1400 },
  { count: 1000, badge: 'Gold', title: 'Gold Sustainability Leader', subtitle: '1,000 Refurbished Packs', co2Kg: 15200, ewasteKg: 2800 },
  { count: 5000, badge: 'Platinum', title: 'Platinum Planet Protector', subtitle: '5,000 Refurbished Packs', co2Kg: 76000, ewasteKg: 14000 },
  { count: 10000, badge: 'Diamond', title: 'Diamond Zero-Waste Hero', subtitle: '10,000 Refurbished Packs', co2Kg: 152000, ewasteKg: 28000 },
  { count: 20000, badge: 'Emerald', title: 'Emerald Circular Vanguard', subtitle: '20,000 Refurbished Packs', co2Kg: 304000, ewasteKg: 56000 },
];

const TIER_STYLE = {
  Bronze: { bar: 'bg-amber-700', active: 'border-amber-400 bg-amber-50', inactive: 'border-amber-200/80 bg-white', chip: 'bg-amber-100 border-amber-300', text: 'text-amber-900', icon: '#92400e' },
  Silver: { bar: 'bg-slate-500', active: 'border-slate-400 bg-slate-100', inactive: 'border-slate-200 bg-white', chip: 'bg-slate-200 border-slate-300', text: 'text-slate-800', icon: '#334155' },
  Gold: { bar: 'bg-yellow-500', active: 'border-yellow-400 bg-yellow-50', inactive: 'border-yellow-200/80 bg-white', chip: 'bg-yellow-100 border-yellow-400', text: 'text-yellow-900', icon: '#854d0e' },
  Platinum: { bar: 'bg-indigo-600', active: 'border-indigo-400 bg-indigo-50', inactive: 'border-indigo-200/80 bg-white', chip: 'bg-indigo-100 border-indigo-300', text: 'text-indigo-900', icon: '#3730a3' },
  Diamond: { bar: 'bg-sky-500', active: 'border-cyan-400 bg-cyan-50', inactive: 'border-cyan-200/80 bg-white', chip: 'bg-cyan-100 border-cyan-300', text: 'text-cyan-900', icon: '#155e75' },
  Emerald: { bar: 'bg-emerald-600', active: 'border-emerald-400 bg-emerald-50', inactive: 'border-emerald-200/80 bg-white', chip: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-900', icon: '#065f46' },
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function Metric({ label, value, unit, sub, border, labelColor, icon, iconColor }) {
  return (
    <View className={`w-[48%] rounded-2xl border bg-white p-3.5 ${border}`}>
      <View className="flex-row items-center justify-between">
        <Text className={`flex-1 text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</Text>
        <Icon name={icon} color={iconColor} size={15} />
      </View>
      <Text className="mt-1.5 text-xl font-black text-slate-900">
        {value} <Text className={`text-xs font-bold ${labelColor}`}>{unit}</Text>
      </Text>
      <Text className="mt-0.5 text-[10px] text-slate-500">{sub}</Text>
    </View>
  );
}

export default function ClientCertificatesScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(null); // `${id}:share` | `${id}:print`
  const [selectedCert, setSelectedCert] = useState(null);
  const [showAnnex, setShowAnnex] = useState(false);

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

  function refresh() {
    setRefreshing(true);
    load();
  }

  async function runPdf(cert, kind) {
    setPdfBusy(`${cert.id}:${kind}`);
    try {
      const clientName = data?.client?.name;
      if (kind === 'print') await printCertificate(cert, clientName);
      else await shareCertificate(cert, clientName);
    } catch (err) {
      Alert.alert('Could not create the certificate PDF', err.message || 'Please try again.');
    } finally {
      setPdfBusy(null);
    }
  }

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

  const client = data?.client;
  const servicedCount = Number(data?.servicedCount || 0);
  const co2SavedTons = ((servicedCount * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(servicedCount * 2.8).toLocaleString();
  const certs = data?.allCerts || [];
  const tiers = data?.milestoneTiers?.length ? data.milestoneTiers : DEFAULT_TIERS;
  const unacknowledgedIds = new Set((data?.unacknowledged || []).map((c) => c.id));

  // same progress maths as the web: from the last tier reached to the next
  const nextTier = tiers.find((t) => Number(t.count) > servicedCount);
  const prevTierCount = Number(tiers.slice().reverse().find((t) => Number(t.count) <= servicedCount)?.count || 0);
  const targetUnits = Number(nextTier ? nextTier.count : tiers[tiers.length - 1].count);
  const neededUnits = nextTier ? Math.max(0, Number(nextTier.count) - servicedCount) : 0;
  const progressPct = nextTier
    ? Math.min(100, Math.round(((servicedCount - prevTierCount) / (targetUnits - prevTierCount)) * 100))
    : 100;

  const breakdownCount = servicedCount > 0 ? servicedCount : 100;
  const breakdown = calculateMaterialBreakdown(breakdownCount);

  function previewTemplate() {
    setSelectedCert({
      client_name: client?.name,
      milestone_count: servicedCount >= 100 ? servicedCount : 100,
      title: `${client?.name || 'Fleet'} Sustainability & Battery Restoration Certificate`,
      co2_saved_kg: Number(co2SavedTons) * 1000,
      ewaste_diverted_kg: Number(servicedCount) * 2.8,
      certificate_code: `CERT-REFURB-${client?.name?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'FLEET'}-PREVIEW`,
      issued_at: new Date().toISOString(),
    });
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerClassName="p-4 pb-16 gap-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Header */}
        <View className="gap-2">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <View className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5">
                <Text className="text-[10px] font-bold text-emerald-800">Verified ESG Records</Text>
              </View>
              <Text className="mt-1.5 text-[11px] text-slate-500">
                Track your fleet's circular economy achievements, carbon offsets, and official sustainability certifications.
              </Text>
            </View>
            <TouchableOpacity onPress={refresh} disabled={refreshing} className="flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Icon name="rotateCcw" color="#334155" size={13} />
              <Text className="text-xs font-bold text-slate-700">{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs font-semibold text-red-700">{error}</Text>
          </View>
        )}

        {loading ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Text className="text-sm text-slate-500">Loading sustainability milestones & certificates…</Text>
          </View>
        ) : (
          <>
            {/* Key impact metrics */}
            <View className="flex-row flex-wrap justify-between gap-y-3">
              <Metric label="CO₂ Saved" value={`~${co2SavedTons}`} unit="Metric Tons" sub="15.2 kg CO₂ prevented per repaired battery" border="border-emerald-200" labelColor="text-emerald-700" icon="zap" iconColor="#047857" />
              <Metric label="E-Waste Diverted" value={ewasteKg} unit="kg" sub="Hazardous battery materials kept out of landfills" border="border-blue-200" labelColor="text-blue-700" icon="battery" iconColor="#1d4ed8" />
              <Metric label="Packs Received & Serviced" value={servicedCount.toLocaleString()} unit="Packs" sub="Packs dispatched & received at workshop for service" border="border-amber-200" labelColor="text-amber-700" icon="package" iconColor="#b45309" />
              <Metric label="Milestone Awards" value={certs.length} unit="Earned" sub="Official ISO-compliant ESG certificates" border="border-violet-200" labelColor="text-violet-700" icon="award" iconColor="#6d28d9" />
            </View>

            {/* Milestone progress */}
            <View className="rounded-2xl border border-slate-200 bg-white p-4">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Milestone Status</Text>
              <Text className="mt-0.5 text-base font-black text-slate-900">
                {nextTier
                  ? `Leveling Up to ${nextTier.badge} Tier (${Number(nextTier.count).toLocaleString()} Batteries)`
                  : '🎉 Top Milestone Tier Achieved!'}
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                <Text className="font-mono text-xs font-bold text-slate-500">
                  {servicedCount.toLocaleString()} / {targetUnits.toLocaleString()} units
                </Text>
                <View className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                  <Text className="text-xs font-black text-emerald-700">{progressPct}%</Text>
                </View>
              </View>
              <View className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <View style={{ width: `${progressPct}%` }} className="h-3 rounded-full bg-emerald-500" />
              </View>
              <View className="mt-2 gap-0.5">
                <Text className="text-xs text-slate-500">{servicedCount.toLocaleString()} units completed</Text>
                {nextTier ? (
                  <Text className="text-xs font-semibold text-slate-700">
                    {neededUnits.toLocaleString()} more units to unlock {nextTier.badge} Certificate
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Roadmap */}
            <View className="gap-2">
              <Text className="text-base font-black text-slate-900">Milestone Roadmap</Text>
              <Text className="text-[11px] text-slate-500">
                Certificates unlock automatically as batteries are packed & received at the workshop (100, 500, 1,000, 5,000, 10,000, 20,000 units).
              </Text>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {tiers.map((t) => {
                  const count = Number(t.count);
                  const isReached = servicedCount >= count;
                  const st = TIER_STYLE[t.badge] || TIER_STYLE.Bronze;
                  const tierProgress = Math.min(100, Math.round((servicedCount / count) * 100));
                  return (
                    <View key={count} className={`w-[48%] overflow-hidden rounded-2xl border ${isReached ? st.active : st.inactive}`}>
                      <View className={`h-1 w-full ${st.bar}`} />
                      <View className="p-3">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className={`h-6 w-6 items-center justify-center rounded-md border ${st.chip}`}>
                              <Icon name="award" color={st.icon} size={13} />
                            </View>
                            <Text className="text-xs font-extrabold uppercase text-slate-800">{t.badge}</Text>
                          </View>
                          {!isReached ? (
                            <Text className="text-[9px] font-medium text-slate-400">{Math.max(0, count - servicedCount).toLocaleString()} to go</Text>
                          ) : null}
                        </View>
                        <Text className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Target Milestone</Text>
                        <Text className="text-lg font-black text-slate-900">
                          {count.toLocaleString()} <Text className="text-xs font-semibold text-slate-500">Units</Text>
                        </Text>
                        <View className="mt-2 border-t border-slate-100 pt-2">
                          {isReached ? (
                            <View className="flex-row items-center justify-between">
                              <Text className="text-[11px] font-bold text-emerald-700">● Active Certificate</Text>
                              <Text className="text-xs font-black text-emerald-700">✓</Text>
                            </View>
                          ) : (
                            <>
                              <View className="flex-row justify-between">
                                <Text className="text-[10px] font-semibold text-slate-400">Progress</Text>
                                <Text className="text-[10px] font-bold text-slate-600">{tierProgress}%</Text>
                              </View>
                              <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <View style={{ width: `${tierProgress}%` }} className={`h-1.5 rounded-full ${st.bar}`} />
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Official certificates */}
            <View className="gap-2 border-t border-slate-200 pt-4">
              <Text className="text-base font-black text-slate-900">Official Milestone Certificates ({certs.length})</Text>
              <Text className="text-[11px] text-slate-500">
                Download or print verified 2-page ESG sustainability certificates for your records and compliance.
              </Text>
              {certs.length === 0 ? (
                <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                  <Icon name="award" color="#cbd5e1" size={40} />
                  <Text className="mt-2 text-base font-bold text-slate-900">First Milestone In Progress</Text>
                  <Text className="mt-1 text-center text-xs text-slate-500">
                    Your first Bronze Milestone Certificate will automatically unlock once 100 batteries are packed and received for service ({servicedCount}/100 currently completed).
                  </Text>
                  <TouchableOpacity onPress={previewTemplate} className="mt-3 flex-row items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2">
                    <Icon name="eye" color="#334155" size={14} />
                    <Text className="text-xs font-bold text-slate-700">Preview Certificate Template</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="gap-3">
                  {certs.map((cert) => {
                    const tier = getTierForCertificate(cert);
                    const st = TIER_STYLE[tier.badge] || TIER_STYLE.Gold;
                    const isNew = unacknowledgedIds.has(cert.id);
                    const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);
                    const ewaste = Math.round(Number(cert.ewaste_diverted_kg || 0)).toLocaleString();
                    const cleanTitle = cert.title?.split('—')[0]?.trim() || cert.title;
                    return (
                      <View key={cert.id} className={`overflow-hidden rounded-2xl border bg-white ${isNew ? 'border-amber-300' : st.inactive.split(' ')[0]}`}>
                        <View className={`h-1 w-full ${st.bar}`} />
                        <View className="p-4">
                          <View className="flex-row items-center justify-between gap-2">
                            <View className={`flex-row items-center gap-1 rounded-full border px-2.5 py-0.5 ${st.chip}`}>
                              <Icon name="award" color={st.icon} size={12} />
                              <Text className={`text-[10px] font-black uppercase ${st.text}`}>
                                {tier.badge} Tier • {Number(cert.milestone_count || 0).toLocaleString()}
                              </Text>
                            </View>
                            {isNew ? <Badge tone="warning">New</Badge> : null}
                          </View>
                          <Text className="mt-1.5 self-start rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{cert.certificate_code}</Text>
                          <Text className="mt-2 text-base font-black text-slate-900">{cleanTitle}</Text>
                          <Text className="text-[11px] text-slate-500">Official 2-Page ESG Sustainability Award</Text>
                          <View className="my-3 flex-row rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                            <View className="flex-1 items-center">
                              <Text className="text-[9px] font-extrabold uppercase text-emerald-700">CO₂ Prevented</Text>
                              <Text className="mt-0.5 text-sm font-black text-slate-900">~{co2} Tons</Text>
                            </View>
                            <View className="flex-1 items-center border-l border-slate-200">
                              <Text className="text-[9px] font-extrabold uppercase text-blue-700">E-Waste Diverted</Text>
                              <Text className="mt-0.5 text-sm font-black text-slate-900">{ewaste} kg</Text>
                            </View>
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[11px] text-slate-500">Issued: {fmtDate(cert.issued_at)}</Text>
                            <Text className="text-[10px] font-bold text-emerald-600">✓ Verified Seal</Text>
                          </View>
                          <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
                            <TouchableOpacity onPress={() => setSelectedCert(cert)} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5">
                              <Icon name="eye" color="#475569" size={14} />
                              <Text className="text-xs font-bold text-slate-700">View Certificate</Text>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={Boolean(pdfBusy)} onPress={() => runPdf(cert, 'share')} className="flex-1 items-center justify-center rounded-xl bg-emerald-600 py-2.5">
                              <Text className="text-xs font-bold text-white">{pdfBusy === `${cert.id}:share` ? 'Creating PDF…' : '⤓ Download PDF'}</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity disabled={Boolean(pdfBusy)} onPress={() => runPdf(cert, 'print')} className="mt-2 items-center rounded-xl border border-slate-200 py-2">
                            <Text className="text-[11px] font-bold text-slate-600">{pdfBusy === `${cert.id}:print` ? 'Opening…' : 'Print'}</Text>
                          </TouchableOpacity>
                          {isNew && (
                            <TouchableOpacity disabled={busyId === cert.id} onPress={() => acknowledge(cert)} className="mt-2 items-center rounded-xl bg-amber-500 py-2.5">
                              <Text className="text-xs font-bold text-white">{busyId === cert.id ? 'Saving…' : 'Acknowledge certificate'}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Technical annex */}
            <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <TouchableOpacity onPress={() => setShowAnnex((v) => !v)} className="flex-row items-center gap-3 p-4">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                  <Icon name="flask" color="#059669" size={18} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">Technical Annex: 14-Element Chemical Recovery Audit & ISO Standards</Text>
                  <Text className="mt-0.5 text-[11px] text-slate-500">
                    Detailed chemical formulas, CAS registry numbers, and metallurgical recovery data for compliance & ESG audits.
                  </Text>
                  <Text className="mt-1 text-[11px] font-bold text-slate-600">{showAnnex ? 'Hide Technical Details ▲' : 'Show Details ▼'}</Text>
                </View>
              </TouchableOpacity>
              {showAnnex && (
                <View className="gap-3 border-t border-slate-200 bg-slate-50 p-4">
                  <Text className="text-xs font-bold text-slate-700">Calculated for {breakdownCount.toLocaleString()} Serviced Batteries:</Text>
                  <View className="self-start rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5">
                    <Text className="font-mono text-xs font-bold text-emerald-800">100% Closed-Loop Retention</Text>
                  </View>
                  <CompositionTable rows={breakdown} />
                  <Text className="text-xs leading-relaxed text-slate-500">
                    Refurbnics certifies that 100% of these 14 components (~{breakdown[0]?.formattedAmount} active cathode material) from your {breakdownCount.toLocaleString()} restored batteries are audited and retained within a closed-loop economy, preventing toxic landfill pollution in accordance with ISO 14001, RoHS, and EU Battery Passport standards.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <CertificateViewModal certificate={selectedCert} clientName={client?.name} onClose={() => setSelectedCert(null)} />
    </>
  );
}
