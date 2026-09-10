import { useRef } from 'react';
import { FiAward, FiPrinter, FiDownload, FiShield } from 'react-icons/fi';
import logoUrl from '../../assets/Refurbnics.png';
import { downloadMilestoneCertificatePDF, getTierForCertificate } from '../../utils/generate-milestone-certificate';

const UI_THEMES = {
  Bronze: {
    border: 'border-[#cd7f32]',
    innerBorder: 'border-[#cd7f32]/60',
    cornerBorder: 'border-[#cd7f32]',
    bgContainer: 'bg-[#fdf7f2] dark:bg-[#15110d]',
    accentText: 'text-[#8c4a16] dark:text-[#f39c55]',
    badgeBg: 'bg-[#faebd7] text-[#8c4a16] border-[#cd7f32]/40 dark:bg-amber-950/70 dark:text-amber-300',
    cardGradient: 'from-[#faebd7]/70 via-white to-[#faebd7]/40 dark:from-surface-850 dark:to-surface-850',
    sealBg: 'from-[#e4a065] via-[#cd7f32] to-[#8c4a16]',
    sealInner: 'from-[#6e350c] to-[#3a1b05]',
    ribbonGradient: 'from-[#cd7f32] to-[#6e350c]',
    shadow: 'rgba(205, 127, 50, 0.25)',
  },
  Silver: {
    border: 'border-[#94a3b8]',
    innerBorder: 'border-[#94a3b8]/60',
    cornerBorder: 'border-[#94a3b8]',
    bgContainer: 'bg-[#f8fafc] dark:bg-[#0f172a]',
    accentText: 'text-[#334155] dark:text-[#cbd5e1]',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200',
    cardGradient: 'from-slate-100/70 via-white to-slate-100/40 dark:from-surface-850 dark:to-surface-850',
    sealBg: 'from-slate-200 via-slate-400 to-slate-600',
    sealInner: 'from-slate-700 to-slate-900',
    ribbonGradient: 'from-slate-500 to-slate-800',
    shadow: 'rgba(148, 163, 184, 0.25)',
  },
  Gold: {
    border: 'border-[#b8862d]',
    innerBorder: 'border-[#b8862d]/60',
    cornerBorder: 'border-[#b8862d]',
    bgContainer: 'bg-[#fdfbf7] dark:bg-[#0f131a]',
    accentText: 'text-[#8a621c] dark:text-amber-300',
    badgeBg: 'bg-[#fbf5e8] text-[#8a621c] border-[#b8862d]/50 dark:bg-amber-950/70 dark:text-amber-300',
    cardGradient: 'from-[#fbf5e8]/70 via-[#f0f9f4]/90 to-[#edf4fc]/70 dark:from-surface-850 dark:via-surface-800 dark:to-surface-850',
    sealBg: 'from-[#e0b96c] via-[#b8862d] to-[#8a621c]',
    sealInner: 'from-[#0a442a] to-[#042013]',
    ribbonGradient: 'from-[#1a4b8c] to-[#10305c]',
    shadow: 'rgba(184, 134, 45, 0.25)',
  },
  Platinum: {
    border: 'border-[#6366f1]',
    innerBorder: 'border-[#6366f1]/60',
    cornerBorder: 'border-[#6366f1]',
    bgContainer: 'bg-[#f8f9ff] dark:bg-[#0f1123]',
    accentText: 'text-[#4338ca] dark:text-[#a5b4fc]',
    badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300',
    cardGradient: 'from-indigo-50/70 via-white to-indigo-50/40 dark:from-surface-850 dark:to-surface-850',
    sealBg: 'from-indigo-300 via-indigo-500 to-indigo-700',
    sealInner: 'from-[#1e1b4b] to-[#0f0e26]',
    ribbonGradient: 'from-indigo-600 to-indigo-950',
    shadow: 'rgba(99, 102, 241, 0.25)',
  },
  Diamond: {
    border: 'border-[#06b6d4]',
    innerBorder: 'border-[#06b6d4]/60',
    cornerBorder: 'border-[#06b6d4]',
    bgContainer: 'bg-[#f0fdfa] dark:bg-[#041d24]',
    accentText: 'text-[#0e7490] dark:text-[#67e8f9]',
    badgeBg: 'bg-cyan-50 text-cyan-900 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-300',
    cardGradient: 'from-cyan-50/70 via-white to-cyan-50/40 dark:from-surface-850 dark:to-surface-850',
    sealBg: 'from-cyan-300 via-cyan-500 to-cyan-700',
    sealInner: 'from-[#083344] to-[#04151c]',
    ribbonGradient: 'from-cyan-600 to-cyan-950',
    shadow: 'rgba(6, 182, 212, 0.25)',
  },
  Emerald: {
    border: 'border-[#059669]',
    innerBorder: 'border-[#059669]/60',
    cornerBorder: 'border-[#059669]',
    bgContainer: 'bg-[#f0fdf4] dark:bg-[#031d13]',
    accentText: 'text-[#065f46] dark:text-[#6ee7b7]',
    badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300',
    cardGradient: 'from-emerald-50/70 via-white to-emerald-50/40 dark:from-surface-850 dark:to-surface-850',
    sealBg: 'from-emerald-300 via-emerald-500 to-emerald-800',
    sealInner: 'from-[#022c22] to-[#01140f]',
    ribbonGradient: 'from-emerald-700 to-emerald-950',
    shadow: 'rgba(5, 150, 105, 0.25)',
  },
};

function CertificateView({ certificate, clientName, showActions = true }) {
  const printRef = useRef(null);

  if (!certificate) return null;

  const tier = getTierForCertificate(certificate);
  const theme = UI_THEMES[tier.badge] || UI_THEMES.Gold;

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

  function handleDownloadPDF() {
    downloadMilestoneCertificatePDF(certificate, clientName);
  }

  function handleTriggerPrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* Certificate Frame - Dynamic Tier Themed */}
      <div
        ref={printRef}
        id="printable-certificate"
        className={`relative overflow-hidden rounded-2xl border-[6px] ${theme.border} ${theme.bgContainer} p-5 sm:p-9 text-center shadow-2xl`}
        style={{
          boxShadow: `0 25px 50px -12px ${theme.shadow}, inset 0 0 40px ${theme.shadow}`,
        }}
      >
        {/* Subtle Security Inlay Pattern */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, currentColor 1px, transparent 1px), linear-gradient(45deg, currentColor 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px, 48px 48px',
          }}
        />

        {/* Crest Watermark */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none flex items-center justify-center select-none">
          <FiAward className="w-[480px] h-[480px]" />
        </div>

        {/* Inner Triple Border */}
        <div className={`relative z-10 border-2 ${theme.innerBorder} rounded-xl p-5 sm:p-8 bg-white/90 backdrop-blur-xs dark:bg-surface-900/95 shadow-inner`}>
          {/* Ornate Corner Accents */}
          <div className={`absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 ${theme.cornerBorder}`} />
          <div className={`absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 ${theme.cornerBorder}`} />
          <div className={`absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 ${theme.cornerBorder}`} />
          <div className={`absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 ${theme.cornerBorder}`} />

          {/* Header & Crest */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-4 gap-3">
            <div className="flex items-center gap-3 text-left">
              <img src={logoUrl} alt="Refurbnics" className="h-10 w-auto object-contain filter drop-shadow-2xs" />
              <div>
                <span className="font-serif font-black text-sm tracking-[0.2em] uppercase text-slate-900 dark:text-white block">
                  Refurbnics International
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-bold uppercase tracking-[0.15em] block">
                  {tier.badge} Tier • Circular Decarbonization Registry
                </span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full ${theme.badgeBg} font-extrabold text-[10.5px] tracking-widest uppercase border shadow-xs`}>
                <FiAward className="w-3.5 h-3.5" />
                <span>{tier.badge} Accreditation</span>
              </span>
            </div>
          </div>

          {/* Certificate Title & Presentation */}
          <div className="py-6 space-y-2">
            <span className={`text-[12px] font-serif italic ${theme.accentText} uppercase tracking-widest block font-bold`}>
              Official {tier.badge} Certificate of Environmental Leadership
            </span>
            <h1 className="text-xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white tracking-tight uppercase leading-tight">
              Sustainability & Circular Economy Achievement
            </h1>

            {/* Decorative Center Line */}
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="h-[1.5px] w-28 sm:w-44 bg-gradient-to-r from-transparent via-slate-400 to-slate-400 dark:via-white/30 dark:to-white/30" />
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-white/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-600 dark:bg-white/80 ring-2 ring-slate-300" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-white/50" />
              </div>
              <div className="h-[1.5px] w-28 sm:w-44 bg-gradient-to-l from-transparent via-slate-400 to-slate-400 dark:via-white/30 dark:to-white/30" />
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 italic font-serif pt-1">
              This distinguished {tier.badge} milestone accreditation is solemnly presented to
            </p>
          </div>

          {/* Recipient Enterprise Plaque */}
          <div className={`my-2 py-3.5 px-8 sm:px-12 rounded-xl bg-gradient-to-r ${theme.cardGradient} border-2 ${theme.innerBorder} inline-block max-w-full shadow-xs`}>
            <h2 className="text-xl sm:text-3xl font-serif font-black text-slate-950 dark:text-white tracking-[0.12em] uppercase">
              {certClient}
            </h2>
          </div>

          {/* Citation Body */}
          <p className="text-xs sm:text-sm text-slate-700 dark:text-neutral-300 max-w-2xl mx-auto leading-relaxed my-5 font-serif">
            For exceptional dedication to decarbonized urban mobility, industrial zero-waste standards, and circular lifecycle excellence. Through reaching the {tier.badge} tier and restoring, testing, and recertifying{' '}
            <strong className="text-slate-950 dark:text-white font-extrabold">{count.toLocaleString()} high-voltage battery packs</strong>, your enterprise has successfully diverted hazardous lithium waste and substantially reduced global greenhouse emissions.
          </p>

          {/* 3 Metric Impact Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-6">
            <div className="p-3.5 rounded-xl bg-[#ecfdf5] border-2 border-emerald-500/40 text-center dark:bg-emerald-950/40 dark:border-emerald-800/40 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block font-sans">
                CO₂ Emissions Saved
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#0a442a] dark:text-emerald-200 mt-0.5 block font-serif">
                ~{co2Tons} Tons
              </span>
              <span className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium">
                Decarbonization Impact
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#eff6ff] border-2 border-blue-500/40 text-center dark:bg-blue-950/40 dark:border-blue-800/40 shadow-xs">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block font-sans">
                E-Waste Diverted
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#10305c] dark:text-blue-200 mt-0.5 block font-serif">
                {ewasteKg} kg
              </span>
              <span className="text-[10.5px] text-blue-700 dark:text-blue-400 font-medium">
                Landfill Toxic Avoidance
              </span>
            </div>

            <div className={`p-3.5 rounded-xl bg-slate-50 border-2 ${theme.innerBorder} text-center dark:bg-surface-850 shadow-xs`}>
              <span className={`text-[10px] font-bold ${theme.accentText} uppercase tracking-wider block font-sans`}>
                {tier.badge} Milestone
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 block font-serif">
                {count.toLocaleString()} Units
              </span>
              <span className="text-[10.5px] text-slate-500 dark:text-neutral-400 font-medium">
                Circular Fleet Life-Extension
              </span>
            </div>
          </div>

          {/* Footer Section: Dual Signatures & Rosette Medallion with Ribbon Tails */}
          <div className="relative pt-6 mt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
            {/* Left Executive Signature */}
            <div className="text-center sm:text-left flex-1">
              <div className="font-serif italic font-bold text-slate-800 dark:text-neutral-200 text-lg border-b border-slate-300 pb-1 dark:border-white/20 inline-block w-48 text-center">
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
            <div className="relative flex flex-col items-center justify-center my-2 sm:my-0">
              {/* Ribbon Tails */}
              <div className="absolute top-8 flex gap-2 pointer-events-none">
                <div
                  className={`w-4 h-9 bg-gradient-to-b ${theme.ribbonGradient} shadow-md transform -rotate-12`}
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                />
                <div
                  className={`w-4 h-9 bg-gradient-to-b ${theme.ribbonGradient} shadow-md transform rotate-12`}
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                />
              </div>

              {/* Rosette Starburst */}
              <div className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${theme.sealBg} text-white shadow-xl ring-4 ring-slate-400/20`}>
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
              <div className="font-serif italic font-bold text-slate-800 dark:text-neutral-200 text-lg border-b border-slate-300 pb-1 dark:border-white/20 inline-block w-48 text-center">
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

          {/* Bottom Security Registry Line */}
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 dark:text-neutral-500 font-mono">
            <span>REGISTRY ID: {certCode}</span>
            <span>TIER: {tier.badge.toUpperCase()} • TAMPER-EVIDENT ESG RECORD</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleTriggerPrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer transition-colors"
          >
            <FiPrinter className="w-4 h-4" />
            <span>Print Certificate</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-emerald-700 hover:to-teal-700 cursor-pointer transition-all"
          >
            <FiDownload className="w-4 h-4" />
            <span>Download {tier.badge} PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CertificateView;
