import { Dimensions, Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../ui/Icon';

// Invoice image preview — the web page's document preview modal: title,
// file name, the image (pinch-zoom), and Download / Close.
export default function InvoicePreviewModal({ preview, onDownload, downloading, onClose }) {
  const { width, height } = Dimensions.get('window');
  return (
    <Modal visible={Boolean(preview)} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="flex-1">
            <Text className="text-sm font-bold text-white" numberOfLines={1}>{preview?.invoice?.invoice_number || 'Invoice Document'}</Text>
            <Text className="text-[11px] text-slate-400" numberOfLines={1}>{preview?.invoice?.file_name || 'Document Viewer'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Icon name="x" color="#fff" size={18} />
          </TouchableOpacity>
        </View>
        <ScrollView maximumZoomScale={3} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          {preview?.uri ? (
            <Image source={{ uri: preview.uri }} style={{ width: width - 16, height: height * 0.7 }} resizeMode="contain" />
          ) : null}
        </ScrollView>
        <View className="flex-row gap-2 px-4 py-4">
          <TouchableOpacity
            disabled={downloading}
            onPress={() => preview && onDownload(preview.invoice)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 ${downloading ? 'opacity-60' : ''}`}
          >
            <Text className="text-xs font-bold text-white">{downloading ? 'Preparing…' : '⤓ Download'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} className="flex-1 items-center justify-center rounded-xl border border-white/30 py-3">
            <Text className="text-xs font-bold text-white">Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
