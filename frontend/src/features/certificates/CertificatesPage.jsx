import { useEffect, useState } from 'react';
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
import { downloadMilestoneCertificatePDF } from '../../utils/generate-milestone-certificate';
import { getLogoUrl } from '../../utils/logo-url';

function CertificatesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'certificates' | 'tiers'

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
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs"
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
            <span className="text-xs text-slate-400 font-bold">Packs</span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
            Across all client operations
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
                          className="h-10 w-10 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 dark:bg-surface-800 dark:border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-surface-800 dark:text-neutral-200 font-bold text-sm shrink-0">
                          {client.clientName[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {client.clientName}
                        </h3>
                        <span className="text-[11px] text-slate-400 dark:text-neutral-400">
                          {client.certificatesCount} Milestone Certificate
                          {client.certificatesCount !== 1 ? 's' : ''} Awarded
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {currentCount.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">
                        Serviced
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar towards Next Milestone */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600 dark:text-neutral-300">
                        {nextTier
                          ? `Progress to ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} Batteries)`
                          : '🎉 Highest Milestone Achieved!'}
                      </span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                        {progressPct}%
                      </span>
                    </div>

                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 rounded-full transition-all duration-500"
                      />
                    </div>

                    <div className="flex justify-between text-[10.5px] text-slate-400 dark:text-neutral-500">
                      <span>{currentCount.toLocaleString()} restored</span>
                      {nextTier && (
                        <span>
                          {(targetCount - currentCount).toLocaleString()} more needed for {nextTier.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Awarded Badges */}
                  {client.certificates.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Achieved Certificates
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {client.certificates.map((cert) => (
                          <button
                            key={cert.id}
                            type="button"
                            onClick={() => setSelectedCert(cert)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200/80 hover:bg-amber-100 dark:bg-amber-950/50 dark:border-amber-900/50 dark:text-amber-300 transition-colors cursor-pointer"
                          >
                            <FiAward className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>{cert.milestone_count.toLocaleString()} Milestone</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'certificates' ? (
        /* Tab 2: Issued Certificates Table */
        <div className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="relative max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search certificates by client name, code, or title..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-white/10 dark:bg-surface-850 dark:text-neutral-100"
            />
          </form>

          {certificates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center bg-white dark:border-white/10 dark:bg-surface-850">
              <FiAward className="mx-auto h-10 w-10 text-slate-300 dark:text-neutral-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-200">
                No Certificates Found
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
                      Milestone Certificate
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
                  {certificates.map((cert) => {
                    const logo = getLogoUrl(cert.client_logo_path);
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <FiAward className="w-3.5 h-3.5 text-amber-500" />
                            <span className="font-bold text-slate-800 dark:text-neutral-200">
                              {cert.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                            ~{co2} Tons CO₂
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-neutral-400">
                          {cert.certificate_code}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-neutral-400">
                          {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => downloadMilestoneCertificatePDF(cert, cert.client_name)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-all cursor-pointer whitespace-nowrap shadow-2xs active:scale-98"
                              title="Download Official Vector PDF"
                            >
                              <FiDownload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCert(cert)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 transition-all cursor-pointer whitespace-nowrap shadow-2xs active:scale-98"
                              title="View & Print Certificate"
                            >
                              <FiEye className="w-3.5 h-3.5" />
                              <span>View Certificate</span>
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
        /* Tab 3: Milestone Tiers Breakdown */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {milestoneTiers.map((tier) => (
            <div
              key={tier.count}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-850 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <FiAward className="w-3 h-3 text-amber-600" />
                  <span>{tier.badge} Tier</span>
                </span>
                <span className="font-black text-lg text-slate-900 dark:text-white">
                  {tier.count.toLocaleString()} Units
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  {tier.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  {tier.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-center">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                    CO₂ Saved
                  </span>
                  <span className="font-extrabold text-xs text-emerald-800 dark:text-emerald-200">
                    ~{(tier.co2Kg / 1000).toFixed(1)} Tons
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block">
                    E-Waste Saved
                  </span>
                  <span className="font-extrabold text-xs text-blue-800 dark:text-blue-200">
                    {tier.ewasteKg.toLocaleString()} kg
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Certificate Live Preview Modal */}
      {selectedCert && (
        <Modal
          title="Official Milestone Certificate"
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
