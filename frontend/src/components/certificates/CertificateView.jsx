import { useRef } from 'react';
import { FiAward, FiCheckCircle, FiPrinter, FiDownload, FiGlobe, FiShield } from 'react-icons/fi';
import logoUrl from '../../assets/Refurbnics.png';

function CertificateView({ certificate, clientName, onPrint, showActions = true }) {
  const printRef = useRef(null);

  if (!certificate) return null;

  const count = Number(certificate.milestone_count || 1000);
  const co2Tons = (Number(certificate.co2_saved_kg || count * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(Number(certificate.ewaste_diverted_kg || count * 2.8)).toLocaleString();
  const certClient = certificate.client_name || clientName || 'Valued Partner';
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

  function handleTriggerPrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* Certificate Frame */}
      <div
        ref={printRef}
        id="printable-certificate"
        className="relative overflow-hidden rounded-2xl border-4 border-double border-amber-600/60 bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 p-6 sm:p-8 text-center shadow-xl dark:border-amber-500/40 dark:from-surface-900 dark:via-surface-850 dark:to-surface-900"
      >
        {/* Background Watermark Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none flex items-center justify-center">
          <FiAward className="w-96 h-96 text-slate-900 dark:text-white" />
        </div>

        {/* Certificate Inner Border */}
        <div className="relative z-10 border border-amber-500/30 rounded-xl p-4 sm:p-6 bg-white/70 backdrop-blur-xs dark:bg-surface-900/80">
          {/* Header & Crest */}
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-4 dark:border-white/10">
            <div className="flex items-center gap-2 text-left">
              <img src={logoUrl} alt="Refurbnics" className="h-8 w-auto object-contain" />
              <div>
                <span className="font-black text-xs tracking-wider uppercase text-slate-800 dark:text-white block">
                  Refurbnics
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">
                  Circular Battery Logistics & Engineering
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 font-extrabold text-[10px] tracking-wider uppercase border border-amber-300 dark:border-amber-700">
                <FiAward className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Official Milestone</span>
              </span>
            </div>
          </div>

          {/* Certificate Main Title */}
          <div className="py-5 space-y-1">
            <span className="text-[11px] font-black tracking-widest text-amber-700 dark:text-amber-400 uppercase">
              Certificate of Sustainability & Circular Economy
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {certificate.title || `${count.toLocaleString()} Battery Milestone Achievement`}
            </h1>
            <p className="text-xs text-slate-500 dark:text-neutral-400 pt-1">
              Presented with honor and distinction to
            </p>
          </div>

          {/* Client Recipient Name */}
          <div className="my-2 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-amber-200/80 dark:border-white/10 inline-block max-w-full">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              {certClient}
            </h2>
          </div>

          {/* Body Text */}
          <p className="text-xs text-slate-600 dark:text-neutral-300 max-w-xl mx-auto leading-relaxed my-4">
            In recognition of outstanding dedication to zero-emission mobility and circular lifecycle management. Through partnering with Refurbnics to repair and restore{' '}
            <strong className="text-slate-900 dark:text-white font-extrabold">{count.toLocaleString()} battery packs</strong>, your organization has actively reduced hazardous e-waste and preserved vital battery raw materials.
          </p>

          {/* Eco Impact Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-center dark:bg-emerald-950/40 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">
                CO₂ Emissions Saved
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-200 mt-0.5 block">
                ~{co2Tons} Tons
              </span>
              <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400">
                Carbon footprint reduced
              </span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 text-center dark:bg-blue-950/40 dark:border-blue-900/40">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                E-Waste Diverted
              </span>
              <span className="text-base sm:text-lg font-black text-blue-800 dark:text-blue-200 mt-0.5 block">
                {ewasteKg} kg
              </span>
              <span className="text-[9.5px] text-blue-600 dark:text-blue-400">
                Landfill diversion
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-center dark:bg-amber-950/40 dark:border-amber-900/40">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block">
                Batteries Restored
              </span>
              <span className="text-base sm:text-lg font-black text-amber-800 dark:text-amber-200 mt-0.5 block">
                {count.toLocaleString()} Units
              </span>
              <span className="text-[9.5px] text-amber-600 dark:text-amber-400">
                Extended lifecycle
              </span>
            </div>
          </div>

          {/* Certificate Footer with Signatures & Official Seal */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/80 pt-4 mt-2 gap-4 text-left dark:border-white/10">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase block font-bold">
                Certificate ID
              </span>
              <span className="font-mono text-[11px] font-black text-slate-800 dark:text-neutral-200">
                {certCode}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 block mt-0.5">
                Issued: {issueDate}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Seal */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md border-2 border-amber-300">
                <FiShield className="w-6 h-6" />
              </div>

              {/* Signature block */}
              <div className="text-center sm:text-right">
                <div className="font-serif italic font-bold text-slate-800 dark:text-neutral-200 text-sm border-b border-slate-300 pb-0.5 dark:border-white/20">
                  Refurbnics Operations
                </div>
                <span className="text-[9.5px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider block mt-0.5">
                  Authorized Sustainability Seal
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 cursor-pointer"
          >
            <FiPrinter className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default CertificateView;
