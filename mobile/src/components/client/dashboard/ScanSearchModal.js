import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../../ui/Icon';
import extractBatteryCode from '../../../utils/extract-battery-code';

// "Scan Battery QR Code" — the web dashboard's Scan QR / Search popup: open
// the camera scanner (the Scan QR tab) or type a Battery ID / scan URL and go
// straight to that battery's full history.

export default function ScanSearchModal({ visible, onClose, onOpenCamera, onOpenBattery }) {
  const [code, setCode] = useState('');

  function submit() {
    const c = extractBatteryCode(code);
    if (!c) return;
    setCode('');
    onOpenBattery(c);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <View className="w-full max-w-2xl self-center rounded-t-3xl bg-white p-5 pb-8 dark:bg-slate-900">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-black text-slate-900 dark:text-white">Scan Battery QR Code</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="x" color="#64748b" size={20} /></TouchableOpacity>
          </View>
          <Text className="mt-1 text-xs text-slate-500">
            Point your camera at the battery QR code or type the Battery ID below to open its complete lifecycle, repairs, testing, and return logs.
          </Text>
          <TouchableOpacity onPress={onOpenCamera} className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5">
            <Icon name="camera" color="#fff" size={18} />
            <Text className="text-sm font-bold text-white">Open Camera Scanner</Text>
          </TouchableOpacity>
          <Text className="my-3 text-center text-[11px] font-semibold uppercase text-slate-400">or enter code manually</Text>
          <Text className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Battery Code / URL</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="e.g. UBE-0001 or scan URL"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
            className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 dark:border-slate-700 dark:text-white"
          />
          <View className="mt-4 flex-row gap-2">
            <TouchableOpacity onPress={onClose} className="flex-1 items-center rounded-2xl border border-slate-200 py-3">
              <Text className="text-sm font-bold text-slate-700 dark:text-slate-200">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!code.trim()} onPress={submit} className={`flex-1 items-center rounded-2xl bg-emerald-600 py-3 ${code.trim() ? '' : 'opacity-50'}`}>
              <Text className="text-sm font-bold text-white">View Full History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
