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
  FiCheck,
  FiFileText,
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
    innerBorder: 'border-[#b87333]/60',
    cornerBorder: 'border-[#b87333]',
    bgContainer: 'bg-[#faf5ef] dark:bg-[#120e0a]',
    accentText: 'text-[#8c4a16] dark:text-[#f6ad55]',
    accentBadge: 'bg-[#faebd7] text-[#8c4a16] border-[#cd7f32]/50 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/60',
    cardBg: 'bg-[#f5e8d8]/70 dark:bg-surface-800/80',
    plaqueBg: 'bg-gradient-to-r from-[#fbf2e7] via-[#f7e4cd] to-[#fbf2e7] dark:from-[#26170d] dark:via-[#362113] dark:to-[#26170d]',
    plaqueBorder: 'border-[#cd7f32]/60',
    sealBg: 'from-[#e4a065] via-[#cd7f32] to-[#8c4a16]',
    sealInner: 'from-[#6e350c] to-[#3a1b05]',
    ribbonGradient: 'from-[#cd7f32] to-[#6e350c]',
    shadow: 'rgba(184, 115, 51, 0.30)',
    metallicGlow: 'rgba(205, 127, 50, 0.20)',
    goldFoil: 'from-[#cd7f32] via-[#e4a065] to-[#8c4a16]',
  },
  Silver: {
    border: 'border-[#94a3b8]',
    outerRing: 'ring-[#94a3b8]/40',
    innerBorder: 'border-[#94a3b8]/60',
    cornerBorder: 'border-[#94a3b8]',
    bgContainer: 'bg-[#f8fafc] dark:bg-[#0c121e]',
    accentText: 'text-[#334155] dark:text-[#cbd5e1]',
    accentBadge: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60',
    cardBg: 'bg-slate-100/70 dark:bg-surface-800/80',
    plaqueBg: 'bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-surface-800 dark:to-slate-900',
    plaqueBorder: 'border-slate-300 dark:border-slate-600',
    sealBg: 'from-slate-200 via-slate-400 to-slate-600',
    sealInner: 'from-slate-700 to-slate-900',
    ribbonGradient: 'from-slate-500 to-slate-800',
    shadow: 'rgba(148, 163, 184, 0.30)',
    metallicGlow: 'rgba(148, 163, 184, 0.20)',
    goldFoil: 'from-slate-400 via-slate-200 to-slate-500',
  },
  Gold: {
    border: 'border-[#c59b27]',
    outerRing: 'ring-[#c59b27]/40',
    innerBorder: 'border-[#c59b27]/60',
    cornerBorder: 'border-[#c59b27]',
    bgContainer: 'bg-[#fcfaf2] dark:bg-[#121008]',
    accentText: 'text-[#8a621c] dark:text-[#fcd34d]',
    accentBadge: 'bg-[#fbf5e8] text-[#8a621c] border-[#b8862d]/50 dark:bg-yellow-950/80 dark:text-yellow-200 dark:border-yellow-700/60',
    cardBg: 'bg-[#f7eed4]/70 dark:bg-surface-800/80',
    plaqueBg: 'bg-gradient-to-r from-[#fefbf3] via-[#f7eed4] to-[#fefbf3] dark:from-[#2a220e] dark:via-[#3d3114] dark:to-[#2a220e]',
    plaqueBorder: 'border-[#c59b27]/60',
    sealBg: 'from-[#fce08b] via-[#c59b27] to-[#8a621c]',
    sealInner: 'from-[#1a1405] to-[#0d0901]',
    ribbonGradient: 'from-[#1e40af] to-[#0f172a]',
    shadow: 'rgba(197, 155, 39, 0.35)',
    metallicGlow: 'rgba(197, 155, 39, 0.22)',
    goldFoil: 'from-[#fce08b] via-[#c59b27] to-[#8a621c]',
  },
  Platinum: {
    border: 'border-[#6366f1]',
    outerRing: 'ring-[#6366f1]/40',
    innerBorder: 'border-[#6366f1]/60',
    cornerBorder: 'border-[#6366f1]',
    bgContainer: 'bg-[#f6f7ff] dark:bg-[#0c0d1f]',
    accentText: 'text-[#4338ca] dark:text-[#a5b4fc]',
    accentBadge: 'bg-indigo-50 text-indigo-900 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700/60',
    cardBg: 'bg-indigo-50/70 dark:bg-surface-800/80',
    plaqueBg: 'bg-gradient-to-r from-indigo-50/80 via-indigo-100/60 to-indigo-50/80 dark:from-indigo-950/60 dark:via-surface-800 dark:to-indigo-950/60',
    plaqueBorder: 'border-indigo-300 dark:border-indigo-700/60',
    sealBg: 'from-indigo-300 via-indigo-500 to-indigo-700',
    sealInner: 'from-[#1e1b4b] to-[#0f0e26]',
    ribbonGradient: 'from-indigo-600 to-indigo-950',
    shadow: 'rgba(99, 102, 241, 0.35)',
    metallicGlow: 'rgba(99, 102, 241, 0.22)',
    goldFoil: 'from-indigo-400 via-indigo-200 to-indigo-600',
  },
  Diamond: {
    border: 'border-[#06b6d4]',
    outerRing: 'ring-[#06b6d4]/40',
    innerBorder: 'border-[#06b6d4]/60',
    cornerBorder: 'border-[#06b6d4]',
    bgContainer: 'bg-[#f0fcfd] dark:bg-[#03171d]',
    accentText: 'text-[#0e7490] dark:text-[#67e8f9]',
    accentBadge: 'bg-cyan-50 text-cyan-900 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-700/60',
    cardBg: 'bg-cyan-50/70 dark:bg-surface-800/80',
    plaqueBg: 'bg-gradient-to-r from-cyan-50/80 via-cyan-100/60 to-cyan-50/80 dark:from-cyan-950/60 dark:via-surface-800 dark:to-cyan-950/60',
    plaqueBorder: 'border-cyan-300 dark:border-cyan-700/60',
    sealBg: 'from-cyan-300 via-cyan-500 to-cyan-700',
    sealInner: 'from-[#083344] to-[#04151c]',
    ribbonGradient: 'from-cyan-600 to-cyan-950',
    shadow: 'rgba(6, 182, 212, 0.35)',
    metallicGlow: 'rgba(6, 182, 212, 0.22)',
    goldFoil: 'from-cyan-300 via-cyan-100 to-cyan-500',
  },
  Emerald: {
    border: 'border-[#059669]',
    outerRing: 'ring-[#059669]/40',
    innerBorder: 'border-[#059669]/60',
    cornerBorder: 'border-[#059669]',
    bgContainer: 'bg-[#f0fdf5] dark:bg-[#02180f]',
    accentText: 'text-[#065f46] dark:text-[#6ee7b7]',
    accentBadge: 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/60',
    cardBg: 'bg-emerald-50/70 dark:bg-surface-800/80',
    plaqueBg: 'bg-gradient-to-r from-emerald-50/80 via-emerald-100/60 to-emerald-50/80 dark:from-emerald-950/60 dark:via-surface-800 dark:to-emerald-950/60',
    plaqueBorder: 'border-emerald-300 dark:border-emerald-700/60',
    sealBg: 'from-emerald-300 via-emerald-500 to-emerald-800',
    sealInner: 'from-[#022c22] to-[#01140f]',
    ribbonGradient: 'from-emerald-700 to-emerald-950',
    shadow: 'rgba(5, 150, 105, 0.35)',
    metallicGlow: 'rgba(5, 150, 105, 0.22)',
    goldFoil: 'from-emerald-300 via-emerald-100 to-emerald-600',
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
  const shaTag = `SHA256:7F9A·88B2·C401·D9E5·33AA·0019·${certCode.replace(/[^A-Za-z0-9]/g, '').slice(-6)}`;
  
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

  function handleDownloadPDF() {
    downloadMilestoneCertificatePDF(certificate, clientName);
  }

  function handleTriggerPrint() {
    window.print();
  }

  return (
    <div className="space-y-4 w-full">
      {/* View Switcher: Certificate vs Section 2 Composition Information */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 dark:border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('certificate')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'certificate'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-surface-700 dark:text-white dark:border dark:border-white/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
            }`}
          >
            <FiAward className="w-4 h-4 text-amber-400" />
            <span>Official Diploma Canvas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('composition')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'composition'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-surface-700 dark:text-white dark:border dark:border-white/10'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-surface-800'
            }`}
          >
            <FiLayers className="w-4 h-4 text-emerald-500" />
            <span>Section 2 Composition Audit ({BATTERY_COMPOSITION_DATA.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-neutral-500">
            {certCode}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
            <FiCheckCircle className="w-3 h-3" />
            Verified
          </span>
        </div>
      </div>

      {/* Horizontal / Responsive Scroll Container */}
      {activeTab === 'certificate' ? (
        <div className="w-full">
          {/* Mobile Scroll Indicator Tip */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 px-1 pb-1 lg:hidden">
            <span className="flex items-center gap-1.5 font-medium">
              <span>↔ Scroll horizontally to inspect full high-resolution diploma layout</span>
            </span>
          </div>

          <div className="w-full overflow-x-auto pb-4 pt-1 custom-scrollbar touch-scroll">
            <div className="min-w-[800px] lg:min-w-0 max-w-[1020px] mx-auto">
              {/* ═══════════════════════════════════════════════════════════════════
                 CLASSIC & PRESTIGIOUS VECTOR CERTIFICATE CANVAS
                 ═══════════════════════════════════════════════════════════════════ */}
              <div
                ref={printRef}
                id="printable-certificate"
                className={`w-full relative rounded-2xl border-[8px] ${theme.border} ${theme.bgContainer} p-4 sm:p-7 md:p-8 text-center shadow-2xl transition-all flex flex-col justify-between`}
                style={{
                  boxShadow: `0 25px 60px -15px ${theme.shadow}, inset 0 0 50px ${theme.metallicGlow}`,
                  fontFamily: "'Cinzel', 'Cormorant Garamond', Georgia, serif",
                }}
              >
                {/* Ornate Guilloché / Intaglio Wave Security Background Pattern */}
                <div
                  className="absolute inset-0 opacity-[0.038] dark:opacity-[0.055] pointer-events-none rounded-xl"
                  style={{
                    backgroundImage: `radial-gradient(circle at 50% 50%, currentColor 1.2px, transparent 1.2px), repeating-linear-gradient(45deg, currentColor 0px, currentColor 0.7px, transparent 0.7px, transparent 18px), repeating-linear-gradient(-45deg, currentColor 0px, currentColor 0.7px, transparent 0.7px, transparent 18px)`,
                    backgroundSize: '24px 24px, 36px 36px, 36px 36px',
                  }}
                />

                {/* Verification Watermark Crest Centerpiece */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none flex items-center justify-center select-none">
                  <FiShield className="w-[480px] h-[480px]" />
                </div>

                {/* Inner Multi-Layer Architectural Frame */}
                <div className={`relative z-10 border-2 ${theme.innerBorder} rounded-xl p-6 sm:p-8 md:p-10 bg-white/95 dark:bg-surface-900/95 backdrop-blur-xs shadow-inner flex flex-col justify-between flex-1`}>
                  {/* Classical Ornate Corner Filigree Ornaments */}
                  <svg className={`absolute top-2.5 left-2.5 w-10 h-10 ${theme.accentText} pointer-events-none opacity-75`} viewBox="0 0 40 40" fill="none" stroke="currentColor">
                    <path d="M 2 38 L 2 6 C 2 3.8 3.8 2 6 2 L 38 2" strokeWidth="2.5" />
                    <path d="M 6 38 L 6 10 C 6 7.8 7.8 6 10 6 L 38 6" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="10" cy="10" r="2.5" fill="currentColor" />
                    <path d="M 2 18 L 18 2" strokeWidth="1" />
                  </svg>
                  <svg className={`absolute top-2.5 right-2.5 w-10 h-10 ${theme.accentText} pointer-events-none opacity-75`} viewBox="0 0 40 40" fill="none" stroke="currentColor">
                    <path d="M 38 38 L 38 6 C 38 3.8 36.2 2 34 2 L 2 2" strokeWidth="2.5" />
                    <path d="M 34 38 L 34 10 C 34 7.8 32.2 6 30 6 L 2 6" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="30" cy="10" r="2.5" fill="currentColor" />
                    <path d="M 38 18 L 22 2" strokeWidth="1" />
                  </svg>
                  <svg className={`absolute bottom-2.5 left-2.5 w-10 h-10 ${theme.accentText} pointer-events-none opacity-75`} viewBox="0 0 40 40" fill="none" stroke="currentColor">
                    <path d="M 2 2 L 2 34 C 2 36.2 3.8 38 6 38 L 38 38" strokeWidth="2.5" />
                    <path d="M 6 2 L 6 30 C 6 32.2 7.8 34 10 34 L 38 34" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="10" cy="30" r="2.5" fill="currentColor" />
                    <path d="M 2 22 L 18 38" strokeWidth="1" />
                  </svg>
                  <svg className={`absolute bottom-2.5 right-2.5 w-10 h-10 ${theme.accentText} pointer-events-none opacity-75`} viewBox="0 0 40 40" fill="none" stroke="currentColor">
                    <path d="M 38 2 L 38 34 C 38 36.2 36.2 38 34 38 L 2 38" strokeWidth="2.5" />
                    <path d="M 34 2 L 34 30 C 34 32.2 32.2 34 30 34 L 2 34" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="30" cy="30" r="2.5" fill="currentColor" />
                    <path d="M 38 22 L 22 38" strokeWidth="1" />
                  </svg>

                  {/* 1. Header & Registry Crest */}
                  <div className="flex flex-row items-center justify-between border-b border-slate-200/90 dark:border-white/10 pb-4 gap-3">
                    <div className="flex items-center gap-3 text-left">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.accentBadge} shadow-xs shrink-0 ring-1 ring-black/5`}>
                        <FiShield className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-serif font-black text-sm sm:text-base tracking-[0.22em] uppercase text-slate-900 dark:text-white block">
                          Refurbnics International
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-neutral-400 font-bold uppercase tracking-[0.16em] block">
                          Global Battery Decarbonization Registry • ISO 14001:2015
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full ${theme.accentBadge} font-extrabold text-[11px] tracking-widest uppercase border shadow-xs`}>
                        <FiAward className="w-4 h-4" />
                        <span>{tier.badge} Tier Accreditation</span>
                      </span>
                    </div>
                  </div>

                  {/* 2. Certificate Title & Classical Presentation */}
                  <div className="pt-4 pb-2 space-y-2">
                    <span className={`text-xs sm:text-sm font-serif italic ${theme.accentText} uppercase tracking-[0.20em] block font-bold`}>
                      Official {tier.badge} Certificate of Environmental Leadership & Closed-Loop Decarbonization
                    </span>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-slate-900 dark:text-white tracking-wide uppercase leading-tight">
                      Sustainability & Circular Economy Achievement
                    </h1>

                    {/* Classical Ornate Divider */}
                    <div className="flex items-center justify-center gap-3 py-1.5 max-w-xl mx-auto">
                      <div className="h-[1.5px] flex-1 bg-gradient-to-r from-transparent via-slate-400/80 to-slate-400 dark:via-white/30 dark:to-white/40" />
                      <div className="flex items-center gap-2 text-slate-500 dark:text-neutral-400">
                        <span className="w-1.5 h-1.5 rotate-45 border border-current" />
                        <span className="w-2.5 h-2.5 rotate-45 bg-current shadow-xs" />
                        <span className="w-1.5 h-1.5 rotate-45 border border-current" />
                      </div>
                      <div className="h-[1.5px] flex-1 bg-gradient-to-l from-transparent via-slate-400/80 to-slate-400 dark:via-white/30 dark:to-white/40" />
                    </div>

                    <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 italic font-serif pt-1">
                      By virtue of verified excellence in industrial zero-waste stewardship, this official accreditation is conferred upon
                    </p>
                  </div>

                  {/* 3. Recipient Enterprise Plaque */}
                  <div className="my-4 flex justify-center">
                    <div className={`py-4 sm:py-5 px-8 sm:px-16 rounded-2xl ${theme.plaqueBg} border-2 ${theme.plaqueBorder} shadow-md inline-block max-w-full text-center relative`}>
                      <div className="absolute top-1.5 left-2 w-2.5 h-2.5 border-t border-l border-current opacity-30" />
                      <div className="absolute top-1.5 right-2 w-2.5 h-2.5 border-t border-r border-current opacity-30" />
                      <div className="absolute bottom-1.5 left-2 w-2.5 h-2.5 border-b border-l border-current opacity-30" />
                      <div className="absolute bottom-1.5 right-2 w-2.5 h-2.5 border-b border-r border-current opacity-30" />

                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-slate-950 dark:text-white tracking-[0.16em] uppercase">
                        {certClient}
                      </h2>
                      <div className="mt-2 flex items-center justify-center gap-2.5 text-[10.5px] font-sans font-bold uppercase tracking-widest text-slate-600 dark:text-neutral-300">
                        <span>Verified Enterprise Partner</span>
                        <span className="opacity-40">•</span>
                        <span className="font-mono">{certCode}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Certified ESG Impact Metrics Plaque Trio */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4 max-w-4xl mx-auto w-full">
                    {/* Metric 1: Modules Recommissioned */}
                    <div className={`p-4 rounded-xl border ${theme.innerBorder} ${theme.cardBg} flex items-center gap-3.5 text-left shadow-2xs`}>
                      <div className={`w-11 h-11 rounded-xl ${theme.accentBadge} flex items-center justify-center shrink-0 shadow-xs ring-1 ring-black/5`}>
                        <FiZap className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 font-sans">
                          Recommissioned
                        </div>
                        <div className="text-lg sm:text-xl font-serif font-black text-slate-900 dark:text-white leading-tight">
                          {count.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-500 dark:text-neutral-400">Packs</span>
                        </div>
                        <div className="text-[9.5px] text-slate-500 dark:text-neutral-400 truncate font-sans">
                          100% Closed-Loop Certified
                        </div>
                      </div>
                    </div>

                    {/* Metric 2: Carbon Abatement */}
                    <div className={`p-4 rounded-xl border ${theme.innerBorder} ${theme.cardBg} flex items-center gap-3.5 text-left shadow-2xs`}>
                      <div className={`w-11 h-11 rounded-xl ${theme.accentBadge} flex items-center justify-center shrink-0 shadow-xs ring-1 ring-black/5`}>
                        <FiGlobe className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 font-sans">
                          Carbon Abated
                        </div>
                        <div className="text-lg sm:text-xl font-serif font-black text-slate-900 dark:text-white leading-tight">
                          ~{co2Tons} <span className="text-xs font-sans font-bold text-slate-500 dark:text-neutral-400">t CO₂e</span>
                        </div>
                        <div className="text-[9.5px] text-slate-500 dark:text-neutral-400 truncate font-sans">
                          GHG Emissions Avoided
                        </div>
                      </div>
                    </div>

                    {/* Metric 3: Critical Metals Diverted */}
                    <div className={`p-4 rounded-xl border ${theme.innerBorder} ${theme.cardBg} flex items-center gap-3.5 text-left shadow-2xs`}>
                      <div className={`w-11 h-11 rounded-xl ${theme.accentBadge} flex items-center justify-center shrink-0 shadow-xs ring-1 ring-black/5`}>
                        <FiLayers className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 font-sans">
                          Circular Mass
                        </div>
                        <div className="text-lg sm:text-xl font-serif font-black text-slate-900 dark:text-white leading-tight">
                          ~{ewasteKg} <span className="text-xs font-sans font-bold text-slate-500 dark:text-neutral-400">kg</span>
                        </div>
                        <div className="text-[9.5px] text-slate-500 dark:text-neutral-400 truncate font-sans">
                          Cathode & Mineral Salvage
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Formal Citation Body */}
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-neutral-300 max-w-3xl mx-auto leading-relaxed font-serif my-4 px-4">
                    For exceptional leadership in decarbonized urban mobility and zero-waste battery lifecycle governance. By reaching the <strong className="text-slate-900 dark:text-white font-bold">{tier.badge} milestone threshold</strong> and restoring, testing, and re-commissioning <strong className="text-slate-950 dark:text-white font-extrabold">{count.toLocaleString()} high-voltage battery modules</strong>, your enterprise has directly mitigated hazardous lithium contamination, extended valuable cell life, and significantly reduced global greenhouse emissions.
                  </p>

                  {/* 6. Footer Section: CEO Signature on Left, Rosette Medallion on Right */}
                  <div className="w-full max-w-4xl mx-auto pt-8 mt-5 pb-5 border-t border-slate-200/90 dark:border-white/10 flex flex-row items-center justify-between px-6 sm:px-12 text-left">
                    {/* Left: CEO of Refurbnics Signature Block */}
                    <div className="text-left flex flex-col items-start min-w-[240px]">
                      {/* Realistic Vector Handwritten Signature Stroke */}
                      <div className="h-14 flex items-center justify-start">
                        <svg viewBox="0 0 240 56" className="w-56 h-13 text-slate-800 dark:text-neutral-200" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M 14 38 C 18 16, 26 8, 36 12 C 44 16, 36 44, 28 46 C 20 48, 24 32, 38 24 C 52 16, 68 28, 82 26 C 96 24, 98 38, 112 34 C 124 30, 138 18, 148 24 C 158 30, 152 42, 166 38 C 180 34, 194 20, 212 22 C 222 24, 230 32, 236 30 M 34 28 Q 70 24, 105 22 M 140 32 Q 175 28, 220 25"
                            stroke="currentColor"
                            strokeWidth="2.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="border-b-2 border-slate-300 dark:border-white/25 w-64 pb-1 text-left relative">
                        <span className="font-serif font-bold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-[0.14em] block whitespace-nowrap">
                          Chief Executive Officer
                        </span>
                        <span className="absolute -bottom-1 right-0 w-1.5 h-1.5 rotate-45 bg-slate-400 dark:bg-white/40" />
                      </div>
                      <span className="text-[11px] text-slate-600 dark:text-neutral-300 uppercase tracking-wider block mt-1 font-sans font-bold">
                        Refurbnics International Ltd
                      </span>
                    </div>

                    {/* Right: 3D Starburst Rosette Medallion with Silk Ribbon Tails */}
                    <div className="relative flex flex-col items-center justify-center shrink-0 min-w-[120px] pb-1">
                      {/* Silk Ribbon Tails - Compact & Contained */}
                      <div className="absolute top-7 flex gap-2.5 pointer-events-none">
                        <div
                          className={`w-4.5 h-11 bg-gradient-to-b ${theme.ribbonGradient} shadow-md transform -rotate-12`}
                          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 82%, 0% 100%)' }}
                        />
                        <div
                          className={`w-4.5 h-11 bg-gradient-to-b ${theme.ribbonGradient} shadow-md transform rotate-12`}
                          style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 82%, 0% 100%)' }}
                        />
                      </div>

                      {/* Rosette Starburst Medallion */}
                      <div className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${theme.sealBg} text-white shadow-xl ring-2 ${theme.border}`}>
                        {/* Metallic Concentric Edge Rings */}
                        <svg className="absolute inset-0 w-full h-full text-white/30 pointer-events-none" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="0.75" />
                        </svg>

                        {/* Inner Concentric Golden Rim */}
                        <div className={`flex h-15 w-15 items-center justify-center rounded-full border-2 border-white/50 bg-gradient-to-br ${theme.sealInner} text-center p-1.5 shadow-inner`}>
                          <div className="text-center flex flex-col items-center justify-center">
                            <span className="text-[7.5px] font-black tracking-widest text-amber-200 uppercase block leading-none">
                              REFURBNICS
                            </span>
                            <FiShield className="w-4 h-4 text-amber-300 mx-auto my-0.5" />
                            <span className="text-[6.5px] font-black text-white/95 uppercase tracking-wider block leading-none">
                              OFFICIAL SEAL
                            </span>
                            <span className="text-[6px] font-bold text-amber-200/90 uppercase tracking-tighter block leading-none mt-0.5">
                              {tier.badge} TIER
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 7. Bottom Security Registry Line & SHA-256 Hash Tag */}
                  <div className="pt-3 mt-2 border-t border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 dark:text-neutral-500 font-mono gap-1.5">
                    <span>REGISTRY ID: {certCode}</span>
                    <span className="text-slate-500 dark:text-neutral-400 font-bold">{shaTag}</span>
                    <span>TIER: {tier.badge.toUpperCase()} • 100% CLOSED-LOOP COMPLIANT</span>
                  </div>
                </div>
              </div>
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

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 dark:bg-surface-800 dark:border-white/10">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold text-slate-700 dark:text-neutral-300">
                    Chemical Composition
                  </th>
                  <th className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-neutral-300">
                    Chemical Formula
                  </th>
                  <th className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-neutral-300">
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
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
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

      {/* Scoped CSS for Standard A4 Landscape Physical Printing */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-certificate, #printable-certificate * {
            visibility: visible !important;
          }
          #printable-certificate {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            min-width: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            border-radius: 4px !important;
            aspect-ratio: 1.414 / 1 !important;
            overflow: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}

export default CertificateView;
