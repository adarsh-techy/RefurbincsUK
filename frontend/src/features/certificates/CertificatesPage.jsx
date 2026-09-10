import { useEffect, useState, useMemo } from 'react';
import {
  FiAward,
  FiSearch,
  FiGlobe,
  FiTrendingUp,
  FiCheckCircle,
  FiPrinter,
  FiEye,
  FiRefreshCw,
  FiShield,
  FiExternalLink,
  FiDownload,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/TableState';
import Modal from '../../components/ui/Modal';
import CertificateView from '../../components/certificates/CertificateView';
import {
  downloadMilestoneCertificatePDF,
  getTierForCertificate,
  TIER_CONFIGS,
} from '../../utils/generate-milestone-certificate';
import { getLogoUrl } from '../../utils/logo-url';

const TIER_BADGES = {
  Bronze: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700',
  Silver: 'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  Gold: 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/90 dark:text-amber-300 dark:border-amber-600',
  Platinum: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-700',
  Diamond: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-700',
  Emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700',
};

function CertificatesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'certificates' | 'tiers'
  const [tierFilter, setTierFilter] = useState('ALL');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-100">
            Milestone Certificates & Sustainability Impact
          </h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Track client decarbonization milestones, issue official sustainability certificates, and monitor CO₂ reduction.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchCertificates}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs cursor-pointer"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Impact Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total CO₂ Saved
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <FiGlobe className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">~{totalCo2Tons}</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Metric Tons</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            Emissions prevented via battery refurbishment
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              E-Waste Diverted
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
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

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Batteries Serviced
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
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

        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-purple-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
              Certificates Issued
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
              <FiAward className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCerts}</span>
            <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Awarded</span>
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            Official sustainability records
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'progress'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-850'
          }`}
        >
          <FiTrendingUp className="w-3.5 h-3.5" />
          <span>Client Milestone Tracker ({clientProgress.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('certificates')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'certificates'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-850'
          }`}
        >
          <FiAward className="w-3.5 h-3.5" />
          <span>Issued Certificates ({certificates.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tiers')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tiers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-850'
          }`}
        >
          <FiShield className="w-3.5 h-3.5" />
          <span>Milestone Tiers Overview</span>
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

            return (
              <div
                key={client.clientId}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-slate-300 dark:border-white/10 dark:bg-surface-850 dark:hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {logo ? (
                        <img
                          src={logo}
                          alt={client.clientName}
                          className="h-9 w-9 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 dark:bg-surface-800 dark:border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-black text-sm dark:bg-surface-800 dark:text-white shrink-0">
                          {client.clientName?.[0] || 'C'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {client.clientName}
                        </h3>
                        <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                          {client.certificates.length} certificate{client.certificates.length === 1 ? '' : 's'} issued
                        </span>
                      </div>
                    </div>

                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white bg-slate-100 px-2.5 py-1 rounded-lg dark:bg-surface-800 shrink-0">
                      {currentCount.toLocaleString()} Serviced
                    </span>
                  </div>

                  {/* Progress to Next Tier */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-neutral-400 font-medium">
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
                        className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>

                  {/* Impact Summary Pill */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-surface-900/60 text-center">
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

                {/* Issued Badges List */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {client.certificates.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">No milestone certificates earned yet</span>
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
                          >
                            <FiAward className="w-3 h-3" />
                            <span>{t.badge} ({c.milestone_count.toLocaleString()})</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'certificates' ? (
        /* Tab 2: All Issued Certificates Table with Tier Filter Chips */
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
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-850 dark:text-neutral-100"
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
                        ? 'bg-slate-900 text-white shadow-xs dark:bg-surface-700'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-surface-850 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-surface-800'
                    }`}
                  >
                    <span>{cat === 'ALL' ? 'All' : cat}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-neutral-400'
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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-850 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">
                      Client
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">
                      Tier & Milestone
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">
                      Certificate Title
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">
                      CO₂ Saved
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">
                      Certificate ID
                    </th>
                    <th className="px-4 py-3 font-bold text-slate-700 dark:text-neutral-300">
                      Issued Date
                    </th>
                    <th className="px-4 py-3 text-right font-bold text-slate-700 dark:text-neutral-300 whitespace-nowrap">
                      Actions
                    </th>
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
                            <span className="font-bold text-slate-900 dark:text-white">
                              {cert.client_name}
                            </span>
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
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                            ~{co2} Tons CO₂
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-neutral-400 whitespace-nowrap">
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
        /* Tab 3: Milestone Tiers Breakdown & Roadmap */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {milestoneTiers.map((tier) => {
              const bStyle = TIER_BADGES[tier.badge] || TIER_BADGES.Gold;
              return (
                <div
                  key={tier.count}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-surface-850 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${bStyle}`}>
                        <FiAward className="w-3.5 h-3.5" />
                        <span>{tier.badge} Tier</span>
                      </span>
                      <span className="font-mono text-xs font-black text-slate-700 dark:text-neutral-300">
                        {tier.count.toLocaleString()} Units
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3">
                      {tier.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                      {tier.subtitle}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-surface-900/80 border border-slate-200/50 dark:border-white/5 text-center">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                          CO₂ Reduction
                        </span>
                        <span className="font-black text-xs text-slate-900 dark:text-white block mt-0.5">
                          ~{(tier.co2Kg / 1000).toFixed(1)} Tons
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block">
                          E-Waste Diversion
                        </span>
                        <span className="font-black text-xs text-slate-900 dark:text-white block mt-0.5">
                          {tier.ewasteKg.toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                    <span>Issued automatically upon reach</span>
                    <FiCheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Certificate Modal View */}
      {selectedCert && (
        <Modal
          title="Sustainability Milestone Certificate"
          description={selectedCert.title}
          size="3xl"
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
