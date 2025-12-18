import { useState, useEffect } from 'react';
import { INPAINTING_CONFIG } from '@/lib/constants';
import { logger } from '@/lib/logger';

interface ModelLoaderState {
  isLoading: boolean;
  progress: number;
  error: string | null;
  isReady: boolean;
}

// Use local proxy to avoid CORS issues with GitHub releases
const MODEL_PROXY_URL = '/api/model-proxy';

/**
 * Hook to eagerly load the AI model on page mount
 * Downloads through our API proxy to avoid CORS issues with GitHub releases
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
        console.log('🚀 useModelLoader: Starting download via proxy');
        logger.info('Starting model download');

        // Download model via our API proxy to avoid CORS
        const response = await fetch(MODEL_PROXY_URL, {
          method: 'GET',
          headers: { Accept: 'application/octet-stream' },
        });

        console.log('🚀 useModelLoader: Fetch response:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength
          ? parseInt(contentLength, 10)
          : INPAINTING_CONFIG.MODEL_SIZE_MB * 1024 * 1024;

        console.log('🚀 useModelLoader: Content length:', total);

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;

        // Read chunks and track progress
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          loaded += value.length;

          const percentage = Math.round((loaded / total) * 100);
          if (mounted) {
            setState({
              isLoading: true,
              progress: percentage,
              error: null,
              isReady: false,
            });
          }
        }

        console.log('🚀 useModelLoader: Download complete! Size:', loaded);

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
