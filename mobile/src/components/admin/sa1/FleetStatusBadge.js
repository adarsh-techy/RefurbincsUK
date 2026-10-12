import { Text, View } from 'react-native';
import { StatusBadge } from '../../ui/Badge';

// The web StatusBadge's extra state: a battery waiting for its fitted parts
// to be taken off shows "Passed to Remove Parts" instead of its status.
export default function FleetStatusBadge({ status, isPassedBack, hasPendingParts }) {
  const pendingRemoval =
    status === 'passed_to_remove' ||
    status === 'passed_for_part_removal' ||
    (['in_repair', 'unserviceable'].includes(status) && (isPassedBack || hasPendingParts));
  if (pendingRemoval) {
    return (
      <View className="flex-row items-center gap-1.5 self-start rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5">
        <View className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <Text className="text-xs font-bold text-amber-900">Passed to Remove Parts</Text>
      </View>
    );
  }
  return <StatusBadge status={status || 'registered'} />;
}
