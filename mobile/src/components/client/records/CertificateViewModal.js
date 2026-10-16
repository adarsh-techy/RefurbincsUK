import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../ui/Icon';
import { getTierForCertificate, printCertificate, shareCertificate } from '../../../utils/print-milestone-certificate';
import { BATTERY_COMPOSITION_DATA, calculateMaterialBreakdown } from './material-breakdown';
import CompositionTable from './CompositionTable';

// "View Certificate" — the web's Sustainability Milestone Certificate modal
// (components/certificates/CertificateView) for a phone: the two tabs
// ("Official Diploma Canvas" and "Section 2 Composition Audit"), the same
// figures, and the two actions — Print Official Certificate and Download
// the two-page PDF (the same PDF the web makes).

const TIER_COLORS = {
  Bronze: { border: 'border-amber-400', badge: 'bg-amber-100 border-amber-300', text: 'text-amber-900', accent: '#b45309' },
  Silver: { border: 'border-slate-400', badge: 'bg-slate-200 border-slate-300', text: 'text-slate-800', accent: '#475569' },
  Gold: { border: 'border-yellow-400', badge: 'bg-yellow-100 border-yellow-400', text: 'text-yellow-900', accent: '#a16207' },
  Platinum: { border: 'border-indigo-400', badge: 'bg-indigo-100 border-indigo-300', text: 'text-indigo-900', accent: '#4338ca' },
  Diamond: { border: 'border-cyan-400', badge: 'bg-cyan-100 border-cyan-300', text: 'text-cyan-900', accent: '#0e7490' },
  Emerald: { border: 'border-emerald-400', badge: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-900', accent: '#047857' },
};

export default function CertificateViewModal({ certificate, clientName, onClose }) {
  const [tab, setTab] = useState('certificate');
  const [busy, setBusy] = useState(null); // 'print' | 'pdf'

  useEffect(() => {
    if (certificate) setTab('certificate');
  }, [certificate]);

  if (!certificate) return null;

  const tier = getTierForCertificate(certificate);
  const colors = TIER_COLORS[tier.badge] || TIER_COLORS.Gold;
  const count = Number(certificate.milestone_count || tier.count);
  const co2Tons = (Number(certificate.co2_saved_kg || count * 15.2) / 1000).toFixed(1);
  const ewasteKg = Math.round(Number(certificate.ewaste_diverted_kg || count * 2.8)).toLocaleString();
  const certClient = (certificate.client_name || clientName || 'Valued Enterprise Partner').toUpperCase();
  const certCode = certificate.certificate_code || `CERT-REFURB-${count}-2026`;
  const issueDate = certificate.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  async function run(kind) {
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
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <View className="flex-1">
            <Text className="text-sm font-extrabold text-slate-900">Sustainability Milestone Certificate</Text>
            <Text className="text-[11px] text-slate-500" numberOfLines={1}>{certificate.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <Icon name="x" color="#334155" size={18} />
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-1 bg-white px-4 pb-3">
          {[
            ['certificate', 'Official Diploma Canvas'],
            ['composition', `Section 2 Composition Audit (${BATTERY_COMPOSITION_DATA.length})`],
          ].map(([id, label]) => (
            <TouchableOpacity key={id} onPress={() => setTab(id)} className={`flex-1 items-center rounded-xl px-2 py-2 ${tab === id ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <Text className={`text-center text-[11px] font-bold ${tab === id ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerClassName="p-3.5 pb-6 gap-3">
          {tab === 'certificate' ? (
            <View className={`rounded-2xl border-2 bg-white p-4 ${colors.border}`}>
              <View className={`self-center rounded-full border px-3 py-0.5 ${colors.badge}`}>
                <Text className={`text-[10px] font-extrabold uppercase tracking-widest ${colors.text}`}>{tier.badge} Tier Accreditation</Text>
              </View>
              <Text className="mt-2 text-center text-[10.5px] font-bold uppercase italic tracking-wider leading-tight" style={{ color: colors.accent }}>
                Official {tier.badge} Certificate of Environmental Leadership & Closed-Loop Decarbonization
              </Text>
              <Text className="mt-3 text-center text-[9.5px] uppercase tracking-wider text-slate-400">Presented to</Text>
              <View className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Text className="text-center text-base font-black text-slate-900 leading-snug">{certClient}</Text>
                <Text className="mt-0.5 text-center text-[9.5px] font-semibold text-emerald-700">✓ Verified Enterprise Partner</Text>
                <Text className="mt-0.5 text-center font-mono text-[9.5px] text-slate-500">{certCode}</Text>
              </View>
              <View className="mt-3 gap-1.5">
                {[
                  ['Batteries Restored', `${count.toLocaleString()} Packs`],
                  ['CO₂ Prevented', `~${co2Tons} t CO₂e`],
                  ['Critical Metals Diverted', `~${ewasteKg} kg`],
                ].map(([label, value]) => (
                  <View key={label} className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Text className="text-[10px] font-bold uppercase text-slate-500">{label}</Text>
                    <Text className="text-xs font-black text-slate-900">{value}</Text>
                  </View>
                ))}
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[10px] text-slate-500">Issued: {issueDate}</Text>
                <Text className="text-[10px] font-bold text-emerald-600">✓ Verified Seal</Text>
              </View>
            </View>
          ) : (
            <>
              <Text className="text-xs font-bold text-slate-700">{count.toLocaleString()} Packs Audited · Recovered Mass ({count.toLocaleString()} Packs)</Text>
              <CompositionTable rows={calculateMaterialBreakdown(count)} />
            </>
          )}
        </ScrollView>

        <View className="gap-2 border-t border-slate-200 bg-white p-3.5">
          <TouchableOpacity disabled={Boolean(busy)} onPress={() => run('pdf')} className={`items-center justify-center rounded-xl bg-emerald-600 py-3 ${busy ? 'opacity-60' : ''}`}>
            <Text className="text-xs font-bold text-white">{busy === 'pdf' ? 'Creating PDF…' : `Download Official ${tier.badge} PDF`}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={Boolean(busy)} onPress={() => run('print')} className={`items-center justify-center rounded-xl border border-slate-300 py-2.5 ${busy ? 'opacity-60' : ''}`}>
            <Text className="text-xs font-bold text-slate-700">{busy === 'print' ? 'Opening…' : 'Print Official Certificate'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
