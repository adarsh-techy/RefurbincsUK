import { useEffect, useRef, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import extractBatteryCode from '../../utils/extract-battery-code';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

// A technician's entry point to start work: scan a battery's QR code with
// the camera, or search/type its code, then jump to its detail screen.
export default function ServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  // Camera fires onBarcodeScanned repeatedly while the code stays in frame —
  // pause after a hit instead of navigating more than once.
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (route.params?.autoScan) {
      handleOpenCamera();
    }
  }, [route.params?.autoScan]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!manualCode.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/batteries', {
          params: { q: manualCode.trim(), limit: SUGGESTION_LIMIT, activeOnly: true },
        });
        setSuggestions(data.data);
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
    // fromScan tells BatteryDetailScreen to only allow entry for a fresh
    // intake battery ('in_repair') and show a blocking popup for anything
    // else — unlike History, which legitimately opens already-worked
    // batteries and must skip this check entirely.
    navigation.navigate('BatteryDetail', { code, fromScan: true });
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
    <View className="flex-1 bg-slate-50 px-5">
      {cameraOpen ? (
        <View className="flex-1 gap-3 pt-8">
          <View className="flex-1 overflow-hidden rounded-2xl border border-blue-200">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          </View>
          <TouchableOpacity
            onPress={() => setCameraOpen(false)}
            className="items-center rounded-md bg-slate-200 py-3"
          >
            <Text className="text-sm font-medium text-slate-700">Stop Scanning</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <Icon name="camera" color="#059669" size={30} />
          </View>
          <Text className="text-lg font-semibold text-slate-900">Scan a Battery to Begin</Text>
          <Text className="mt-2 max-w-xs text-center text-sm text-slate-500">
            Scan the QR code on a battery to start work, log the parts you changed, and mark it
            complete.
          </Text>

          <View className="mt-6 w-full max-w-xs gap-3">
            <TouchableOpacity
              onPress={handleOpenCamera}
              className="items-center rounded-md bg-blue-600 px-4 py-3.5"
            >
              <Text className="text-base font-semibold text-white">Scan with Camera</Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              <View className="h-px flex-1 bg-slate-200" />
              <Text className="text-xs text-slate-400">or search by code</Text>
              <View className="h-px flex-1 bg-slate-200" />
            </View>

            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={() => goToBattery(manualCode)}
              placeholder="Type battery code"
              placeholderTextColor="#6b7280"
              autoCapitalize="characters"
              autoCorrect={false}
              className="rounded-md border border-blue-200 bg-blue-50 px-3.5 py-3 text-center text-base text-slate-900"
            />

            {suggestions.length > 0 && (
              <View className="max-h-64 overflow-hidden rounded-md border border-blue-200 bg-white">
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => goToBattery(item.battery_code)}
                      className="flex-row items-center justify-between border-b border-slate-100 px-3 py-3 last:border-b-0"
                    >
                      <Text className="font-medium text-slate-900">{item.battery_code}</Text>
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
