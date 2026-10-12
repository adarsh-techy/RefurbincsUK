import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { capitalizeFirstLetter } from './sort-utils';

// Popups of the Battery Sorting screen — the mobile versions of the web
// page's Modal / ConfirmModal / AlertModal. `buttons` run right to left like
// the web footer: the last one is the main action.
const ICONS = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-600', glyph: '✓' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-600', glyph: '!' },
  danger: { bg: 'bg-red-100', text: 'text-red-600', glyph: '✕' },
};

const BUTTON = {
  primary: { box: 'bg-emerald-600', text: 'text-white' },
  danger: { box: 'border border-red-200 bg-red-50', text: 'text-red-700' },
  dangerSolid: { box: 'bg-red-600', text: 'text-white' },
  plain: { box: '', text: 'text-slate-600 dark:text-slate-300' },
};

export default function SortDialog({ visible, tone, title, message, buttons = [], onClose }) {
  const icon = ICONS[tone];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <View className="flex-row items-start gap-3">
            {icon ? (
              <View className={`h-11 w-11 items-center justify-center rounded-full ${icon.bg}`}>
                <Text className={`text-xl font-black ${icon.text}`}>{icon.glyph}</Text>
              </View>
            ) : null}
            <View className="flex-1">
              <Text className="text-base font-extrabold text-slate-900 dark:text-white">{title}</Text>
              {message ? <Text className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{message}</Text> : null}
            </View>
          </View>
          <View className="mt-5 flex-row flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {buttons.map((b) => {
              const s = BUTTON[b.kind || 'plain'];
              return (
                <TouchableOpacity key={b.label} onPress={b.onPress} className={`rounded-xl px-4 py-2.5 ${s.box}`}>
                  <Text className={`text-xs font-bold ${s.text}`}>{b.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Create / rename a sort group
export function NameModal({ visible, mode, value, onChangeValue, onCancel, onSubmit }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <Text className="text-base font-extrabold text-slate-900 dark:text-white">
            {mode === 'create' ? 'New Sort Group' : 'Rename Sort Group'}
          </Text>
          <Text className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Group Name</Text>
          <TextInput
            value={value}
            onChangeText={(text) => onChangeValue(capitalizeFirstLetter(text))}
            onSubmitEditing={onSubmit}
            placeholder="e.g. Site A Requirement, 40Ah Batch, Order #204"
            placeholderTextColor="#94a3b8"
            autoCapitalize="sentences"
            autoFocus
            className="rounded-md border border-blue-300 bg-blue-50 px-3.5 py-2.5 text-sm text-slate-900 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-white"
          />
          <View className="mt-5 flex-row justify-end gap-2">
            <TouchableOpacity onPress={onCancel} className="rounded-xl px-4 py-2.5">
              <Text className="text-xs font-bold text-slate-600 dark:text-slate-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={!value.trim()}
              className={`rounded-xl bg-emerald-600 px-5 py-2.5 ${!value.trim() ? 'opacity-50' : ''}`}
            >
              <Text className="text-xs font-bold text-white">{mode === 'create' ? 'Create Group' : 'Save Name'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
