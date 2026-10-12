import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import Icon from '../../ui/Icon';
import { Btn, Sheet } from './common';

// Rate a received delivery — the web RatingModal: 5 stars (default 5), quick
// service tags (two preselected), optional notes; one POST /ratings per
// battery in the shipment, then a thank-you screen.

const PRESET_FEEDBACK_OPTIONS = [
  '⚡ Fast & On-Time Turnaround',
  '🔋 Battery Health & Range Fully Restored',
  '🔧 Technical Fault Completely Resolved',
  '📦 Secure & High-Quality Workshop Packaging',
  '🚚 Smooth Delivery & Return Dispatch',
  '✨ Exceptional Refurbishment Workmanship',
  '💬 Transparent & Prompt Communication',
  '🛡️ Comprehensive Safety & BMS Calibration',
  '📊 Accurate Testing & Diagnostic Accuracy',
  '🌱 High Environmental & Eco-Impact Standards',
];

const DEFAULT_TAGS = ['🔋 Battery Health & Range Fully Restored', '⚡ Fast & On-Time Turnaround'];

const RATING_LABELS = {
  5: { title: '5 / 5 · Excellent Service & Quality!', cls: 'text-amber-600 bg-amber-500/10' },
  4: { title: '4 / 5 · Very Good Experience', cls: 'text-emerald-600 bg-emerald-500/10' },
  3: { title: '3 / 5 · Satisfactory / Standard', cls: 'text-blue-600 bg-blue-500/10' },
  2: { title: '2 / 5 · Fair / Needs Improvement', cls: 'text-orange-600 bg-orange-500/10' },
  1: { title: '1 / 5 · Unsatisfactory Experience', cls: 'text-rose-600 bg-rose-500/10' },
};

// target: { batteryCodes, truckNumber, driverName, returnId } or null
export default function RatingModal({ target, clientId, onClose, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState(DEFAULT_TAGS);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!target) return;
    setRating(5);
    setTags(DEFAULT_TAGS);
    setFeedback('');
    setSubmitted(false);
    setError(null);
  }, [target]);

  const codes = Array.from(new Set((target?.batteryCodes || []).filter(Boolean)));

  async function submit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const base = { returnId: target.returnId, clientId, rating, presetTags: tags, customFeedback: feedback };
      if (codes.length > 0) {
        for (const code of codes) await apiClient.post('/ratings', { ...base, batteryCode: code });
      } else {
        await apiClient.post('/ratings', base);
      }
      setSubmitted(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const info = RATING_LABELS[rating] || RATING_LABELS[5];
  const title = target?.truckNumber
    ? `Rate Delivery — Truck ${target.truckNumber}`
    : codes.length > 1
      ? `Rate Batch (${codes.length} Batteries)`
      : 'Battery Service Rating & Feedback';

  return (
    <Sheet
      visible={Boolean(target)}
      title={title}
      description={
        codes.length > 1
          ? `Review and rate your received delivery containing ${codes.length} refurbished batteries.`
          : 'Help our engineering team continually optimize battery longevity, safety, and turnaround.'
      }
      onClose={onClose}
      footer={
        submitted ? null : (
          <View className="flex-row gap-2">
            <Btn label="Skip / Dismiss" tone="ghost" onPress={onClose} className="flex-1" />
            <Btn label={submitting ? 'Submitting…' : 'Submit Feedback'} tone="blue" onPress={submit} disabled={submitting} className="flex-1" />
          </View>
        )
      }
    >
      {submitted ? (
        <View className="items-center py-10">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Icon name="check" color="#059669" size={30} />
          </View>
          <Text className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">Thank You for Your Review!</Text>
          <Text className="mt-1 text-center text-xs text-slate-500">
            Your feedback has been logged directly with our workshop operations team for all{' '}
            {codes.length > 0 ? `${codes.length} batteries` : 'units'} in this shipment.
          </Text>
        </View>
      ) : (
        <>
          {target?.truckNumber || codes.length > 0 ? (
            <View className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <Icon name="truck" color="#2563eb" size={16} />
                  <Text className="flex-1 text-xs font-bold text-slate-800 dark:text-slate-100">
                    {target?.truckNumber ? `Truck ${target.truckNumber}` : 'Return Shipment'}
                    {target?.driverName ? <Text className="font-normal text-slate-500"> · Driver: {target.driverName}</Text> : null}
                  </Text>
                </View>
                <Text className="text-[11px] font-bold text-emerald-700">
                  {codes.length} {codes.length === 1 ? 'Battery' : 'Batteries'} Received
                </Text>
              </View>
              {codes.length > 0 && (
                <View className="mt-2 flex-row flex-wrap gap-1">
                  {codes.map((c) => (
                    <View key={c} className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                      <Text className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">{c}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <View className="items-center">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Select Your Rating</Text>
            <View className="mt-2 flex-row gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Text className={`text-4xl ${n <= rating ? 'text-amber-400' : 'text-slate-300'}`}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className={`mt-2 rounded-full px-3 py-1 ${info.cls}`}>
              <Text className={`text-xs font-bold ${info.cls}`}>{info.title}</Text>
            </View>
          </View>

          <View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-200">Quick Service Tags (Select all that apply)</Text>
              <Text className="text-[11px] font-semibold text-slate-500">{tags.length} selected</Text>
            </View>
            <View className="mt-2 flex-row flex-wrap gap-1.5">
              {PRESET_FEEDBACK_OPTIONS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setTags(on ? tags.filter((t) => t !== tag) : [...tags, tag])}
                    className={`flex-row items-center gap-1 rounded-xl px-2.5 py-1.5 ${on ? 'bg-blue-600' : 'border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'}`}
                  >
                    {on ? <Icon name="check" color="#fff" size={11} /> : null}
                    <Text className={`text-[11px] font-semibold ${on ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">Additional Notes, Feedback, or Special Requests (Optional)</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder="Share any specific details about the battery performance, fleet deployment status, packaging, or communication..."
              placeholderTextColor="#94a3b8"
              className="min-h-[96px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
          {error ? <Text className="text-xs font-semibold text-red-600">{error}</Text> : null}
        </>
      )}
    </Sheet>
  );
}
