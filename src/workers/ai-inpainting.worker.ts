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
      const modelUrl = INPAINTING_CONFIG.MODEL_URL;

      console.log('[AI Worker] Downloading model from:', modelUrl);
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

      // Get output tensor
      const output = results.output || results[Object.keys(results)[0]];

      // Post-process output
      const resultImageData = this.postprocessOutput(
        output,
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
   */
  private postprocessOutput(
    output: ort.Tensor,
    originalWidth: number,
    originalHeight: number
  ): ImageData {
    const data = output.data as Float32Array;
    const [batch, channels, height, width] = output.dims;

    // Create temporary canvas for model output
    const tempImageData = new ImageData(width, height);

    // Convert from [1, 3, H, W] tensor to RGBA ImageData
    for (let i = 0; i < height * width; i++) {
      const pixelIndex = i * 4;

      // Get RGB values and denormalize from [0, 1] to [0, 255]
      const r = Math.max(0, Math.min(255, data[i] * 255));
      const g = Math.max(0, Math.min(255, data[height * width + i] * 255));
      const b = Math.max(0, Math.min(255, data[2 * height * width + i] * 255));

      tempImageData.data[pixelIndex] = r;
      tempImageData.data[pixelIndex + 1] = g;
      tempImageData.data[pixelIndex + 2] = b;
      tempImageData.data[pixelIndex + 3] = 255; // Alpha
    }

    // Resize back to original dimensions if needed
    if (width !== originalWidth || height !== originalHeight) {
      return this.resizeImageData(tempImageData, originalWidth, originalHeight);
    }

    return tempImageData;
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
