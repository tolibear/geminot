import { wrap, Remote } from 'comlink';
import type { ProcessedFile } from '@/lib/schemas';
import { logger } from '@/lib/logger';
import { INPAINTING_CONFIG, DETECTION_CONFIG } from '@/lib/constants';

type AIInpaintingWorker = {
  initialize(): Promise<void>;
  inpaint(imageData: ImageData, maskData: ImageData): Promise<ImageData>;
  isInitialized(): boolean;
  cleanup(): void;
};

type DetectionWorker = {
  initialize(): Promise<void>;
  detectBadge(imageData: ImageData): Promise<DetectionResult | null>;
  isInitialized(): boolean;
  cleanup(): void;
};

interface DetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Service for handling badge inpainting using AI
 */
export class InpaintingService {
  private aiWorker: Worker | null = null;
  private aiApi: Remote<AIInpaintingWorker> | null = null;
  private detectionWorker: Worker | null = null;
  private detectionApi: Remote<DetectionWorker> | null = null;

  /**
   * Initialize the AI inpainting worker
   */
  private async ensureAIWorker(): Promise<Remote<AIInpaintingWorker>> {
    if (this.aiApi) {
      // Check if already initialized
      const isInit = await this.aiApi.isInitialized();
      if (isInit) {
        return this.aiApi;
      }
    }

    logger.info('Initializing AI inpainting worker');

    try {
      this.aiWorker = new Worker(
        new URL('@/workers/ai-inpainting.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.aiApi = wrap<AIInpaintingWorker>(this.aiWorker);

      // Initialize without progress callback (can't serialize through Comlink)
      await this.aiApi.initialize();

      logger.info('AI inpainting worker initialized successfully');
      return this.aiApi;
    } catch (error) {
      logger.error('Failed to initialize AI worker', { error });
      throw new Error(
        `AI worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Initialize the detection worker
   */
  private async ensureDetectionWorker(): Promise<Remote<DetectionWorker>> {
    if (this.detectionApi) {
      // Check if already initialized
      const isInit = await this.detectionApi.isInitialized();
      if (isInit) {
        return this.detectionApi;
      }
    }

    logger.info('Initializing detection worker');

    try {
      this.detectionWorker = new Worker(
        new URL('@/workers/detection.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.detectionApi = wrap<DetectionWorker>(this.detectionWorker);

      await this.detectionApi.initialize();

      logger.info('Detection worker initialized successfully');
      return this.detectionApi;
    } catch (error) {
      logger.error('Failed to initialize detection worker', { error });
      throw new Error(
        `Detection worker initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Inpaint a badge from an image using AI
   */
  async inpaintBadge(file: ProcessedFile): Promise<Blob> {
    logger.info('Starting AI inpainting', {
      fileName: file.name,
      hasDetection: !!file.detectionResult?.location,
    });

    try {
      // Load the original image
      const bitmap = await createImageBitmap(file.originalFile);

      // Convert to ImageData
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

      // Get AI worker (no progress callback - can't be serialized through Comlink)
      const aiApi = await this.ensureAIWorker();

      // Create mask from detection result
      const maskData = this.createMask(imageData, file);

      // Perform AI inpainting
      logger.info('Running AI inpainting');
      const inpaintedData = await aiApi.inpaint(imageData, maskData);

      // Convert to blob
      const blob = await this.imageDataToBlob(
        inpaintedData,
        file.originalFile.type || 'image/png'
      );

      logger.info('AI inpainting successful', {
        fileName: file.name,
        blobSize: blob.size,
      });

      return blob;
    } catch (error) {
      logger.error('AI inpainting failed', { fileName: file.name, error });
      throw error;
    }
  }

  /**
   * Create a feathered mask for the badge region with smooth edges
   */
  private createMask(imageData: ImageData, file: ProcessedFile): ImageData {
    const { width, height } = imageData;
    const maskCanvas = new OffscreenCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d');

    if (!maskCtx) {
      throw new Error('Failed to get mask canvas context');
    }

    // Start with black (no inpainting)
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, width, height);

    // Calculate badge location
    let maskX: number;
    let maskY: number;
    let maskWidth: number;
    let maskHeight: number;

    if (file.detectionResult?.location) {
      // Use detected location
      const roiWidth = Math.floor(width * DETECTION_CONFIG.ROI_PERCENT);
      const roiHeight = Math.floor(height * DETECTION_CONFIG.ROI_PERCENT);
      const roiX = width - roiWidth;
      const roiY = height - roiHeight;

      maskX = roiX + file.detectionResult.location.x;
      maskY = roiY + file.detectionResult.location.y;

      // Estimate badge size (could use template size if available)
      maskWidth = 100;
      maskHeight = 100;
    } else {
      // Default to bottom-right corner
      const estimatedSize = Math.floor(Math.min(width, height) * 0.15);
      const margin = 10;

      maskX = width - estimatedSize - margin;
      maskY = height - estimatedSize - margin;
      maskWidth = estimatedSize;
      maskHeight = estimatedSize;
    }

    // Add dilation to mask
    const dilation = INPAINTING_CONFIG.MASK_DILATION;
    maskX = Math.max(0, maskX - dilation);
    maskY = Math.max(0, maskY - dilation);
    maskWidth = Math.min(width - maskX, maskWidth + dilation * 2);
    maskHeight = Math.min(height - maskY, maskHeight + dilation * 2);

    // Draw white rectangle for badge region (white = inpaint)
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(maskX, maskY, maskWidth, maskHeight);

    // Apply Gaussian blur for feathered edges
    const maskImageData = maskCtx.getImageData(0, 0, width, height);
    return this.applyGaussianBlur(
      maskImageData,
      INPAINTING_CONFIG.MASK_FEATHER_RADIUS
    );
  }

  /**
   * Apply Gaussian blur to create feathered mask edges
   */
  private applyGaussianBlur(imageData: ImageData, radius: number): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(width, height);

    // Create Gaussian kernel
    const kernel = this.createGaussianKernel(radius);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);

    // Apply horizontal blur
    const temp = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const sx = Math.min(Math.max(x + kx, 0), width - 1);
          const weight = kernel[kx + halfKernel];
          const idx = (y * width + sx) * 4;
          sum += data[idx] * weight; // Use R channel (grayscale mask)
          weightSum += weight;
        }

        const idx = (y * width + x) * 4;
        const value = Math.round(sum / weightSum);
        temp[idx] = value;
        temp[idx + 1] = value;
        temp[idx + 2] = value;
        temp[idx + 3] = 255;
      }
    }

    // Apply vertical blur
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          const sy = Math.min(Math.max(y + ky, 0), height - 1);
          const weight = kernel[ky + halfKernel];
          const idx = (sy * width + x) * 4;
          sum += temp[idx] * weight;
          weightSum += weight;
        }

        const idx = (y * width + x) * 4;
        const value = Math.round(sum / weightSum);
        output.data[idx] = value;
        output.data[idx + 1] = value;
        output.data[idx + 2] = value;
        output.data[idx + 3] = 255;
      }
    }

    return output;
  }

  /**
   * Create 1D Gaussian kernel
   */
  private createGaussianKernel(radius: number): number[] {
    const sigma = radius / 3;
    const size = radius * 2 + 1;
    const kernel: number[] = [];
    let sum = 0;

    for (let i = 0; i < size; i++) {
      const x = i - radius;
      const value = Math.exp(-(x * x) / (2 * sigma * sigma));
      kernel.push(value);
      sum += value;
    }

    // Normalize
    return kernel.map((v) => v / sum);
  }

  /**
   * Convert ImageData to Blob
   */
  private async imageDataToBlob(
    imageData: ImageData,
    mimeType: string
  ): Promise<Blob> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.putImageData(imageData, 0, 0);

    return await canvas.convertToBlob({
      type: mimeType,
      quality: 0.95,
    });
  }

  /**
   * Inpaint an image blob with fixed-position star watermark removal
   */
  async inpaintImage(imageBlob: Blob): Promise<Blob> {
    logger.info('Starting watermark removal (fixed position)');

    try {
      // Load the image
      const bitmap = await createImageBitmap(imageBlob);

      // Convert to ImageData
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

      // Get AI worker
      const aiApi = await this.ensureAIWorker();

      // Create mask for fixed-position watermark in bottom-right
      const maskData = this.createFixedPositionMask(imageData);

      // Perform AI inpainting
      logger.info('Running AI inpainting on fixed watermark position');
      const inpaintedData = await aiApi.inpaint(imageData, maskData);

      // Convert to blob
      const blob = await this.imageDataToBlob(
        inpaintedData,
        imageBlob.type || 'image/png'
      );

      logger.info('Watermark removal successful', { blobSize: blob.size });

      return blob;
    } catch (error) {
      logger.error('Watermark removal failed', { error });
      throw error;
    }
  }

  /**
   * Create a feathered mask for fixed-position watermark in bottom-right corner
   */
  private createFixedPositionMask(imageData: ImageData): ImageData {
    const { width, height } = imageData;
    const maskCanvas = new OffscreenCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d');

    if (!maskCtx) {
      throw new Error('Failed to get mask canvas context');
    }

    // Start with black (no inpainting)
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, width, height);

    // Star watermark position - very close to corner
    // The star center appears to be ~18px from right edge, ~18px from bottom edge
    const starCenterFromRight = 120;
    const starCenterFromBottom = 120;
    const starRadius = 80; // Half the star size (~44px total)
    const dilation = INPAINTING_CONFIG.MASK_DILATION;

    // Calculate mask centered on the star
    const maskRadius = starRadius + dilation;
    const centerX = width - starCenterFromRight;
    const centerY = height - starCenterFromBottom;

    const maskX = Math.max(0, centerX - maskRadius);
    const maskY = Math.max(0, centerY - maskRadius);
    const maskWidth = Math.min(width - maskX, maskRadius * 2);
    const maskHeight = Math.min(height - maskY, maskRadius * 2);

    logger.info('Creating centered mask over star watermark', {
      imageSize: `${width}x${height}`,
      starCenter: `${centerX}, ${centerY}`,
      maskPosition: `${maskX}, ${maskY}`,
      maskSize: `${maskWidth}x${maskHeight}`,
    });

    // Draw white circle/ellipse for more natural star coverage
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.ellipse(
      centerX,
      centerY,
      maskRadius,
      maskRadius,
      0,
      0,
      Math.PI * 2
    );
    maskCtx.fill();

    // Apply Gaussian blur for feathered edges (larger for better blending)
    const maskImageData = maskCtx.getImageData(0, 0, width, height);
    return this.applyGaussianBlur(
      maskImageData,
      INPAINTING_CONFIG.MASK_FEATHER_RADIUS
    );
  }

  /**
   * Check if AI worker is initialized
   */
  isAIInitialized(): boolean {
    return this.aiApi !== null;
  }

  /**
   * Cleanup worker resources
   */
  cleanup(): void {
    if (this.aiWorker) {
      this.aiWorker.terminate();
      this.aiWorker = null;
      this.aiApi = null;
      logger.info('AI inpainting worker terminated');
    }
    if (this.detectionWorker) {
      this.detectionWorker.terminate();
      this.detectionWorker = null;
      this.detectionApi = null;
      logger.info('Detection worker terminated');
    }
  }
}

// Singleton instance
let inpaintingServiceInstance: InpaintingService | null = null;

/**
 * Get the inpainting service singleton
 */
export function getInpaintingService(): InpaintingService {
  if (!inpaintingServiceInstance) {
    inpaintingServiceInstance = new InpaintingService();
  }
  return inpaintingServiceInstance;
}
