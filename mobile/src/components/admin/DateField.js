import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

// Date input without a native picker package: type YYYY-MM-DD (validated),
// step a day back / forward, or tap a quick chip. value / onChange use
// 'YYYY-MM-DD' strings ('' = no date) — the same format the web date inputs
// send as query params (?date=, ?from=, ?to=).

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
  useEffect(() => setText(value), [value]);
  const invalid = text !== '' && !isValidYmd(text);

  function commit(t) {
    setText(t);
    if (t === '') onChange?.('');
    else if (isValidYmd(t)) onChange?.(t);
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
          className={`flex-1 rounded-xl border bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 ${invalid ? 'border-red-400' : 'border-slate-300'}`}
        />
        <TouchableOpacity disabled={!isValidYmd(value)} onPress={() => commit(shiftYmd(value, 1))} hitSlop={6} className={`rounded-lg border border-slate-200 bg-white px-2.5 py-2 ${isValidYmd(value) ? '' : 'opacity-40'}`}>
          <Text className="text-xs font-bold text-slate-600">›</Text>
        </TouchableOpacity>
      </View>
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
