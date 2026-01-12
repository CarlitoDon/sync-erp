import { useState, useCallback } from 'react';

interface UsePhotoUploadOptions {
  /** Maximum number of photos allowed (default: 5) */
  maxPhotos?: number;
  /** Initial photos array */
  initialPhotos?: string[];
}

interface UsePhotoUploadReturn {
  /** Current array of photo base64 strings */
  photos: string[];
  /** Add a new photo (base64 string) */
  addPhoto: (base64: string) => boolean;
  /** Remove photo at index */
  removePhoto: (index: number) => void;
  /** Clear all photos */
  clearPhotos: () => void;
  /** Reset to initial photos */
  reset: () => void;
  /** Whether max photos limit reached */
  isMaxReached: boolean;
  /** Current count */
  count: number;
}

/**
 * Hook for managing photo upload state.
 * Handles adding, removing, and limiting photos.
 */
export function usePhotoUpload(
  options: UsePhotoUploadOptions = {}
): UsePhotoUploadReturn {
  const { maxPhotos = 5, initialPhotos = [] } = options;
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  const addPhoto = useCallback(
    (base64: string): boolean => {
      if (photos.length >= maxPhotos) {
        return false;
      }
      setPhotos((prev) => [...prev, base64]);
      return true;
    },
    [photos.length, maxPhotos]
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  const reset = useCallback(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  return {
    photos,
    addPhoto,
    removePhoto,
    clearPhotos,
    reset,
    isMaxReached: photos.length >= maxPhotos,
    count: photos.length,
  };
}

/**
 * Hook for managing multiple photo upload states (e.g., for multiple units).
 */
export function useMultiPhotoUpload<T extends string | number>(
  maxPhotosPerItem = 5
) {
  const [photosByKey, setPhotosByKey] = useState<
    Record<string, string[]>
  >({});

  const addPhoto = useCallback(
    (key: T, base64: string): boolean => {
      const keyStr = String(key);
      const current = photosByKey[keyStr] || [];
      if (current.length >= maxPhotosPerItem) {
        return false;
      }
      setPhotosByKey((prev) => ({
        ...prev,
        [keyStr]: [...(prev[keyStr] || []), base64],
      }));
      return true;
    },
    [photosByKey, maxPhotosPerItem]
  );

  const removePhoto = useCallback((key: T, photoIndex: number) => {
    const keyStr = String(key);
    setPhotosByKey((prev) => ({
      ...prev,
      [keyStr]: (prev[keyStr] || []).filter(
        (_, i) => i !== photoIndex
      ),
    }));
  }, []);

  const getPhotos = useCallback(
    (key: T): string[] => {
      return photosByKey[String(key)] || [];
    },
    [photosByKey]
  );

  const clearAll = useCallback(() => {
    setPhotosByKey({});
  }, []);

  return {
    photosByKey,
    addPhoto,
    removePhoto,
    getPhotos,
    clearAll,
  };
}
