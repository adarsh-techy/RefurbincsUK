import { useRef } from 'react';
import { FiAward, FiPrinter, FiDownload, FiGlobe, FiShield, FiCheckCircle } from 'react-icons/fi';
import logoUrl from '../../assets/Refurbnics.png';
import { downloadMilestoneCertificatePDF } from '../../utils/generate-milestone-certificate';

function CertificateView({ certificate, clientName, onPrint, showActions = true }) {
  const printRef = useRef(null);

  if (!certificate) return null;

  const count = Number(certificate.milestone_count || 1000);
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
      {/* Certificate Frame - Royal Classic Diploma & Sustainability Award */}
      <div
        ref={printRef}
        id="printable-certificate"
        className="relative overflow-hidden rounded-2xl border-[6px] border-[#b8862d] bg-[#fdfbf7] p-5 sm:p-9 text-center shadow-2xl dark:border-[#b8862d] dark:bg-[#0f131a]"
        style={{
          boxShadow: '0 25px 50px -12px rgba(184, 134, 45, 0.25), inset 0 0 40px rgba(184, 134, 45, 0.08)',
        }}
      >
        {/* Subtle Guilloche Security Pattern Inlay */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, #b8862d 1px, transparent 1px), linear-gradient(45deg, #b8862d 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px, 48px 48px',
          }}
        />

        {/* Large Faint Crest Watermark in Background */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none flex items-center justify-center select-none">
          <FiAward className="w-[480px] h-[480px] text-[#b8862d]" />
        </div>

        {/* Inner Triple Classical Border */}
        <div className="relative z-10 border-2 border-[#b8862d]/60 rounded-xl p-5 sm:p-8 bg-white/90 backdrop-blur-xs dark:bg-surface-900/95 shadow-inner">
          {/* Ornate Corner Accents */}
          <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#b8862d]" />
          <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#b8862d]" />
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#b8862d]" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#b8862d]" />

          {/* Header & Imperial Crest */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#b8862d]/40 pb-4 gap-3">
            <div className="flex items-center gap-3 text-left">
              <img src={logoUrl} alt="Refurbnics" className="h-10 w-auto object-contain filter drop-shadow-2xs" />
              <div>
                <span className="font-serif font-black text-sm tracking-[0.2em] uppercase text-[#0a442a] dark:text-emerald-400 block">
                  Refurbnics International
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-bold uppercase tracking-[0.15em] block">
                  Circular Battery Logistics & Decarbonization Registry
                </span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#fbf5e8] text-[#8a621c] dark:bg-amber-950/70 dark:text-amber-300 font-extrabold text-[10.5px] tracking-widest uppercase border border-[#b8862d]/50 shadow-xs">
                <FiAward className="w-3.5 h-3.5 text-[#b8862d]" />
                <span>Official ESG Accreditation</span>
              </span>
            </div>
          </div>

          {/* Certificate Title & Presentation */}
          <div className="py-6 space-y-2">
            <span className="text-[12px] font-serif italic text-[#8a621c] dark:text-amber-400 uppercase tracking-widest block">
              Official Certificate of Environmental Leadership
            </span>
            <h1 className="text-xl sm:text-3xl font-serif font-black text-slate-900 dark:text-white tracking-tight uppercase leading-tight">
              Sustainability & Circular Economy Achievement
            </h1>

            {/* Decorative Gold Center Line */}
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="h-[1.5px] w-28 sm:w-44 bg-gradient-to-r from-transparent via-[#b8862d] to-[#b8862d]" />
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b8862d]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#b8862d] ring-2 ring-[#e0b96c]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#b8862d]" />
              </div>
              <div className="h-[1.5px] w-28 sm:w-44 bg-gradient-to-l from-transparent via-[#b8862d] to-[#b8862d]" />
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 italic font-serif pt-1">
              This distinguished milestone accreditation is solemnly presented to
            </p>
          </div>

          {/* Recipient Enterprise Name Plaque */}
          <div className="my-2 py-3.5 px-8 sm:px-12 rounded-xl bg-gradient-to-r from-[#fbf5e8]/70 via-[#f0f9f4]/90 to-[#edf4fc]/70 border-2 border-[#b8862d]/60 dark:from-surface-850 dark:via-surface-800 dark:to-surface-850 inline-block max-w-full shadow-xs">
            <h2 className="text-xl sm:text-3xl font-serif font-black text-[#0a442a] dark:text-emerald-300 tracking-[0.12em] uppercase">
              {certClient}
            </h2>
          </div>

          {/* Formal Citation Text */}
          <p className="text-xs sm:text-sm text-slate-700 dark:text-neutral-300 max-w-2xl mx-auto leading-relaxed my-5 font-serif">
            For exceptional dedication to decarbonized urban mobility, industrial zero-waste standards, and circular lifecycle excellence. Through authorized collaboration with Refurbnics to restore, test, and recertify{' '}
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
                Industrial Decarbonization Impact
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

            <div className="p-3.5 rounded-xl bg-[#fefce8] border-2 border-amber-500/40 text-center dark:bg-amber-950/40 dark:border-amber-800/40 shadow-xs">
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block font-sans">
                Batteries Restored
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#8a621c] dark:text-amber-200 mt-0.5 block font-serif">
                {count.toLocaleString()} Units
              </span>
              <span className="text-[10.5px] text-amber-700 dark:text-amber-400 font-medium">
                Circular Fleet Life-Extension
              </span>
            </div>
          </div>

          {/* Footer Section: Dual Signatures & Gold Foil Medallion with Ribbon Tails */}
          <div className="relative pt-6 mt-4 border-t border-[#b8862d]/30 flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
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

            {/* Center Gold Foil Embossed Seal with Ribbon Tails */}
            <div className="relative flex flex-col items-center justify-center my-2 sm:my-0">
              {/* Ribbon Tails */}
              <div className="absolute top-8 flex gap-2 pointer-events-none">
                <div
                  className="w-4 h-9 bg-gradient-to-b from-[#1a4b8c] to-[#10305c] shadow-md transform -rotate-12"
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                />
                <div
                  className="w-4 h-9 bg-gradient-to-b from-[#1a4b8c] to-[#10305c] shadow-md transform rotate-12"
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                />
              </div>

              {/* Rosette Starburst Outer */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#e0b96c] via-[#b8862d] to-[#8a621c] text-white shadow-xl ring-4 ring-[#b8862d]/30">
                <div className="flex h-13 w-13 items-center justify-center rounded-full border border-[#fbf5e8]/80 bg-gradient-to-br from-[#0a442a] to-[#042013] text-center p-1 shadow-inner">
                  <div className="text-center">
                    <span className="text-[6px] font-black tracking-widest text-[#e0b96c] uppercase block">
                      OFFICIAL
                    </span>
                    <FiShield className="w-4 h-4 text-[#e0b96c] mx-auto my-0.5" />
                    <span className="text-[5px] font-black text-white uppercase tracking-wider block">
                      VERIFIED
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Executive Signature & Verification Info */}
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

          {/* Bottom Security Registry Code */}
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 dark:text-neutral-500 font-mono">
            <span>REGISTRY ID: {certCode}</span>
            <span>OFFICIAL TAMPER-EVIDENT SUSTAINABILITY RECORD</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
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
            <span>Download Official PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CertificateView;
