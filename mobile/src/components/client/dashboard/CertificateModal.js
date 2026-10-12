import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from '../../ui/Icon';
import { getTierForCertificate, printCertificate, shareCertificate } from '../../../utils/print-milestone-certificate';

// Milestone certificate popup used by the dashboard, in two modes like the web:
//   milestone  "🎉 Sustainability Milestone Reached!" — opens by itself for a
//              newly awarded certificate; "Celebrate & Continue" (or closing)
//              acknowledges it (the caller posts /certificates/acknowledge/:id)
//   preview    tapping an earned certificate in "Sustainability Milestones"
// Both offer the same Download PDF / Print the web CertificateView has.

const day = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function CertificateModal({ certificate, clientName, mode = 'preview', onClose }) {
  const [busy, setBusy] = useState(null);
  if (!certificate) return null;
  const isMilestone = mode === 'milestone';
  const count = Number(certificate.milestone_count || 1000);
  let tier = null;
  try {
    tier = getTierForCertificate(certificate);
  } catch {
    tier = null;
  }

  async function pdf(kind) {
    setBusy(kind);
    try {
      if (kind === 'print') await printCertificate(certificate, clientName);
      else await shareCertificate(certificate, clientName);
    } catch (err) {
      Alert.alert('Could not create the certificate PDF', err.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-4">
        <View className="max-h-[90%] w-full max-w-lg rounded-3xl bg-white p-5 dark:bg-slate-900">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-lg font-black text-slate-900 dark:text-white">
                {isMilestone ? '🎉 Sustainability Milestone Reached!' : certificate.title || 'Official Milestone ESG Certificate'}
              </Text>
              {isMilestone ? (
                <Text className="mt-0.5 text-xs text-slate-500">Congratulations on reaching the {count.toLocaleString()} Batteries Serviced milestone!</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="x" color="#64748b" size={20} /></TouchableOpacity>
          </View>

          <ScrollView className="mt-4" contentContainerClassName="gap-3">
            <View className="items-center rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5">
              <Icon name="award" color="#b45309" size={40} />
              <Text className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-700">{tier?.badge ? `${tier.badge} Tier` : 'Milestone'} Certificate</Text>
              <Text className="mt-1 text-center text-base font-black text-slate-900">{certificate.title}</Text>
              <Text className="mt-1 text-center text-xs text-slate-600">Awarded to {certificate.client_name || clientName || 'your company'}</Text>
              <View className="mt-4 w-full flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-lg font-black text-slate-900">{count.toLocaleString()}</Text>
                  <Text className="text-[10px] text-slate-500">Batteries serviced</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-lg font-black text-emerald-700">{Math.round(certificate.co2_saved_kg || 0).toLocaleString()}</Text>
                  <Text className="text-[10px] text-slate-500">kg CO₂ offset</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-lg font-black text-teal-700">{Math.round(certificate.ewaste_diverted_kg || 0).toLocaleString()}</Text>
                  <Text className="text-[10px] text-slate-500">kg e-waste diverted</Text>
                </View>
              </View>
              <Text className="mt-4 text-[10px] text-slate-400">
                {certificate.certificate_code ? `${certificate.certificate_code} · ` : ''}Issued {day(certificate.issued_at)}
              </Text>
            </View>
            {isMilestone ? (
              <Text className="text-center text-[11px] text-slate-500">This certificate has been added to your official Sustainability Records.</Text>
            ) : null}
          </ScrollView>

          <View className="mt-4 flex-row gap-2">
            <TouchableOpacity disabled={Boolean(busy)} onPress={() => pdf('share')} className="flex-1 items-center rounded-2xl bg-violet-700 py-3">
              <Text className="text-xs font-bold text-white">{busy === 'share' ? 'Creating PDF…' : 'Download PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={Boolean(busy)} onPress={() => pdf('print')} className="items-center rounded-2xl border border-violet-300 px-5 py-3">
              <Text className="text-xs font-bold text-violet-700">{busy === 'print' ? '…' : 'Print'}</Text>
            </TouchableOpacity>
          </View>
          {isMilestone ? (
            <TouchableOpacity onPress={onClose} className="mt-2 items-center rounded-2xl bg-emerald-600 py-3">
              <Text className="text-sm font-bold text-white">Celebrate & Continue</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
