import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from '../ui/Icon';
import { hardwareScannerAvailable, useHardwareScan } from '../../services/hardware-scanner';

// One scan box for every place a battery is scanned (sorting, intake,
// returns, recycle, verify, technician lookup) — the mobile twin of the web
// scan box + RfidScanButton. Three ways in:
//   • RFID — an external reader (Bluetooth / USB-OTG, keyboard/HID mode) types
//     the tag into this box. "Scan RFID" focuses the box with the on-screen
//     keyboard hidden and keeps it focused, so tags can be read back to back.
//     Readers that end with Enter submit at once; ones that send nothing (or
//     Tab) submit after a short pause.
//   • QR — the phone camera.
//   • Typing — tap the box; the keyboard comes back.
//   • Zebra devices (TC22 + RFID sled): DataWedge delivers the trigger read
//     straight to this box via services/hardware-scanner — no focus needed.
// The parent gets the raw value in onSubmit(raw) and resolves it (QR link,
// code, serial or tag) with utils/scan-input.
//
// UHF tags (EPC "E280…") can't be read by a phone's own NFC, so the reader
// is always an external device.

const RFID_IDLE_SUBMIT_MS = 300; // readers type a whole tag in well under this

const ScanBatteryInput = forwardRef(function ScanBatteryInput(
  {
    onSubmit,
    placeholder = 'Battery code, serial or RFID tag…',
    submitLabel = 'Add',
    feedback, // { tone: 'good' | 'warn' | 'bad', message }
    disabled = false,
    showCamera = true,
    startInRfidMode = false,
    compact = false,
  },
  ref
) {
  const inputRef = useRef(null);
  const idleRef = useRef(null);
  const [value, setValue] = useState('');
  const valueRef = useRef(''); // latest text — Enter can arrive before the last keystroke re-renders
  const [lastRead, setLastRead] = useState(null); // shown under the box, so you can see what the reader sent
  const [rfidMode, setRfidMode] = useState(startInRfidMode);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraLockRef = useRef(false);

  const zebra = hardwareScannerAvailable();
  useHardwareScan((v) => {
    setLastRead(v);
    onSubmit?.(v);
  }, !disabled);

  const setText = (t) => {
    valueRef.current = t;
    setValue(t);
  };

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus(), clear: () => setText('') }));

  useEffect(() => () => clearTimeout(idleRef.current), []);

  // RFID mode: focus once the keyboard flag has been applied
  useEffect(() => {
    if (!rfidMode) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [rfidMode]);

  function submit(raw) {
    clearTimeout(idleRef.current);
    const v = String(raw ?? valueRef.current).replace(/[\t\r\n]+/g, '').trim();
    if (!v) return;
    setText('');
    setLastRead(v);
    onSubmit?.(v);
    if (rfidMode) setTimeout(() => inputRef.current?.focus(), 30);
  }

  function handleChange(text) {
    // a reader that ends with Tab/Enter inside the text
    if (/[\t\r\n]/.test(text)) {
      submit(text);
      return;
    }
    setText(text);
    if (rfidMode) {
      clearTimeout(idleRef.current);
      if (text.trim().length >= 4) idleRef.current = setTimeout(() => submit(text), RFID_IDLE_SUBMIT_MS);
    }
  }

  function startRfid() {
    if (rfidMode) {
      setRfidMode(false);
      inputRef.current?.blur();
      return;
    }
    setRfidMode(true);
  }

  function startTyping() {
    if (!rfidMode) return;
    // leave RFID mode so the keyboard can open on the next focus
    setRfidMode(false);
    inputRef.current?.blur();
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  async function openCamera() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    cameraLockRef.current = false;
    setCameraOpen(true);
  }

  const tones = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    bad: 'border-red-200 bg-red-50 text-red-700',
    error: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChange}
            onSubmitEditing={() => submit()}
            blurOnSubmit={false}
            showSoftInputOnFocus={!rfidMode}
            editable={!disabled}
            onPressIn={startTyping}
            placeholder={rfidMode ? 'Waiting for tag… scan with the reader' : placeholder}
            placeholderTextColor={rfidMode ? '#ef4444' : '#94a3b8'}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            className={`rounded-xl border px-3.5 ${compact ? 'py-2' : 'py-2.5'} text-xs text-slate-900 dark:text-white ${
              rfidMode ? 'border-red-400 bg-red-50 dark:bg-red-950/40' : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950'
            }`}
          />
        </View>
        <TouchableOpacity
          disabled={disabled || !value.trim()}
          onPress={() => submit()}
          className={`items-center justify-center rounded-xl bg-blue-600 px-4 ${!value.trim() ? 'opacity-50' : ''}`}
        >
          <Text className="text-xs font-bold text-white">{submitLabel}</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <TouchableOpacity
          disabled={disabled}
          onPress={startRfid}
          className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
            rfidMode
              ? 'border-red-500 bg-red-600'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
          }`}
        >
          <Icon name="rfid" size={14} color={rfidMode ? '#fff' : '#047857'} />
          <Text className={`text-[11px] font-bold ${rfidMode ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
            {rfidMode ? 'Stop RFID Scan' : 'Scan RFID tag'}
          </Text>
        </TouchableOpacity>
        {showCamera && (
          <TouchableOpacity
            disabled={disabled}
            onPress={openCamera}
            className="flex-row items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          >
            <Icon name="camera" size={14} color="#334155" />
            <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Scan QR</Text>
          </TouchableOpacity>
        )}
        {zebra ? (
          <Text className="text-[10px] font-semibold text-emerald-700">Zebra reader ready — pull the trigger</Text>
        ) : (
          !rfidMode && !compact && <Text className="text-[10px] text-slate-400">QR, battery code or RFID tag</Text>
        )}
      </View>

      {lastRead ? (
        <Text className="mt-1.5 font-mono text-[10px] text-slate-400" numberOfLines={1}>Read: {lastRead}</Text>
      ) : null}
      {feedback?.message ? (
        <Text className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${tones[feedback.tone] || tones.bad}`}>
          {feedback.message}
        </Text>
      ) : null}

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View className="flex-1 bg-black">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              // the camera fires repeatedly while the code stays in frame
              if (cameraLockRef.current) return;
              cameraLockRef.current = true;
              setCameraOpen(false);
              onSubmit?.(data);
            }}
          />
          <TouchableOpacity onPress={() => setCameraOpen(false)} className="m-5 items-center rounded-2xl bg-white py-4">
            <Text className="text-sm font-bold text-slate-900">Close camera</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
});

export default ScanBatteryInput;
