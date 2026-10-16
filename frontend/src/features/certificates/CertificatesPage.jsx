import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAward,
  FiSearch,
  FiGlobe,
  FiTrendingUp,
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
  FiX,
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
          // continue with next client
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
    <div className="w-full max-w-full overflow-x-hidden space-y-4 sm:space-y-5 pb-12">
      {/* ── 1. Executive Header Card with Live Counters Strip ────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-white/10 dark:bg-surface-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Milestone Certificates & Sustainability Impact
              </h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50">
                Fleet ESG Governance
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-2xl leading-4">
              Track client decarbonization milestones, evaluate fleet achievements, and issue verified ESG sustainability certificates.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              disabled={isEvaluatingAll || loading}
              onClick={handleEvaluateAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 dark:border dark:border-white/10 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
              title="Evaluate all clients and award unlocked milestone certificates"
            >
              <FiZap className={`w-3.5 h-3.5 text-amber-400 ${isEvaluatingAll ? 'animate-spin' : ''}`} />
              <span>{isEvaluatingAll ? 'Evaluating Fleets…' : 'Evaluate All Fleets'}</span>
            </button>

            <button
              type="button"
              onClick={fetchCertificates}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs cursor-pointer"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Single-Line Live Counters Strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-white/5 text-[11px]">
          <span className="text-slate-500 dark:text-neutral-400">
            CO₂ Saved: <strong className="font-extrabold text-emerald-600 dark:text-emerald-400">~{totalCo2Tons} Tons</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            E-Waste Diverted: <strong className="font-extrabold text-blue-600 dark:text-blue-400">{totalEwasteKg} kg</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Batteries Serviced: <strong className="font-extrabold text-amber-600 dark:text-amber-400">{totalServiced} Packs</strong>
          </span>
          <span className="text-slate-300 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-neutral-400">
            Certificates Issued: <strong className="font-extrabold text-purple-600 dark:text-purple-400">{totalCerts}</strong>
          </span>
        </div>
      </div>

      {/* ── 2. Global Impact Summary Counters (Compact 2x2 on Mobile, 4-col on Desktop) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/50 p-3 sm:p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total CO₂ Saved
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <FiGlobe className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">~{totalCo2Tons}</span>
            <span className="text-[10.5px] text-emerald-700 dark:text-emerald-300 font-bold">Metric Tons</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium truncate">
            Emissions prevented via battery extension
          </p>
        </div>

        <div className="rounded-xl border border-blue-200/90 bg-blue-50/50 p-3 sm:p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              E-Waste Diverted
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <FiShield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{totalEwasteKg}</span>
            <span className="text-[10.5px] text-blue-700 dark:text-blue-300 font-bold">kg</span>
          </div>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium truncate">
            Lithium material diverted from landfills
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-3 sm:p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Batteries Serviced
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <FiTrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{totalServiced}</span>
            <span className="text-[10.5px] text-amber-700 dark:text-amber-300 font-bold">Packs</span>
          </div>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium truncate">
            Completed repairs across all fleets
          </p>
        </div>

        <div className="rounded-xl border border-purple-200/90 bg-purple-50/50 p-3 sm:p-3.5 dark:border-purple-900/40 dark:bg-purple-950/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
              Certificates Issued
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
              <FiAward className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{totalCerts}</span>
            <span className="text-[10.5px] text-purple-700 dark:text-purple-300 font-bold">Awarded</span>
          </div>
          <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium truncate">
            Official sustainability accreditations
          </p>
        </div>
      </div>

      {/* ── 3. Notification Alert ────────────────────────────────────────────── */}
      {evalSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-2xs">
          <span>{evalSuccessMsg}</span>
          <button type="button" onClick={() => setEvalSuccessMsg(null)} className="p-1 hover:opacity-75 cursor-pointer">✕</button>
        </div>
      )}

      {/* ── 4. Tab Navigation — WRAPPING (Zero Horizontal Scrolling) ─────────── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-blue-600 text-white shadow-2xs dark:bg-blue-600 dark:text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-300 dark:hover:bg-surface-800'
          }`}
        >
          <FiTrendingUp className="w-3.5 h-3.5" />
          <span>Fleet Milestone Tracker ({clientProgress.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('certificates')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'certificates'
              ? 'bg-blue-600 text-white shadow-2xs dark:bg-blue-600 dark:text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-300 dark:hover:bg-surface-800'
          }`}
        >
          <FiAward className="w-3.5 h-3.5" />
          <span>Issued Certificates ({certificates.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'rules'
              ? 'bg-blue-600 text-white shadow-2xs dark:bg-blue-600 dark:text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-300 dark:hover:bg-surface-800'
          }`}
        >
          <FiSliders className="w-3.5 h-3.5" />
          <span>Tier Rules & Framework</span>
        </button>
      </div>

      {/* ── 5. Tab Contents ─────────────────────────────────────────────────── */}
      {loading ? (
        <TableState>Loading certificates & impact stats…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : activeTab === 'progress' ? (
        /* ── Tab 1: Client Milestone Tracker ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs hover:border-slate-300 dark:border-white/10 dark:bg-surface-850 dark:hover:border-white/20 transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2.5">
                    <Link
                      to={`/certificates/client/${client.clientId}`}
                      className="flex items-center gap-2.5 min-w-0 group cursor-pointer flex-1"
                    >
                      {logo ? (
                        <img
                          src={logo}
                          alt={client.clientName}
                          className="h-9 w-9 rounded-xl object-contain bg-slate-50 border border-slate-200 p-0.5 dark:bg-surface-800 dark:border-white/10 shrink-0 group-hover:border-emerald-500 transition-colors shadow-2xs"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white font-black text-xs shrink-0 shadow-2xs">
                          {client.clientName?.[0] || 'C'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
                          <span>{client.clientName}</span>
                          <FiExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </h3>
                        <span className="text-[10.5px] text-slate-400 dark:text-neutral-400 font-medium block truncate">
                          {client.certificates.length} certificate{client.certificates.length === 1 ? '' : 's'} awarded
                        </span>
                      </div>
                    </Link>

                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-slate-100 px-2 py-1 rounded-lg dark:bg-surface-800 dark:border dark:border-white/10 shrink-0">
                      {currentCount.toLocaleString()} Serviced
                    </span>
                  </div>

                  {/* Progress to Next Tier */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-neutral-300 font-semibold text-[11px] truncate">
                        {nextTier
                          ? `Next: ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} units)`
                          : '🎉 Top Tier Achieved'}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {progressPct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Impact Summary Pill */}
                  <div className="grid grid-cols-2 gap-2 mt-3 p-2 rounded-xl bg-slate-50/80 dark:bg-surface-900/70 border border-slate-100 dark:border-white/5 text-center">
                    <div>
                      <span className="text-[9.5px] text-slate-400 uppercase font-bold block">CO₂ Saved</span>
                      <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                        ~{((currentCount * 15.2) / 1000).toFixed(1)} Tons
                      </span>
                    </div>
                    <div className="border-l border-slate-200/70 dark:border-white/10 pl-2">
                      <span className="text-[9.5px] text-slate-400 uppercase font-bold block">E-Waste Diverted</span>
                      <span className="font-bold text-xs text-blue-700 dark:text-blue-400">
                        {Math.round(currentCount * 2.8).toLocaleString()} kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Issued Badges List & Action Trigger */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-white/10 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {client.certificates.length === 0 ? (
                      <span className="text-[10.5px] text-slate-400 dark:text-neutral-500 italic">No certificates yet</span>
                    ) : (
                      client.certificates.map((c) => {
                        const t = getTierForCertificate(c);
                        const bStyle = TIER_BADGES[t.badge] || TIER_BADGES.Gold;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCert(c)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold cursor-pointer border hover:opacity-80 transition-opacity ${bStyle}`}
                            title="View Certificate"
                          >
                            <FiAward className="w-2.5 h-2.5" />
                            <span>{t.badge} ({c.milestone_count.toLocaleString()})</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <Link
                      to={`/certificates/client/${client.clientId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                    >
                      <span>Statement</span>
                      <FiExternalLink className="w-3 h-3" />
                    </Link>

                    {/* Evaluate / Award Button */}
                    <button
                      type="button"
                      disabled={isEvaluating}
                      onClick={() => handleEvaluateClient(client.clientId, client.clientName)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 dark:border dark:border-white/10 disabled:opacity-50 transition-colors cursor-pointer shrink-0 shadow-2xs"
                      title="Check and award newly unlocked milestone certificates for this client"
                    >
                      <FiZap className={`w-3 h-3 text-amber-400 ${isEvaluating ? 'animate-spin' : ''}`} />
                      <span>{isEvaluating ? 'Evaluating…' : 'Award'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'certificates' ? (
        /* ── Tab 2: Issued Certificates Registry ── */
        <div className="space-y-3.5">
          {/* Controls: Search & Category Filter Chips */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search certificates by client name, code, or title…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-white/10 dark:bg-surface-850 dark:text-neutral-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); fetchCertificates(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                )}
              </form>

              {/* Category Filter Chips — WRAPPING */}
              <div className="flex items-center gap-1 flex-wrap">
                {['ALL', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald'].map((cat) => {
                  const countVal = categoryCounts[cat] || 0;
                  const isActive = tierFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTierFilter(cat)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-2xs dark:bg-surface-700 dark:border dark:border-white/10'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-surface-850 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-surface-800'
                      }`}
                    >
                      <span>{cat === 'ALL' ? 'All Tiers' : cat}</span>
                      <span className={`px-1 py-0.2 rounded text-[9.5px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600 dark:bg-surface-800 dark:text-neutral-400'
                      }`}>
                        {countVal}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {filteredCertificates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-white dark:border-white/10 dark:bg-surface-850">
              <FiAward className="mx-auto h-8 w-8 text-slate-300 dark:text-neutral-600 mb-2" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                {tierFilter === 'ALL' ? 'No Certificates Found' : `No ${tierFilter} Certificates Found`}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Certificates are automatically awarded when client battery services reach milestone thresholds.
              </p>
            </div>
          ) : (
            <>
              {/* ── Mobile View: Compact Stacking Cards (Zero Horizontal Scrolling) ── */}
              <div className="lg:hidden space-y-2.5">
                {filteredCertificates.map((cert) => {
                  const logo = getLogoUrl(cert.client_logo_path);
                  const tier = getTierForCertificate(cert);
                  const bStyle = TIER_BADGES[tier.badge] || TIER_BADGES.Gold;
                  const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);

                  return (
                    <div
                      key={cert.id}
                      className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-surface-900 space-y-2"
                    >
                      {/* Top Row: Client & Tier */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {logo ? (
                            <img
                              src={logo}
                              alt={cert.client_name}
                              className="h-7 w-7 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 dark:bg-surface-800 dark:border-white/10 shrink-0"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shrink-0">
                              {cert.client_name?.[0] || 'C'}
                            </div>
                          )}
                          <Link
                            to={`/certificates/client/${cert.client_id}`}
                            className="font-bold text-xs text-slate-900 hover:text-blue-600 dark:text-white truncate"
                          >
                            {cert.client_name}
                          </Link>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase border shrink-0 ${bStyle}`}>
                          <FiAward className="w-2.5 h-2.5" />
                          <span>{tier.badge} ({cert.milestone_count.toLocaleString()})</span>
                        </span>
                      </div>

                      {/* Title & Metadata */}
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-neutral-200 block">
                          {cert.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10.5px]">
                          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.2 font-extrabold text-emerald-800 border border-emerald-200">
                            ~{co2} Tons CO₂
                          </span>
                          <span className="font-mono text-slate-500">
                            {cert.certificate_code}
                          </span>
                          <span className="text-slate-400">
                            • {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/5 pt-2">
                        <button
                          type="button"
                          onClick={() => downloadMilestoneCertificatePDF(cert, cert.client_name)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                        >
                          <FiDownload className="w-3 h-3 text-slate-500" />
                          <span>Download PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCert(cert)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 shadow-2xs cursor-pointer"
                        >
                          <FiEye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop View: Responsive Table (lg:block) ── */}
              <div className="hidden lg:block overflow-hidden rounded-xl border border-slate-200/90 bg-white dark:border-white/10 dark:bg-surface-850 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-3.5 py-2.5">Client</th>
                      <th className="px-3.5 py-2.5">Tier & Milestone</th>
                      <th className="px-3.5 py-2.5">Certificate Title</th>
                      <th className="px-3.5 py-2.5">CO₂ Saved</th>
                      <th className="px-3.5 py-2.5">Certificate Code</th>
                      <th className="px-3.5 py-2.5">Issued Date</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
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
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                              {logo ? (
                                <img
                                  src={logo}
                                  alt={cert.client_name}
                                  className="h-6 w-6 rounded-md object-contain bg-slate-50 border border-slate-200 p-0.5 dark:bg-surface-800 dark:border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] dark:bg-surface-800 dark:text-neutral-300 shrink-0">
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
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase border ${bStyle}`}>
                              <FiAward className="w-2.5 h-2.5" />
                              <span>{tier.badge} ({cert.milestone_count.toLocaleString()})</span>
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="font-bold text-slate-800 dark:text-neutral-200">
                              {cert.title}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.2 font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10.5px]">
                              ~{co2} Tons CO₂
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-neutral-300 whitespace-nowrap text-[11px]">
                            {cert.certificate_code}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500 dark:text-neutral-400 whitespace-nowrap text-[11px]">
                            {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => downloadMilestoneCertificatePDF(cert, cert.client_name)}
                                className="p-1 text-slate-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                                title="Download Official PDF"
                                aria-label="Download Official PDF"
                              >
                                <FiDownload className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCert(cert)}
                                className="p-1 text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
                                title="View Certificate"
                                aria-label="View Certificate"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ── Tab 3: Milestone Rules Architecture & Standards ── */
        <div className="space-y-4 sm:space-y-5">
          {/* Header Card: Milestone Governance */}
          <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-emerald-50/40 via-white to-blue-50/30 p-3.5 sm:p-4 dark:border-white/10 dark:from-surface-850 dark:via-surface-850 dark:to-surface-850 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0 shadow-2xs">
                  <FiSliders className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Automated Milestone Governance & ISO Decarbonization Rules
                    </h3>
                    <span className="hidden sm:inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      ISO 14064
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    Certificates are automatically awarded when fleet partners reach verified service thresholds.
                  </p>
                </div>
              </div>

              {/* Conversion Metrics */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>15.2 kg CO₂ / pack</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span>2.8 kg E-Waste / pack</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6 Milestone Tier Rules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {milestoneTiers.map((tier) => {
              const theme = TIER_THEMES[tier.badge] || TIER_THEMES.Gold;
              const cleanTitle = tier.title?.split('—')[0]?.trim() || tier.title;

              return (
                <div
                  key={tier.count}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white dark:bg-surface-850 p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs ${theme.border}`}
                >
                  {/* Subtle top accent bar */}
                  <div className={`absolute inset-x-0 top-0 h-0.5 ${theme.topBar}`} />

                  <div>
                    {/* Header: Tier Badge & Threshold Count */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${theme.badge}`}>
                        <FiAward className="w-3 h-3" />
                        <span>{tier.badge} Tier</span>
                      </span>
                      <span className="font-mono text-[11px] font-black text-slate-800 dark:text-neutral-200 bg-slate-100 dark:bg-surface-800 px-2 py-0.5 rounded-md border border-slate-200/70">
                        {tier.count.toLocaleString()} Batteries
                      </span>
                    </div>

                    {/* Clean Title */}
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-2.5 tracking-tight">
                      {cleanTitle}
                    </h4>

                    {/* Impact Stats */}
                    <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-slate-50/90 dark:bg-surface-900/60 p-2 border border-slate-100 dark:border-white/5">
                      <div>
                        <span className="text-[10px] font-medium text-slate-500 block">
                          CO₂ Reduction
                        </span>
                        <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                          ~{(tier.co2Kg / 1000).toFixed(1)} Tons
                        </span>
                      </div>
                      <div className="border-l border-slate-200/80 pl-2">
                        <span className="text-[10px] font-medium text-slate-500 block">
                          E-Waste Saved
                        </span>
                        <span className="text-xs font-bold text-blue-600 block mt-0.5">
                          {tier.ewasteKg.toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Status & Action */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
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
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <FiEye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Collapsible Technical Composition Audit */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-850 overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowRulesChemicalAnnex(!showRulesChemicalAnnex)}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-slate-50 dark:hover:bg-surface-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <FiLayers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Technical Composition Standards & CAS Registry Information
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                    Standard chemical recovery rates and metallurgical standards across all serviced battery units.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-neutral-300 shrink-0">
                <span className="hidden sm:inline">{showRulesChemicalAnnex ? 'Hide' : 'Show'}</span>
                {showRulesChemicalAnnex ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showRulesChemicalAnnex && (
              <div className="border-t border-slate-200/80 dark:border-white/10 p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-surface-900/40">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-850">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2">Composition</th>
                        <th className="px-3 py-2">Formula</th>
                        <th className="px-3 py-2">CAS No.</th>
                        <th className="px-3 py-2">Weight (%)</th>
                        <th className="px-3 py-2 font-bold text-emerald-700">Calculated Mass ({benchmarkCount.toLocaleString()} Packs)</th>
                        <th className="px-3 py-2">Material Role & Recovery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {adminBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{item.nameEn}</td>
                          <td className="px-3 py-2 font-mono text-slate-700 font-semibold">{item.formula}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{item.casNo}</td>
                          <td className="px-3 py-2 font-mono">{item.weightPct}</td>
                          <td className="px-3 py-2 font-mono font-extrabold text-emerald-700">{item.formattedAmount}</td>
                          <td className="px-3 py-2 text-slate-600 text-[11px]">{item.role}</td>
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
          size="5xl"
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
