import { z } from 'zod';
import { FILE_STATUS, DETECTION_STATUS, INPAINTING_STATUS } from './constants';

export const FileStatusSchema = z.enum([
  FILE_STATUS.PENDING,
  FILE_STATUS.SCANNING,
  FILE_STATUS.CLEAN,
  FILE_STATUS.BADGE_DETECTED,
  FILE_STATUS.POSSIBLE_BADGE,
  FILE_STATUS.ERROR,
]);

export const DetectionStatusSchema = z.enum([
  DETECTION_STATUS.NO_BADGE,
  DETECTION_STATUS.BADGE_DETECTED,
  DETECTION_STATUS.POSSIBLE_BADGE,
]);

export const InpaintingStatusSchema = z.enum([
  INPAINTING_STATUS.IDLE,
  INPAINTING_STATUS.LOADING_MODEL,
  INPAINTING_STATUS.INPAINTING,
  INPAINTING_STATUS.COMPLETE,
  INPAINTING_STATUS.ERROR,
]);

export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const LocationSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const DetectionResultSchema = z.object({
  detected: z.boolean(),
  confidence: z.number().min(0).max(1),
  possibleDetection: z.boolean(),
  location: LocationSchema.optional(),
  status: DetectionStatusSchema,
});

export const ProcessedFileSchema: z.ZodType<{
  id: string;
  originalFile: File;
  name: string;
  size: number;
  dimensions: { width: number; height: number };
  thumbnailUrl: string;
  status: FileStatus;
  detectionResult?: DetectionResult;
  replacementFile?: any; // Circular reference
  inpaintedUrl?: string; // Object URL to inpainted version
  inpaintingStatus?: InpaintingStatus;
  errorMessage?: string;
}> = z.object({
  id: z.string(),
  originalFile: z.instanceof(File),
  name: z.string(),
  size: z.number().positive(),
  dimensions: DimensionsSchema,
  thumbnailUrl: z.string(),
  status: FileStatusSchema,
  detectionResult: DetectionResultSchema.optional(),
  replacementFile: z.lazy(() => ProcessedFileSchema).optional(),
  inpaintedUrl: z.string().optional(),
  inpaintingStatus: InpaintingStatusSchema.optional(),
  errorMessage: z.string().optional(),
});

export const DetectionConfigSchema = z.object({
  roiPercent: z.number().min(0).max(1),
  confidenceThreshold: z.number().min(0).max(1),
  possibleThreshold: z.number().min(0).max(1),
  scales: z.array(z.number().positive()),
  templatePath: z.string().optional(),
});

// Type exports derived from schemas
export type FileStatus = z.infer<typeof FileStatusSchema>;
export type DetectionStatus = z.infer<typeof DetectionStatusSchema>;
export type InpaintingStatus = z.infer<typeof InpaintingStatusSchema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
export type ProcessedFile = z.infer<typeof ProcessedFileSchema>;
export type DetectionConfig = z.infer<typeof DetectionConfigSchema>;
