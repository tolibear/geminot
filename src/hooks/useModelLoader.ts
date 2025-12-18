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
    let mounted = true;

    const loadModel = async () => {
      try {
        logger.info('Starting eager model download');
        const modelService = getModelService();

        // Check if model is already cached
        const isCached = await modelService.isModelCached(
          INPAINTING_CONFIG.MODEL_URL
        );

        if (isCached) {
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
        await modelService.downloadModel(
          INPAINTING_CONFIG.MODEL_URL,
          (progress: ModelDownloadProgress) => {
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

    loadModel();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
