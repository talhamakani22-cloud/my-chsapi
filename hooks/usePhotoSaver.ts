import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { savePhotoToAppAndLibrary, deletePhotoFromStorage, SavePhotoResult } from '@/utils/photoSaver';

interface UsePhotoSaverState {
  photoUri: string | null;
  photoPath: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePhotoSaverReturn extends UsePhotoSaverState {
  captureAndSave: () => Promise<void>;
  removePhoto: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for managing photo capture and auto-save to device library
 * Usage: const { photoUri, captureAndSave, removePhoto } = usePhotoSaver();
 */
export const usePhotoSaver = (): UsePhotoSaverReturn => {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureAndSave = useCallback(async () => {
    // This is typically called after you've captured the image
    // The actual capture would happen in your component
  }, []);

  const savePhoto = useCallback(async (uri: string, fileName?: string): Promise<SavePhotoResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await savePhotoToAppAndLibrary(uri, fileName);

      if (result.success && result.savedPath) {
        setPhotoUri(result.savedPath);
        setPhotoPath(result.savedPath);
      } else {
        setError(result.message);
      }

      return result;
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      return {
        success: false,
        message: 'Failed to save photo',
        error: errorMsg,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removePhoto = useCallback(async () => {
    if (!photoPath) return;

    setIsLoading(true);
    try {
      const result = await deletePhotoFromStorage(photoPath);
      if (result.success) {
        setPhotoUri(null);
        setPhotoPath(null);
        setError(null);
      }
    } catch (err) {
      console.error('Error removing photo:', err);
    } finally {
      setIsLoading(false);
    }
  }, [photoPath]);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setPhotoPath(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    photoUri,
    photoPath,
    isLoading,
    error,
    captureAndSave,
    removePhoto,
    reset,
  };
};

export default usePhotoSaver;
