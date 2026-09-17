import { useEffect, useState } from 'react';
import { resolveImageUrl } from '../../../utils/image-url';

export function ImageLightboxModal({ images = [], initialIndex = 0, onClose, title = 'Battery Issue Photos' }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length, onClose]);

  if (!images || images.length === 0) return null;

  const currentImg = resolveImageUrl(images[currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="w-full max-w-5xl flex items-center justify-between pb-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold">{title}</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-slate-200 font-medium">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 hover:bg-white/25 p-2 text-white transition-colors"
          title="Close (Esc)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Image Container */}
      <div
        className="relative w-full max-w-5xl flex-1 flex items-center justify-center min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 z-10 rounded-full bg-black/60 hover:bg-black/80 text-white p-3 backdrop-blur-xs transition shadow-lg"
            title="Previous Image (←)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <img
          src={currentImg}
          alt={`Issue Photo ${currentIndex + 1}`}
          className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
        />

        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 z-10 rounded-full bg-black/60 hover:bg-black/80 text-white p-3 backdrop-blur-xs transition shadow-lg"
            title="Next Image (→)"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Thumbnails row if multiple */}
      {images.length > 1 && (
        <div
          className="mt-4 flex items-center gap-3 overflow-x-auto p-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => {
            const url = resolveImageUrl(img);
            const isSelected = idx === currentIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/50' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-16 h-16 object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ImageLightboxModal;
