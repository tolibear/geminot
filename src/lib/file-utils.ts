import { SUPPORTED_FORMATS, FILE_LIMITS } from './constants';
import { logger } from './logger';
import { ValidationError } from './errors';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): FileValidationResult {
  // Check file type
  const validTypes = Object.keys(SUPPORTED_FORMATS);
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Supported formats: JPG, PNG, WEBP, HEIC`,
    };
  }

  // Check file size
  if (file.size > FILE_LIMITS.MAX_FILE_SIZE) {
    const maxSizeMB = FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)}. Max size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate a unique ID for a file
 */
export function generateFileId(): string {
  return crypto.randomUUID();
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get image dimensions from a File object
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ValidationError('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Generate a thumbnail from an image file
 * @param file - The image file
 * @param maxSize - Maximum width or height for the thumbnail (default: 200px)
 * @returns Object URL for the thumbnail
 */
export async function generateThumbnail(
  file: File,
  maxSize = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to blob and create object URL
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error('Failed to generate thumbnail blob'));
              return;
            }
            const thumbnailUrl = URL.createObjectURL(blob);
            resolve(thumbnailUrl);
          },
          'image/jpeg',
          0.85
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for thumbnail generation'));
    };

    img.src = objectUrl;
  });
}

/**
 * Process a file: validate, get dimensions, generate thumbnail
 */
export async function processImageFile(file: File): Promise<{
  id: string;
  originalFile: File;
  name: string;
  size: number;
  dimensions: ImageDimensions;
  thumbnailUrl: string;
}> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new ValidationError(validation.error || 'Invalid file');
  }

  // Generate unique ID
  const id = generateFileId();

  // Get dimensions and thumbnail in parallel
  const [dimensions, thumbnailUrl] = await Promise.all([
    getImageDimensions(file),
    generateThumbnail(file),
  ]);

  logger.debug('Processed file', {
    id,
    name: file.name,
    size: file.size,
    dimensions,
  });

  return {
    id,
    originalFile: file,
    name: file.name,
    size: file.size,
    dimensions,
    thumbnailUrl,
  };
}

/**
 * Cleanup object URL to free memory
 */
export function cleanupObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch (error) {
    logger.warn('Failed to revoke object URL', { url, error });
  }
}
