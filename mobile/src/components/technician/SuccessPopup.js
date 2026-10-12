import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

// Small confirmation shown after a workshop action succeeds (start work,
// start testing, password change…) — the twin of the web SuccessPopup.
// autoCloseMs: closes by itself for steps in the middle of a flow.
export default function SuccessPopup({ open, title, message, onClose, autoCloseMs = 0 }) {
  // the latest onClose, without restarting the countdown on every re-render
  // (the repair timer re-renders the screen each second)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !autoCloseMs) return undefined;
    const t = setTimeout(() => closeRef.current?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs]);

  return (
    <Modal visible={Boolean(open)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 320 }}>
          <View className="items-center rounded-3xl border border-emerald-200 bg-white p-6 dark:border-emerald-900/60 dark:bg-slate-900">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/40">
              <Text className="text-2xl text-emerald-600">✓</Text>
            </View>
            <Text className="mb-1 text-center text-lg font-bold text-slate-900 dark:text-white">{title}</Text>
            {message ? <Text className="mb-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">{message}</Text> : null}
            <TouchableOpacity onPress={onClose} className="w-full items-center rounded-xl bg-emerald-600 py-3">
              <Text className="text-sm font-bold text-white">OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
