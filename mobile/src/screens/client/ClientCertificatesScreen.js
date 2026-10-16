import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../services/api-client';
import { Badge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { getTierForCertificate, printCertificate, shareCertificate } from '../../utils/print-milestone-certificate';
import { calculateMaterialBreakdown } from '../../components/client/records/material-breakdown';
import CompositionTable from '../../components/client/records/CompositionTable';
import CertificateViewModal from '../../components/client/records/CertificateViewModal';

const DEFAULT_TIERS = [
  { count: 100, badge: 'Bronze', title: 'Bronze Eco Champion', subtitle: '100 Refurbished Packs', co2Kg: 1520, ewasteKg: 280 },
  { count: 500, badge: 'Silver', title: 'Silver Circular Pioneer', subtitle: '500 Refurbished Packs', co2Kg: 7600, ewasteKg: 1400 },
  { count: 1000, badge: 'Gold', title: 'Gold Sustainability Leader', subtitle: '1,000 Refurbished Packs', co2Kg: 15200, ewasteKg: 2800 },
  { count: 5000, badge: 'Platinum', title: 'Platinum Planet Protector', subtitle: '5,000 Refurbished Packs', co2Kg: 76000, ewasteKg: 14000 },
  { count: 10000, badge: 'Diamond', title: 'Diamond Zero-Waste Hero', subtitle: '10,000 Refurbished Packs', co2Kg: 152000, ewasteKg: 28000 },
  { count: 20000, badge: 'Emerald', title: 'Emerald Circular Vanguard', subtitle: '20,000 Refurbished Packs', co2Kg: 304000, ewasteKg: 56000 },
];

const TIER_STYLE = {
  Bronze: { bar: 'bg-amber-700', active: 'border-amber-400 bg-amber-50/70', inactive: 'border-amber-200/80 bg-white', chip: 'bg-amber-100 border-amber-300', text: 'text-amber-900', icon: '#92400e' },
  Silver: { bar: 'bg-slate-500', active: 'border-slate-400 bg-slate-100/70', inactive: 'border-slate-200 bg-white', chip: 'bg-slate-200 border-slate-300', text: 'text-slate-800', icon: '#334155' },
  Gold: { bar: 'bg-yellow-500', active: 'border-yellow-400 bg-yellow-50/70', inactive: 'border-yellow-200/80 bg-white', chip: 'bg-yellow-100 border-yellow-400', text: 'text-yellow-900', icon: '#854d0e' },
  Platinum: { bar: 'bg-indigo-600', active: 'border-indigo-400 bg-indigo-50/70', inactive: 'border-indigo-200/80 bg-white', chip: 'bg-indigo-100 border-indigo-300', text: 'text-indigo-900', icon: '#3730a3' },
  Diamond: { bar: 'bg-sky-500', active: 'border-cyan-400 bg-cyan-50/70', inactive: 'border-cyan-200/80 bg-white', chip: 'bg-cyan-100 border-cyan-300', text: 'text-cyan-900', icon: '#155e75' },
  Emerald: { bar: 'bg-emerald-600', active: 'border-emerald-400 bg-emerald-50/70', inactive: 'border-emerald-200/80 bg-white', chip: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-900', icon: '#065f46' },
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function MetricTile({ label, value, unit, sub, border, labelColor, icon, iconColor, bg }) {
  return (
    <View className={`flex-1 rounded-2xl border p-3 justify-between ${border} ${bg || 'bg-white'}`}>
      <View>
        <View className="flex-row items-center justify-between">
          <Text className={`flex-1 text-[9.5px] font-bold uppercase tracking-wider ${labelColor}`} numberOfLines={1}>
            {label}
          </Text>
          <View className="h-6 w-6 rounded-lg items-center justify-center bg-white/80">
            <Icon name={icon} color={iconColor} size={13} />
          </View>
        </View>
        <View className="mt-1 flex-row items-baseline gap-1">
          <Text className="text-lg font-black text-slate-900">{value}</Text>
          <Text className={`text-[10px] font-bold ${labelColor}`}>{unit}</Text>
        </View>
      </View>
      <Text className="mt-1 text-[9.5px] text-slate-500 leading-tight" numberOfLines={1}>
        {sub}
      </Text>
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

  // Helper to split array into pairs for balanced 2-column rows
  const tierPairs = [];
  for (let i = 0; i < tiers.length; i += 2) {
    tierPairs.push(tiers.slice(i, i + 2));
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-slate-50"
        contentContainerClassName="p-3.5 pb-20 gap-3.5"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Header */}
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-lg font-black text-slate-900">Milestones & ESG Impact</Text>
                <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                  <Text className="text-[9.5px] font-bold text-emerald-800">Verified ESG</Text>
                </View>
              </View>
              <Text className="mt-0.5 text-[11px] text-slate-500" numberOfLines={2}>
                Track circular economy milestones, CO₂ offsets, and official sustainability certifications.
              </Text>
            </View>
            <TouchableOpacity
              onPress={refresh}
              disabled={refreshing}
              className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shrink-0 shadow-2xs"
            >
              <Icon name="rotateCcw" color="#334155" size={12} />
              <Text className="text-[11px] font-bold text-slate-700">{refreshing ? '…' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View className="rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-xs font-semibold text-red-700">{error}</Text>
          </View>
        )}

        {loading ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-white p-8">
            <Text className="text-xs text-slate-500">Loading sustainability milestones & certificates…</Text>
          </View>
        ) : (
          <>
            {/* 1. Key impact metrics - Balanced 2x2 grid */}
            <View className="gap-2.5">
              <View className="flex-row gap-2.5">
                <MetricTile
                  label="CO₂ Saved"
                  value={`~${co2SavedTons}`}
                  unit="Tons"
                  sub="15.2 kg prevented/pack"
                  border="border-emerald-200/90"
                  bg="bg-emerald-50/50"
                  labelColor="text-emerald-700"
                  icon="zap"
                  iconColor="#047857"
                />
                <MetricTile
                  label="E-Waste Diverted"
                  value={ewasteKg}
                  unit="kg"
                  sub="Hazardous metals salvaged"
                  border="border-blue-200/90"
                  bg="bg-blue-50/50"
                  labelColor="text-blue-700"
                  icon="battery"
                  iconColor="#1d4ed8"
                />
              </View>
              <View className="flex-row gap-2.5">
                <MetricTile
                  label="Packs Serviced"
                  value={servicedCount.toLocaleString()}
                  unit="Packs"
                  sub="Batteries processed"
                  border="border-amber-200/90"
                  bg="bg-amber-50/50"
                  labelColor="text-amber-700"
                  icon="package"
                  iconColor="#b45309"
                />
                <MetricTile
                  label="Awards Earned"
                  value={certs.length}
                  unit="Certificates"
                  sub="ISO-audited awards"
                  border="border-purple-200/90"
                  bg="bg-purple-50/50"
                  labelColor="text-purple-700"
                  icon="award"
                  iconColor="#6d28d9"
                />
              </View>
            </View>

            {/* 2. Milestone Progress */}
            <View className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <View className="flex-row items-center justify-between">
                <Text className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Milestone Status</Text>
                <View className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                  <Text className="text-[11px] font-black text-emerald-700">{progressPct}%</Text>
                </View>
              </View>
              <Text className="mt-0.5 text-sm font-black text-slate-900 leading-snug">
                {nextTier
                  ? `Leveling Up to ${nextTier.badge} Tier (${Number(nextTier.count).toLocaleString()} Batteries)`
                  : '🎉 Top Milestone Tier Achieved!'}
              </Text>
              <View className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <View style={{ width: `${progressPct}%` }} className="h-2.5 rounded-full bg-emerald-500" />
              </View>
              <View className="mt-1.5 flex-row items-center justify-between">
                <Text className="font-mono text-[10.5px] text-slate-500">
                  {servicedCount.toLocaleString()} / {targetUnits.toLocaleString()} units
                </Text>
                {nextTier ? (
                  <Text className="text-[10.5px] font-semibold text-slate-700">
                    {neededUnits.toLocaleString()} units to go
                  </Text>
                ) : null}
              </View>
            </View>

            {/* 3. Milestone Roadmap - Balanced 2-column paired layout */}
            <View className="gap-2">
              <View>
                <Text className="text-sm font-black text-slate-900">Milestone Roadmap</Text>
                <Text className="text-[10.5px] text-slate-500">
                  Certificates unlock automatically at 100, 500, 1k, 5k, 10k, 20k units.
                </Text>
              </View>

              <View className="gap-2.5">
                {tierPairs.map((pair, rowIdx) => (
                  <View key={rowIdx} className="flex-row gap-2.5">
                    {pair.map((t) => {
                      const count = Number(t.count);
                      const isReached = servicedCount >= count;
                      const st = TIER_STYLE[t.badge] || TIER_STYLE.Bronze;
                      const tierProgress = Math.min(100, Math.round((servicedCount / count) * 100));

                      return (
                        <View
                          key={count}
                          className={`flex-1 overflow-hidden rounded-xl border justify-between ${
                            isReached ? st.active : st.inactive
                          }`}
                        >
                          <View className={`h-1 w-full ${st.bar}`} />
                          <View className="p-2.5 justify-between flex-1">
                            <View>
                              <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center gap-1">
                                  <View className={`h-5 w-5 items-center justify-center rounded-md border ${st.chip}`}>
                                    <Icon name="award" color={st.icon} size={11} />
                                  </View>
                                  <Text className="text-[11px] font-extrabold uppercase text-slate-800">{t.badge}</Text>
                                </View>
                                {!isReached ? (
                                  <Text className="text-[8.5px] font-medium text-slate-400">
                                    {Math.max(0, count - servicedCount).toLocaleString()} to go
                                  </Text>
                                ) : null}
                              </View>
                              <Text className="mt-1.5 text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                                Target
                              </Text>
                              <Text className="text-base font-black text-slate-900 leading-tight">
                                {count.toLocaleString()} <Text className="text-[10px] font-semibold text-slate-500">Units</Text>
                              </Text>
                            </View>

                            <View className="mt-2 border-t border-slate-100 pt-1.5">
                              {isReached ? (
                                <View className="flex-row items-center justify-between">
                                  <Text className="text-[10px] font-bold text-emerald-700">● Active</Text>
                                  <Text className="text-[11px] font-black text-emerald-700">✓</Text>
                                </View>
                              ) : (
                                <>
                                  <View className="flex-row justify-between mb-0.5">
                                    <Text className="text-[9px] font-semibold text-slate-400">Progress</Text>
                                    <Text className="text-[9px] font-bold text-slate-600">{tierProgress}%</Text>
                                  </View>
                                  <View className="h-1 overflow-hidden rounded-full bg-slate-100">
                                    <View style={{ width: `${tierProgress}%` }} className={`h-1 rounded-full ${st.bar}`} />
                                  </View>
                                </>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* 4. Official Milestone Certificates */}
            <View className="gap-2 border-t border-slate-200/80 pt-3">
              <View>
                <Text className="text-sm font-black text-slate-900">Official Certificates ({certs.length})</Text>
                <Text className="text-[10.5px] text-slate-500">
                  Verified 2-page ESG sustainability certificates for records & compliance.
                </Text>
              </View>

              {certs.length === 0 ? (
                <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
                  <Icon name="award" color="#cbd5e1" size={36} />
                  <Text className="mt-1.5 text-sm font-bold text-slate-900">First Milestone In Progress</Text>
                  <Text className="mt-1 text-center text-[11px] text-slate-500 leading-relaxed">
                    Your Bronze Certificate will automatically unlock once 100 batteries are packed & received ({servicedCount}/100 currently completed).
                  </Text>
                  <TouchableOpacity
                    onPress={previewTemplate}
                    className="mt-3 flex-row items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 bg-white"
                  >
                    <Icon name="eye" color="#334155" size={13} />
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
                      <View
                        key={cert.id}
                        className={`overflow-hidden rounded-2xl border bg-white shadow-2xs ${
                          isNew ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-slate-200'
                        }`}
                      >
                        <View className={`h-1 w-full ${st.bar}`} />
                        <View className="p-3.5">
                          <View className="flex-row items-center justify-between gap-2">
                            <View className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${st.chip}`}>
                              <Icon name="award" color={st.icon} size={11} />
                              <Text className={`text-[9.5px] font-black uppercase ${st.text}`}>
                                {tier.badge} Tier • {Number(cert.milestone_count || 0).toLocaleString()}
                              </Text>
                            </View>
                            {isNew ? <Badge tone="warning">New</Badge> : null}
                          </View>

                          <View className="mt-1.5 flex-row items-center justify-between">
                            <Text className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
                              {cert.certificate_code}
                            </Text>
                            <Text className="text-[10px] text-slate-400">
                              Issued: {fmtDate(cert.issued_at)}
                            </Text>
                          </View>

                          <Text className="mt-2 text-sm font-black text-slate-900 leading-snug">{cleanTitle}</Text>
                          <Text className="text-[10px] text-slate-500">Official 2-Page ESG Sustainability Award</Text>

                          {/* Impact Metrics Box */}
                          <View className="my-2.5 flex-row rounded-xl border border-slate-200/90 bg-slate-50/80 p-2 text-center">
                            <View className="flex-1 items-center">
                              <Text className="text-[8.5px] font-extrabold uppercase text-emerald-700">CO₂ Prevented</Text>
                              <Text className="mt-0.5 text-xs font-black text-slate-900">~{co2} Tons</Text>
                            </View>
                            <View className="flex-1 items-center border-l border-slate-200">
                              <Text className="text-[8.5px] font-extrabold uppercase text-blue-700">E-Waste Diverted</Text>
                              <Text className="mt-0.5 text-xs font-black text-slate-900">{ewaste} kg</Text>
                            </View>
                          </View>

                          <View className="flex-row items-center justify-between text-[10px] text-slate-500">
                            <Text className="text-[10px] text-slate-500">Closed-Loop Compliance</Text>
                            <Text className="text-[10px] font-bold text-emerald-600">✓ Verified Seal</Text>
                          </View>

                          {/* Action Buttons */}
                          <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-2.5">
                            <TouchableOpacity
                              onPress={() => setSelectedCert(cert)}
                              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 bg-white"
                            >
                              <Icon name="eye" color="#475569" size={13} />
                              <Text className="text-xs font-bold text-slate-700">View</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              disabled={Boolean(pdfBusy)}
                              onPress={() => runPdf(cert, 'share')}
                              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5"
                            >
                              <Text className="text-xs font-bold text-white">
                                {pdfBusy === `${cert.id}:share` ? 'Creating PDF…' : '⤓ Download PDF'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            disabled={Boolean(pdfBusy)}
                            onPress={() => runPdf(cert, 'print')}
                            className="mt-1.5 items-center justify-center rounded-xl border border-slate-200 py-1.5 bg-slate-50"
                          >
                            <Text className="text-[11px] font-bold text-slate-600">
                              {pdfBusy === `${cert.id}:print` ? 'Opening…' : 'Print Certificate'}
                            </Text>
                          </TouchableOpacity>

                          {isNew && (
                            <TouchableOpacity
                              disabled={busyId === cert.id}
                              onPress={() => acknowledge(cert)}
                              className="mt-2 items-center rounded-xl bg-amber-500 py-2.5"
                            >
                              <Text className="text-xs font-bold text-white">
                                {busyId === cert.id ? 'Saving…' : 'Acknowledge Certificate'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 5. Technical Annex */}
            <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <TouchableOpacity
                onPress={() => setShowAnnex((v) => !v)}
                className="flex-row items-center gap-2.5 p-3.5"
              >
                <View className="h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 shrink-0">
                  <Icon name="flask" color="#059669" size={16} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-xs font-bold text-slate-900 leading-snug">
                    Technical Annex: 14-Element Chemical Recovery Audit
                  </Text>
                  <Text className="text-[10px] text-slate-500 leading-tight">
                    Formulas, CAS registry & metallurgical recovery standards.
                  </Text>
                </View>
                <Icon name={showAnnex ? 'chevronUp' : 'chevronDown'} color="#64748b" size={16} />
              </TouchableOpacity>

              {showAnnex && (
                <View className="gap-2.5 border-t border-slate-200 bg-slate-50/70 p-3.5">
                  <View className="flex-row items-center justify-between gap-1 flex-wrap">
                    <Text className="text-[11px] font-bold text-slate-700">
                      Calculated for {breakdownCount.toLocaleString()} Batteries:
                    </Text>
                    <View className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                      <Text className="font-mono text-[10px] font-bold text-emerald-800">100% Closed-Loop</Text>
                    </View>
                  </View>

                  <CompositionTable rows={breakdown} />

                  <Text className="text-[10px] leading-relaxed text-slate-500">
                    Refurbnics certifies that 100% of these 14 components (~{breakdown[0]?.formattedAmount} cathode material) from your {breakdownCount.toLocaleString()} restored batteries are retained within a closed-loop economy, preventing landfill pollution in accordance with ISO 14001, RoHS, and EU Battery Passport standards.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <CertificateViewModal
        certificate={selectedCert}
        clientName={client?.name}
        onClose={() => setSelectedCert(null)}
      />
    </>
  );
}
