import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAward,
  FiSearch,
  FiGlobe,
  FiTrendingUp,
  FiCheckCircle,
  FiEye,
  FiRefreshCw,
  FiShield,
  FiDownload,
  FiSliders,
  FiZap,
  FiLayers,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/table/TableState';
import Modal from '../../components/ui/overlays/Modal';
import CertificateView from '../../components/certificates/CertificateView';
import {
  downloadMilestoneCertificatePDF,
  getTierForCertificate,
  calculateMaterialBreakdown,
} from '../../utils/generate-milestone-certificate';
import { getLogoUrl } from '../../utils/logo-url';

const TIER_BADGES = {
  Bronze: 'bg-amber-100 text-amber-900 border-amber-300/80 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60',
  Silver: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/60',
  Gold: 'bg-yellow-100 text-yellow-900 border-yellow-400/80 dark:bg-yellow-950/70 dark:text-yellow-200 dark:border-yellow-700/60',
  Platinum: 'bg-indigo-100 text-indigo-900 border-indigo-300/80 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-700/60',
  Diamond: 'bg-cyan-100 text-cyan-900 border-cyan-300/80 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-700/60',
  Emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300/80 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700/60',
};

const TIER_CARDS = {
  Bronze: 'border-amber-300/80 bg-white dark:bg-surface-850 dark:border-amber-800/40',
  Silver: 'border-slate-300 bg-white dark:bg-surface-850 dark:border-white/10',
  Gold: 'border-yellow-400/80 bg-white dark:bg-surface-850 dark:border-yellow-800/40',
  Platinum: 'border-indigo-300/80 bg-white dark:bg-surface-850 dark:border-indigo-800/40',
  Diamond: 'border-cyan-300/80 bg-white dark:bg-surface-850 dark:border-cyan-800/40',
  Emerald: 'border-emerald-300/80 bg-white dark:bg-surface-850 dark:border-emerald-800/40',
};

const TIER_THEMES = {
  Bronze: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50',
    border: 'border-amber-200 hover:border-amber-300 dark:border-amber-900/40 dark:hover:border-amber-700/60',
    dot: 'bg-amber-500',
    topBar: 'bg-amber-500',
  },
  Silver: {
    badge: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/50',
    border: 'border-slate-200 hover:border-slate-300 dark:border-slate-700/60 dark:hover:border-slate-600',
    dot: 'bg-slate-400',
    topBar: 'bg-slate-400',
  },
  Gold: {
    badge: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800/50',
    border: 'border-yellow-200 hover:border-yellow-300 dark:border-yellow-900/40 dark:hover:border-yellow-700/60',
    dot: 'bg-yellow-500',
    topBar: 'bg-yellow-500',
  },
  Platinum: {
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/50',
    border: 'border-indigo-200 hover:border-indigo-300 dark:border-indigo-900/40 dark:hover:border-indigo-700/60',
    dot: 'bg-indigo-500',
    topBar: 'bg-indigo-500',
  },
  Diamond: {
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/50',
    border: 'border-cyan-200 hover:border-cyan-300 dark:border-cyan-900/40 dark:hover:border-cyan-700/60',
    dot: 'bg-cyan-500',
    topBar: 'bg-cyan-500',
  },
  Emerald: {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50',
    border: 'border-emerald-200 hover:border-emerald-300 dark:border-emerald-900/40 dark:hover:border-emerald-700/60',
    dot: 'bg-emerald-500',
    topBar: 'bg-emerald-500',
  },
};

function CertificatesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'certificates' | 'rules'
  const [tierFilter, setTierFilter] = useState('ALL');
  const [evaluatingClientId, setEvaluatingClientId] = useState(null);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState(false);
  const [evalSuccessMsg, setEvalSuccessMsg] = useState(null);
  const [showRulesChemicalAnnex, setShowRulesChemicalAnnex] = useState(false);

  useEffect(() => {
    fetchCertificates();
  }, []);

  async function fetchCertificates() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/certificates/admin', {
        params: { search: search || undefined },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEvaluateClient(clientId, clientName) {
    setEvaluatingClientId(clientId);
    setEvalSuccessMsg(null);
    try {
      const res = await apiClient.post(`/certificates/admin/evaluate/${clientId}`);
      const newlyCount = res.data?.newlyAwarded?.length || 0;
      if (newlyCount > 0) {
        setEvalSuccessMsg(`🎉 Successfully evaluated ${clientName}: Awarded ${newlyCount} new milestone certificate(s)!`);
      } else {
        setEvalSuccessMsg(`✅ Evaluated ${clientName}: Milestones are up to date (${res.data?.servicedCount || 0} packs serviced).`);
      }
      setTimeout(() => setEvalSuccessMsg(null), 5000);
      fetchCertificates();
    } catch (err) {
      console.error('Failed to evaluate client milestones:', err);
    } finally {
      setEvaluatingClientId(null);
    }
  }

  async function handleEvaluateAll() {
    const clients = data?.clientProgress || [];
    if (clients.length === 0) return;
    setIsEvaluatingAll(true);
    setEvalSuccessMsg(null);
    try {
      let totalNew = 0;
      for (const cl of clients) {
        try {
          const res = await apiClient.post(`/certificates/admin/evaluate/${cl.clientId}`);
          totalNew += res.data?.newlyAwarded?.length || 0;
        } catch {
          // ignore single client failure and continue
        }
      }
      if (totalNew > 0) {
        setEvalSuccessMsg(`🎉 Evaluated all ${clients.length} fleets: Successfully issued ${totalNew} new milestone certificate(s)!`);
      } else {
        setEvalSuccessMsg(`✅ Evaluated all ${clients.length} fleets: All milestone certificates are completely up to date.`);
      }
      setTimeout(() => setEvalSuccessMsg(null), 5000);
      fetchCertificates();
    } catch (err) {
      console.error('Failed to evaluate all clients:', err);
    } finally {
      setIsEvaluatingAll(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchCertificates();
  }

  const certificates = data?.certificates || [];
  const clientProgress = data?.clientProgress || [];
  const milestoneTiers = data?.milestoneTiers || [];
  const stats = data?.stats || {};

  const totalCo2Tons = (Number(stats.totalCo2SavedKg || 0) / 1000).toFixed(1);
  const totalEwasteKg = Number(stats.totalEwasteDivertedKg || 0).toLocaleString();
  const totalServiced = Number(stats.totalServicedAll || 0).toLocaleString();
  const totalCerts = Number(stats.totalCertificatesIssued || 0);

  // Category counts for issued certificates
  const categoryCounts = useMemo(() => {
    const counts = { ALL: certificates.length, Bronze: 0, Silver: 0, Gold: 0, Platinum: 0, Diamond: 0, Emerald: 0 };
    certificates.forEach((cert) => {
      const t = getTierForCertificate(cert);
      if (counts[t.badge] !== undefined) counts[t.badge]++;
    });
    return counts;
  }, [certificates]);

  // Filtered certificates on Tab 2
  const filteredCertificates = useMemo(() => {
    if (tierFilter === 'ALL') return certificates;
    return certificates.filter((cert) => getTierForCertificate(cert).badge === tierFilter);
  }, [certificates, tierFilter]);

  const benchmarkCount = totalServiced ? Math.max(1000, Number(stats.totalServicedAll || 1000)) : 1000;
  const adminBreakdown = calculateMaterialBreakdown(benchmarkCount);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Milestone Certificates & Sustainability Impact
            </h1>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50">
              Fleet ESG Governance
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mt-1">
            Track client decarbonization milestones, evaluate fleet achievements, and issue verified ESG sustainability certificates.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            disabled={isEvaluatingAll || loading}
            onClick={handleEvaluateAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 dark:border dark:border-white/10 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
            title="Evaluate all clients and award unlocked milestone certificates"
          >
            <FiZap className={`w-3.5 h-3.5 text-amber-400 ${isEvaluatingAll ? 'animate-spin' : ''}`} />
            <span>{isEvaluatingAll ? 'Evaluating Fleets…' : 'Evaluate All Fleets'}</span>
          </button>

          <button
            type="button"
            onClick={fetchCertificates}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs cursor-pointer"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Global Impact Summary Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total CO₂ Saved
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <FiGlobe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">~{totalCo2Tons}</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Metric Tons</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            Emissions prevented via battery life extension
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/90 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              E-Waste Diverted
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <FiShield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalEwasteKg}</span>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">kg</span>
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Lithium material diverted from landfills
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Batteries Serviced
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <FiTrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalServiced}</span>
            <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">Packs</span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
            Completed repairs across all client fleets
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200/90 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-purple-950/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
              Certificates Issued
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              <FiAward className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCerts}</span>
            <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Awarded</span>
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            Official sustainability accreditations
          </p>
        </div>
      </div>

      {/* 3. Notification Alert */}
      {evalSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-xs">
          <span>{evalSuccessMsg}</span>
          <button type="button" onClick={() => setEvalSuccessMsg(null)} className="p-1 hover:opacity-75 cursor-pointer">✕</button>
        </div>
      )}

      {/* 4. Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'progress'
              ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
          }`}
        >
          <FiTrendingUp className="w-3.5 h-3.5" />
          <span>Fleet Milestone Tracker ({clientProgress.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('certificates')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'certificates'
              ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
          }`}
        >
          <FiAward className="w-3.5 h-3.5" />
          <span>Issued Certificates ({certificates.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'rules'
              ? 'bg-blue-600 text-white shadow-xs dark:bg-blue-600 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
          }`}
        >
          <FiSliders className="w-3.5 h-3.5" />
          <span>Tier Rules & Framework</span>
        </button>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <TableState>Loading certificates & impact stats…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : activeTab === 'progress' ? (
        /* Tab 1: Client Milestone Tracker */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clientProgress.map((client) => {
            const logo = getLogoUrl(client.logoPath);
            const nextTier = client.nextTier;
            const currentCount = client.servicedCount;
            const targetCount = nextTier ? nextTier.count : currentCount;
            const progressPct = nextTier
              ? Math.min(100, Math.round((currentCount / targetCount) * 100))
              : 100;
            const isEvaluating = evaluatingClientId === client.clientId;

            return (
              <div
                key={client.clientId}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-slate-300 dark:border-white/10 dark:bg-surface-850 dark:hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      to={`/certificates/client/${client.clientId}`}
                      className="flex items-center gap-3 min-w-0 group cursor-pointer"
                    >
                      {logo ? (
                        <img
                          src={logo}
                          alt={client.clientName}
                          className="h-10 w-10 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 dark:bg-surface-800 dark:border-white/10 shrink-0 group-hover:border-emerald-500 transition-colors"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-black text-sm dark:bg-surface-800 dark:text-white shrink-0 group-hover:bg-blue-100 transition-colors">
                          {client.clientName?.[0] || 'C'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                          <span>{client.clientName}</span>
                          <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <span className="text-[11px] text-slate-400 dark:text-neutral-400 font-medium">
                          {client.certificates.length} certificate{client.certificates.length === 1 ? '' : 's'} awarded
                        </span>
                      </div>
                    </Link>

                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-slate-100 px-2.5 py-1 rounded-lg dark:bg-surface-800 dark:border dark:border-white/10 shrink-0">
                      {currentCount.toLocaleString()} Serviced
                    </span>
                  </div>

                  {/* Progress to Next Tier */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-neutral-300 font-semibold">
                        {nextTier
                          ? `Next: ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} units)`
                          : '🎉 Top Tier Achieved'}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Impact Summary Pill */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-surface-900/70 border border-slate-100 dark:border-white/5 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">CO₂ Saved</span>
                      <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                        ~{((currentCount * 15.2) / 1000).toFixed(1)} Tons
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">E-Waste Diverted</span>
                      <span className="font-bold text-xs text-blue-700 dark:text-blue-400">
                        {Math.round(currentCount * 2.8).toLocaleString()} kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Issued Badges List & Action Trigger */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {client.certificates.length === 0 ? (
                      <span className="text-[11px] text-slate-400 dark:text-neutral-500 italic">No certificates earned yet</span>
                    ) : (
                      client.certificates.map((c) => {
                        const t = getTierForCertificate(c);
                        const bStyle = TIER_BADGES[t.badge] || TIER_BADGES.Gold;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCert(c)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold cursor-pointer border hover:opacity-80 transition-opacity ${bStyle}`}
                            title="View Certificate"
                          >
                            <FiAward className="w-3 h-3" />
                            <span>{t.badge} ({c.milestone_count.toLocaleString()})</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    <Link
                      to={`/certificates/client/${client.clientId}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <span>Statement</span>
                      <FiExternalLink className="w-3 h-3" />
                    </Link>

                    {/* Evaluate / Award Button */}
                    <button
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleEvaluateClient(client.clientId, client.clientName)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 dark:border dark:border-white/10 disabled:opacity-50 transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="Check and award newly unlocked milestone certificates for this client"
                    >
                      <FiZap className={`w-3.5 h-3.5 text-amber-400 ${isEvaluating ? 'animate-spin' : ''}`} />
                      <span>{isEvaluating ? 'Evaluating…' : 'Award'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'certificates' ? (
        /* Tab 2: Issued Certificates Registry */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search certificates by client name, code, or title..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-850 dark:text-neutral-100"
              />
            </form>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald'].map((cat) => {
                const countVal = categoryCounts[cat] || 0;
                const isActive = tierFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTierFilter(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs dark:bg-surface-700 dark:border dark:border-white/10'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-surface-850 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-surface-800'
                    }`}
                  >
                    <span>{cat === 'ALL' ? 'All Tiers' : cat}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-surface-800 dark:text-neutral-400'
                    }`}>
                      {countVal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCertificates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white dark:border-white/10 dark:bg-surface-850">
              <FiAward className="mx-auto h-10 w-10 text-slate-300 dark:text-neutral-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200">
                {tierFilter === 'ALL' ? 'No Certificates Found' : `No ${tierFilter} Certificates Found`}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Certificates are automatically awarded when client battery services reach milestone thresholds.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-850 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Client</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Tier & Milestone</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Certificate Title</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">CO₂ Saved</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Certificate Code</th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">Issued Date</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-700 dark:text-neutral-300 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredCertificates.map((cert) => {
                    const logo = getLogoUrl(cert.client_logo_path);
                    const tier = getTierForCertificate(cert);
                    const bStyle = TIER_BADGES[tier.badge] || TIER_BADGES.Gold;
                    const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);

                    return (
                      <tr key={cert.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {logo ? (
                              <img
                                src={logo}
                                alt={cert.client_name}
                                className="h-7 w-7 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 dark:bg-surface-800 dark:border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-bold text-xs dark:bg-surface-800 dark:text-neutral-300 shrink-0">
                                {cert.client_name?.[0] || 'C'}
                              </div>
                            )}
                            <Link
                              to={`/certificates/client/${cert.client_id}`}
                              className="font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 transition-colors"
                            >
                              {cert.client_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold text-[10.5px] uppercase border ${bStyle}`}>
                            <FiAward className="w-3 h-3" />
                            <span>{tier.badge} ({cert.milestone_count.toLocaleString()})</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800 dark:text-neutral-200">
                            {cert.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            ~{co2} Tons CO₂
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-neutral-300 whitespace-nowrap">
                          {cert.certificate_code}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                          {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => downloadMilestoneCertificatePDF(cert, cert.client_name)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Download Official PDF"
                              aria-label="Download Official PDF"
                            >
                              <FiDownload className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCert(cert)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
                              title="View Certificate"
                              aria-label="View Certificate"
                            >
                              <FiEye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Tab 3: Milestone Rules Architecture & Standards */
        <div className="space-y-6">
          {/* Header Card: Milestone Governance */}
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-emerald-50/40 via-white to-blue-50/30 p-5 dark:border-white/10 dark:from-surface-850 dark:via-surface-850 dark:to-surface-850 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0 shadow-2xs">
                  <FiSliders className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Automated Milestone Governance & ISO Decarbonization Rules
                    </h3>
                    <span className="hidden sm:inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50">
                      ISO 14064
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                    Certificates are automatically awarded when fleet partners reach verified service thresholds.
                  </p>
                </div>
              </div>

              {/* Verified standard conversion metrics */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-white dark:bg-surface-800 dark:border-emerald-800/40 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>15.2 kg CO₂ / pack</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-blue-200/80 bg-white dark:bg-surface-800 dark:border-blue-800/40 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>2.8 kg E-Waste / pack</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6 Milestone Tier Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {milestoneTiers.map((tier) => {
              const theme = TIER_THEMES[tier.badge] || TIER_THEMES.Gold;
              const cleanTitle = tier.title?.split('—')[0]?.trim() || tier.title;

              return (
                <div
                  key={tier.count}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white dark:bg-surface-850 p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${theme.border}`}
                >
                  {/* Subtle top accent bar */}
                  <div className={`absolute inset-x-0 top-0 h-1 ${theme.topBar}`} />

                  <div>
                    {/* Header: Tier Badge & Threshold Count */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${theme.badge}`}>
                        <FiAward className="w-3.5 h-3.5" />
                        <span>{tier.badge} Tier</span>
                      </span>
                      <span className="font-mono text-xs font-black text-slate-800 dark:text-neutral-200 bg-slate-100 dark:bg-surface-800 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-white/10">
                        {tier.count.toLocaleString()} Batteries
                      </span>
                    </div>

                    {/* Clean Title */}
                    <h4 className="font-bold text-base text-slate-900 dark:text-white mt-4 tracking-tight">
                      {cleanTitle}
                    </h4>

                    {/* Impact Stats */}
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50/90 dark:bg-surface-900/60 p-3 border border-slate-100 dark:border-white/5">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 block">
                          CO₂ Reduction
                        </span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          ~{(tier.co2Kg / 1000).toFixed(1)} Tons
                        </span>
                      </div>
                      <div className="border-l border-slate-200/80 dark:border-white/10 pl-2.5">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 block">
                          E-Waste Saved
                        </span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                          {tier.ewasteKg.toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Status & Action */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                      Automated rule
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCert({
                          client_name: 'Sample Fleet Partner',
                          milestone_count: tier.count,
                          milestone_tier: tier.tier,
                          title: tier.title,
                          co2_saved_kg: tier.co2Kg,
                          ewaste_diverted_kg: tier.ewasteKg,
                          certificate_code: `CERT-REFURB-${tier.count}-SAMPLE`,
                          issued_at: new Date().toISOString(),
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    >
                      <FiEye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapsible Technical Composition Audit */}
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-850 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShowRulesChemicalAnnex(!showRulesChemicalAnnex)}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 dark:hover:bg-surface-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                  <FiLayers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Technical Composition Standards & CAS Registry Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Standard chemical recovery rates and metallurgical standards across all serviced battery units.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-neutral-300 shrink-0">
                <span className="hidden sm:inline">{showRulesChemicalAnnex ? 'Hide Breakdown' : 'Show Breakdown'}</span>
                {showRulesChemicalAnnex ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showRulesChemicalAnnex && (
              <div className="border-t border-slate-200/80 dark:border-white/10 p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-surface-900/40">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-850">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Chemical Composition</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Chemical Formula</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">CAS No.</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Weight (%)</th>
                        <th className="px-3.5 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">Calculated Mass ({benchmarkCount.toLocaleString()} Packs)</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Material Role & Recovery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {adminBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white">{item.nameEn}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-neutral-200 font-semibold">{item.formula}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-neutral-400">{item.casNo}</td>
                          <td className="px-3.5 py-2.5 font-mono">{item.weightPct}</td>
                          <td className="px-3.5 py-2.5 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">{item.formattedAmount}</td>
                          <td className="px-3.5 py-2.5 text-slate-600 dark:text-neutral-300 text-[11px]">{item.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Certificate Modal View */}
      {selectedCert && (
        <Modal
          title="Sustainability Milestone Certificate"
          description={selectedCert.title}
          size="4xl"
          onClose={() => setSelectedCert(null)}
        >
          <CertificateView
            certificate={selectedCert}
            clientName={selectedCert.client_name}
            showActions={true}
          />
        </Modal>
      )}
    </div>
  );
}

export default CertificatesPage;
