import { useState, useEffect } from 'react';
import {
  getModelService,
  ModelDownloadProgress,
} from '@/lib/services/model-service';
import { INPAINTING_CONFIG } from '@/lib/constants';
import { logger } from '@/lib/logger';

interface ModelLoaderState {
  isLoading: boolean;
  progress: number;
  error: string | null;
  isReady: boolean;
}

/**
 * Hook to eagerly load the AI model on page mount
 */
export function useModelLoader() {
  const [state, setState] = useState<ModelLoaderState>({
    isLoading: true,
    progress: 0,
    error: null,
    isReady: false,
  });

  useEffect(() => {
    console.log('🚀 useModelLoader: Effect triggered');
    let mounted = true;

    const loadModel = async () => {
      try {
        console.log('🚀 useModelLoader: Starting model load');
        logger.info('Starting eager model download');
        const modelService = getModelService();
        console.log('🚀 useModelLoader: Model service initialized');

        // Check if model is already cached
        console.log(
          '🚀 useModelLoader: Checking cache for',
          INPAINTING_CONFIG.MODEL_URL
        );
        const isCached = await modelService.isModelCached(
          INPAINTING_CONFIG.MODEL_URL
        );
        console.log('🚀 useModelLoader: Cache check result:', isCached);

        if (isCached) {
          console.log('🚀 useModelLoader: Model cached, loading instantly');
          logger.info('Model already cached, loading instantly');
          if (mounted) {
            setState({
              isLoading: false,
              progress: 100,
              error: null,
              isReady: true,
            });
          }
          return;
        }

        // Download model with progress tracking
        console.log('🚀 useModelLoader: Starting download...');
        await modelService.downloadModel(
          INPAINTING_CONFIG.MODEL_URL,
          (progress: ModelDownloadProgress) => {
            console.log(
              '🚀 useModelLoader: Progress:',
              progress.percentage + '%'
            );
            if (mounted) {
              setState({
                isLoading: true,
                progress: progress.percentage,
                error: null,
                isReady: false,
              });
            }
          }
        );
        console.log('🚀 useModelLoader: Download complete!');

        if (mounted) {
          logger.info('Model download complete');
          setState({
            isLoading: false,
            progress: 100,
            error: null,
            isReady: true,
          });
        }
      } catch (error) {
        console.error('🚨 useModelLoader: Error occurred', error);
        logger.error('Model download failed', { error });
        if (mounted) {
          setState({
            isLoading: false,
            progress: 0,
            error:
              error instanceof Error ? error.message : 'Failed to load model',
            isReady: false,
          });
        }
      }
    };

    console.log('🚀 useModelLoader: Calling loadModel()');
    loadModel();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
