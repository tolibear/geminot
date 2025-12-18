import { expose } from 'comlink';
import * as ort from 'onnxruntime-web';
import { INPAINTING_CONFIG } from '@/lib/constants';

// Type declarations
interface InpaintingAPI {
  initialize(): Promise<void>;
  inpaint(imageData: ImageData, maskData: ImageData): Promise<ImageData>;
  isInitialized(): boolean;
  cleanup(): void;
}

interface ModelConfig {
  inputSize: number;
  executionProvider: 'webgpu' | 'wasm';
}

/**
 * AI Inpainting Worker using ONNX Runtime Web
 */
class AIInpaintingWorker implements InpaintingAPI {
  private session: ort.InferenceSession | null = null;
  private initialized = false;
  private modelBuffer: ArrayBuffer | null = null;
  private config: ModelConfig = {
    inputSize: INPAINTING_CONFIG.INPUT_SIZE,
    executionProvider: 'wasm', // Start with WASM, try WebGPU
  };

  /**
   * Initialize the ONNX Runtime and load model
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[AI Worker] Already initialized');
      return;
    }

    console.log('[AI Worker] Starting initialization...');

    try {
      // Download model using fetch with progress tracking
      // Use the proxy API to avoid CORS issues with GitHub releases
      const modelUrl = '/api/model-proxy';

      console.log('[AI Worker] Downloading model via proxy...');
      const response = await fetch(modelUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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

        if (total > 0) {
          const percentage = Math.round((loaded / total) * 100);
          console.log(`[AI Worker] Download progress: ${percentage}%`);
        }
      }

      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      this.modelBuffer = result.buffer;
      console.log('[AI Worker] Model downloaded:', {
        size: this.modelBuffer.byteLength,
        sizeMB: (this.modelBuffer.byteLength / (1024 * 1024)).toFixed(2),
      });

      // Try to initialize with WebGPU first, fallback to WASM
      await this.initializeSession();

      this.initialized = true;
      console.log('[AI Worker] Initialization complete');
    } catch (error) {
      console.error('[AI Worker] Initialization failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Initialize ONNX Runtime session with provider fallback
   */
  private async initializeSession(): Promise<void> {
    if (!this.modelBuffer) {
      throw new Error('Model buffer not loaded');
    }

    // Try WebGPU first if enabled
    if (INPAINTING_CONFIG.USE_WEBGPU) {
      try {
        console.log('[AI Worker] Attempting WebGPU...');
        this.session = await ort.InferenceSession.create(this.modelBuffer, {
          executionProviders: ['webgpu'],
        });
        this.config.executionProvider = 'webgpu';
        console.log('[AI Worker] WebGPU session created successfully');
        return;
      } catch (error) {
        console.warn('[AI Worker] WebGPU failed, falling back to WASM:', error);
      }
    }

    // Fallback to WASM
    try {
      console.log('[AI Worker] Using WASM backend...');
      this.session = await ort.InferenceSession.create(this.modelBuffer, {
        executionProviders: ['wasm'],
      });
      this.config.executionProvider = 'wasm';
      console.log('[AI Worker] WASM session created successfully');
    } catch (error) {
      console.error('[AI Worker] WASM session creation failed:', error);
      throw error;
    }
  }

  /**
   * Perform patch-based inpainting on an image
   */
  async inpaint(imageData: ImageData, maskData: ImageData): Promise<ImageData> {
    if (!this.initialized || !this.session) {
      throw new Error('Worker not initialized');
    }

    console.log('[AI Worker] Starting patch-based inpainting...', {
      imageSize: `${imageData.width}x${imageData.height}`,
      maskSize: `${maskData.width}x${maskData.height}`,
      provider: this.config.executionProvider,
    });

    try {
      const startTime = performance.now();

      // Extract watermark patch with context padding
      const patchInfo = this.extractWatermarkPatch(imageData, maskData);
      console.log('[AI Worker] Extracted patch:', {
        patchSize: `${patchInfo.patchImage.width}x${patchInfo.patchImage.height}`,
        offset: `${patchInfo.offsetX}, ${patchInfo.offsetY}`,
      });

      // Prepare input tensors from patch
      const { imageTensor, maskTensor, originalWidth, originalHeight } =
        this.preprocessInputs(patchInfo.patchImage, patchInfo.patchMask);

      // Run inference on patch
      console.log('[AI Worker] Running inference on patch...');
      const feeds = { image: imageTensor, mask: maskTensor };
      const results = await this.session.run(feeds);

      // Get output tensor - try common output names
      const outputKey = Object.keys(results)[0];
      const output = results.output || results[outputKey];

      console.log('[AI Worker] Output tensor info:', {
        outputKey,
        dims: output.dims,
        type: output.type,
      });

      // Post-process patch output
      const inpaintedPatch = this.postprocessPatchOutput(
        output,
        patchInfo.patchImage,
        originalWidth,
        originalHeight
      );

      // Validate output quality
      if (!this.validateInpaintingResult(inpaintedPatch)) {
        console.warn(
          '[AI Worker] Output validation failed, quality may be poor'
        );
      }

      // Composite patch back into original image
      const resultImageData = this.compositePatchToImage(
        imageData,
        inpaintedPatch,
        patchInfo.patchMask,
        patchInfo.offsetX,
        patchInfo.offsetY
      );

      const elapsed = performance.now() - startTime;
      console.log('[AI Worker] Patch-based inpainting complete', {
        timeMs: elapsed.toFixed(0),
        timeSec: (elapsed / 1000).toFixed(2),
      });

      return resultImageData;
    } catch (error) {
      console.error('[AI Worker] Inpainting failed:', error);
      throw error;
    }
  }

  /**
   * Extract watermark patch with context padding
   */
  private extractWatermarkPatch(
    imageData: ImageData,
    maskData: ImageData
  ): {
    patchImage: ImageData;
    patchMask: ImageData;
    offsetX: number;
    offsetY: number;
  } {
    const { width, height } = imageData;

    // Find bounding box of mask (white pixels)
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (maskData.data[idx] > 128) {
          // White pixel
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add padding for context
    const padding = INPAINTING_CONFIG.PATCH_PADDING;
    const patchX = Math.max(0, minX - padding);
    const patchY = Math.max(0, minY - padding);
    const patchWidth = Math.min(width - patchX, maxX - minX + padding * 2);
    const patchHeight = Math.min(height - patchY, maxY - minY + padding * 2);

    console.log('[AI Worker] Patch bounds:', {
      maskBounds: `${minX},${minY} to ${maxX},${maxY}`,
      patchBounds: `${patchX},${patchY} size ${patchWidth}x${patchHeight}`,
      padding,
    });

    // Extract patch from image
    const patchCanvas = new OffscreenCanvas(patchWidth, patchHeight);
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) {
      throw new Error('Failed to get patch canvas context');
    }

    // Draw image patch
    const sourceCanvas = new OffscreenCanvas(width, height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
      throw new Error('Failed to get source canvas context');
    }
    sourceCtx.putImageData(imageData, 0, 0);
    patchCtx.drawImage(
      sourceCanvas,
      patchX,
      patchY,
      patchWidth,
      patchHeight,
      0,
      0,
      patchWidth,
      patchHeight
    );
    const patchImage = patchCtx.getImageData(0, 0, patchWidth, patchHeight);

    // Extract patch from mask
    const maskCanvas = new OffscreenCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) {
      throw new Error('Failed to get mask canvas context');
    }
    maskCtx.putImageData(maskData, 0, 0);

    const patchMaskCanvas = new OffscreenCanvas(patchWidth, patchHeight);
    const patchMaskCtx = patchMaskCanvas.getContext('2d');
    if (!patchMaskCtx) {
      throw new Error('Failed to get patch mask canvas context');
    }
    patchMaskCtx.drawImage(
      maskCanvas,
      patchX,
      patchY,
      patchWidth,
      patchHeight,
      0,
      0,
      patchWidth,
      patchHeight
    );
    const patchMask = patchMaskCtx.getImageData(0, 0, patchWidth, patchHeight);

    return {
      patchImage,
      patchMask,
      offsetX: patchX,
      offsetY: patchY,
    };
  }

  /**
   * Preprocess image and mask for model input
   * LaMa expects: masked image (areas to inpaint are black) + mask
   */
  private preprocessInputs(
    imageData: ImageData,
    maskData: ImageData
  ): {
    imageTensor: ort.Tensor;
    maskTensor: ort.Tensor;
    originalWidth: number;
    originalHeight: number;
  } {
    const originalWidth = imageData.width;
    const originalHeight = imageData.height;
    const targetSize = this.config.inputSize;

    // Resize image to model input size
    const resizedImage = this.resizeImageData(
      imageData,
      targetSize,
      targetSize
    );
    const resizedMask = this.resizeImageData(maskData, targetSize, targetSize);

    // Convert to RGB tensors (normalize to 0-1)
    const imageArray = new Float32Array(3 * targetSize * targetSize);
    const maskArray = new Float32Array(1 * targetSize * targetSize);

    // LaMa expects "masked image" where mask areas are BLACK (zeroed out)
    // This tells the model WHERE to fill in content
    for (let i = 0; i < targetSize * targetSize; i++) {
      const pixelIndex = i * 4;
      const tensorIndex = i;

      // Get mask value (0 = keep, 1 = inpaint)
      const maskValue = resizedMask.data[pixelIndex] / 255.0;

      // Create masked image: original * (1 - mask)
      // Areas to inpaint become BLACK in the input image
      const keepFactor = 1.0 - maskValue;

      // RGB channels - black out masked areas
      imageArray[tensorIndex] =
        (resizedImage.data[pixelIndex] / 255.0) * keepFactor; // R
      imageArray[targetSize * targetSize + tensorIndex] =
        (resizedImage.data[pixelIndex + 1] / 255.0) * keepFactor; // G
      imageArray[2 * targetSize * targetSize + tensorIndex] =
        (resizedImage.data[pixelIndex + 2] / 255.0) * keepFactor; // B

      // Mask: single channel, normalized (1 = area to fill)
      maskArray[tensorIndex] = maskValue;
    }

    console.log(
      '[AI Worker] Created masked image input (masked areas are black)'
    );

    const imageTensor = new ort.Tensor('float32', imageArray, [
      1,
      3,
      targetSize,
      targetSize,
    ]);
    const maskTensor = new ort.Tensor('float32', maskArray, [
      1,
      1,
      targetSize,
      targetSize,
    ]);

    return { imageTensor, maskTensor, originalWidth, originalHeight };
  }

  /**
   * Post-process patch model output back to ImageData
   */
  private postprocessPatchOutput(
    output: ort.Tensor,
    originalPatchImage: ImageData,
    originalWidth: number,
    originalHeight: number
  ): ImageData {
    const data = output.data as Float32Array;
    const [batch, channels, height, width] = output.dims;

    // Detect output value range
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
    }

    console.log('[AI Worker] Output value range:', { min, max });

    // Smart normalization based on output range
    const normalize = (val: number): number => {
      if (max === min) {
        // Avoid division by zero - solid color output
        return 128;
      }

      // If output is already in ~[0, 255] range, use directly with clamping
      // This preserves original color values better
      if (min >= -10 && max <= 265 && max - min > 100) {
        return Math.max(0, Math.min(255, val));
      }

      // If output is in [0, 1] range
      if (min >= -0.1 && max <= 1.1) {
        return Math.max(0, Math.min(255, val * 255));
      }

      // If output is in [-1, 1] range
      if (min >= -1.1 && max <= 1.1) {
        return Math.max(0, Math.min(255, ((val + 1) / 2) * 255));
      }

      // Otherwise use min-max normalization
      return ((val - min) / (max - min)) * 255;
    };

    // Create temporary canvas for model output at model resolution
    const modelImageData = new ImageData(width, height);

    // Convert from [1, 3, H, W] tensor to RGBA ImageData
    for (let i = 0; i < height * width; i++) {
      const pixelIndex = i * 4;

      // Get RGB values and normalize
      const r = Math.max(0, Math.min(255, normalize(data[i])));
      const g = Math.max(0, Math.min(255, normalize(data[height * width + i])));
      const b = Math.max(
        0,
        Math.min(255, normalize(data[2 * height * width + i]))
      );

      modelImageData.data[pixelIndex] = r;
      modelImageData.data[pixelIndex + 1] = g;
      modelImageData.data[pixelIndex + 2] = b;
      modelImageData.data[pixelIndex + 3] = 255; // Alpha
    }

    // Resize model output to original patch dimensions
    const resizedInpainted = this.resizeImageData(
      modelImageData,
      originalWidth,
      originalHeight
    );

    console.log('[AI Worker] Resized inpainted patch to original dimensions');

    return resizedInpainted;
  }

  /**
   * Composite inpainted patch back into original image with feathered blending
   */
  private compositePatchToImage(
    originalImage: ImageData,
    inpaintedPatch: ImageData,
    patchMask: ImageData,
    offsetX: number,
    offsetY: number
  ): ImageData {
    const resultImageData = new ImageData(
      originalImage.width,
      originalImage.height
    );

    // Copy original image
    resultImageData.data.set(originalImage.data);

    // Blend inpainted patch into result using feathered mask
    const patchWidth = inpaintedPatch.width;
    const patchHeight = inpaintedPatch.height;

    for (let py = 0; py < patchHeight; py++) {
      for (let px = 0; px < patchWidth; px++) {
        const imageX = offsetX + px;
        const imageY = offsetY + py;

        // Skip if outside image bounds
        if (
          imageX < 0 ||
          imageX >= originalImage.width ||
          imageY < 0 ||
          imageY >= originalImage.height
        ) {
          continue;
        }

        const patchIdx = (py * patchWidth + px) * 4;
        const imageIdx = (imageY * originalImage.width + imageX) * 4;

        // Get mask value (feathered, 0-255)
        const maskValue = patchMask.data[patchIdx] / 255;

        // Alpha blend: result = original * (1 - alpha) + inpainted * alpha
        resultImageData.data[imageIdx] = Math.round(
          originalImage.data[imageIdx] * (1 - maskValue) +
            inpaintedPatch.data[patchIdx] * maskValue
        );
        resultImageData.data[imageIdx + 1] = Math.round(
          originalImage.data[imageIdx + 1] * (1 - maskValue) +
            inpaintedPatch.data[patchIdx + 1] * maskValue
        );
        resultImageData.data[imageIdx + 2] = Math.round(
          originalImage.data[imageIdx + 2] * (1 - maskValue) +
            inpaintedPatch.data[patchIdx + 2] * maskValue
        );
        resultImageData.data[imageIdx + 3] = 255; // Alpha
      }
    }

    console.log(
      '[AI Worker] Composited patch into original image with feathering'
    );

    return resultImageData;
  }

  /**
   * Validate inpainting result quality
   * Detects failures like solid-color outputs
   */
  private validateInpaintingResult(imageData: ImageData): boolean {
    const { width, height, data } = imageData;
    const totalPixels = width * height;

    // Calculate color variance
    let rSum = 0,
      gSum = 0,
      bSum = 0;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
    }

    const rMean = rSum / totalPixels;
    const gMean = gSum / totalPixels;
    const bMean = bSum / totalPixels;

    // Calculate variance
    let rVariance = 0,
      gVariance = 0,
      bVariance = 0;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      rVariance += Math.pow(data[idx] - rMean, 2);
      gVariance += Math.pow(data[idx + 1] - gMean, 2);
      bVariance += Math.pow(data[idx + 2] - bMean, 2);
    }

    rVariance /= totalPixels;
    gVariance /= totalPixels;
    bVariance /= totalPixels;

    const totalVariance = rVariance + gVariance + bVariance;

    console.log('[AI Worker] Output quality check:', {
      mean: `R:${rMean.toFixed(1)} G:${gMean.toFixed(1)} B:${bMean.toFixed(1)}`,
      variance: totalVariance.toFixed(1),
      threshold: INPAINTING_CONFIG.MIN_OUTPUT_VARIANCE,
      passed: totalVariance >= INPAINTING_CONFIG.MIN_OUTPUT_VARIANCE,
    });

    // If variance is too low, output is likely solid color (failed inpainting)
    return totalVariance >= INPAINTING_CONFIG.MIN_OUTPUT_VARIANCE;
  }

  /**
   * Resize ImageData using OffscreenCanvas
   */
  private resizeImageData(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): ImageData {
    // Create source canvas
    const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height);
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
      throw new Error('Failed to get source canvas context');
    }
    sourceCtx.putImageData(imageData, 0, 0);

    // Create target canvas
    const targetCanvas = new OffscreenCanvas(targetWidth, targetHeight);
    const targetCtx = targetCanvas.getContext('2d');
    if (!targetCtx) {
      throw new Error('Failed to get target canvas context');
    }

    // Draw scaled image
    targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

    return targetCtx.getImageData(0, 0, targetWidth, targetHeight);
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
    if (this.session) {
      this.session = null;
    }
    this.modelBuffer = null;
    this.initialized = false;
    console.log('[AI Worker] Cleaned up');
  }
}

// Create and expose worker instance
const worker = new AIInpaintingWorker();
expose(worker);
