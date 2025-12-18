export const FILE_LIMITS = {
  MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
  MAX_FILES_PER_BATCH: 50,
} as const;

export const SUPPORTED_FORMATS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
} as const;

export const DETECTION_CONFIG = {
  ROI_PERCENT: 0.15, // Bottom-right 15%
  CONFIDENCE_THRESHOLD: 0.7, // "Detected" threshold
  POSSIBLE_THRESHOLD: 0.5, // "Possible" threshold
  SCALES: [0.5, 0.75, 1.0, 1.25, 1.5],
  MATCH_METHOD: 'TM_CCOEFF_NORMED',
  MAX_CONCURRENT: 1, // Sequential to avoid memory issues
  TEMPLATE_SIZES: [16, 24, 32, 48, 64] as const,
  TEMPLATE_BASE_PATH: '/templates/badge',
} as const;

export const FILE_STATUS = {
  PENDING: 'pending',
  SCANNING: 'scanning',
  CLEAN: 'clean',
  BADGE_DETECTED: 'badge',
  POSSIBLE_BADGE: 'possible',
  ERROR: 'error',
} as const;

export const DETECTION_STATUS = {
  NO_BADGE: 'no_badge',
  BADGE_DETECTED: 'badge_detected',
  POSSIBLE_BADGE: 'possible_badge',
} as const;

export const INPAINTING_STATUS = {
  IDLE: 'idle',
  LOADING_MODEL: 'loading_model',
  INPAINTING: 'inpainting',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;

export const INPAINTING_CONFIG = {
  // Using OpenCV's optimized LaMa model for efficient client-side inference
  // Hosted on GitHub Releases for free CDN delivery
  MODEL_URL:
    'https://github.com/tolibear/geminot/releases/download/v1.0.0/lama-small.onnx',
  MODEL_SIZE_MB: 88,
  INPUT_SIZE: 512,
  // WebGPU is disabled - has compatibility issues with this model's Add kernels
  // WASM backend is more stable and works across all browsers
  USE_WEBGPU: false,
  CACHE_NAME: 'ai-inpainting-models',
  CACHE_VERSION: 2, // Bumped for new model
  MASK_DILATION: 10, // Pixels to expand mask around star
  BADGE_SIZE_ESTIMATE: 50, // Star watermark size (~50px)
  // Patch-based inpainting config for better quality
  PATCH_PADDING: 100, // Context pixels for good texture sampling
  MASK_FEATHER_RADIUS: 40, // Large feather for seamless blending into background
  MIN_OUTPUT_VARIANCE: 500, // Threshold for detecting solid-color failures
} as const;
