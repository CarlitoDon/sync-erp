import React, { useRef, useState } from 'react';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';
import PhotoLightbox from './PhotoLightbox';

interface PhotoUploaderProps {
  /** Array of base64-encoded photo strings */
  photos: string[];
  /** Callback when a new photo is added */
  onAdd: (base64: string) => void;
  /** Callback when a photo is removed by index */
  onRemove: (index: number) => void;
  /** Maximum number of photos allowed (default: 5) */
  maxPhotos?: number;
  /** Label shown when no photos exist */
  label?: string;
  /** Size of photo thumbnails (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
};

export default function PhotoUploader({
  photos,
  onAdd,
  onRemove,
  maxPhotos = 5,
  label = 'Tambah foto',
  size = 'md',
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onAdd(base64);
    };
    reader.readAsDataURL(file);

    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const sizeClass = SIZE_CLASSES[size];
  const canAddMore = photos.length < maxPhotos;

  return (
    <>
      <PhotoLightbox
        photos={photos}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <div className="flex flex-wrap gap-2">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Photo thumbnails */}
        {photos.map((photo, idx) => (
          <div key={idx} className="relative group">
            <img
              src={photo}
              alt={`Foto ${idx + 1}`}
              className={`${sizeClass} object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => openLightbox(idx)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(idx);
              }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add photo button */}
        {canAddMore && (
          <button
            type="button"
            onClick={handleClick}
            className={`${sizeClass} border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-600 transition-colors`}
          >
            <CameraIcon className="w-5 h-5" />
            <span className="text-xs">Foto</span>
          </button>
        )}

        {/* Empty state hint */}
        {photos.length === 0 && (
          <p className="text-xs text-gray-500 flex items-center gap-1 ml-2">
            <PhotoIcon className="w-3 h-3" />
            {label}
          </p>
        )}
      </div>
    </>
  );
}
