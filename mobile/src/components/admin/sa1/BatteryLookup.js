import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../../services/api-client';
import { StatusBadge } from '../../ui/Badge';

// "Look Up Battery by ID" from the web Battery Fleet page: typing searches
// matching battery codes (GET /batteries?q=, 8 suggestions); picking one or
// pressing View Battery opens that battery's full history.
const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

export default function BatteryLookup() {
  const navigation = useNavigation();
  const [code, setCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!code.trim()) { setSuggestions([]); return undefined; }
    timer.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/batteries', { params: { q: code.trim(), limit: SUGGESTION_LIMIT } });
        setSuggestions(data.data || []);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [code]);

  function goTo(batteryCode) {
    setOpen(false);
    navigation.navigate('BatteryDetail', { code: batteryCode, fromScan: false });
  }

  return (
    <View>
      <Text className="mb-1 text-xs font-medium text-slate-700">Look Up Battery by ID</Text>
      <View className="flex-row gap-2">
        <TextInput
          value={code}
          onChangeText={(v) => { setCode(v); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onSubmitEditing={() => code.trim() && goTo(code.trim())}
          placeholder="e.g. BAT-12-001"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          className="flex-1 rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-900"
        />
        <TouchableOpacity disabled={!code.trim()} onPress={() => goTo(code.trim())} className={`justify-center rounded-xl bg-violet-700 px-3.5 ${code.trim() ? '' : 'opacity-50'}`}>
          <Text className="text-xs font-bold text-white">View Battery</Text>
        </TouchableOpacity>
      </View>
      {open && suggestions.length > 0 && (
        <View className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {suggestions.map((b) => (
            <TouchableOpacity key={b.id} onPress={() => goTo(b.battery_code)} className="flex-row items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-800">{b.battery_code}</Text>
                {b.serial_number ? <Text className="text-[11px] text-slate-400">SN: {b.serial_number}</Text> : null}
              </View>
              <StatusBadge status={b.status} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
