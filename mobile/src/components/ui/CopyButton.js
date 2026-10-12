import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';

// Small "Copy" pill (the web's copy buttons). Shows "Copied" for 1.5s.
// expo-clipboard is loaded lazily so a build without the native module
// just hides the button instead of crashing.
let Clipboard = null;
try {
  Clipboard = require('expo-clipboard');
} catch {
  Clipboard = null;
}

export default function CopyButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!Clipboard || value === undefined || value === null || value === '') return null;

  async function copy() {
    try {
      await Clipboard.setStringAsync(String(value));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — long-press selection still works
    }
  }

  return (
    <TouchableOpacity
      onPress={copy}
      hitSlop={6}
      className={`rounded-md border px-2 py-0.5 ${copied ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'} ${className}`}
    >
      <Text className={`text-[10px] font-bold ${copied ? 'text-emerald-700' : 'text-slate-600'}`}>{copied ? 'Copied' : label}</Text>
    </TouchableOpacity>
  );
}
