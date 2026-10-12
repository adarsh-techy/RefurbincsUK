import { useEffect, useState } from 'react';
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Date input: a 📅 button opens the phone's native date picker (Android
// dialog / iOS calendar sheet); the YYYY-MM-DD box stays for typing (and is
// all there is on web), with ‹ › day steps and quick chips. value / onChange
// use 'YYYY-MM-DD' strings ('' = no date) — the same format the web date
// inputs send as query params (?date=, ?from=, ?to=).

// Native module loaded lazily: a build without it just hides the 📅 button.
let Picker = null;
if (Platform.OS !== 'web') {
  try {
    Picker = require('@react-native-community/datetimepicker');
  } catch {
    Picker = null;
  }
}

function toDate(s) {
  if (!isValidYmd(s)) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function ymd(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function isValidYmd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function shiftYmd(s, days) {
  const [y, m, d] = s.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + days));
}

export const todayYmd = () => ymd(new Date());

export function prettyYmd(s) {
  if (!isValidYmd(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DateField({ label, value = '', onChange, clearable = true, quick = true, compact = false }) {
  const [text, setText] = useState(value);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(new Date());
  useEffect(() => setText(value), [value]);
  const invalid = text !== '' && !isValidYmd(text);

  function commit(t) {
    setText(t);
    if (t === '') onChange?.('');
    else if (isValidYmd(t)) onChange?.(t);
  }

  function openPicker() {
    if (!Picker) return;
    if (Platform.OS === 'android') {
      Picker.DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) commit(ymd(date));
        },
      });
    } else {
      setIosDraft(toDate(value));
      setIosOpen(true);
    }
  }

  const chip = (lbl, v) => (
    <TouchableOpacity key={lbl} onPress={() => commit(v)} className={`rounded-lg px-2.5 py-1 ${value === v ? 'bg-blue-600' : 'bg-slate-100'}`}>
      <Text className={`text-[11px] font-bold ${value === v ? 'text-white' : 'text-slate-600'}`}>{lbl}</Text>
    </TouchableOpacity>
  );

  return (
    <View className={compact ? 'flex-1' : ''}>
      {label ? <Text className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</Text> : null}
      <View className="flex-row items-center gap-1.5">
        <TouchableOpacity disabled={!isValidYmd(value)} onPress={() => commit(shiftYmd(value, -1))} hitSlop={6} className={`rounded-lg border border-slate-200 bg-white px-2.5 py-2 ${isValidYmd(value) ? '' : 'opacity-40'}`}>
          <Text className="text-xs font-bold text-slate-600">‹</Text>
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={commit}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          autoCorrect={false}
          className={`min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 ${invalid ? 'border-red-400' : 'border-slate-300'}`}
        />
        <TouchableOpacity disabled={!isValidYmd(value)} onPress={() => commit(shiftYmd(value, 1))} hitSlop={6} className={`rounded-lg border border-slate-200 bg-white px-2.5 py-2 ${isValidYmd(value) ? '' : 'opacity-40'}`}>
          <Text className="text-xs font-bold text-slate-600">›</Text>
        </TouchableOpacity>
        {Picker ? (
          <TouchableOpacity onPress={openPicker} hitSlop={6} accessibilityLabel="Pick a date" className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
            <Text className="text-xs">📅</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {iosOpen && Picker ? (
        <Modal transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="w-full max-w-2xl self-center rounded-t-2xl bg-white p-4 pb-8">
              <Picker.default value={iosDraft} mode="date" display="inline" onChange={(e, d) => d && setIosDraft(d)} />
              <View className="mt-2 flex-row gap-2">
                <TouchableOpacity onPress={() => setIosOpen(false)} className="flex-1 items-center rounded-xl border border-slate-200 py-3">
                  <Text className="text-sm font-bold text-slate-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { commit(ymd(iosDraft)); setIosOpen(false); }} className="flex-1 items-center rounded-xl bg-blue-600 py-3">
                  <Text className="text-sm font-bold text-white">Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      {invalid ? <Text className="mt-1 text-[10px] font-semibold text-red-600">Use YYYY-MM-DD, e.g. {todayYmd()}</Text> : null}
      {quick && (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {chip('Today', todayYmd())}
          {chip('Yesterday', shiftYmd(todayYmd(), -1))}
          {clearable && value ? (
            <TouchableOpacity onPress={() => commit('')} className="rounded-lg bg-white px-2.5 py-1">
              <Text className="text-[11px] font-bold text-red-600">Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}
