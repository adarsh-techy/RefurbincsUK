import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { getTierForCertificate, shareCertificate } from '../../../utils/print-milestone-certificate';
import { calculateMaterialBreakdown } from '../../../components/client/records/material-breakdown';
import CompositionTable from '../../../components/client/records/CompositionTable';
import CertificateViewModal from '../../../components/client/records/CertificateViewModal';
import { Banner, Card, ClientLogo, EmptyState, Loading, SmallButton } from '../../../components/admin/sa5/common';
import { TierPill, tierStyle } from '../../../components/admin/sa5/tiers';
import Icon from '../../../components/ui/Icon';

// Milestone Certificates & Sustainability Impact
// Polished executive redesign with zero horizontal scrolling, compact cards,
// wrapping filter pills, live metrics summary strip, and quick actions.

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
        // continue with next client
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

  const benchmarkCount = Math.max(1000, totalServiced || 1000);
  const adminBreakdown = useMemo(() => calculateMaterialBreakdown(benchmarkCount), [benchmarkCount]);
  const openClient = (clientId, name) => navigation.navigate('AdminCertificateClient', { id: clientId, name });

  const TABS = [
    { id: 'progress', label: `Tracker (${clientProgress.length})` },
    { id: 'certificates', label: `Issued (${certificates.length})` },
    { id: 'rules', label: 'Tier Rules' },
  ];

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 p-3.5 pb-20"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCertificates(); }} />}
      >
        {/* Executive Header Card with Live Metrics Strip */}
        <View className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-base font-black text-slate-900">Milestone Certificates</Text>
                <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-emerald-800">Fleet ESG</Text>
                </View>
              </View>
              <Text className="mt-0.5 text-[11px] text-slate-500 leading-4">
                Track client decarbonization milestones and issue verified ESG sustainability certificates.
              </Text>
            </View>

            {/* Top Action Buttons */}
            <View className="flex-row items-center gap-1.5">
              <TouchableOpacity
                disabled={isEvaluatingAll || loading}
                onPress={evaluateAll}
                className="flex-row items-center gap-1 rounded-xl bg-slate-900 px-2.5 py-1.5 shadow-2xs"
              >
                <Text className="text-[10.5px] font-bold text-white">
                  {isEvaluatingAll ? '⚡ Evaluating…' : '⚡ Evaluate All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setLoading(true); fetchCertificates(); }}
                className="flex-row items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-2xs"
              >
                <Icon name="refresh" size={11} color="#64748b" />
                <Text className="text-[10.5px] font-semibold text-slate-700">Sync</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live Counters Strip */}
          <View className="flex-row items-center gap-2 pt-2 mt-2 border-t border-slate-100 flex-wrap">
            <Text className="text-[10.5px] text-slate-500">
              CO₂: <Text className="font-black text-emerald-700">~{totalCo2Tons} T</Text>
            </Text>
            <Text className="text-slate-300">•</Text>
            <Text className="text-[10.5px] text-blue-700">
              E-Waste: <Text className="font-bold">{totalEwasteKg} kg</Text>
            </Text>
            <Text className="text-slate-300">•</Text>
            <Text className="text-[10.5px] text-amber-700">
              Serviced: <Text className="font-bold">{totalServiced.toLocaleString()}</Text>
            </Text>
            <Text className="text-slate-300">•</Text>
            <Text className="text-[10.5px] text-purple-700">
              Certs: <Text className="font-bold">{totalCerts}</Text>
            </Text>
          </View>
        </View>

        {/* 2x2 Impact Summary Counters */}
        <View className="gap-2">
          <View className="flex-row gap-2">
            <View className="flex-1 rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-2.5 shadow-2xs">
              <Text className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800">Total CO₂ Saved</Text>
              <View className="mt-1 flex-row items-baseline gap-1">
                <Text className="text-xl font-black text-slate-900">~{totalCo2Tons}</Text>
                <Text className="text-[10px] font-bold text-emerald-700">Tons</Text>
              </View>
              <Text className="mt-0.5 text-[9.5px] text-emerald-700 font-medium" numberOfLines={1}>Emissions prevented</Text>
            </View>

            <View className="flex-1 rounded-xl border border-blue-200/90 bg-blue-50/70 p-2.5 shadow-2xs">
              <Text className="text-[9.5px] font-bold uppercase tracking-wider text-blue-800">E-Waste Diverted</Text>
              <View className="mt-1 flex-row items-baseline gap-1">
                <Text className="text-xl font-black text-slate-900">{totalEwasteKg}</Text>
                <Text className="text-[10px] font-bold text-blue-700">kg</Text>
              </View>
              <Text className="mt-0.5 text-[9.5px] text-blue-600 font-medium" numberOfLines={1}>Lithium diverted</Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1 rounded-xl border border-amber-200/90 bg-amber-50/70 p-2.5 shadow-2xs">
              <Text className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800">Batteries Serviced</Text>
              <View className="mt-1 flex-row items-baseline gap-1">
                <Text className="text-xl font-black text-slate-900">{totalServiced.toLocaleString()}</Text>
                <Text className="text-[10px] font-bold text-amber-700">Packs</Text>
              </View>
              <Text className="mt-0.5 text-[9.5px] text-amber-700 font-medium" numberOfLines={1}>Total repaired</Text>
            </View>

            <View className="flex-1 rounded-xl border border-purple-200/90 bg-purple-50/70 p-2.5 shadow-2xs">
              <Text className="text-[9.5px] font-bold uppercase tracking-wider text-purple-800">Certificates Issued</Text>
              <View className="mt-1 flex-row items-baseline gap-1">
                <Text className="text-xl font-black text-slate-900">{totalCerts}</Text>
                <Text className="text-[10px] font-bold text-purple-700">Awarded</Text>
              </View>
              <Text className="mt-0.5 text-[9.5px] text-purple-600 font-medium" numberOfLines={1}>Verified credentials</Text>
            </View>
          </View>
        </View>

        {evalMsg ? (
          <Banner text={evalMsg} tone={evalMsg?.startsWith('Could not') ? 'bad' : 'good'} onClose={() => setEvalMsg(null)} />
        ) : null}

        {/* Tab Navigation — WRAPPING (Zero Horizontal Scrolling) */}
        <View className="flex-row flex-wrap gap-1.5 pb-0.5">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                className={`rounded-xl px-3 py-1.5 ${
                  active ? 'bg-blue-600 shadow-2xs' : 'border border-slate-200 bg-white'
                }`}
              >
                <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <Loading text="Loading certificates & impact stats…" />
        ) : error ? (
          <Banner tone="bad" text={error} />
        ) : activeTab === 'progress' ? (
          /* Tab 1: Client Milestone Tracker */
          <View className="gap-2.5">
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
                <View key={client.clientId} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs gap-2.5">
                  {/* Top Row: Client Info & Total Serviced */}
                  <View className="flex-row items-center gap-2.5">
                    <TouchableOpacity
                      className="flex-1 flex-row items-center gap-2.5 min-w-0"
                      onPress={() => openClient(client.clientId, client.clientName)}
                    >
                      <ClientLogo path={client.logoPath} name={client.clientName} size={34} />
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                          {client.clientName} ↗
                        </Text>
                        <Text className="text-[10px] text-slate-400 font-medium">
                          {certs.length} certificate{certs.length === 1 ? '' : 's'} awarded
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <Text className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-black text-slate-900">
                      {current.toLocaleString()} Serviced
                    </Text>
                  </View>

                  {/* Progress to Next Tier */}
                  <View className="gap-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 text-[11px] font-semibold text-slate-600" numberOfLines={1}>
                        {nextTier ? `Next: ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} units)` : '🎉 Top Tier Achieved'}
                      </Text>
                      <Text className="font-mono text-[11px] font-bold text-emerald-600">{pct}%</Text>
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <View className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </View>
                  </View>

                  {/* Mini Impact Box */}
                  <View className="flex-row rounded-xl border border-slate-100 bg-slate-50/80 p-2">
                    <View className="flex-1 items-center">
                      <Text className="text-[9.5px] font-semibold uppercase text-slate-400">CO₂ Saved</Text>
                      <Text className="text-xs font-bold text-emerald-700">~{((current * 15.2) / 1000).toFixed(1)} Tons</Text>
                    </View>
                    <View className="flex-1 items-center border-l border-slate-200/70">
                      <Text className="text-[9.5px] font-semibold uppercase text-slate-400">E-Waste Diverted</Text>
                      <Text className="text-xs font-bold text-blue-700">{Math.round(current * 2.8).toLocaleString()} kg</Text>
                    </View>
                  </View>

                  {/* Awarded Badges & Actions */}
                  <View className="gap-2 border-t border-slate-100 pt-2">
                    <View className="flex-row flex-wrap gap-1">
                      {certs.length === 0 ? (
                        <Text className="text-[10px] italic text-slate-400">No certificates earned yet</Text>
                      ) : (
                        certs.map((c) => {
                          const t = getTierForCertificate(c);
                          return (
                            <TouchableOpacity
                              key={c.id}
                              onPress={() => setSelectedCert({ ...c, client_name: c.client_name || client.clientName })}
                            >
                              <TierPill badge={t.badge}>
                                {t.badge} ({Number(c.milestone_count || 0).toLocaleString()})
                              </TierPill>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>

                    <View className="flex-row items-center justify-between pt-0.5">
                      <TouchableOpacity onPress={() => openClient(client.clientId, client.clientName)} hitSlop={6}>
                        <Text className="text-[11px] font-bold text-blue-600">Statement ↗</Text>
                      </TouchableOpacity>
                      <SmallButton
                        tone="dark"
                        disabled={isEvaluating || isEvaluatingAll}
                        label={isEvaluating ? '⚡ Evaluating…' : '⚡ Award'}
                        onPress={() => evaluateClient(client.clientId, client.clientName)}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : activeTab === 'certificates' ? (
          /* Tab 2: Issued Certificates */
          <View className="gap-2.5">
            {/* Search Input */}
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
              <Icon name="search" size={13} color="#94a3b8" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => { setLoading(true); fetchCertificates(); }}
                returnKeyType="search"
                placeholder="Search by client, code, title…"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                className="ml-1.5 flex-1 p-0 text-xs text-slate-900"
              />
              {search ? (
                <TouchableOpacity onPress={() => { setSearch(''); searchRef.current = ''; fetchCertificates(); }} hitSlop={6}>
                  <Icon name="x" size={12} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category Filter Pills — WRAPPING (Zero Horizontal Scrolling) */}
            <View className="flex-row flex-wrap gap-1">
              {TIERS.map((t) => {
                const active = tierFilter === t;
                const count = categoryCounts[t] || 0;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTierFilter(t)}
                    className={`flex-row items-center gap-1 rounded-lg border px-2 py-0.5 ${
                      active ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? 'text-white' : 'text-slate-600'}`}>
                      {t === 'ALL' ? 'All Tiers' : t}
                    </Text>
                    <View className={`rounded px-1 py-0.2 ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
                      <Text className={`text-[9px] font-extrabold ${active ? 'text-white' : 'text-slate-600'}`}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

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
                  <View key={cert.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs gap-2">
                    {/* Top Row: Client & Tier */}
                    <View className="flex-row items-center gap-2">
                      <ClientLogo path={cert.client_logo_path} name={cert.client_name} size={28} />
                      <TouchableOpacity className="flex-1 min-w-0" onPress={() => openClient(cert.client_id, cert.client_name)}>
                        <Text className="text-xs font-black text-slate-900" numberOfLines={1}>
                          {cert.client_name}
                        </Text>
                      </TouchableOpacity>
                      <TierPill badge={tier.badge}>
                        {tier.badge.toUpperCase()} ({Number(cert.milestone_count || 0).toLocaleString()})
                      </TierPill>
                    </View>

                    {/* Certificate Title */}
                    <Text className="text-xs font-bold text-slate-800">{cert.title}</Text>

                    {/* Metadata Ribbon */}
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800">
                        ~{co2} Tons CO₂
                      </Text>
                      <Text className="font-mono text-[10px] text-slate-500">{cert.certificate_code}</Text>
                      <Text className="text-[10px] text-slate-400">
                        • {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : '—'}
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row justify-end gap-1.5 border-t border-slate-100 pt-2">
                      <SmallButton
                        label={downloadingId === cert.id ? 'Preparing…' : '↓ Download PDF'}
                        disabled={downloadingId === cert.id}
                        onPress={() => download(cert)}
                      />
                      <SmallButton label="👁 View" tone="dark" onPress={() => setSelectedCert(cert)} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* Tab 3: Tier Rules & Framework */
          <View className="gap-3">
            {/* Automated Governance Banner */}
            <Card className="gap-2">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-xs font-bold text-slate-900">Automated Milestone Governance</Text>
                <View className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                  <Text className="text-[9.5px] font-bold text-emerald-700">ISO 14064</Text>
                </View>
              </View>
              <Text className="text-[11px] text-slate-500 leading-4">
                Certificates are automatically awarded when fleet partners reach verified service thresholds.
              </Text>
              <View className="flex-row flex-wrap gap-1.5 pt-1">
                <Text className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-emerald-800">
                  ● 15.2 kg CO₂ / pack
                </Text>
                <Text className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-blue-800">
                  ● 2.8 kg E-Waste / pack
                </Text>
              </View>
            </Card>

            {/* 6 Milestone Tier Cards */}
            {milestoneTiers.map((tier) => {
              const s = tierStyle(tier.badge);
              const cleanTitle = tier.title?.split('—')[0]?.trim() || tier.title;
              return (
                <View key={tier.count} className={`overflow-hidden rounded-2xl border bg-white shadow-2xs ${s.card}`}>
                  <View className={`h-0.5 ${s.bar}`} />
                  <View className="gap-2.5 p-3.5">
                    <View className="flex-row items-center justify-between">
                      <TierPill badge={tier.badge}>{tier.badge} Tier</TierPill>
                      <Text className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-black text-slate-800">
                        {tier.count.toLocaleString()} Batteries
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-slate-900">{cleanTitle}</Text>
                    <View className="flex-row rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                      <View className="flex-1">
                        <Text className="text-[10px] text-slate-500 font-medium">CO₂ Reduction</Text>
                        <Text className="text-xs font-bold text-emerald-600 mt-0.5">~{(tier.co2Kg / 1000).toFixed(1)} Tons</Text>
                      </View>
                      <View className="flex-1 border-l border-slate-200 pl-2">
                        <Text className="text-[10px] text-slate-500 font-medium">E-Waste Saved</Text>
                        <Text className="text-xs font-bold text-blue-600 mt-0.5">{tier.ewasteKg.toLocaleString()} kg</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between border-t border-slate-100 pt-2">
                      <Text className="text-[10px] text-slate-500">● Automated rule</Text>
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

            {/* Technical Composition Standards Collapsible */}
            <Card className="gap-2.5">
              <TouchableOpacity onPress={() => setShowAnnex((v) => !v)} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900">Technical Composition Standards & CAS Registry</Text>
                  <Text className="mt-0.5 text-[10.5px] text-slate-500">Chemical recovery rates and metallurgical standards across all serviced packs.</Text>
                </View>
                <Text className="text-xs font-bold text-slate-600">{showAnnex ? '▲ Hide' : '▼ Show'}</Text>
              </TouchableOpacity>
              {showAnnex ? (
                <View className="gap-2 pt-1 border-t border-slate-100">
                  <Text className="text-[10.5px] font-bold text-emerald-700">Calculated Mass ({benchmarkCount.toLocaleString()} Packs)</Text>
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
