import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import DateField, { isValidYmd, ymd } from '../DateField';

// The web's <input type="datetime-local"> without a picker package: a
// YYYY-MM-DD date (DateField) plus an HH:MM time box. value/onChange use a
// Date (or null while the text is incomplete).

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');

export default function DateTimeField({ value, onChange, autoLabel }) {
  const [day, setDay] = useState(value ? ymd(value) : '');
  const [time, setTime] = useState(value ? hhmm(value) : '');

  useEffect(() => {
    if (!value) return;
    setDay(ymd(value));
    setTime(hhmm(value));
  }, [value]);

  function emit(d, t) {
    if (isValidYmd(d) && validTime(t)) {
      const [y, m, dd] = d.split('-').map(Number);
      const [h, mi] = t.split(':').map(Number);
      onChange(new Date(y, m - 1, dd, h, mi));
    } else {
      onChange(null);
    }
  }

  return (
    <View className="gap-2">
      {autoLabel ? (
        <TouchableOpacity onPress={() => onChange(new Date())} className="self-end rounded-lg bg-blue-50 px-2.5 py-1">
          <Text className="text-[11px] font-bold text-blue-700">🕒 {autoLabel}</Text>
        </TouchableOpacity>
      ) : null}
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <DateField value={day} onChange={(d) => { setDay(d); emit(d, time); }} quick={false} clearable={false} />
        </View>
        <TextInput
          value={time}
          onChangeText={(t) => { setTime(t); emit(day, t); }}
          placeholder="HH:MM"
          placeholderTextColor="#94a3b8"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          className={`w-20 rounded-xl border bg-white px-2 py-2 text-center text-sm font-semibold text-slate-900 ${time && !validTime(time) ? 'border-red-400' : 'border-slate-300'}`}
        />
      </View>
    </View>
  );
}

// "Upload Delivery Note / Photo (PDF, PNG, JPG, WebP)" — returns
// { uri, name, type, size } or null.
export async function pickDocument() {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, type: a.mimeType || 'application/pdf', size: a.size || 0 };
}

export function DocumentBox({ file, onPick, onRemove, emptyLabel = 'Upload Delivery Note / Photo', hint = '(PDF, PNG, JPG, WebP)' }) {
  if (!file) {
    return (
      <TouchableOpacity onPress={onPick} className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-3">
        <Text className="text-xs font-semibold text-slate-700">⬆ {emptyLabel}</Text>
        <Text className="text-[10px] text-slate-400">{hint}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View className="flex-row items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
      <Text className="flex-1 text-xs font-semibold text-emerald-900" numberOfLines={1}>
        📄 {file.name} <Text className="text-[10px] text-emerald-700">({((file.size || 0) / 1024 / 1024).toFixed(2)} MB)</Text>
      </Text>
      <TouchableOpacity onPress={onRemove} className="rounded-lg px-2 py-1">
        <Text className="text-xs font-bold text-rose-600">Remove</Text>
      </TouchableOpacity>
    </View>
  );
}
