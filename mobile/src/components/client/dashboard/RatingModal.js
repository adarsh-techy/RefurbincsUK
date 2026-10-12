import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import Icon from '../../ui/Icon';

// "Rate Workshop Service Quality" — the web RatingModal as opened from the
// dashboard battery table: 1–5 stars (5 preselected), preset feedback tags,
// free text, POST /ratings { batteryCode, clientId, rating, presetTags,
// customFeedback }.

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

const RATING_LABELS = {
  5: '5 / 5 · Excellent Service & Quality!',
  4: '4 / 5 · Very Good Experience',
  3: '3 / 5 · Satisfactory / Standard',
  2: '2 / 5 · Fair / Needs Improvement',
  1: '1 / 5 · Unsatisfactory Experience',
};

export default function RatingModal({ batteryCode, clientId, onClose, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRating(5);
    setTags([]);
    setFeedback('');
    setSubmitted(false);
    setError(null);
  }, [batteryCode]);

  const toggle = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  async function submit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/ratings', { batteryCode, clientId, rating, presetTags: tags, customFeedback: feedback });
      setSubmitted(true);
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={Boolean(batteryCode)} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-3xl bg-white p-5 dark:bg-slate-900">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-lg font-black text-slate-900 dark:text-white">Rate Workshop Service Quality</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Battery {batteryCode}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="x" color="#64748b" size={20} /></TouchableOpacity>
          </View>

          {submitted ? (
            <View className="items-center py-10">
              <Icon name="checkCircle" color="#059669" size={40} />
              <Text className="mt-3 text-base font-black text-slate-900 dark:text-white">Thank you for your feedback!</Text>
              <Text className="mt-1 text-xs text-slate-500">Your rating helps us keep improving our service.</Text>
            </View>
          ) : (
            <ScrollView className="mt-4" contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              <View className="items-center">
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                      <Text className={`text-4xl ${n <= rating ? 'text-amber-400' : 'text-slate-200'}`}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text className="mt-2 text-xs font-bold text-amber-600">{RATING_LABELS[rating]}</Text>
              </View>
              <View>
                <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">What went well? (optional)</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PRESET_FEEDBACK_OPTIONS.map((t) => {
                    const on = tags.includes(t);
                    return (
                      <TouchableOpacity key={t} onPress={() => toggle(t)} className={`rounded-full border px-3 py-1.5 ${on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                        <Text className={`text-[11px] font-semibold ${on ? 'text-emerald-800' : 'text-slate-600 dark:text-slate-300'}`}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View>
                <Text className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Additional comments (optional)</Text>
                <TextInput
                  value={feedback}
                  onChangeText={setFeedback}
                  multiline
                  placeholder="Tell us more about your experience…"
                  placeholderTextColor="#94a3b8"
                  className="min-h-[80px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:text-white"
                  textAlignVertical="top"
                />
              </View>
              {error ? <Text className="text-xs font-semibold text-red-600">{error}</Text> : null}
              <View className="flex-row gap-2 pb-2">
                <TouchableOpacity onPress={onClose} className="flex-1 items-center rounded-2xl border border-slate-200 py-3">
                  <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={submitting || !rating} onPress={submit} className={`flex-1 items-center rounded-2xl bg-amber-500 py-3 ${submitting ? 'opacity-60' : ''}`}>
                  <Text className="text-sm font-bold text-white">{submitting ? 'Submitting…' : 'Submit Rating'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
