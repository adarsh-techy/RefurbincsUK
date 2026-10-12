import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { getTierForCertificate, shareCertificate } from '../../../utils/print-milestone-certificate';
import { calculateMaterialBreakdown } from '../../../components/client/records/material-breakdown';
import CompositionTable from '../../../components/client/records/CompositionTable';
import CertificateViewModal from '../../../components/client/records/CertificateViewModal';
import { Banner, Card, Chips, ClientLogo, EmptyState, Loading, SmallButton } from '../../../components/admin/sa5/common';
import { TierPill, tierStyle } from '../../../components/admin/sa5/tiers';

// Milestone Certificates & Sustainability Impact — the web CertificatesPage:
// GET /certificates/admin (?search=), four impact counters, "Evaluate All
// Fleets" / per-client "Award" (POST /certificates/admin/evaluate/:clientId),
// and three tabs: Fleet Milestone Tracker, Issued Certificates (search +
// tier chips, View / Download PDF) and Tier Rules & Framework (tier cards
// with a sample Preview, and the composition table).

const TIERS = ['ALL', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald'];

export default function CertificatesScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('progress');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [selectedCert, setSelectedCert] = useState(null);
  const [evaluatingClientId, setEvaluatingClientId] = useState(null);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
  const [evalMsg, setEvalMsg] = useState(null);
  const [showAnnex, setShowAnnex] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const msgTimer = useRef(null);
  const searchRef = useRef('');
  searchRef.current = search;

  const fetchCertificates = useCallback(async () => {
    setError(null);
    try {
      const { data: d } = await apiClient.get('/certificates/admin', { params: { search: searchRef.current || undefined } });
      setData(d);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    return () => clearTimeout(msgTimer.current);
  }, [fetchCertificates]);

  function flash(msg) {
    setEvalMsg(msg);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setEvalMsg(null), 5000);
  }

  async function evaluateClient(clientId, clientName) {
    setEvaluatingClientId(clientId);
    setEvalMsg(null);
    try {
      const { data: res } = await apiClient.post(`/certificates/admin/evaluate/${clientId}`);
      const n = res?.newlyAwarded?.length || 0;
      flash(n > 0
        ? `🎉 Successfully evaluated ${clientName}: Awarded ${n} new milestone certificate(s)!`
        : `✅ Evaluated ${clientName}: Milestones are up to date (${res?.servicedCount || 0} packs serviced).`);
      fetchCertificates();
    } catch (err) {
      flash(`Could not evaluate ${clientName}: ${err.response?.data?.message || err.message}`);
    } finally {
      setEvaluatingClientId(null);
    }
  }

  async function evaluateAll() {
    const clients = data?.clientProgress || [];
    if (!clients.length) return;
    setIsEvaluatingAll(true);
    setEvalMsg(null);
    let totalNew = 0;
    for (const cl of clients) {
      try {
        const { data: res } = await apiClient.post(`/certificates/admin/evaluate/${cl.clientId}`);
        totalNew += res?.newlyAwarded?.length || 0;
      } catch {
        // one client failing doesn't stop the rest (same as the web)
      }
    }
    flash(totalNew > 0
      ? `🎉 Evaluated all ${clients.length} fleets: Successfully issued ${totalNew} new milestone certificate(s)!`
      : `✅ Evaluated all ${clients.length} fleets: All milestone certificates are completely up to date.`);
    setIsEvaluatingAll(false);
    fetchCertificates();
  }

  async function download(cert) {
    setDownloadingId(cert.id);
    try {
      await shareCertificate(cert, cert.client_name);
    } catch (err) {
      Alert.alert('Could not create the certificate PDF', err.message || 'Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  const certificates = data?.certificates || [];
  const clientProgress = data?.clientProgress || [];
  const milestoneTiers = data?.milestoneTiers || [];
  const stats = data?.stats || {};
  const totalCo2Tons = (Number(stats.totalCo2SavedKg || 0) / 1000).toFixed(1);
  const totalEwasteKg = Number(stats.totalEwasteDivertedKg || 0).toLocaleString();
  const totalServiced = Number(stats.totalServicedAll || 0);
  const totalCerts = Number(stats.totalCertificatesIssued || 0);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: certificates.length, Bronze: 0, Silver: 0, Gold: 0, Platinum: 0, Diamond: 0, Emerald: 0 };
    certificates.forEach((c) => {
      const t = getTierForCertificate(c);
      if (counts[t.badge] !== undefined) counts[t.badge] += 1;
    });
    return counts;
  }, [certificates]);

  const filteredCertificates = useMemo(
    () => (tierFilter === 'ALL' ? certificates : certificates.filter((c) => getTierForCertificate(c).badge === tierFilter)),
    [certificates, tierFilter]
  );

  // web: the annex is worked out for at least 1,000 packs
  const benchmarkCount = Math.max(1000, totalServiced || 1000);
  const adminBreakdown = useMemo(() => calculateMaterialBreakdown(benchmarkCount), [benchmarkCount]);
  const openClient = (clientId, name) => navigation.navigate('AdminCertificateClient', { id: clientId, name });

  const TABS = [
    { id: 'progress', label: `Fleet Milestone Tracker (${clientProgress.length})` },
    { id: 'certificates', label: `Issued Certificates (${certificates.length})` },
    { id: 'rules', label: 'Tier Rules & Framework' },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-16"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCertificates(); }} />}
      >
        {/* Header */}
        <View className="gap-2 border-b border-slate-200 pb-4">
          <Text className="text-xl font-black text-slate-900">Milestone Certificates & Sustainability Impact</Text>
          <Text className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Fleet ESG Governance</Text>
          <Text className="text-xs text-slate-500">
            Track client decarbonization milestones, evaluate fleet achievements, and issue verified ESG sustainability certificates.
          </Text>
          <View className="flex-row gap-2">
            <SmallButton
              tone="dark"
              className="flex-1"
              disabled={isEvaluatingAll || loading}
              label={isEvaluatingAll ? '⚡ Evaluating Fleets…' : '⚡ Evaluate All Fleets'}
              onPress={evaluateAll}
            />
            <SmallButton label="↻ Refresh" onPress={() => { setLoading(true); fetchCertificates(); }} />
          </View>
        </View>

        {/* Impact counters */}
        <View className="flex-row flex-wrap gap-2">
          {[
            { label: 'Total CO₂ Saved', value: `~${totalCo2Tons}`, unit: 'Metric Tons', note: 'Emissions prevented via battery life extension', cls: 'border-emerald-200 bg-emerald-50/60', tone: 'text-emerald-800' },
            { label: 'E-Waste Diverted', value: totalEwasteKg, unit: 'kg', note: 'Lithium material diverted from landfills', cls: 'border-blue-200 bg-blue-50/60', tone: 'text-blue-800' },
            { label: 'Batteries Serviced', value: totalServiced.toLocaleString(), unit: 'Packs', note: 'Completed repairs across all client fleets', cls: 'border-amber-200 bg-amber-50/60', tone: 'text-amber-800' },
            { label: 'Certificates Issued', value: totalCerts, unit: 'Awarded', note: 'Official sustainability accreditations', cls: 'border-purple-200 bg-purple-50/60', tone: 'text-purple-800' },
          ].map((m) => (
            <View key={m.label} className={`min-w-[46%] flex-1 rounded-2xl border p-3.5 ${m.cls}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${m.tone}`}>{m.label}</Text>
              <Text className="mt-1.5 text-xl font-black text-slate-900">{m.value} <Text className={`text-xs font-bold ${m.tone}`}>{m.unit}</Text></Text>
              <Text className={`mt-1 text-[10px] font-medium ${m.tone}`}>{m.note}</Text>
            </View>
          ))}
        </View>

        <Banner text={evalMsg} tone={evalMsg?.startsWith('Could not') ? 'bad' : 'good'} onClose={() => setEvalMsg(null)} />

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setActiveTab(t.id)} className={`rounded-xl px-4 py-2 ${activeTab === t.id ? 'bg-blue-600' : 'bg-white border border-slate-200'}`}>
              <Text className={`text-xs font-bold ${activeTab === t.id ? 'text-white' : 'text-slate-600'}`}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && !refreshing ? (
          <Loading text="Loading certificates & impact stats…" />
        ) : error ? (
          <Banner tone="bad" text={error} />
        ) : activeTab === 'progress' ? (
          <View className="gap-3">
            {clientProgress.length === 0 ? (
              <EmptyState icon="🏅" title="No client fleets yet" text="Client milestone progress appears here once fleet clients are added." />
            ) : null}
            {clientProgress.map((client) => {
              const nextTier = client.nextTier;
              const current = Number(client.servicedCount || 0);
              const target = nextTier ? nextTier.count : current;
              const pct = nextTier ? Math.min(100, Math.round((current / target) * 100)) : 100;
              const isEvaluating = evaluatingClientId === client.clientId;
              const certs = client.certificates || [];
              return (
                <Card key={client.clientId} className="gap-3">
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity className="flex-1 flex-row items-center gap-3" onPress={() => openClient(client.clientId, client.clientName)}>
                      <ClientLogo path={client.logoPath} name={client.clientName} size={40} />
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{client.clientName} ↗</Text>
                        <Text className="text-[11px] font-medium text-slate-400">{certs.length} certificate{certs.length === 1 ? '' : 's'} awarded</Text>
                      </View>
                    </TouchableOpacity>
                    <Text className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-900">{current.toLocaleString()} Serviced</Text>
                  </View>

                  <View>
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 text-xs font-semibold text-slate-600">
                        {nextTier ? `Next: ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} units)` : '🎉 Top Tier Achieved'}
                      </Text>
                      <Text className="font-mono text-xs font-bold text-emerald-600">{pct}%</Text>
                    </View>
                    <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <View className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </View>
                  </View>

                  <View className="flex-row rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <View className="flex-1 items-center">
                      <Text className="text-[10px] font-semibold uppercase text-slate-400">CO₂ Saved</Text>
                      <Text className="text-xs font-bold text-emerald-700">~{((current * 15.2) / 1000).toFixed(1)} Tons</Text>
                    </View>
                    <View className="flex-1 items-center">
                      <Text className="text-[10px] font-semibold uppercase text-slate-400">E-Waste Diverted</Text>
                      <Text className="text-xs font-bold text-blue-700">{Math.round(current * 2.8).toLocaleString()} kg</Text>
                    </View>
                  </View>

                  <View className="gap-2 border-t border-slate-100 pt-3">
                    <View className="flex-row flex-wrap gap-1.5">
                      {certs.length === 0 ? (
                        <Text className="text-[11px] italic text-slate-400">No certificates earned yet</Text>
                      ) : certs.map((c) => {
                        const t = getTierForCertificate(c);
                        return (
                          <TouchableOpacity key={c.id} onPress={() => setSelectedCert({ ...c, client_name: c.client_name || client.clientName })}>
                            <TierPill badge={t.badge}>{t.badge} ({Number(c.milestone_count || 0).toLocaleString()})</TierPill>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View className="flex-row items-center justify-end gap-3">
                      <TouchableOpacity onPress={() => openClient(client.clientId, client.clientName)} hitSlop={6}>
                        <Text className="text-xs font-bold text-blue-600">Statement ↗</Text>
                      </TouchableOpacity>
                      <SmallButton
                        tone="dark"
                        disabled={isEvaluating || isEvaluatingAll}
                        label={isEvaluating ? '⚡ Evaluating…' : '⚡ Award'}
                        onPress={() => evaluateClient(client.clientId, client.clientName)}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        ) : activeTab === 'certificates' ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <TextInput
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => { setLoading(true); fetchCertificates(); }}
                returnKeyType="search"
                placeholder="Search certificates by client name, code, or title..."
                placeholderTextColor="#94a3b8"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900"
              />
              <SmallButton label="Search" tone="primary" onPress={() => { setLoading(true); fetchCertificates(); }} />
            </View>
            <Chips
              options={TIERS.map((t) => ({ id: t, label: t === 'ALL' ? 'All Tiers' : t, count: categoryCounts[t] || 0 }))}
              value={tierFilter}
              onChange={setTierFilter}
              activeClass="bg-slate-900"
            />
            {filteredCertificates.length === 0 ? (
              <EmptyState
                icon="🏅"
                title={tierFilter === 'ALL' ? 'No Certificates Found' : `No ${tierFilter} Certificates Found`}
                text="Certificates are automatically awarded when client battery services reach milestone thresholds."
              />
            ) : (
              filteredCertificates.map((cert) => {
                const tier = getTierForCertificate(cert);
                const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);
                return (
                  <Card key={cert.id} className="gap-2.5">
                    <View className="flex-row items-center gap-2.5">
                      <ClientLogo path={cert.client_logo_path} name={cert.client_name} size={28} />
                      <TouchableOpacity className="flex-1" onPress={() => openClient(cert.client_id, cert.client_name)}>
                        <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{cert.client_name}</Text>
                      </TouchableOpacity>
                      <TierPill badge={tier.badge}>{tier.badge.toUpperCase()} ({Number(cert.milestone_count || 0).toLocaleString()})</TierPill>
                    </View>
                    <Text className="text-xs font-bold text-slate-800">{cert.title}</Text>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">~{co2} Tons CO₂</Text>
                      <Text className="font-mono text-[11px] text-slate-600">{cert.certificate_code}</Text>
                      <Text className="text-[11px] text-slate-500">{cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : '—'}</Text>
                    </View>
                    <View className="flex-row justify-end gap-2 border-t border-slate-100 pt-2.5">
                      <SmallButton
                        label={downloadingId === cert.id ? 'Preparing…' : '↓ Download Official PDF'}
                        disabled={downloadingId === cert.id}
                        onPress={() => download(cert)}
                      />
                      <SmallButton label="👁 View Certificate" tone="dark" onPress={() => setSelectedCert(cert)} />
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        ) : (
          <View className="gap-4">
            <Card className="gap-2">
              <Text className="text-sm font-bold text-slate-900">Automated Milestone Governance & ISO Decarbonization Rules</Text>
              <Text className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">ISO 14064</Text>
              <Text className="text-xs text-slate-500">Certificates are automatically awarded when fleet partners reach verified service thresholds.</Text>
              <View className="flex-row flex-wrap gap-2">
                <Text className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800">● 15.2 kg CO₂ / pack</Text>
                <Text className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800">● 2.8 kg E-Waste / pack</Text>
              </View>
            </Card>

            {milestoneTiers.map((tier) => {
              const s = tierStyle(tier.badge);
              const cleanTitle = tier.title?.split('—')[0]?.trim() || tier.title;
              return (
                <View key={tier.count} className={`overflow-hidden rounded-2xl border bg-white ${s.card}`}>
                  <View className={`h-1 ${s.bar}`} />
                  <View className="gap-3 p-4">
                    <View className="flex-row items-center justify-between">
                      <TierPill badge={tier.badge}>{tier.badge} Tier</TierPill>
                      <Text className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-800">{tier.count.toLocaleString()} Batteries</Text>
                    </View>
                    <Text className="text-base font-bold text-slate-900">{cleanTitle}</Text>
                    <View className="flex-row rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <View className="flex-1">
                        <Text className="text-[11px] text-slate-500">CO₂ Reduction</Text>
                        <Text className="text-sm font-bold text-emerald-600">~{(tier.co2Kg / 1000).toFixed(1)} Tons</Text>
                      </View>
                      <View className="flex-1 border-l border-slate-200 pl-2.5">
                        <Text className="text-[11px] text-slate-500">E-Waste Saved</Text>
                        <Text className="text-sm font-bold text-blue-600">{tier.ewasteKg.toLocaleString()} kg</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
                      <Text className="text-[11px] text-slate-500">● Automated rule</Text>
                      <SmallButton
                        label="👁 Preview"
                        onPress={() => setSelectedCert({
                          client_name: 'Sample Fleet Partner',
                          milestone_count: tier.count,
                          milestone_tier: tier.tier,
                          title: tier.title,
                          co2_saved_kg: tier.co2Kg,
                          ewaste_diverted_kg: tier.ewasteKg,
                          certificate_code: `CERT-REFURB-${tier.count}-SAMPLE`,
                          issued_at: new Date().toISOString(),
                        })}
                      />
                    </View>
                  </View>
                </View>
              );
            })}

            <Card className="gap-3">
              <TouchableOpacity onPress={() => setShowAnnex((v) => !v)} className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">Technical Composition Standards & CAS Registry Information</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">Standard chemical recovery rates and metallurgical standards across all serviced battery units.</Text>
                </View>
                <Text className="text-xs font-bold text-slate-600">{showAnnex ? 'Hide Breakdown ▲' : 'Show Breakdown ▼'}</Text>
              </TouchableOpacity>
              {showAnnex ? (
                <View className="gap-2">
                  <Text className="text-[11px] font-bold text-emerald-700">Calculated Mass ({benchmarkCount.toLocaleString()} Packs)</Text>
                  <CompositionTable rows={adminBreakdown} />
                </View>
              ) : null}
            </Card>
          </View>
        )}
      </ScrollView>

      {selectedCert ? (
        <CertificateViewModal certificate={selectedCert} clientName={selectedCert.client_name} onClose={() => setSelectedCert(null)} />
      ) : null}
    </View>
  );
}
