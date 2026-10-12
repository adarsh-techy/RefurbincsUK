import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import apiClient from '../../../services/api-client';
import { SmallButton } from './common';

// Same flow as the web Trash RestoreModal: confirm → POST /trash/:id/restore
// → result. onRestored runs when the user closes the success screen.
export default function RestoreModal({ item, onClose, onRestored }) {
  const [state, setState] = useState('confirm'); // confirm | working | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (item) {
      setState('confirm');
      setResult(null);
      setError(null);
    }
  }, [item]);

  async function restore() {
    setState('working');
    setError(null);
    try {
      const { data } = await apiClient.post(`/trash/${item.id}/restore`);
      setResult(data);
      setState('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore item');
      setState('error');
    }
  }

  function close() {
    if (state === 'working') return;
    if (state === 'done' && onRestored) onRestored(result);
    else onClose();
  }

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="w-full max-w-md rounded-3xl bg-white p-5">
          {state === 'done' ? (
            <>
              <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Text className="text-lg font-bold text-emerald-700">✓</Text>
              </View>
              <Text className="mt-3 text-base font-black text-slate-900">Item Restored</Text>
              <Text className="mt-1 text-sm font-semibold text-slate-800">{result?.message || `"${item?.title}" was restored.`}</Text>
              <Text className="mt-1 text-sm text-slate-600">It has been put back and removed from the trash bin.</Text>
              {result?.notes?.length ? (
                <View className="mt-2 gap-1">
                  {result.notes.map((n) => (
                    <Text key={n} className="text-xs text-amber-700">• {n}</Text>
                  ))}
                </View>
              ) : null}
              <View className="mt-5 flex-row justify-end">
                <SmallButton label="Done" tone="green" onPress={close} />
              </View>
            </>
          ) : (
            <>
              <Text className="text-base font-black text-slate-900">Restore Item?</Text>
              <Text className="mt-2 text-sm leading-5 text-slate-600">
                Put <Text className="font-bold text-slate-800">"{item?.title}"</Text> back where it came from?
              </Text>
              {item?.restore_note ? <Text className="mt-2 text-xs text-amber-700">{item.restore_note}</Text> : null}
              {state === 'error' ? (
                <Text className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</Text>
              ) : null}
              <View className="mt-5 flex-row justify-end gap-2">
                <SmallButton label="Cancel" onPress={close} disabled={state === 'working'} />
                <TouchableOpacity
                  disabled={state === 'working'}
                  onPress={restore}
                  className={`flex-row items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 ${state === 'working' ? 'opacity-60' : ''}`}
                >
                  {state === 'working' ? <ActivityIndicator size="small" color="#fff" /> : null}
                  <Text className="text-xs font-bold text-white">
                    {state === 'working' ? 'Restoring…' : state === 'error' ? 'Try Again' : 'Restore'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
