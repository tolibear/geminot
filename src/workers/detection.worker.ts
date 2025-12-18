import { expose } from 'comlink';
import { DETECTION_CONFIG } from '@/lib/constants';

// Type declarations
interface DetectionAPI {
  initialize(): Promise<void>;
  detectBadge(imageData: ImageData): Promise<DetectionResult | null>;
  isInitialized(): boolean;
  cleanup(): void;
}

interface DetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

// Declare cv as global (loaded from opencv.js)
declare const cv: any;

/**
 * Badge Detection Worker using OpenCV.js
 */
class BadgeDetectionWorker implements DetectionAPI {
  private initialized = false;
  private template: any = null; // cv.Mat
  private cvReady = false;

  /**
   * Initialize OpenCV and load badge template
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[Detection Worker] Already initialized');
      return;
    }

    console.log('[Detection Worker] Starting initialization...');

    try {
      // Load OpenCV.js
      await this.loadOpenCV();

      // Load badge template
      await this.loadTemplate();

      this.initialized = true;
      console.log('[Detection Worker] Initialization complete');
    } catch (error) {
      console.error('[Detection Worker] Initialization failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Load OpenCV.js library
   */
  private async loadOpenCV(): Promise<void> {
    if (typeof cv !== 'undefined' && cv.Mat) {
      this.cvReady = true;
      console.log('[Detection Worker] OpenCV already loaded');
      return;
    }

    console.log('[Detection Worker] Loading OpenCV.js...');

    return new Promise((resolve, reject) => {
      try {
        // Import OpenCV.js from public folder
        importScripts('/opencv/opencv.js');
        console.log(
          '[Detection Worker] OpenCV.js script loaded, waiting for initialization...'
        );

        // Wait for OpenCV to be ready
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds

        const checkReady = setInterval(() => {
          attempts++;

          if (typeof cv !== 'undefined' && cv.Mat) {
            clearInterval(checkReady);
            this.cvReady = true;
            console.log('[Detection Worker] OpenCV loaded and ready');
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkReady);
            reject(
              new Error(`OpenCV loading timeout after ${maxAttempts * 100}ms`)
            );
          }
        }, 100);
      } catch (error) {
        console.error(
          '[Detection Worker] Failed to load OpenCV script:',
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Load badge template image
   */
  private async loadTemplate(): Promise<void> {
    console.log('[Detection Worker] Loading badge template...');

    try {
      // Fetch template image
      const response = await fetch('/templates/badge.png');
      if (!response.ok) {
        throw new Error(`Failed to load template: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      console.log('[Detection Worker] Template blob loaded:', {
        size: blob.size,
        type: blob.type,
      });

      const bitmap = await createImageBitmap(blob);
      console.log('[Detection Worker] Template bitmap created:', {
        width: bitmap.width,
        height: bitmap.height,
      });

      // Convert to ImageData
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

      // Convert ImageData to cv.Mat
      this.template = cv.matFromImageData(imageData);
      console.log('[Detection Worker] Template converted to cv.Mat:', {
        cols: this.template.cols,
        rows: this.template.rows,
        channels: this.template.channels(),
      });

      // Convert to grayscale for matching
      if (this.template.channels() > 1) {
        cv.cvtColor(this.template, this.template, cv.COLOR_RGBA2GRAY);
        console.log('[Detection Worker] Template converted to grayscale');
      }

      console.log('[Detection Worker] Template loaded successfully:', {
        width: this.template.cols,
        height: this.template.rows,
      });
    } catch (error) {
      console.error('[Detection Worker] Failed to load template:', error);
      throw error;
    }
  }

  /**
   * Detect badge in image using template matching
   */
  async detectBadge(imageData: ImageData): Promise<DetectionResult | null> {
    if (!this.initialized || !this.template) {
      throw new Error('Worker not initialized');
    }

    console.log('[Detection Worker] Starting badge detection...', {
      imageSize: `${imageData.width}x${imageData.height}`,
    });

    let srcMat: any = null;
    let roiMat: any = null;
    let grayMat: any = null;

    try {
      // Convert ImageData to cv.Mat
      srcMat = cv.matFromImageData(imageData);

      // Extract ROI (bottom-right corner)
      const roiWidth = Math.floor(
        imageData.width * DETECTION_CONFIG.ROI_PERCENT
      );
      const roiHeight = Math.floor(
        imageData.height * DETECTION_CONFIG.ROI_PERCENT
      );
      const roiX = imageData.width - roiWidth;
      const roiY = imageData.height - roiHeight;

      const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);
      roiMat = srcMat.roi(roiRect);

      // Convert to grayscale
      grayMat = new cv.Mat();
      if (roiMat.channels() > 1) {
        cv.cvtColor(roiMat, grayMat, cv.COLOR_RGBA2GRAY);
      } else {
        roiMat.copyTo(grayMat);
      }

      console.log('[Detection Worker] ROI extracted:', {
        roiSize: `${roiWidth}x${roiHeight}`,
        roiOffset: `${roiX}, ${roiY}`,
      });

      // Perform multi-scale template matching
      let bestMatch: DetectionResult | null = null;
      let bestConfidence = 0;

      for (const scale of DETECTION_CONFIG.SCALES) {
        const match = this.matchAtScale(grayMat, scale);
        if (match && match.confidence > bestConfidence) {
          bestConfidence = match.confidence;
          // Adjust coordinates to full image space
          bestMatch = {
            x: roiX + match.x,
            y: roiY + match.y,
            width: match.width,
            height: match.height,
            confidence: match.confidence,
          };
        }
      }

      if (
        bestMatch &&
        bestMatch.confidence >= DETECTION_CONFIG.POSSIBLE_THRESHOLD
      ) {
        console.log('[Detection Worker] Badge detected:', {
          location: `${bestMatch.x}, ${bestMatch.y}`,
          size: `${bestMatch.width}x${bestMatch.height}`,
          confidence: bestMatch.confidence.toFixed(3),
        });
        return bestMatch;
      }

      console.log('[Detection Worker] No badge detected (confidence too low)');
      return null;
    } catch (error) {
      console.error('[Detection Worker] Detection failed:', error);
      throw error;
    } finally {
      // Cleanup OpenCV Mats
      if (srcMat) srcMat.delete();
      if (roiMat) roiMat.delete();
      if (grayMat) grayMat.delete();
    }
  }

  /**
   * Match template at a specific scale
   */
  private matchAtScale(
    grayMat: any,
    scale: number
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  } | null {
    let scaledTemplate: any = null;
    let result: any = null;

    try {
      // Scale template
      const scaledWidth = Math.round(this.template.cols * scale);
      const scaledHeight = Math.round(this.template.rows * scale);

      // Skip if scaled template is larger than ROI
      if (scaledWidth > grayMat.cols || scaledHeight > grayMat.rows) {
        return null;
      }

      scaledTemplate = new cv.Mat();
      cv.resize(
        this.template,
        scaledTemplate,
        new cv.Size(scaledWidth, scaledHeight),
        0,
        0,
        cv.INTER_LINEAR
      );

      // Perform template matching
      result = new cv.Mat();
      const method = cv.TM_CCOEFF_NORMED; // Normalized correlation coefficient

      cv.matchTemplate(grayMat, scaledTemplate, result, method);

      // Find best match
      const minMax = cv.minMaxLoc(result);
      const confidence = minMax.maxVal;
      const matchLoc = minMax.maxLoc;

      return {
        x: matchLoc.x,
        y: matchLoc.y,
        width: scaledWidth,
        height: scaledHeight,
        confidence,
      };
    } catch (error) {
      console.error(
        `[Detection Worker] Match at scale ${scale} failed:`,
        error
      );
      return null;
    } finally {
      if (scaledTemplate) scaledTemplate.delete();
      if (result) result.delete();
    }
  }

  /**
   * Check if worker is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.template) {
      this.template.delete();
      this.template = null;
    }
    this.initialized = false;
    console.log('[Detection Worker] Cleaned up');
  }
}

// Create and expose worker instance
const worker = new BadgeDetectionWorker();
expose(worker);
