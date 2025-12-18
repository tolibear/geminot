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
   * Perform inpainting on an image
   */
  async inpaint(imageData: ImageData, maskData: ImageData): Promise<ImageData> {
    if (!this.initialized || !this.session) {
      throw new Error('Worker not initialized');
    }

    console.log('[AI Worker] Starting inpainting...', {
      imageSize: `${imageData.width}x${imageData.height}`,
      maskSize: `${maskData.width}x${maskData.height}`,
      provider: this.config.executionProvider,
    });

    try {
      const startTime = performance.now();

      // Prepare input tensors
      const { imageTensor, maskTensor, originalWidth, originalHeight } =
        this.preprocessInputs(imageData, maskData);

      // Run inference
      console.log('[AI Worker] Running inference...');
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

      // Debug: Check output value range
      const outputData = output.data as Float32Array;
      let min = Infinity,
        max = -Infinity,
        sum = 0;
      for (let i = 0; i < Math.min(outputData.length, 10000); i++) {
        min = Math.min(min, outputData[i]);
        max = Math.max(max, outputData[i]);
        sum += outputData[i];
      }
      console.log('[AI Worker] Output value range:', {
        min: min.toFixed(4),
        max: max.toFixed(4),
        mean: (sum / Math.min(outputData.length, 10000)).toFixed(4),
      });

      // Post-process output and composite with original
      const resultImageData = this.postprocessOutput(
        output,
        imageData,
        maskData,
        originalWidth,
        originalHeight
      );

      const elapsed = performance.now() - startTime;
      console.log('[AI Worker] Inpainting complete', {
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
   * Preprocess image and mask for model input
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

    // Image: convert RGBA to RGB, normalize to [0, 1], shape [1, 3, H, W]
    for (let i = 0; i < targetSize * targetSize; i++) {
      const pixelIndex = i * 4;
      const tensorIndex = i;

      // RGB channels
      imageArray[tensorIndex] = resizedImage.data[pixelIndex] / 255.0; // R
      imageArray[targetSize * targetSize + tensorIndex] =
        resizedImage.data[pixelIndex + 1] / 255.0; // G
      imageArray[2 * targetSize * targetSize + tensorIndex] =
        resizedImage.data[pixelIndex + 2] / 255.0; // B

      // Mask: single channel, normalized
      maskArray[tensorIndex] = resizedMask.data[pixelIndex] / 255.0;
    }

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
   * Post-process model output back to ImageData
   * Composites the inpainted result with the original image using the mask
   */
  private postprocessOutput(
    output: ort.Tensor,
    originalImage: ImageData,
    maskData: ImageData,
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

    console.log('[AI Worker] Normalizing output from range:', { min, max });

    // Determine normalization strategy
    // LaMa models typically output in [-1, 1] or [0, 1]
    const normalize = (val: number): number => {
      if (min >= 0 && max <= 1) {
        // Already [0, 1] range
        return val * 255;
      } else if (min >= -1 && max <= 1) {
        // [-1, 1] range -> [0, 255]
        return ((val + 1) / 2) * 255;
      } else if (max > 1 && max <= 255) {
        // Already [0, 255] range (approximately)
        return val;
      } else {
        // Unknown range - normalize to [0, 255]
        return ((val - min) / (max - min)) * 255;
      }
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

    // Resize model output to original dimensions
    const resizedInpainted = this.resizeImageData(
      modelImageData,
      originalWidth,
      originalHeight
    );

    // Composite: use inpainted result where mask is white, original elsewhere
    const resultImageData = new ImageData(originalWidth, originalHeight);

    for (let i = 0; i < originalWidth * originalHeight; i++) {
      const pixelIndex = i * 4;

      // Mask value (0 = keep original, 255 = use inpainted)
      const maskValue = maskData.data[pixelIndex] / 255;

      // Blend based on mask
      resultImageData.data[pixelIndex] = Math.round(
        originalImage.data[pixelIndex] * (1 - maskValue) +
          resizedInpainted.data[pixelIndex] * maskValue
      );
      resultImageData.data[pixelIndex + 1] = Math.round(
        originalImage.data[pixelIndex + 1] * (1 - maskValue) +
          resizedInpainted.data[pixelIndex + 1] * maskValue
      );
      resultImageData.data[pixelIndex + 2] = Math.round(
        originalImage.data[pixelIndex + 2] * (1 - maskValue) +
          resizedInpainted.data[pixelIndex + 2] * maskValue
      );
      resultImageData.data[pixelIndex + 3] = 255; // Alpha
    }

    console.log('[AI Worker] Composited result with original image');

    return resultImageData;
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
