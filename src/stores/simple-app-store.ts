import { create } from 'zustand';
import { logger } from '@/lib/logger';

type AppState = 'loading' | 'ready' | 'processing' | 'complete';

interface ImageState {
  originalImage: Blob | null;
  originalImageUrl: string | null;
  cleanedImage: Blob | null;
  cleanedImageUrl: string | null;
}

interface AppStore extends ImageState {
  appState: AppState;
  modelProgress: number;

  // Actions
  setAppState: (state: AppState) => void;
  setModelProgress: (progress: number) => void;
  setOriginalImage: (blob: Blob) => void;
  setCleanedImage: (blob: Blob) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // State
  appState: 'loading',
  modelProgress: 0,
  originalImage: null,
  originalImageUrl: null,
  cleanedImage: null,
  cleanedImageUrl: null,

  // Actions
  setAppState: (appState: AppState) => {
    logger.info('App state changed', { appState });
    set({ appState });
  },

  setModelProgress: (progress: number) => {
    set({ modelProgress: progress });
  },

  setOriginalImage: (blob: Blob) => {
    const state = get();

    // Cleanup old URL
    if (state.originalImageUrl) {
      URL.revokeObjectURL(state.originalImageUrl);
    }

    const url = URL.createObjectURL(blob);
    logger.info('Original image set', { size: blob.size });

    set({
      originalImage: blob,
      originalImageUrl: url,
      appState: 'processing',
    });
  },

  setCleanedImage: (blob: Blob) => {
    const state = get();

    // Cleanup old URL
    if (state.cleanedImageUrl) {
      URL.revokeObjectURL(state.cleanedImageUrl);
    }

    const url = URL.createObjectURL(blob);
    logger.info('Cleaned image set', { size: blob.size });

    set({
      cleanedImage: blob,
      cleanedImageUrl: url,
      appState: 'complete',
    });
  },

  reset: () => {
    const state = get();

    // Cleanup URLs
    if (state.originalImageUrl) {
      URL.revokeObjectURL(state.originalImageUrl);
    }
    if (state.cleanedImageUrl) {
      URL.revokeObjectURL(state.cleanedImageUrl);
    }

    logger.info('App state reset');

    set({
      originalImage: null,
      originalImageUrl: null,
      cleanedImage: null,
      cleanedImageUrl: null,
      appState: 'ready',
    });
  },
}));
