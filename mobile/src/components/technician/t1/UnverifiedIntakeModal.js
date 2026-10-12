import { Modal, Text, TouchableOpacity, View } from 'react-native';

// Same popup as the web technician home page: the scanned battery came in on
// a truck the workshop hasn't verified yet, so work and testing can't start.
export default function UnverifiedIntakeModal({ battery, canOpenIntake, onScanAnother, onOpenIntake, onViewBattery }) {
  if (!battery) return null;
  const rows = [
    ['Battery ID', battery.battery_code, 'font-mono font-bold text-amber-800'],
    ['Truck Number', battery.intake_truck_number ? `Truck #${battery.intake_truck_number}` : 'N/A', 'font-semibold text-slate-800'],
    battery.intake_driver_name ? ['Driver', battery.intake_driver_name, 'font-medium text-slate-700'] : null,
    ['Shipment Status', 'Pending Arrival Verification', 'font-bold text-amber-700'],
  ].filter(Boolean);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onScanAnother}>
      <View className="flex-1 items-center justify-center bg-black/60 p-4">
        <View className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6">
          <View className="mb-3.5 h-14 w-14 items-center justify-center self-center rounded-2xl border border-amber-300 bg-amber-100">
            <Text className="text-2xl">⚠️</Text>
          </View>
          <View className="mb-2 items-center">
            <View className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1">
              <Text className="text-[11px] font-bold text-amber-800">Intake Not Verified</Text>
            </View>
          </View>
          <Text className="mb-1 text-center text-lg font-bold text-slate-900">Battery Not Verified at Intake</Text>
          <Text className="mb-4 text-center text-xs leading-5 text-slate-500">
            This battery has not been verified at intake yet. Work or testing cannot begin until the workshop verifies the truck shipment arrival.
          </Text>

          <View className="mb-5 gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            {rows.map(([label, value, valueClass], i) => (
              <View
                key={label}
                className={`flex-row items-center justify-between ${i < rows.length - 1 ? 'border-b border-amber-200/60 pb-1.5' : ''}`}
              >
                <Text className="text-xs font-medium text-slate-500">{label}</Text>
                <Text className={`text-xs ${valueClass}`}>{value}</Text>
              </View>
            ))}
          </View>

          <View className="gap-2.5">
            <TouchableOpacity onPress={onScanAnother} className="items-center rounded-xl bg-blue-600 py-3">
              <Text className="text-sm font-bold text-white">📷 Scan Another Battery</Text>
            </TouchableOpacity>
            {battery.truck_intake_id && canOpenIntake ? (
              <TouchableOpacity onPress={onOpenIntake} className="items-center rounded-xl border border-amber-300 bg-amber-50 py-2.5">
                <Text className="text-xs font-bold text-amber-900">Go to Truck Intake Shipment</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onViewBattery} className="items-center rounded-xl border border-slate-200 bg-slate-100 py-2">
              <Text className="text-xs font-semibold text-slate-700">View Battery Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
