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
  const certClient = (certificate.client_name || clientName || 'Valued Partner').toUpperCase();
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
      {/* Certificate Frame - Classic Official Diplomatic Look */}
      <div
        ref={printRef}
        id="printable-certificate"
        className="relative overflow-hidden rounded-2xl border-[5px] border-double border-amber-600/70 bg-[#fdfcf7] p-5 sm:p-8 text-center shadow-2xl dark:border-amber-500/60 dark:bg-[#131720]"
      >
        {/* Background Watermark Crest */}
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.04] pointer-events-none flex items-center justify-center select-none">
          <FiAward className="w-[420px] h-[420px] text-amber-950 dark:text-amber-200" />
        </div>

        {/* Certificate Inner Ornate Border */}
        <div className="relative z-10 border-2 border-amber-500/40 rounded-xl p-5 sm:p-7 bg-white/85 backdrop-blur-xs dark:bg-surface-900/90 shadow-xs">
          {/* Header & Crest */}
          <div className="flex items-center justify-between border-b border-amber-300/60 pb-4 dark:border-white/10">
            <div className="flex items-center gap-3 text-left">
              <img src={logoUrl} alt="Refurbnics" className="h-9 w-auto object-contain" />
              <div>
                <span className="font-black text-xs tracking-wider uppercase text-emerald-900 dark:text-emerald-400 block font-serif">
                  Refurbnics
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-bold block uppercase tracking-wider">
                  Circular Logistics & Battery Engineering
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 font-extrabold text-[10px] tracking-widest uppercase border border-amber-300 dark:border-amber-700 shadow-2xs">
                <FiAward className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Official Accreditation</span>
              </span>
            </div>
          </div>

          {/* Certificate Main Title */}
          <div className="py-5 space-y-1.5">
            <span className="text-[11px] font-black tracking-widest text-amber-700 dark:text-amber-400 uppercase font-serif">
              Certificate of Environmental Stewardship
            </span>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-serif uppercase">
              {certificate.title || `Sustainability & Circular Economy Milestone`}
            </h1>
            <p className="text-xs text-slate-500 dark:text-neutral-400 italic pt-1 font-serif">
              This distinguished recognition is officially presented with honor to
            </p>
          </div>

          {/* Client Recipient Name Box */}
          <div className="my-2 py-3 px-8 rounded-xl bg-gradient-to-r from-amber-50 via-emerald-50/60 to-blue-50 border border-amber-300/80 dark:border-white/10 dark:from-surface-850 dark:via-surface-800 dark:to-surface-850 inline-block max-w-full shadow-2xs">
            <h2 className="text-lg sm:text-2xl font-black text-emerald-950 dark:text-emerald-300 tracking-wider uppercase font-serif">
              {certClient}
            </h2>
          </div>

          {/* Citation Body */}
          <p className="text-xs sm:text-sm text-slate-700 dark:text-neutral-300 max-w-2xl mx-auto leading-relaxed my-4 font-serif">
            In recognition of outstanding dedication to zero-emission mobility, circular lifecycle management, and hazardous waste reduction. Through partnering with Refurbnics to restore{' '}
            <strong className="text-slate-950 dark:text-white font-extrabold">{count.toLocaleString()} high-voltage battery packs</strong>, your organization has actively diverted lithium toxic materials and preserved crucial earth elements.
          </p>

          {/* Eco Impact Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-6">
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center dark:bg-emerald-950/40 dark:border-emerald-900/40 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block font-sans">
                CO₂ Emissions Saved
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-900 dark:text-emerald-200 mt-0.5 block font-serif">
                ~{co2Tons} Tons
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Decarbonization Impact
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-center dark:bg-blue-950/40 dark:border-blue-900/40 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block font-sans">
                E-Waste Diverted
              </span>
              <span className="text-lg sm:text-xl font-black text-blue-900 dark:text-blue-200 mt-0.5 block font-serif">
                {ewasteKg} kg
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                Landfill Toxic Avoidance
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-center dark:bg-amber-950/40 dark:border-amber-900/40 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block font-sans">
                Batteries Restored
              </span>
              <span className="text-lg sm:text-xl font-black text-amber-900 dark:text-amber-200 mt-0.5 block font-serif">
                {count.toLocaleString()} Units
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Circular Fleet Mileage
              </span>
            </div>
          </div>

          {/* Certificate Footer with ID, Seal & Official Signature */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-4 mt-2 gap-4 text-left dark:border-white/10">
            <div>
              <span className="text-[9.5px] text-slate-400 dark:text-neutral-500 uppercase block font-bold tracking-wider font-sans">
                Certificate Identifier
              </span>
              <span className="font-mono text-xs font-black text-slate-800 dark:text-neutral-200 tracking-wider">
                {certCode}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 block mt-0.5 font-sans">
                Date of Issue: {issueDate}
              </span>
            </div>

            <div className="flex items-center gap-5">
              {/* Gold Medallion Seal */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-600 text-white shadow-lg border-2 border-amber-200/80 ring-2 ring-amber-500/30">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/60 bg-emerald-900/30">
                  <FiShield className="w-6 h-6 text-amber-100 drop-shadow-xs" />
                </div>
              </div>

              {/* Signature block */}
              <div className="text-center sm:text-right">
                <div className="font-serif italic font-bold text-slate-800 dark:text-neutral-200 text-sm sm:text-base border-b border-slate-300 pb-0.5 dark:border-white/20">
                  Refurbnics Operations & Engineering
                </div>
                <span className="text-[9.5px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider block mt-0.5 font-sans font-bold">
                  Authorized Sustainability Signatory
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleTriggerPrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-surface-800 dark:text-neutral-200 dark:hover:bg-surface-700 cursor-pointer transition-colors"
          >
            <FiPrinter className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 cursor-pointer transition-colors"
          >
            <FiDownload className="w-3.5 h-3.5" />
            <span>Download Official PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CertificateView;
