import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// JS side of the Zebra DataWedge bridge (android/…/ZebraDataWedgeModule.kt).
// Null-safe everywhere: in Expo Go, on iOS, on the web or on a phone without
// DataWedge the native module is missing and every call is a no-op.
const Native = Platform.OS === 'android' ? requireOptionalNativeModule('ZebraDataWedge') : null;

export const hasNativeModule = Boolean(Native);

export function isAvailable() {
  try {
    return Boolean(Native?.isAvailable());
  } catch {
    return false;
  }
}

// Creates / updates the DataWedge profile for this app (RFID + QR in, intent out).
export function configure(profileName = 'Refurbnics') {
  try {
    return Boolean(Native?.configure(profileName));
  } catch {
    return false;
  }
}

export function getStatus() {
  try {
    return Native ? Native.getStatus() : { installed: false };
  } catch {
    return { installed: false };
  }
}

// cb({ data, labelType, source }) for every read; returns { remove() }
export function addScanListener(cb) {
  if (!Native) return { remove() {} };
  return Native.addListener('onScan', cb);
}

export function addResultListener(cb) {
  if (!Native) return { remove() {} };
  return Native.addListener('onResult', cb);
}
