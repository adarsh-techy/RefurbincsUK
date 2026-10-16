import { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../services/api-client';
import { isLikelyRfidTag } from '../../utils/scan-input';
import extractBatteryCode from '../../utils/extract-battery-code';
import { StatusBadge } from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import RfidLookupButton from '../../components/scan/RfidLookupButton';
import { isIntakeUnverified } from '../../utils/intake';
import UnverifiedIntakeModal from '../../components/technician/t1/UnverifiedIntakeModal';
import { canTestBatteries, hasPermission, useLiveStaffUser } from '../../components/technician/t1/staff-role';

const SUGGESTION_LIMIT = 20;
const DEBOUNCE_MS = 250;

// A technician's entry point to start work: scan a battery's QR code with
// the camera, or search/type its code, then jump to its detail screen.
// Mirrors the web TechnicianHomePage: the battery is looked up first, and one
// still on an unverified truck intake gets a popup instead of opening.
export default function ServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const currentUser = useSelector((state) => state.auth.user);
  // live staff role from /auth/me, like the web (a promotion to supervisor
  // takes effect without signing out)
  const effectiveUser = useLiveStaffUser(currentUser);
  const canTest = canTestBatteries(effectiveUser);
  // the intake page is admin-only on the web; on mobile it needs the
  // truck_intakes permission the backend checks
  const canOpenIntake = hasPermission(currentUser, 'truck_intakes');
  const [checkingScan, setCheckingScan] = useState(false);
  const [unverifiedBattery, setUnverifiedBattery] = useState(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  // Camera fires onBarcodeScanned repeatedly while the code stays in frame —
  // pause after a hit instead of navigating more than once.
  const scanLockRef = useRef(false);
  // one lookup at a time (camera frames, scanner trigger and typing can all
  // fire at once)
  const checkingRef = useRef(false);

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
        const params = {
          q: manualCode.trim(),
          limit: SUGGESTION_LIMIT,
          intakedOnly: 'true',
        };
        if (canTest) {
          params.includeTesting = 'true';
        }
        const { data } = await apiClient.get('/batteries', { params });
        setSuggestions(data.data);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [manualCode, canTest]);

  async function goToBattery(raw) {
    const code = extractBatteryCode(raw);
    if (!code) return;
    if (checkingRef.current) return;
    checkingRef.current = true;
    setSuggestions([]);
    setManualCode('');
    setCheckingScan(true);

    try {
      const { data } = await apiClient.get(`/batteries/${encodeURIComponent(code)}`);
      if (isIntakeUnverified(data.battery)) {
        setCameraOpen(false);
        setUnverifiedBattery(data.battery);
        return; // staying here — accept new scans
      }
    } catch (err) {
      // an unregistered RFID tag is ignored quietly; other not-found /
      // offline cases go on to the detail screen, which shows its own error
      if (err?.response?.status === 404 && isLikelyRfidTag(raw)) {
        setCheckingScan(false);
        checkingRef.current = false;
        return;
      }
    } finally {
      setCheckingScan(false);
      checkingRef.current = false;
    }

    setCameraOpen(false);
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

  const roleName = effectiveUser?.staff_role === 'supervisor' ? 'Supervisor' : 'Technician';
  const userName = currentUser?.name || 'Technician';

  return (
    <View className="flex-1 bg-slate-100">
      {cameraOpen ? (
        <View className="flex-1 gap-3 p-4 pt-8">
          <View className="flex-1 overflow-hidden rounded-2xl border border-slate-300">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          </View>
          <TouchableOpacity
            onPress={() => setCameraOpen(false)}
            className="items-center rounded-xl bg-slate-800 py-3.5 active:opacity-90"
          >
            <Text className="text-sm font-bold text-white">Stop Scanning</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-sm self-center my-auto">
            {/* ── Main Scan Hero Card ── */}
            <View className="items-center rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
              {/* Emblem Icon */}
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                <Icon name="camera" color="#059669" size={28} />
              </View>

              <Text className="text-lg font-bold text-slate-900">Scan a Battery to Begin</Text>
              <Text className="mt-1.5 text-center text-xs text-slate-500 leading-relaxed max-w-xs">
                Scan the QR code on a battery, tap RFID reader, or enter the ID below to start work.
              </Text>

              {/* Primary Action Button */}
              <TouchableOpacity
                onPress={handleOpenCamera}
                disabled={checkingScan}
                className={`mt-5 w-full flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 shadow-xs active:opacity-90 ${checkingScan ? 'opacity-50' : ''}`}
              >
                <Icon name="camera" color="#ffffff" size={18} />
                <Text className="text-sm font-bold text-white">
                  {checkingScan ? 'Checking Battery…' : 'Scan with Camera'}
                </Text>
              </TouchableOpacity>

              {/* RFID Lookup Button */}
              <View className="w-full mt-2.5">
                <RfidLookupButton onScan={goToBattery} />
              </View>

              {/* Divider */}
              <View className="my-3 flex-row items-center gap-2 w-full">
                <View className="h-px flex-1 bg-slate-200" />
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or search by code</Text>
                <View className="h-px flex-1 bg-slate-200" />
              </View>

              {/* Search Input with Icon & Submit */}
              <View className="w-full flex-row items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-1">
                <Icon name="search" color="#94a3b8" size={16} />
                <TextInput
                  value={manualCode}
                  onChangeText={setManualCode}
                  onSubmitEditing={() => goToBattery(manualCode)}
                  placeholder="Type battery code"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  className="flex-1 px-2.5 py-2 text-xs font-semibold text-slate-900 text-left"
                />
                {manualCode.trim().length > 0 && (
                  <View className="flex-row items-center gap-1.5">
                    <TouchableOpacity onPress={() => setManualCode('')} className="p-1">
                      <Icon name="close" color="#94a3b8" size={14} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => goToBattery(manualCode)}
                      className="flex-row items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1"
                    >
                      <Text className="text-[11px] font-bold text-white">Go</Text>
                      <Icon name="arrowRight" color="#ffffff" size={10} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Suggestions Dropdown (Longer & Richer) */}
              {suggestions.length > 0 && (
                <View className="mt-2 w-full max-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => goToBattery(item.battery_code)}
                        className="flex-row items-center justify-between border-b border-slate-100 px-3.5 py-3 last:border-b-0 active:bg-slate-50"
                      >
                        <View className="flex-1 pr-2">
                          <Text className="text-xs font-bold text-slate-900">{item.battery_code}</Text>
                          {item.client_name ? (
                            <Text className="text-[10px] text-slate-400 mt-0.5">{item.client_name}</Text>
                          ) : null}
                        </View>
                        <StatusBadge status={item.status} />
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <UnverifiedIntakeModal
        battery={unverifiedBattery}
        canOpenIntake={canOpenIntake}
        onScanAnother={() => {
          setUnverifiedBattery(null);
          setManualCode('');
          handleOpenCamera();
        }}
        onOpenIntake={() => {
          const id = unverifiedBattery.truck_intake_id;
          setUnverifiedBattery(null);
          navigation.navigate('AdminIntakeDetail', { id });
        }}
        onViewBattery={() => {
          const code = unverifiedBattery.battery_code;
          setUnverifiedBattery(null);
          navigation.navigate('BatteryDetail', { code });
        }}
      />
    </View>
  );
}
