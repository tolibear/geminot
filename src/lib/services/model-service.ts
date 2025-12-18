import { logger } from '@/lib/logger';
import { INPAINTING_CONFIG } from '@/lib/constants';

export interface ModelDownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ModelDownloadCallback = (progress: ModelDownloadProgress) => void;

/**
 * Service for downloading and caching AI models
 */
export class ModelService {
  private dbName = INPAINTING_CONFIG.CACHE_NAME;
  private dbVersion = INPAINTING_CONFIG.CACHE_VERSION;
  private storeName = 'models';
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB for model caching
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      console.log('💾 initDB: Using cached DB instance');
      return this.db;
    }

    console.log(
      '💾 initDB: Opening IndexedDB',
      this.dbName,
      'version',
      this.dbVersion
    );
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('💾 initDB: Error opening DB', request.error);
        logger.error('Failed to open IndexedDB', { error: request.error });
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('💾 initDB: DB opened successfully');
        this.db = request.result;
        logger.info('IndexedDB opened successfully');
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        console.log('💾 initDB: DB upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          console.log('💾 initDB: Creating object store', this.storeName);
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'url',
          });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          logger.info('Created IndexedDB object store');
        }
      };
    });
  }

  /**
   * Check if model is cached in IndexedDB
   */
  async isModelCached(modelUrl: string): Promise<boolean> {
    try {
      console.log('💾 isModelCached: Starting cache check');
      const db = await this.initDB();
      console.log('💾 isModelCached: DB initialized');

      return new Promise((resolve, reject) => {
        console.log('💾 isModelCached: Creating transaction');
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(modelUrl);

        request.onsuccess = () => {
          console.log('💾 isModelCached: Success, result:', !!request.result);
          resolve(!!request.result);
        };

        request.onerror = () => {
          console.error('💾 isModelCached: Error', request.error);
          logger.error('Error checking cache', { error: request.error });
          reject(request.error);
        };

        // Add timeout to prevent hanging
        setTimeout(() => {
          console.error('💾 isModelCached: Timeout after 5 seconds');
          resolve(false); // Assume not cached on timeout
        }, 5000);
      });
    } catch (error) {
      console.error('💾 isModelCached: Exception caught', error);
      logger.error('Failed to check model cache', { error });
      return false;
    }
  }

  /**
   * Get cached model from IndexedDB
   */
  async getCachedModel(modelUrl: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(modelUrl);

        request.onsuccess = () => {
          if (request.result) {
            logger.info('Retrieved model from cache', {
              url: modelUrl,
              size: request.result.data.byteLength,
            });
            resolve(request.result.data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          logger.error('Error retrieving cached model', {
            error: request.error,
          });
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to get cached model', { error });
      return null;
    }
  }

  /**
   * Cache model in IndexedDB
   */
  private async cacheModel(modelUrl: string, data: ArrayBuffer): Promise<void> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const modelData = {
          url: modelUrl,
          data: data,
          timestamp: Date.now(),
        };

        const request = store.put(modelData);

        request.onsuccess = () => {
          logger.info('Model cached successfully', {
            url: modelUrl,
            size: data.byteLength,
          });
          resolve();
        };

        request.onerror = () => {
          logger.error('Error caching model', { error: request.error });
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to cache model', { error });
      throw error;
    }
  }

  /**
   * Download model with progress tracking
   */
  async downloadModel(
    modelUrl: string,
    onProgress?: ModelDownloadCallback
  ): Promise<ArrayBuffer> {
    logger.info('Starting model download', { url: modelUrl });

    try {
      // Check cache first
      const cached = await this.getCachedModel(modelUrl);
      if (cached) {
        logger.info('Using cached model');
        // Still report progress as 100% for UI consistency
        if (onProgress) {
          onProgress({
            loaded: cached.byteLength,
            total: cached.byteLength,
            percentage: 100,
          });
        }
        return cached;
      }

      // Download from URL with proper fetch options
      const response = await fetch(modelUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream',
        },
        // Follow redirects (default behavior)
        redirect: 'follow',
        // Use same-origin credentials
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        throw new Error(
          `HTTP error! status: ${response.status}, details: ${errorText}`
        );
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      // Read chunks and track progress
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        loaded += value.length;

        if (onProgress && total > 0) {
          const percentage = Math.round((loaded / total) * 100);
          onProgress({ loaded, total, percentage });
        }
      }

      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const arrayBuffer = result.buffer;

      // Cache for future use
      await this.cacheModel(modelUrl, arrayBuffer);

      logger.info('Model download complete', {
        url: modelUrl,
        size: arrayBuffer.byteLength,
      });

      return arrayBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorDetails = {
        error,
        url: modelUrl,
        message: errorMessage,
        type:
          error instanceof TypeError ? 'Network/CORS Error' : 'Unknown Error',
      };
      logger.error('Model download failed', errorDetails);
      throw new Error(`Failed to download model: ${errorMessage}`);
    }
  }

  /**
   * Clear model cache
   */
  async clearCache(): Promise<void> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          logger.info('Model cache cleared');
          resolve();
        };

        request.onerror = () => {
          logger.error('Error clearing cache', { error: request.error });
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      throw error;
    }
  }

  /**
   * Get cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const totalSize = request.result.reduce(
            (acc, item) => acc + (item.data?.byteLength || 0),
            0
          );
          resolve(totalSize);
        };

        request.onerror = () => {
          logger.error('Error calculating cache size', {
            error: request.error,
          });
          reject(request.error);
        };
      });
    } catch (error) {
      logger.error('Failed to get cache size', { error });
      return 0;
    }
  }
}

// Singleton instance
let modelServiceInstance: ModelService | null = null;

/**
 * Get the model service singleton
 */
export function getModelService(): ModelService {
  if (!modelServiceInstance) {
    modelServiceInstance = new ModelService();
  }
  return modelServiceInstance;
}
