import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import * as DataWedge from '../../modules/zebra-datawedge';
import { splitScanInput } from '../utils/scan-input';

// Hardware scanner reads (Zebra DataWedge: RFID sled trigger or the built-in
// QR imager) go to the scan box on the screen the user is looking at — no
// field needs focus. Screens subscribe with useHardwareScan(handler); the most
// recently mounted *focused* subscriber gets each read. One trigger pull can
// read several RFID tags; they arrive as separate values.

const handlers = [];
let subscription = null;

function ensureSubscribed() {
  if (subscription || !DataWedge.hasNativeModule) return;
  subscription = DataWedge.addScanListener(({ data, source, labelType }) => {
    const top = handlers[handlers.length - 1];
    if (!top) return;
    String(data || '')
      .split(/[\r\n\t]+/)
      .flatMap((v) => splitScanInput(v))
      // meta tells an RFID read (source "rfid") from a barcode / QR read
      .forEach((v) => top.handle(v, { source, labelType }));
  });
}

// Call once at app start: sets up the DataWedge profile on Zebra devices.
export function setupHardwareScanner() {
  if (!DataWedge.isAvailable()) return false;
  ensureSubscribed();
  return DataWedge.configure('Refurbnics');
}

export const hardwareScannerAvailable = () => DataWedge.isAvailable();
export const hardwareScannerStatus = () => DataWedge.getStatus();

// DataWedge's answer to each setup command ({ command, result, info }), as it
// arrives — used by the Profile "Zebra RFID reader" card.
export const addSetupResultListener = (cb) => DataWedge.addResultListener(cb);

export function useHardwareScan(handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  const focused = useIsFocused();
  useEffect(() => {
    if (!enabled || !focused || !DataWedge.hasNativeModule) return undefined;
    ensureSubscribed();
    const entry = { handle: (v, meta) => ref.current?.(v, meta) };
    handlers.push(entry);
    return () => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [enabled, focused]);
}
