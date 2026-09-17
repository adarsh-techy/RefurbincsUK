import { FiAward, FiCheck, FiX, FiPrinter, FiDownload } from 'react-icons/fi';
import Modal from '../ui/overlays/Modal';
import CertificateView from './CertificateView';
import apiClient from '../../services/api-client';
import { downloadMilestoneCertificatePDF } from '../../utils/generate-milestone-certificate';

function MilestoneCertificateModal({ certificate, clientName, onClose, onAcknowledge }) {
  if (!certificate) return null;

  async function handleAcknowledgeAndClose() {
    if (certificate.id) {
      try {
        await apiClient.post(`/certificates/acknowledge/${certificate.id}`);
      } catch (err) {
        console.error('Failed to acknowledge milestone:', err);
      }
    }
    if (onAcknowledge) onAcknowledge(certificate);
    if (onClose) onClose();
  }

  const count = certificate.milestone_count || 1000;

  return (
    <Modal
      title="🎉 Sustainability Milestone Reached!"
      description={`Congratulations on reaching the ${count.toLocaleString()} Batteries Serviced milestone!`}
      size="3xl"
      onClose={handleAcknowledgeAndClose}
    >
      <div className="space-y-4">
        {/* Certificate Display */}
        <CertificateView
          certificate={certificate}
          clientName={clientName}
          showActions={false}
        />

        {/* Modal Footer with Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
          <div className="text-xs text-slate-500 dark:text-neutral-400 text-center sm:text-left">
            This certificate has been added to your official Sustainability Records.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => downloadMilestoneCertificatePDF(certificate, clientName)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-surface-700 dark:hover:bg-surface-600 cursor-pointer shadow-2xs"
            >
              <FiDownload className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-surface-800 cursor-pointer"
            >
              <FiPrinter className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handleAcknowledgeAndClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer"
            >
              <FiCheck className="w-3.5 h-3.5" />
              <span>Celebrate & Continue</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default MilestoneCertificateModal;
