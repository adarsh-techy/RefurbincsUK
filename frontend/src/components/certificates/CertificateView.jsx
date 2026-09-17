import { useRef, useState } from 'react';
import {
  FiAward,
  FiPrinter,
  FiDownload,
  FiShield,
  FiLayers,
  FiCheckCircle,
  FiGlobe,
  FiTrendingUp,
  FiZap,
  FiCpu,
  FiExternalLink,
} from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import {
  downloadMilestoneCertificatePDF,
  getTierForCertificate,
  BATTERY_COMPOSITION_DATA,
  calculateMaterialBreakdown,
} from '../../utils/generate-milestone-certificate';

const CERT_THEMES = {
  Bronze: {
    border: 'border-[#b87333]',
    outerRing: 'ring-[#b87333]/40',
    innerBorder: 'border-[#b87333]/50',
    cornerBorder: 'border-[#b87333]',
    bgContainer: 'bg-[#faf5ef] dark:bg-[#120e0a]',
    accentText: 'text-[#8c4a16] dark:text-[#f6ad55]',
    accentBadge: 'bg-[#faebd7] text-[#8c4a16] border-[#cd7f32]/50 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/60',
    cardBg: 'bg-[#f5e8d8]/60 dark:bg-surface-800',
    sealBg: 'from-[#e4a065] via-[#cd7f32] to-[#8c4a16]',
    sealInner: 'from-[#6e350c] to-[#3a1b05]',
    ribbonGradient: 'from-[#cd7f32] to-[#6e350c]',
    shadow: 'rgba(184, 115, 51, 0.28)',
    metallicGlow: 'rgba(205, 127, 50, 0.15)',
  },
  Silver: {
    border: 'border-[#94a3b8]',
    outerRing: 'ring-[#94a3b8]/40',
    innerBorder: 'border-[#94a3b8]/50',
    cornerBorder: 'border-[#94a3b8]',
    bgContainer: 'bg-[#f8fafc] dark:bg-[#0c121e]',
    accentText: 'text-[#334155] dark:text-[#cbd5e1]',
    accentBadge: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60',
    cardBg: 'bg-slate-100/60 dark:bg-surface-800',
    sealBg: 'from-slate-200 via-slate-400 to-slate-600',
    sealInner: 'from-slate-700 to-slate-900',
    ribbonGradient: 'from-slate-500 to-slate-800',
    shadow: 'rgba(148, 163, 184, 0.28)',
    metallicGlow: 'rgba(148, 163, 184, 0.15)',
  },
  Gold: {
    border: 'border-[#c59b27]',
    outerRing: 'ring-[#c59b27]/40',
    innerBorder: 'border-[#c59b27]/50',
    cornerBorder: 'border-[#c59b27]',
    bgContainer: 'bg-[#fcfaf2] dark:bg-[#121008]',
    accentText: 'text-[#8a621c] dark:text-[#fcd34d]',
    accentBadge: 'bg-[#fbf5e8] text-[#8a621c] border-[#b8862d]/50 dark:bg-yellow-950/80 dark:text-yellow-200 dark:border-yellow-700/60',
    cardBg: 'bg-[#f7eed4]/60 dark:bg-surface-800',
    sealBg: 'from-[#f3cf7a] via-[#c59b27] to-[#8a621c]',
    sealInner: 'from-[#0a442a] to-[#042013]',
    ribbonGradient: 'from-[#1e40af] to-[#172554]',
    shadow: 'rgba(197, 155, 39, 0.32)',
    metallicGlow: 'rgba(197, 155, 39, 0.18)',
  },
  Platinum: {
    border: 'border-[#6366f1]',
    outerRing: 'ring-[#6366f1]/40',
    innerBorder: 'border-[#6366f1]/50',
    cornerBorder: 'border-[#6366f1]',
    bgContainer: 'bg-[#f6f7ff] dark:bg-[#0c0d1f]',
    accentText: 'text-[#4338ca] dark:text-[#a5b4fc]',
    accentBadge: 'bg-indigo-50 text-indigo-900 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700/60',
    cardBg: 'bg-indigo-50/60 dark:bg-surface-800',
    sealBg: 'from-indigo-300 via-indigo-500 to-indigo-700',
    sealInner: 'from-[#1e1b4b] to-[#0f0e26]',
    ribbonGradient: 'from-indigo-600 to-indigo-950',
    shadow: 'rgba(99, 102, 241, 0.32)',
    metallicGlow: 'rgba(99, 102, 241, 0.18)',
  },
  Diamond: {
    border: 'border-[#06b6d4]',
    outerRing: 'ring-[#06b6d4]/40',
    innerBorder: 'border-[#06b6d4]/50',
    cornerBorder: 'border-[#06b6d4]',
    bgContainer: 'bg-[#f0fcfd] dark:bg-[#03171d]',
    accentText: 'text-[#0e7490] dark:text-[#67e8f9]',
    accentBadge: 'bg-cyan-50 text-cyan-900 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-700/60',
    cardBg: 'bg-cyan-50/60 dark:bg-surface-800',
    sealBg: 'from-cyan-300 via-cyan-500 to-cyan-700',
    sealInner: 'from-[#083344] to-[#04151c]',
    ribbonGradient: 'from-cyan-600 to-cyan-950',
    shadow: 'rgba(6, 182, 212, 0.32)',
    metallicGlow: 'rgba(6, 182, 212, 0.18)',
  },
  Emerald: {
    border: 'border-[#059669]',
    outerRing: 'ring-[#059669]/40',
    innerBorder: 'border-[#059669]/50',
    cornerBorder: 'border-[#059669]',
    bgContainer: 'bg-[#f0fdf5] dark:bg-[#02180f]',
    accentText: 'text-[#065f46] dark:text-[#6ee7b7]',
    accentBadge: 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60',
    cardBg: 'bg-emerald-50/60 dark:bg-surface-800',
    sealBg: 'from-emerald-300 via-emerald-500 to-emerald-800',
    sealInner: 'from-[#022c22] to-[#01140f]',
    ribbonGradient: 'from-emerald-700 to-emerald-950',
    shadow: 'rgba(5, 150, 105, 0.32)',
    metallicGlow: 'rgba(5, 150, 105, 0.18)',
  },
};

function CertificateView({ certificate, clientName, showActions = true }) {
  const printRef = useRef(null);
  const { theme: currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('certificate'); // 'certificate' | 'composition'

  if (!certificate) return null;

  const tier = getTierForCertificate(certificate);
  const theme = CERT_THEMES[tier.badge] || CERT_THEMES.Gold;

  const count = Number(certificate.milestone_count || tier.count);
  const co2Tons = (Number(certificate.co2_saved_kg || count * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(Number(certificate.ewaste_diverted_kg || count * 2.8)).toLocaleString();
  const certClient = (certificate.client_name || clientName || 'Valued Enterprise Partner').toUpperCase();
  const certCode = certificate.certificate_code || `CERT-REFURB-${count}-2026`;
  const issueDate = certificate.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

  const breakdown = calculateMaterialBreakdown(count);
  const cathodeAmount = breakdown[0]?.formattedAmount || '—';
  const graphiteAmount = breakdown[4]?.formattedAmount || '—';
  const cuAmount = breakdown[12]?.formattedAmount || '—';
  const niAmount = breakdown[11]?.formattedAmount || '—';
  const feAmount = breakdown[13]?.formattedAmount || '—';

  function handleDownloadPDF() {
    downloadMilestoneCertificatePDF(certificate, clientName);
  }

  function handleTriggerPrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* View Switcher: Certificate vs Section 2 Composition Information */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('certificate')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'certificate'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-surface-700 dark:text-white dark:border dark:border-white/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
            }`}
          >
            <FiAward className="w-3.5 h-3.5 text-amber-400" />
            <span>Milestone Certificate (All Data)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('composition')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'composition'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-surface-700 dark:text-white dark:border dark:border-white/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
            }`}
          >
            <FiLayers className="w-3.5 h-3.5 text-emerald-500" />
            <span>Section 2 Composition Audit ({BATTERY_COMPOSITION_DATA.length})</span>
          </button>
        </div>

        <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-neutral-500 hidden sm:inline">
          {certCode}
        </span>
      </div>

      {activeTab === 'certificate' ? (
        /* ═══════════════════════════════════════════════════════════════════
           CLASSIC & PRESTIGIOUS VECTOR CERTIFICATE CANVAS
           ═══════════════════════════════════════════════════════════════════ */
        <div
          ref={printRef}
          id="printable-certificate"
          className={`relative overflow-hidden rounded-2xl border-[7px] ${theme.border} ${theme.bgContainer} p-4 sm:p-8 text-center shadow-2xl transition-all`}
          style={{
            boxShadow: `0 25px 60px -15px ${theme.shadow}, inset 0 0 50px ${theme.metallicGlow}`,
          }}
        >
          {/* Ornate Guilloché / Intaglio Wave Security Pattern */}
          <div
            className="absolute inset-0 opacity-[0.035] dark:opacity-[0.055] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, currentColor 1.2px, transparent 1.2px), repeating-linear-gradient(45deg, currentColor 0px, currentColor 0.7px, transparent 0.7px, transparent 18px), repeating-linear-gradient(-45deg, currentColor 0px, currentColor 0.7px, transparent 0.7px, transparent 18px)`,
              backgroundSize: '24px 24px, 36px 36px, 36px 36px',
            }}
          />

          {/* Verification Watermark Crest */}
          <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.035] pointer-events-none flex items-center justify-center select-none">
            <FiShield className="w-[440px] h-[440px]" />
          </div>

          {/* Inner Multi-Layer Frame */}
          <div className={`relative z-10 border-2 ${theme.innerBorder} rounded-xl p-4 sm:p-7 bg-white dark:bg-surface-900 shadow-inner space-y-4`}>
            {/* Ornate Classic Corner Accents with Jewels */}
            <div className={`absolute top-2 left-2 w-7 h-7 border-t-2 border-l-2 ${theme.cornerBorder}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBadge} absolute -top-1 -left-1 ring-1 ring-current`} />
            </div>
            <div className={`absolute top-2 right-2 w-7 h-7 border-t-2 border-r-2 ${theme.cornerBorder}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBadge} absolute -top-1 -right-1 ring-1 ring-current`} />
            </div>
            <div className={`absolute bottom-2 left-2 w-7 h-7 border-b-2 border-l-2 ${theme.cornerBorder}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBadge} absolute -bottom-1 -left-1 ring-1 ring-current`} />
            </div>
            <div className={`absolute bottom-2 right-2 w-7 h-7 border-b-2 border-r-2 ${theme.cornerBorder}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBadge} absolute -bottom-1 -right-1 ring-1 ring-current`} />
            </div>

            {/* 1. Header & Registry Crest */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200/90 dark:border-white/10 pb-3 gap-3">
              <div className="flex items-center gap-2.5 text-left">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${theme.accentBadge} shadow-xs shrink-0`}>
                  <FiShield className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-serif font-black text-sm tracking-[0.2em] uppercase text-slate-900 dark:text-white block">
                    Refurbnics International
                  </span>
                  <span className="text-[9.5px] text-slate-500 dark:text-neutral-400 font-bold uppercase tracking-[0.14em] block">
                    Global Battery Decarbonization Registry • ISO 14001:2015
                  </span>
                </div>
              </div>

              <div className="text-center sm:text-right flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full ${theme.accentBadge} font-extrabold text-[10.5px] tracking-widest uppercase border shadow-xs`}>
                  <FiAward className="w-3.5 h-3.5" />
                  <span>{tier.badge} Tier Accreditation</span>
                </span>
              </div>
            </div>

            {/* 2. Certificate Title & Classical Presentation */}
            <div className="pt-2 pb-1 space-y-1.5">
              <span className={`text-[12px] font-serif italic ${theme.accentText} uppercase tracking-widest block font-bold`}>
                Official {tier.badge} Certificate of Environmental Leadership & Closed-Loop Decarbonization
              </span>
              <h1 className="text-xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white tracking-tight uppercase leading-tight">
                Sustainability & Circular Economy Achievement
              </h1>

              {/* Decorative Geometric Divider */}
              <div className="flex items-center justify-center gap-3 py-1">
                <div className="h-[1.5px] w-24 sm:w-44 bg-gradient-to-r from-transparent via-slate-400 to-slate-400 dark:via-white/30 dark:to-white/30" />
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-white/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-600 dark:bg-white/80 ring-2 ring-slate-300 dark:ring-white/20" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-white/50" />
                </div>
                <div className="h-[1.5px] w-24 sm:w-44 bg-gradient-to-l from-transparent via-slate-400 to-slate-400 dark:via-white/30 dark:to-white/30" />
              </div>

              <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 italic font-serif">
                By virtue of verified excellence in industrial zero-waste stewardship, this official accreditation is conferred upon
              </p>
            </div>

            {/* 3. Recipient Enterprise Plaque */}
            <div className={`my-1 py-3 px-6 sm:px-12 rounded-xl ${theme.cardBg} border-2 ${theme.innerBorder} inline-block max-w-full shadow-xs`}>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-slate-950 dark:text-white tracking-[0.14em] uppercase">
                {certClient}
              </h2>
            </div>

            {/* 4. Formal Citation Body */}
            <p className="text-xs sm:text-sm text-slate-700 dark:text-neutral-300 max-w-3xl mx-auto leading-relaxed font-serif my-2">
              For exceptional leadership in decarbonized urban mobility and zero-waste battery lifecycle governance. By reaching the <strong className="text-slate-900 dark:text-white font-bold">{tier.badge} milestone threshold</strong> and restoring, testing, and re-commissioning <strong className="text-slate-950 dark:text-white font-extrabold">{count.toLocaleString()} high-voltage battery modules</strong>, your enterprise has directly mitigated hazardous lithium contamination, extended valuable cell life, and significantly reduced global greenhouse emissions.
            </p>

            {/* 5. Four Key ESG Metric Impact Plaques (All Data Included) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
              {/* Card 1: CO2 Abatement */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300/80 text-center dark:bg-surface-800 dark:border-emerald-800/60 shadow-xs">
                <span className="text-[9.5px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block font-sans">
                  CO₂ Saved
                </span>
                <span className="text-lg sm:text-xl font-black text-[#0a442a] dark:text-emerald-300 mt-0.5 block font-serif">
                  ~{co2Tons} Tons
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400/90 font-medium block">
                  Emissions Abated
                </span>
              </div>

              {/* Card 2: E-Waste Avoidance */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-300/80 text-center dark:bg-surface-800 dark:border-blue-800/60 shadow-xs">
                <span className="text-[9.5px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider block font-sans">
                  E-Waste Diverted
                </span>
                <span className="text-lg sm:text-xl font-black text-[#10305c] dark:text-blue-300 mt-0.5 block font-serif">
                  {ewasteKg} kg
                </span>
                <span className="text-[10px] text-blue-700 dark:text-blue-400/90 font-medium block">
                  Toxic Landfill Avoided
                </span>
              </div>

              {/* Card 3: Milestone Restorations */}
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300/80 text-center dark:bg-surface-800 dark:border-amber-800/60 shadow-xs">
                <span className={`text-[9.5px] font-bold ${theme.accentText} uppercase tracking-wider block font-sans`}>
                  {tier.badge} Units
                </span>
                <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 block font-serif">
                  {count.toLocaleString()} Packs
                </span>
                <span className="text-[10px] text-amber-800 dark:text-amber-400/90 font-medium block">
                  Circular Life Extended
                </span>
              </div>

              {/* Card 4: Material Recovery Rate */}
              <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-300/80 text-center dark:bg-surface-800 dark:border-purple-800/60 shadow-xs">
                <span className="text-[9.5px] font-bold text-purple-800 dark:text-purple-400 uppercase tracking-wider block font-sans">
                  Recovery Rate
                </span>
                <span className="text-lg sm:text-xl font-black text-purple-900 dark:text-purple-300 mt-0.5 block font-serif">
                  100% Closed-Loop
                </span>
                <span className="text-[10px] text-purple-700 dark:text-purple-400/90 font-medium block">
                  Zero Municipal Waste
                </span>
              </div>
            </div>

            {/* 6. Audited Chemical Composition & Recovery Summary Strip (Dynamically Calculated) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-800 border border-slate-200/90 dark:border-white/10 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/70 dark:border-white/5 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <FiCpu className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Audited Material Recovery for {count.toLocaleString()} Batteries (Section 2 Standard)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('composition')}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <span>View 14-Element Breakdown Table</span>
                  <FiExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                <div className="p-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 dark:text-neutral-500 text-[10px] block font-mono">CATHODE ACTIVE</span>
                  <strong className="text-slate-800 dark:text-neutral-200 font-mono text-[10.5px]">Li(NiCoMn)O₂</strong>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">~{cathodeAmount} • Recycled</span>
                </div>

                <div className="p-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 dark:text-neutral-500 text-[10px] block font-mono">ANODE ACTIVE</span>
                  <strong className="text-slate-800 dark:text-neutral-200 font-mono text-[10.5px]">Graphite (C)</strong>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">~{graphiteAmount} • Closed Loop</span>
                </div>

                <div className="p-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 dark:text-neutral-500 text-[10px] block font-mono">COLLECTORS</span>
                  <strong className="text-slate-800 dark:text-neutral-200 font-mono text-[10.5px]">Cu & Ni Foil</strong>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">~{cuAmount} Cu / {niAmount} Ni</span>
                </div>

                <div className="p-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 dark:text-neutral-500 text-[10px] block font-mono">ELECTROLYTE</span>
                  <strong className="text-slate-800 dark:text-neutral-200 font-mono text-[10.5px]">Organic Solvents</strong>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">4.7% • Neutralized</span>
                </div>

                <div className="p-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-400 dark:text-neutral-500 text-[10px] block font-mono">STRUCTURAL</span>
                  <strong className="text-slate-800 dark:text-neutral-200 font-mono text-[10.5px]">Fe Shell</strong>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">~{feAmount} Fe • Restored</span>
                </div>
              </div>
            </div>

            {/* 7. Official Compliance Standards Chips */}
            <div className="flex items-center justify-center gap-2 flex-wrap text-[10.5px] font-bold text-slate-600 dark:text-neutral-400 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-surface-800 border border-slate-200/80 dark:border-white/10">
                <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                <span>ISO 14001:2015 ESG Standard</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-surface-800 border border-slate-200/80 dark:border-white/10">
                <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                <span>RoHS Directive 2011/65/EU</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-surface-800 border border-slate-200/80 dark:border-white/10">
                <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                <span>UN 38.3 Lithium Transport Certified</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-surface-800 border border-slate-200/80 dark:border-white/10">
                <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                <span>EU Battery Passport 2026 Ready</span>
              </span>
            </div>

            {/* 8. Footer Section: Signatures & Starburst Rosette Medallion */}
            <div className="relative pt-4 mt-2 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
              {/* Left Executive Signature */}
              <div className="text-center sm:text-left flex-1">
                <div className="font-serif italic font-bold text-slate-800 dark:text-neutral-200 text-lg border-b border-slate-300 pb-0.5 dark:border-white/20 inline-block w-48 text-center font-cursive">
                  Dr. Richard Thorne
                </div>
                <span className="text-[9.5px] text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mt-1 font-sans font-bold">
                  Head of Circular Engineering
                </span>
                <span className="text-[9px] text-slate-400 dark:text-neutral-500 block font-sans">
                  Refurbnics Technical Directorate
                </span>
              </div>

              {/* Center Rosette Medallion with Ribbon Tails */}
              <div className="relative flex flex-col items-center justify-center my-1 sm:my-0">
                {/* Ribbon Tails */}
                <div className="absolute top-8 flex gap-2 pointer-events-none">
                  <div
                    className={`w-4 h-10 bg-gradient-to-b ${theme.ribbonGradient} shadow-md transform -rotate-12`}
                    style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                  />
                  <div
                    className={`w-4 h-10 bg-gradient-to-b ${theme.ribbonGradient} shadow-md transform rotate-12`}
                    style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                  />
                </div>

                {/* Rosette Starburst */}
                <div className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${theme.sealBg} text-white shadow-xl ring-4 ring-slate-400/20 dark:ring-white/10`}>
                  <div className={`flex h-13 w-13 items-center justify-center rounded-full border border-white/40 bg-gradient-to-br ${theme.sealInner} text-center p-1 shadow-inner`}>
                    <div className="text-center">
                      <span className="text-[6px] font-black tracking-widest text-white/90 uppercase block">
                        {tier.badge}
                      </span>
                      <FiShield className="w-4 h-4 text-white mx-auto my-0.5" />
                      <span className="text-[5px] font-black text-white/80 uppercase tracking-wider block">
                        VERIFIED
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Executive Signature */}
              <div className="text-center sm:text-right flex-1">
                <div className="font-serif italic font-bold text-slate-800 dark:text-neutral-200 text-lg border-b border-slate-300 pb-0.5 dark:border-white/20 inline-block w-48 text-center font-cursive">
                  Eleanor Sterling-Ward
                </div>
                <span className="text-[9.5px] text-slate-500 dark:text-neutral-400 uppercase tracking-wider block mt-1 font-sans font-bold">
                  Managing Director & Chair
                </span>
                <span className="text-[9px] text-slate-400 dark:text-neutral-500 block font-sans">
                  Issued: {issueDate}
                </span>
              </div>
            </div>

            {/* 9. Bottom Security Registry Line & SHA-256 Hash Tag */}
            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between text-[9.5px] text-slate-400 dark:text-neutral-500 font-mono">
              <span>REGISTRY ID: {certCode}</span>
              <span>SHA-256 TAMPER-EVIDENT ESG AUDIT CERTIFICATE</span>
              <span>TIER: {tier.badge.toUpperCase()} • 100% CLOSED-LOOP COMPLIANT</span>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════════
           SECTION 2. FULL COMPOSITION INFORMATION AUDIT TABLE (DYNAMICALLY CALCULATED)
           ═══════════════════════════════════════════════════════════════════ */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-surface-900 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-white/10 pb-3">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Technical Annex • Section 2. Composition Information
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Material & Chemical Composition Recovery Audit for {count.toLocaleString()} Batteries
              </h3>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-mono font-bold text-slate-700 dark:bg-surface-800 dark:text-neutral-200 self-start sm:self-auto border border-slate-200 dark:border-white/10">
              {count.toLocaleString()} Packs Audited
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">
                    Chemical Composition
                  </th>
                  <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">
                    Chemical Formula
                  </th>
                  <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">
                    CAS No.
                  </th>
                  <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">
                    Weight (%)
                  </th>
                  <th className="px-3.5 py-2.5 font-bold text-emerald-700 dark:text-emerald-400">
                    Recovered Mass ({count.toLocaleString()} Packs)
                  </th>
                  <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">
                    Battery Functional Role & Recovery
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {breakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-slate-900 dark:text-white">{item.nameEn}</div>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-neutral-200 font-semibold">
                      {item.formula}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-neutral-400">
                      {item.casNo}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold bg-slate-100 text-slate-700 dark:bg-surface-800 dark:text-neutral-300 border border-slate-200 dark:border-white/10 text-[11px]">
                        {item.weightPct}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-extrabold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 text-[11.5px]">
                        {item.formattedAmount}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-neutral-300 text-[11px]">
                      {item.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-900 border border-slate-200/80 dark:border-white/10 text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-white font-bold">Audited Decarbonization Standard:</strong> 100% of cells refurbished by Refurbnics undergo certified metallurgical and functional recovery. For this certificate of {count.toLocaleString()} battery packs, rare earth metals, copper foils, and active cathode compounds (~{cathodeAmount} Li(NiCoMn)O₂) are prevented from entering municipal waste streams, guaranteeing ISO 14001, RoHS, and EU Battery Passport compliance.
          </div>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleTriggerPrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer transition-colors"
          >
            <FiPrinter className="w-4 h-4" />
            <span>Print Official Certificate</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-emerald-700 hover:to-teal-700 cursor-pointer transition-all"
          >
            <FiDownload className="w-4 h-4" />
            <span>Download Official {tier.badge} PDF (Complete 2-Page Audit)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CertificateView;

