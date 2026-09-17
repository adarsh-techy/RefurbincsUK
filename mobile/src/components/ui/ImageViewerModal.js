import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ScrollView,
} from 'react-native';
import Icon from './Icon';
import { resolveImageUrl } from '../../utils/imageUrl';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerModal({
  visible,
  images = [],
  initialIndex = 0,
  title = 'Battery Photo',
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);

  if (!visible || !images || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];
  const uri = resolveImageUrl(typeof currentImage === 'string' ? currentImage : currentImage?.uri || currentImage?.url);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView className="flex-1 bg-black justify-between">
        {/* Top Bar */}
        <View className="flex-row items-center justify-between px-5 py-3.5 z-20 bg-black/60">
          <View className="flex-1 pr-3">
            <Text className="text-white text-sm font-bold truncate">
              {title}
            </Text>
            {images.length > 1 && (
              <Text className="text-slate-400 text-xs mt-0.5">
                Photo {currentIndex + 1} of {images.length}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="h-9 w-9 rounded-full bg-white/20 items-center justify-center active:bg-white/30"
          >
            <Icon name="x" color="#ffffff" size={18} />
          </TouchableOpacity>
        </View>

        {/* Main Image Stage */}
        <View className="flex-1 items-center justify-center px-2">
          {loading && (
            <View className="absolute z-10 items-center justify-center">
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text className="text-slate-400 text-xs mt-2 font-medium">Loading high-res photo…</Text>
            </View>
          )}
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Image
              source={{ uri }}
              style={{ width: SCREEN_WIDTH - 16, height: SCREEN_HEIGHT * 0.65 }}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          </ScrollView>
        </View>

        {/* Bottom Bar / Pagination Controls */}
        <View className="px-5 py-4 z-20 bg-black/60">
          {images.length > 1 ? (
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                disabled={currentIndex === 0}
                onPress={() => {
                  setLoading(true);
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
                className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl border ${
                  currentIndex === 0
                    ? 'border-white/10 opacity-30'
                    : 'border-white/20 bg-white/10 active:bg-white/20'
                }`}
              >
                <Icon name="arrowLeft" color="#ffffff" size={14} />
                <Text className="text-white text-xs font-bold">Previous</Text>
              </TouchableOpacity>

              <View className="flex-row items-center gap-1.5">
                {images.map((_, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      if (idx !== currentIndex) {
                        setLoading(true);
                        setCurrentIndex(idx);
                      }
                    }}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentIndex ? 'w-6 bg-sky-400' : 'w-2 bg-white/30'
                    }`}
                  />
                ))}
              </View>

              <TouchableOpacity
                disabled={currentIndex === images.length - 1}
                onPress={() => {
                  setLoading(true);
                  setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
                }}
                className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl border ${
                  currentIndex === images.length - 1
                    ? 'border-white/10 opacity-30'
                    : 'border-white/20 bg-white/10 active:bg-white/20'
                }`}
              >
                <Text className="text-white text-xs font-bold">Next</Text>
                <Icon name="arrowRight" color="#ffffff" size={14} />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center">
              <Text className="text-slate-400 text-xs">Pinch to zoom photo</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
