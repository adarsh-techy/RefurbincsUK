import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from '../ui/Icon';
import { hardwareScannerAvailable, useHardwareScan } from '../../services/hardware-scanner';
import { isUnassignedTagMessage, normalizeRfidTag, splitScanInput } from '../../utils/scan-input';

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
// code, serial or tag) with utils/scan-input. onSubmit may return (or resolve
// to) { tone: 'good' | 'warn' | 'bad', message } — every scan then gives a
// clear answer: good/warn as a banner under the box, bad (unassigned tag, not
// on this list, no connection…) as a popup that has to be dismissed, each
// with a vibration. Without a result the box just confirms what was read.
//
// UHF tags (EPC "E280…") can't be read by a phone's own NFC, so the reader
// is always an external device.

// Readers that end a tag with Enter/Tab submit at once. Without one, the tag
// is submitted after this much quiet — long enough that a slow Bluetooth/HID
// reader can't be cut mid-tag, and never for a fragment under 8 characters.
const RFID_IDLE_SUBMIT_MS = 700;
const MIN_TAG_LENGTH = 8;
// UHF EPC-96 tags are 24 hex characters. A reader typing tag after tag with
// no suffix gives no boundary at all, so in RFID mode a hex run is cut into
// complete tags as it grows (pass tagLength for readers set up otherwise).
const EPC_TAG_LENGTH = 24;
// a complete tag with nothing after it is submitted after this short pause
const COMPLETE_TAG_SUBMIT_MS = 150;
const isHexRun = (s) => /^[0-9A-F]+$/.test(s);
// A reader repeats the tag it is pointed at many times a second; the same
// value again within this window is the same scan, not a new one.
const REPEAT_READ_MS = 2500;

const VIBRATE = { good: 60, warn: 180, bad: [0, 160, 90, 160] };

// popup title for a refused scan, from its message
function problemTitle(message = '') {
  if (/not assigned/i.test(message)) return 'RFID tag not assigned';
  if (/reach the server|network|timeout/i.test(message)) return 'No connection to the server';
  if (/not (on|in) (this|the)/i.test(message)) return 'Not on this list';
  if (/already assigned to|tag in use|belongs to another/i.test(message)) return 'Tag is on another battery';
  if (/does not match|client mismatch/i.test(message)) return 'Different client';
  if (/already sorted in the .*group/i.test(message)) return 'Already in another sort group';
  if (/already/i.test(message)) return 'Already scanned';
  if (/not one of your|not found|no battery/i.test(message)) return 'Battery not found';
  return 'Scan problem';
}

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
    multiple = true, // false: a read holding several tags is refused (tag assignment)
    tagLength = EPC_TAG_LENGTH, // characters in one tag, for cutting a run of tags typed back to back
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

  const [result, setResult] = useState(null); // { tone, message } of the last scan
  const [problem, setProblem] = useState(null); // { title, message, value } → popup
  // reader problems during a sweep: kept (newest first) until dismissed, so a
  // later successful read can't hide them
  const [readerIssues, setReaderIssues] = useState([]);
  const resultTimer = useRef(null);
  const queueRef = useRef(Promise.resolve()); // scans are handled one at a time, in order
  const recentRef = useRef(new Map()); // value → when it was last taken

  // Every scan (typed, reader, camera, Zebra trigger) ends here.
  // fromReader: an RFID/QR reader read (trigger or keystroke burst). Its
  // problems show as a banner instead of a popup, so the reader can keep
  // sweeping without a dialog swallowing the next tags.
  async function deliver(v, fromReader = false) {
    setLastRead(v);
    let res;
    try {
      res = await onSubmit?.(v);
    } catch (err) {
      res = { tone: 'bad', message: err?.response?.data?.message || err?.message || 'Scan failed' };
    }
    clearTimeout(resultTimer.current);
    if (res?.ignore || isUnassignedTagMessage(res?.message)) {
      // unregistered RFID tag: ignore it quietly
      setLastRead(null);
      return;
    }
    if (!res?.tone) {
      setResult({ tone: 'info', message: `Scanned ${v}` });
    } else if (res.tone === 'bad' || res.tone === 'error') {
      if (fromReader) {
        setReaderIssues((list) => [{ id: `${Date.now()}-${v}`, message: res.message }, ...list.filter((x) => x.message !== res.message)].slice(0, 5));
      } else {
        setResult(null);
        setProblem({ title: problemTitle(res.message), message: res.message, value: v });
      }
    } else {
      setResult(res);
    }
    Vibration.vibrate(VIBRATE[res?.tone === 'error' ? 'bad' : res?.tone] || VIBRATE.good);
    resultTimer.current = setTimeout(() => setResult(null), 4000);
  }

  function closeProblem() {
    setProblem(null);
    if (rfidMode) setTimeout(() => inputRef.current?.focus(), 60);
  }

  useEffect(() => () => clearTimeout(resultTimer.current), []);

  const zebra = hardwareScannerAvailable();
  // A new trigger pull while a problem popup is open replaces the popup
  // instead of being dropped (and never falls through to another screen).
  useHardwareScan((v) => {
    if (problem) setProblem(null);
    deliverAll(splitScanInput(v), true);
  }, !disabled);

  function deliverAll(pieces, fromReader = false) {
    if (!multiple && pieces.length > 1) {
      setProblem({
        title: 'Several tags read at once',
        message: `The reader picked up ${pieces.length} tags. Hold only one sticker near the reader and scan again.`,
        value: pieces.join(', '),
      });
      Vibration.vibrate(VIBRATE.bad);
      return;
    }
    const now = Date.now();
    pieces.forEach((piece) => {
      const key = normalizeRfidTag(piece) || piece;
      if (now - (recentRef.current.get(key) || 0) < REPEAT_READ_MS) return; // repeated read
      recentRef.current.set(key, now);
      // queued: a fast second tag waits for the first to be added, so both
      // count and the page always sees the latest list
      queueRef.current = queueRef.current.then(() => deliver(piece, fromReader)).catch(() => {});
    });
  }

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

  // Each piece is delivered on its own: one burst can hold several tags.
  // keep: text left in the box afterwards (the part of the next tag that has
  // already arrived), so nothing typed meanwhile is lost
  function submit(raw, keep = '') {
    clearTimeout(idleRef.current);
    const pieces = String(raw ?? valueRef.current)
      .split(/[\t\r\n]+/)
      .flatMap((p) => splitScanInput(p));
    if (!pieces.length) return;
    setText(keep);
    deliverAll(pieces, rfidMode); // in RFID mode the text came from the reader
    if (rfidMode) setTimeout(() => inputRef.current?.focus(), 30);
  }

  function handleChange(text) {
    // a reader that ends each tag with Tab/Enter (or, in RFID mode, a comma
    // or semicolon): deliver every finished tag and keep whatever is still
    // being typed after the last one. Spaces aren't a boundary — an EPC
    // grouped in fours or "EPC: E280…" contains them.
    const boundary = rfidMode ? /[\t\r\n,;]/ : /[\t\r\n]/;
    if (boundary.test(text)) {
      const splitter = rfidMode ? /[\t\r\n,;]+/ : /[\t\r\n]+/;
      const endsWithBreak = new RegExp(`${boundary.source}$`).test(text);
      const parts = text.split(splitter);
      const rest = endsWithBreak ? '' : parts.pop();
      if (parts.some((p) => p.trim())) submit(parts.join('\n'), rest);
      if (rest || !parts.some((p) => p.trim())) handleChange(rest || '');
      return;
    }
    if (rfidMode && multiple && tagLength > 0) {
      // no boundary from the reader: cut complete tags off the front as the
      // run grows, so the box only ever holds the tag still arriving
      const clean = normalizeRfidTag(text);
      if (clean.length > tagLength && isHexRun(clean)) {
        const complete = [];
        let rest = clean;
        while (rest.length > tagLength) {
          complete.push(rest.slice(0, tagLength));
          rest = rest.slice(tagLength);
        }
        submit(complete.join('\n'), rest);
        handleChange(rest);
        return;
      }
    }
    setText(text);
    if (rfidMode) {
      clearTimeout(idleRef.current);
      const clean = normalizeRfidTag(text);
      if (clean.length >= MIN_TAG_LENGTH) {
        // a whole tag that stops here goes quickly; anything else waits for
        // the reader to go quiet (a slow reader mid-tag is never cut)
        const wait = multiple && clean.length === tagLength && isHexRun(clean) ? COMPLETE_TAG_SUBMIT_MS : RFID_IDLE_SUBMIT_MS;
        idleRef.current = setTimeout(() => submit(valueRef.current), wait);
      }
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
    info: 'border-slate-200 bg-slate-50 text-slate-700',
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
      {result?.message ? (
        <Text className={`mt-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${tones[result.tone] || tones.info}`}>
          {result.message}
        </Text>
      ) : feedback?.message ? (
        <Text className={`mt-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${tones[feedback.tone] || tones.bad}`}>
          {feedback.message}
        </Text>
      ) : null}
      {readerIssues.length ? (
        <View className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-extrabold text-red-700">
              {readerIssues.length === 1 ? 'Could not add 1 tag' : `Could not add ${readerIssues.length} tags`}
            </Text>
            <TouchableOpacity onPress={() => setReaderIssues([])} hitSlop={10}>
              <Text className="text-[11px] font-bold text-red-700">Dismiss</Text>
            </TouchableOpacity>
          </View>
          {readerIssues.map((x) => (
            <Text key={x.id} className="mt-1 text-xs text-red-700">• {x.message}</Text>
          ))}
        </View>
      ) : null}

      {/* refused scan: has to be acknowledged so it can't be missed */}
      <Modal visible={Boolean(problem)} transparent animationType="fade" onRequestClose={closeProblem}>
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full max-w-md items-center rounded-3xl bg-white p-6 dark:bg-slate-900">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Text className="text-3xl font-black text-red-600">✕</Text>
            </View>
            <Text className="mt-4 text-center text-lg font-extrabold text-slate-900 dark:text-white">{problem?.title}</Text>
            <Text className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">{problem?.message}</Text>
            {problem?.value ? (
              <View className="mt-4 w-full rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <Text className="text-[10px] font-bold uppercase text-slate-400">Scanned</Text>
                <Text className="font-mono text-xs font-bold text-slate-900 dark:text-white" selectable>{problem.value}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={closeProblem} className="mt-5 w-full items-center rounded-2xl bg-red-600 py-3.5">
              <Text className="text-sm font-bold text-white">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              deliver(data);
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
