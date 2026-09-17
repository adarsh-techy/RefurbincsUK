import { useEffect, useState } from 'react';
import {
  FiAward,
  FiGlobe,
  FiShield,
  FiTrendingUp,
  FiEye,
  FiRefreshCw,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiLayers,
  FiZap,
} from 'react-icons/fi';
import apiClient from '../../../services/api-client';
import TableState from '../../../components/ui/table/TableState';
import Modal from '../../../components/ui/overlays/Modal';
import CertificateView from '../../../components/certificates/CertificateView';
import {
  downloadMilestoneCertificatePDF,
  getTierForCertificate,
  calculateMaterialBreakdown,
} from '../../../utils/generate-milestone-certificate';

const TIER_META = {
  Bronze: {
    badge: 'Bronze',
    units: '100 Units',
    accentGradient: 'from-amber-700 via-amber-600 to-amber-900',
    iconBg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60',
    cardActive: 'border-amber-400 bg-gradient-to-b from-amber-100/70 via-amber-50/40 to-white dark:from-amber-950/50 dark:via-surface-900 dark:to-surface-900 dark:border-amber-600/70 shadow-xs ring-1 ring-amber-400/20',
    cardInactive: 'border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/25 dark:to-surface-900 dark:border-amber-900/40',
  },
  Silver: {
    badge: 'Silver',
    units: '500 Units',
    accentGradient: 'from-slate-400 via-slate-500 to-slate-700',
    iconBg: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    cardActive: 'border-slate-400 bg-gradient-to-b from-slate-200/60 via-slate-50/40 to-white dark:from-slate-800/50 dark:via-surface-900 dark:to-surface-900 dark:border-slate-500/70 shadow-xs ring-1 ring-slate-400/20',
    cardInactive: 'border-slate-200 bg-gradient-to-b from-slate-100/50 to-white dark:from-slate-900/40 dark:to-surface-900 dark:border-slate-800/40',
  },
  Gold: {
    badge: 'Gold',
    units: '1,000 Units',
    accentGradient: 'from-yellow-400 via-amber-500 to-yellow-600',
    iconBg: 'bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-700',
    badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-950/70 dark:text-yellow-200 dark:border-yellow-600',
    cardActive: 'border-yellow-400 bg-gradient-to-b from-yellow-100/70 via-yellow-50/40 to-white dark:from-yellow-950/50 dark:via-surface-900 dark:to-surface-900 dark:border-yellow-500/70 shadow-xs ring-1 ring-yellow-400/20',
    cardInactive: 'border-yellow-200/80 bg-gradient-to-b from-yellow-50/50 to-white dark:from-yellow-950/25 dark:to-surface-900 dark:border-yellow-900/40',
  },
  Platinum: {
    badge: 'Platinum',
    units: '5,000 Units',
    accentGradient: 'from-indigo-500 via-purple-600 to-indigo-700',
    iconBg: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-600',
    cardActive: 'border-indigo-400 bg-gradient-to-b from-indigo-100/70 via-indigo-50/40 to-white dark:from-indigo-950/50 dark:via-surface-900 dark:to-surface-900 dark:border-indigo-500/70 shadow-xs ring-1 ring-indigo-400/20',
    cardInactive: 'border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/25 dark:to-surface-900 dark:border-indigo-900/40',
  },
  Diamond: {
    badge: 'Diamond',
    units: '10,000 Units',
    accentGradient: 'from-cyan-400 via-sky-500 to-blue-600',
    iconBg: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-700',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-600',
    cardActive: 'border-cyan-400 bg-gradient-to-b from-cyan-100/70 via-cyan-50/40 to-white dark:from-cyan-950/50 dark:via-surface-900 dark:to-surface-900 dark:border-cyan-500/70 shadow-xs ring-1 ring-cyan-400/20',
    cardInactive: 'border-cyan-200/80 bg-gradient-to-b from-cyan-50/50 to-white dark:from-cyan-950/25 dark:to-surface-900 dark:border-cyan-900/40',
  },
  Emerald: {
    badge: 'Emerald',
    units: '20,000 Units',
    accentGradient: 'from-emerald-400 via-emerald-600 to-teal-700',
    iconBg: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-600',
    cardActive: 'border-emerald-400 bg-gradient-to-b from-emerald-100/70 via-emerald-50/40 to-white dark:from-emerald-950/50 dark:via-surface-900 dark:to-surface-900 dark:border-emerald-500/70 shadow-xs ring-1 ring-emerald-400/20',
    cardInactive: 'border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/25 dark:to-surface-900 dark:border-emerald-900/40',
  },
};

const TIER_BADGES = {
  Bronze: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
  Silver: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  Gold: 'bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-700',
  Platinum: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700',
  Diamond: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-700',
  Emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700',
};

const TIER_CARDS = {
  Bronze: 'border-amber-300/80 bg-gradient-to-b from-amber-50/60 via-white to-amber-50/20 dark:from-amber-950/30 dark:via-surface-900 dark:to-surface-900 dark:border-amber-800/50 shadow-xs ring-1 ring-amber-400/20',
  Silver: 'border-slate-300 bg-gradient-to-b from-slate-100/60 via-white to-slate-50/20 dark:from-slate-800/30 dark:via-surface-900 dark:to-surface-900 dark:border-slate-700 shadow-xs ring-1 ring-slate-400/20',
  Gold: 'border-yellow-400/80 bg-gradient-to-b from-yellow-50/60 via-white to-yellow-50/20 dark:from-yellow-950/30 dark:via-surface-900 dark:to-surface-900 dark:border-yellow-700/50 shadow-xs ring-1 ring-yellow-400/20',
  Platinum: 'border-indigo-300/80 bg-gradient-to-b from-indigo-50/60 via-white to-indigo-50/20 dark:from-indigo-950/30 dark:via-surface-900 dark:to-surface-900 dark:border-indigo-800/50 shadow-xs ring-1 ring-indigo-400/20',
  Diamond: 'border-cyan-300/80 bg-gradient-to-b from-cyan-50/60 via-white to-cyan-50/20 dark:from-cyan-950/30 dark:via-surface-900 dark:to-surface-900 dark:border-cyan-800/50 shadow-xs ring-1 ring-cyan-400/20',
  Emerald: 'border-emerald-300/80 bg-gradient-to-b from-emerald-50/60 via-white to-emerald-50/20 dark:from-emerald-950/30 dark:via-surface-900 dark:to-surface-900 dark:border-emerald-800/50 shadow-xs ring-1 ring-emerald-400/20',
};

function ClientCertificatesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCert, setSelectedCert] = useState(null);
  const [showTechnicalAnnex, setShowTechnicalAnnex] = useState(false);

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
    { count: 100, badge: 'Bronze', title: 'Bronze Eco Champion', subtitle: '100 Refurbished Packs', co2Kg: 1520, ewasteKg: 280 },
    { count: 500, badge: 'Silver', title: 'Silver Circular Pioneer', subtitle: '500 Refurbished Packs', co2Kg: 7600, ewasteKg: 1400 },
    { count: 1000, badge: 'Gold', title: 'Gold Sustainability Leader', subtitle: '1,000 Refurbished Packs', co2Kg: 15200, ewasteKg: 2800 },
    { count: 5000, badge: 'Platinum', title: 'Platinum Planet Protector', subtitle: '5,000 Refurbished Packs', co2Kg: 76000, ewasteKg: 14000 },
    { count: 10000, badge: 'Diamond', title: 'Diamond Zero-Waste Hero', subtitle: '10,000 Refurbished Packs', co2Kg: 152000, ewasteKg: 28000 },
    { count: 20000, badge: 'Emerald', title: 'Emerald Circular Vanguard', subtitle: '20,000 Refurbished Packs', co2Kg: 304000, ewasteKg: 56000 },
  ];

  const nextTier = tiers.find((t) => t.count > servicedCount);
  const prevTierCount = tiers.slice().reverse().find((t) => t.count <= servicedCount)?.count || 0;
  const targetUnits = nextTier ? nextTier.count : tiers[tiers.length - 1].count;
  const neededUnits = nextTier ? Math.max(0, nextTier.count - servicedCount) : 0;
  const progressPct = nextTier
    ? Math.min(100, Math.round(((servicedCount - prevTierCount) / (targetUnits - prevTierCount)) * 100))
    : 100;

  const clientBreakdownCount = servicedCount > 0 ? servicedCount : 100;
  const clientBreakdown = calculateMaterialBreakdown(clientBreakdownCount);

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
              Verified ESG Records
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mt-1">
            Track your fleet&apos;s circular economy achievements, carbon offsets, and official sustainability certifications.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchMilestones}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors shadow-2xs cursor-pointer"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <TableState>Loading sustainability milestones & certificates…</TableState>
      ) : error ? (
        <TableState tone="error">{error}</TableState>
      ) : (
        <>
          {/* 2. Top Key Impact Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  CO₂ Saved
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <FiGlobe className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">~{co2SavedTons}</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">Metric Tons</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                15.2 kg CO₂ prevented per repaired battery
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
                <span className="text-2xl font-black text-slate-900 dark:text-white">{ewasteKg}</span>
                <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">kg</span>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                Hazardous battery materials kept out of landfills
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Packs Received & Serviced
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <FiTrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{servicedCount.toLocaleString()}</span>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">Packs</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                Packs dispatched & received at workshop for service
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200/90 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-purple-950/20 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                  Milestone Awards
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  <FiAward className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{allCerts.length}</span>
                <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Earned</span>
              </div>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
                Official ISO-compliant ESG certificates
              </p>
            </div>
          </div>

          {/* 3. Milestone Progress Bar */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-xs dark:border-white/10 dark:bg-surface-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                  Milestone Status
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {nextTier
                    ? `Leveling Up to ${nextTier.badge} Tier (${nextTier.count.toLocaleString()} Batteries)`
                    : '🎉 Top Milestone Tier Achieved!'}
                </h3>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-neutral-400">
                  {servicedCount.toLocaleString()} / {targetUnits.toLocaleString()} units
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  {progressPct}%
                </span>
              </div>
            </div>

            <div className="mt-3.5">
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-neutral-400">
                <span>{servicedCount.toLocaleString()} units completed</span>
                {nextTier && (
                  <span className="font-semibold text-slate-700 dark:text-neutral-200">
                    {neededUnits.toLocaleString()} more units to unlock {nextTier.badge} Certificate
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Circular Economy Milestone Roadmap */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Milestone Roadmap
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Certificates unlock automatically as batteries are packed & received at the workshop (100, 500, 1,000, 5,000, 10,000, 20,000 units).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
              {tiers.map((t) => {
                const isReached = servicedCount >= t.count;
                const meta = TIER_META[t.badge] || TIER_META.Bronze;
                const tierProgress = Math.min(100, Math.round((servicedCount / t.count) * 100));

                return (
                  <div
                    key={t.count}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 ${
                      isReached
                        ? meta.cardActive
                        : `${meta.cardInactive} hover:border-slate-300 dark:hover:border-white/20`
                    }`}
                  >
                    {/* Top Metallic Accent Bar */}
                    <div className={`h-1 w-full bg-gradient-to-r ${meta.accentGradient} opacity-90`} />

                    <div className="p-3.5 sm:p-4 flex flex-col justify-between h-full">
                      <div>
                        {/* Header: Tier Medallion & Status */}
                        <div className="flex items-center justify-between gap-1.5 mb-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center border text-xs shadow-2xs ${meta.iconBg}`}>
                              <FiAward className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-extrabold text-xs tracking-wider uppercase text-slate-800 dark:text-neutral-200">
                              {t.badge}
                            </span>
                          </div>

                          {!isReached && (
                            <span className="text-[10px] font-medium text-slate-400 dark:text-neutral-400">
                              {Math.max(0, t.count - servicedCount).toLocaleString()} to go
                            </span>
                          )}
                        </div>

                        {/* Target Units */}
                        <div className="mt-2">
                          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                            Target Milestone
                          </div>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                              {t.count.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">
                              Units
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer: Active Status or Progress Bar */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-white/5">
                        {isReached ? (
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active Certificate
                            </span>
                            <span className="text-xs font-black">✓</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 dark:text-neutral-400 mb-1">
                              <span>Progress</span>
                              <span className="font-bold text-slate-600 dark:text-neutral-300">{tierProgress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-800">
                              <div
                                style={{ width: `${tierProgress}%` }}
                                className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Official Milestone Certificates Showcase */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Official Milestone Certificates ({allCerts.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Download or print verified 2-page ESG sustainability certificates for your records and compliance.
                </p>
              </div>
            </div>

            {allCerts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 sm:p-10 text-center bg-white dark:border-white/10 dark:bg-surface-900 space-y-3">
                <FiAward className="mx-auto h-12 w-12 text-slate-300 dark:text-neutral-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  First Milestone In Progress
                </h3>
                <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                  Your first Bronze Milestone Certificate will automatically unlock once 100 batteries are packed and received for service ({servicedCount}/100 currently completed).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCert({
                      client_name: client?.name,
                      milestone_count: servicedCount >= 100 ? servicedCount : 100,
                      title: `${client?.name || 'Fleet'} Sustainability & Battery Restoration Certificate`,
                      co2_saved_kg: Number(co2SavedTons) * 1000,
                      ewaste_diverted_kg: Number(servicedCount) * 2.8,
                      certificate_code: `CERT-REFURB-${client?.name?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'FLEET'}-PREVIEW`,
                      issued_at: new Date().toISOString(),
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                >
                  <FiEye className="w-3.5 h-3.5" />
                  <span>Preview Certificate Template</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCerts.map((cert) => {
                  const tier = getTierForCertificate(cert);
                  const meta = TIER_META[tier.badge] || TIER_META.Gold;
                  const badgeStyle = TIER_BADGES[tier.badge] || TIER_BADGES.Gold;
                  const cardStyle = TIER_CARDS[tier.badge] || TIER_CARDS.Gold;
                  const co2 = (Number(cert.co2_saved_kg || 0) / 1000).toFixed(1);
                  const ewaste = Math.round(Number(cert.ewaste_diverted_kg || 0)).toLocaleString();
                  const cleanTitle = cert.title?.split('—')[0]?.trim() || cert.title;

                  return (
                    <div
                      key={cert.id}
                      className={`relative overflow-hidden rounded-2xl border transition-all duration-200 flex flex-col justify-between ${cardStyle}`}
                    >
                      {/* Top Metallic Accent Bar */}
                      <div className={`h-1 w-full bg-gradient-to-r ${meta.accentGradient} opacity-90`} />

                      <div className="p-5 flex flex-col justify-between h-full">
                        <div>
                          {/* Header: Tier Medallion & Certificate Code */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black text-[10.5px] uppercase tracking-wider border shadow-2xs ${badgeStyle}`}>
                              <FiAward className="w-3.5 h-3.5" />
                              <span>{tier.badge} Tier • {cert.milestone_count.toLocaleString()}</span>
                            </span>
                            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/90 text-slate-500 dark:bg-surface-800/90 dark:text-neutral-400 border border-slate-200/80 dark:border-white/10">
                              {cert.certificate_code}
                            </span>
                          </div>

                          {/* Certificate Award Title */}
                          <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight leading-snug">
                            {cleanTitle}
                          </h3>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 mt-0.5">
                            Official 2-Page ESG Sustainability Award
                          </p>

                          {/* CO2 & E-Waste Impact Grid */}
                          <div className="grid grid-cols-2 gap-2 my-3.5 p-2.5 rounded-xl bg-white/90 dark:bg-surface-800/90 border border-slate-200/60 dark:border-white/5 text-center shadow-2xs">
                            <div>
                              <span className="text-[9.5px] uppercase font-extrabold text-emerald-700 dark:text-emerald-400 block tracking-wider">
                                CO₂ Prevented
                              </span>
                              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block mt-0.5">
                                ~{co2} Tons
                              </span>
                            </div>
                            <div className="border-l border-slate-100 dark:border-white/10">
                              <span className="text-[9.5px] uppercase font-extrabold text-blue-700 dark:text-blue-400 block tracking-wider">
                                E-Waste Diverted
                              </span>
                              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block mt-0.5">
                                {ewaste} kg
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                            <span>Issued: {new Date(cert.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-[10.5px]">
                              <FiCheckCircle className="w-3 h-3" /> Verified Seal
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCert(cert)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 transition-colors shadow-2xs cursor-pointer"
                          >
                            <FiEye className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400" />
                            <span>View Certificate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadMilestoneCertificatePDF(cert, client?.name)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors shadow-2xs cursor-pointer"
                          >
                            <FiDownload className="w-3.5 h-3.5" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Technical Composition & ISO Material Recovery Annex (Collapsible) */}
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-surface-900 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setShowTechnicalAnnex(!showTechnicalAnnex)}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 dark:hover:bg-surface-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                  <FiLayers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Technical Annex: 14-Element Chemical Recovery Audit & ISO Standards
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Detailed chemical formulas, CAS registry numbers, and metallurgical recovery data for compliance & ESG audits.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-neutral-300 shrink-0">
                <span className="hidden sm:inline">{showTechnicalAnnex ? 'Hide Technical Details' : 'Show Details'}</span>
                {showTechnicalAnnex ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showTechnicalAnnex && (
              <div className="border-t border-slate-200/80 dark:border-white/10 p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-surface-950/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                    Calculated for {clientBreakdownCount.toLocaleString()} Serviced Batteries:
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 self-start sm:self-auto">
                    100% Closed-Loop Retention
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Chemical Composition</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Formula</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">CAS No.</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Weight (%)</th>
                        <th className="px-3.5 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">Recovered Mass</th>
                        <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">Material Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {clientBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white">{item.nameEn}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-neutral-200 font-semibold">{item.formula}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-500 dark:text-neutral-400">{item.casNo}</td>
                          <td className="px-3.5 py-2.5 font-mono">{item.weightPct}</td>
                          <td className="px-3.5 py-2.5 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">{item.formattedAmount}</td>
                          <td className="px-3.5 py-2.5 text-slate-600 dark:text-neutral-300 text-[11px]">{item.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
                  Refurbnics certifies that 100% of these 14 components (~{clientBreakdown[0]?.formattedAmount} active cathode material) from your {clientBreakdownCount.toLocaleString()} restored batteries are audited and retained within a closed-loop economy, preventing toxic landfill pollution in accordance with ISO 14001, RoHS, and EU Battery Passport standards.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Certificate Modal */}
      {selectedCert && (
        <Modal
          title="Sustainability Milestone Certificate"
          description={selectedCert.title}
          size="4xl"
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
