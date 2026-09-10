import { useEffect, useState } from 'react';
import {
  FiAward,
  FiGlobe,
  FiShield,
  FiTrendingUp,
  FiPrinter,
  FiEye,
  FiRefreshCw,
  FiCheckCircle,
  FiArrowRight,
  FiDownload,
} from 'react-icons/fi';
import apiClient from '../../services/api-client';
import TableState from '../../components/ui/TableState';
import Modal from '../../components/ui/Modal';
import CertificateView from '../../components/certificates/CertificateView';
import { downloadMilestoneCertificatePDF } from '../../utils/generate-milestone-certificate';
import { useTheme } from '../../context/ThemeContext';

function ClientCertificatesPage() {
  const { customTheme } = useTheme();
  const accent = customTheme?.accentColor || '#10b981';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCert, setSelectedCert] = useState(null);

  useEffect(() => {
    fetchMilestones();
  }, []);

  async function fetchMilestones() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/certificates/my-milestones');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  const client = data?.client;
  const servicedCount = Number(data?.servicedCount || 0);
  const co2SavedTons = ((servicedCount * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(servicedCount * 2.8).toLocaleString();
  const allCerts = data?.allCerts || [];
  const tiers = data?.milestoneTiers || [
    { count: 100, badge: 'Bronze', title: 'Bronze Eco Champion — 100 Batteries', co2Kg: 1520, ewasteKg: 280 },
    { count: 500, badge: 'Silver', title: 'Silver Circular Pioneer — 500 Batteries', co2Kg: 7600, ewasteKg: 1400 },
    { count: 1000, badge: 'Gold', title: 'Gold Sustainability Leader — 1,000 Batteries', co2Kg: 15200, ewasteKg: 2800 },
    { count: 5000, badge: 'Platinum', title: 'Platinum Planet Protector — 5,000 Batteries', co2Kg: 76000, ewasteKg: 14000 },
    { count: 10000, badge: 'Diamond', title: 'Diamond Zero-Waste Hero — 10,000 Batteries', co2Kg: 152000, ewasteKg: 28000 },
    { count: 20000, badge: 'Emerald', title: 'Emerald Circular Vanguard — 20,000 Batteries', co2Kg: 304000, ewasteKg: 56000 },
  ];

  const nextTier = tiers.find((t) => t.count > servicedCount) || tiers[tiers.length - 1];
  const progressPct = nextTier ? Math.min(100, Math.round((servicedCount / nextTier.count) * 100)) : 100;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Milestone Certificates & Eco Impact
            </h1>
            <span className="rounded-xl bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40">
              Official Records
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            Official sustainability certificates, decarbonization metrics, and circular lifecycle achievements for your fleet.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchMilestones}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-850 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors shadow-2xs"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <TableState>Loading your sustainability milestones & certificates…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <>
          {/* Top Key Impact Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  CO₂ Emissions Saved
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <FiGlobe className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">~{co2SavedTons}</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Metric Tons</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                Prevented via battery life extension
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
                <span className="text-2xl font-black text-slate-900 dark:text-white">{ewasteKg}</span>
                <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">kg</span>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                Hazardous lithium landfill diversion
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
                <span className="text-2xl font-black text-slate-900 dark:text-white">{servicedCount.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-bold">Packs</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                Total completed restorations
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                  Milestone Awards
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400">
                  <FiAward className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{allCerts.length}</span>
                <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Earned</span>
              </div>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
                Verified ESG certificates
              </p>
            </div>
          </div>

          {/* Progress Tracker Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-850">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                  Current Milestone Progress
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {nextTier
                    ? `Leveling up to ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} Batteries)`
                    : '🎉 Top Milestone Tier Achieved!'}
                </h3>
              </div>
              <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                {progressPct}%
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 rounded-full transition-all duration-700"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-neutral-400">
                <span>{servicedCount.toLocaleString()} batteries restored</span>
                {nextTier && (
                  <span>
                    {Math.max(0, nextTier.count - servicedCount).toLocaleString()} more units needed for {nextTier.badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Issued Certificates Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Your Official Certificates ({allCerts.length})
              </h2>
            </div>

            {allCerts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center bg-white dark:border-white/10 dark:bg-surface-850 space-y-3">
                <FiAward className="mx-auto h-12 w-12 text-slate-300 dark:text-neutral-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  First Milestone Certificate in Progress
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                  Your official Bronze Certificate will be unlocked once your fleet reaches 100 serviced batteries ({servicedCount}/100 currently completed).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Instant sample preview for client
                    setSelectedCert({
                      client_name: client?.name,
                      milestone_count: servicedCount >= 100 ? servicedCount : 100,
                      title: `${client?.name || 'Partner'} Sustainability & Battery Restoration Certificate`,
                      co2_saved_kg: Number(co2SavedTons) * 1000,
                      ewaste_diverted_kg: Number(servicedCount) * 2.8,
                      certificate_code: `CERT-REFURB-${client?.name?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PARTNER'}-PREVIEW`,
                      issued_at: new Date().toISOString(),
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  <FiEye className="w-3.5 h-3.5" />
                  <span>Preview Sustainability Certificate Template</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCerts.map((cert) => {
                  const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);
                  const ewaste = Math.round(Number(cert.ewaste_diverted_kg || 0)).toLocaleString();

                  return (
                    <div
                      key={cert.id}
                      className="rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/40 via-white to-white p-5 shadow-2xs hover:border-amber-400 hover:shadow-md dark:border-amber-900/30 dark:from-amber-950/20 dark:via-surface-850 dark:to-surface-850 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 font-extrabold text-[10px] uppercase border border-amber-300 dark:border-amber-700">
                            <FiAward className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>{cert.milestone_count.toLocaleString()} Milestone</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {cert.certificate_code}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {cert.title}
                        </h3>

                        <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-slate-50 dark:bg-surface-900/80 border border-slate-200/50 dark:border-white/5 text-center">
                          <div>
                            <span className="text-[9.5px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                              CO₂ Saved
                            </span>
                            <span className="font-black text-xs text-slate-900 dark:text-white block mt-0.5">
                              ~{co2} Tons
                            </span>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase font-bold text-blue-700 dark:text-blue-400 block">
                              E-Waste
                            </span>
                            <span className="font-black text-xs text-slate-900 dark:text-white block mt-0.5">
                              {ewaste} kg
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                          Issued on {new Date(cert.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => downloadMilestoneCertificatePDF(cert, client?.name)}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Milestone Tiers Reference */}
          <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-white/10">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Circular Economy Milestone Roadmap
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {tiers.map((t) => {
                const isReached = servicedCount >= t.count;
                return (
                  <div
                    key={t.count}
                    className={`rounded-2xl border p-4 transition-all ${
                      isReached
                        ? 'bg-emerald-50/40 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800/40'
                        : 'bg-white border-slate-200 dark:bg-surface-850 dark:border-white/10 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-white">
                        {t.badge} Tier
                      </span>
                      {isReached ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-400">
                          <FiCheckCircle className="w-3.5 h-3.5" />
                          <span>Achieved</span>
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-bold text-slate-400">
                          {t.count.toLocaleString()} Units
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-neutral-300 font-medium mt-1">
                      {t.title}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-neutral-400 mt-2">
                      <span>~{(t.co2Kg / 1000).toFixed(1)} Tons CO₂</span>
                      <span>•</span>
                      <span>{t.ewasteKg.toLocaleString()} kg E-Waste</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Certificate Modal */}
      {selectedCert && (
        <Modal
          title="Sustainability Milestone Certificate"
          description={selectedCert.title}
          size="3xl"
          onClose={() => setSelectedCert(null)}
        >
          <CertificateView
            certificate={selectedCert}
            clientName={client?.name}
            showActions={true}
          />
        </Modal>
      )}
    </div>
  );
}

export default ClientCertificatesPage;
