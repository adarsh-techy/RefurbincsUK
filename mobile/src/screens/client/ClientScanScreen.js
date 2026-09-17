import { useEffect, useRef, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import extractBatteryCode from '../../utils/extract-battery-code';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

export default function ClientScanScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const scanLockRef = useRef(false);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!manualCode.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/clients/me/batteries');
        const q = manualCode.trim().toLowerCase();
        const list = (data.data || []).filter(
          (b) =>
            b.battery_code?.toLowerCase().includes(q) ||
            b.serial_number?.toLowerCase().includes(q)
        );
        setSuggestions(list.slice(0, SUGGESTION_LIMIT));
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [manualCode]);

  function goToBattery(raw) {
    const code = extractBatteryCode(raw);
    if (!code) return;
    setCameraOpen(false);
    setSuggestions([]);
    setManualCode('');
    navigation.navigate('BatteryDetail', { code, fromScan: false });
  }

  async function handleOpenCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    scanLockRef.current = false;
    setCameraOpen(true);
  }

  function handleBarcodeScanned({ data }) {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    goToBattery(data);
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950 px-5">
      {cameraOpen ? (
        <View className="flex-1 gap-4 pt-8 pb-10">
          <View className="flex-1 overflow-hidden rounded-3xl border border-blue-500/50 bg-black shadow-2xl">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            {/* Viewfinder Target Overlay */}
            <View className="absolute inset-0 items-center justify-center pointer-events-none">
              <View className="h-56 w-56 rounded-3xl border-2 border-emerald-400/80 bg-emerald-400/5" />
              <Text className="mt-4 text-xs font-bold text-white uppercase tracking-widest bg-black/60 px-3 py-1 rounded-full">
                Align QR Code in Frame
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setCameraOpen(false)}
            className="items-center rounded-2xl bg-slate-100 dark:bg-slate-800 py-4 shadow-sm active:bg-slate-200 dark:active:bg-slate-700"
          >
            <Text className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">Close Camera</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <View className="mb-6 h-24 w-24 items-center justify-center rounded-3xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 shadow-2xl">
            <Icon name="camera" color="#2563eb" size={36} />
          </View>
          <Text className="text-2xl font-black text-slate-900 dark:text-white">Scan Battery QR Code</Text>
          <Text className="mt-2 max-w-xs text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Scan the QR code on your battery to inspect its full intake-to-return lifecycle, repair parts, and testing record.
          </Text>

          <View className="mt-8 w-full max-w-xs gap-3">
            <TouchableOpacity
              onPress={handleOpenCamera}
              activeOpacity={0.8}
              className="items-center rounded-2xl bg-blue-600 px-4 py-4 shadow-lg shadow-blue-600/30 active:bg-blue-700"
            >
              <Text className="text-base font-bold text-white">Open Device Camera</Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3 my-2">
              <View className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
              <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">or search code</Text>
              <View className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </View>

            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={() => goToBattery(manualCode)}
              placeholder="e.g. DEM-0001 or scan link"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 text-center text-sm font-bold text-slate-900 dark:text-white"
            />

            {suggestions.length > 0 && (
              <View className="max-h-64 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => goToBattery(item.battery_code)}
                      className="flex-row items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
                    >
                      <View>
                        <Text className="font-bold text-blue-600 dark:text-blue-400 text-sm">{item.battery_code}</Text>
                        {item.serial_number && (
                          <Text className="text-xs text-slate-500 dark:text-slate-400">SN: {item.serial_number}</Text>
                        )}
                      </View>
                      <StatusBadge status={item.status} />
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
