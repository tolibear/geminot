'use client';

import { useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Download, Upload, Sparkles, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useModelLoader } from '@/hooks/useModelLoader';
import { useAppStore } from '@/stores/simple-app-store';
import { getInpaintingService } from '@/lib/services/inpainting-service';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export default function Home() {
  const {
    isLoading: modelLoading,
    progress: modelProgress,
    error: modelError,
    isReady: modelReady,
  } = useModelLoader();
  const {
    appState,
    originalImageUrl,
    cleanedImageUrl,
    cleanedImage,
    setAppState,
    setModelProgress,
    setOriginalImage,
    setCleanedImage,
    reset,
  } = useAppStore();

  // Update model progress in store
  useEffect(() => {
    if (modelLoading) {
      setModelProgress(modelProgress);
    }
  }, [modelLoading, modelProgress, setModelProgress]);

  // Update app state when model is ready
  useEffect(() => {
    if (modelReady && appState === 'loading') {
      setAppState('ready');
    }
  }, [modelReady, appState, setAppState]);

  // Handle model error
  useEffect(() => {
    if (modelError) {
      toast.error('Failed to load AI model', {
        description: modelError,
      });
    }
  }, [modelError]);

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      try {
        // Convert File to Blob
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        setOriginalImage(blob);

        logger.info('Processing image', { fileName: file.name });

        // Inpaint the image
        const inpaintingService = getInpaintingService();
        const cleanedBlob = await inpaintingService.inpaintImage(blob);

        setCleanedImage(cleanedBlob);

        toast.success('Watermark removed successfully!');
      } catch (error) {
        logger.error('Image processing failed', { error });
        toast.error('Failed to process image', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
        reset();
      }
    },
    [setOriginalImage, setCleanedImage, reset]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: !modelReady || appState === 'processing',
  });

  // Download handler
  const handleDownload = useCallback(() => {
    if (!cleanedImage || !cleanedImageUrl) return;

    const link = document.createElement('a');
    link.href = cleanedImageUrl;
    link.download = `cleaned-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Image downloaded!');
  }, [cleanedImage, cleanedImageUrl]);

  // Try another handler
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Toaster />

      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-emerald-400" />
            <h1 className="text-4xl font-bold text-white">Watermark Remover</h1>
          </div>
          <p className="text-slate-300 text-lg">
            AI-powered watermark removal in your browser
          </p>
        </div>

        {/* Loading State */}
        {appState === 'loading' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-6">
                <Sparkles className="h-8 w-8 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Preparing AI Model...
              </h2>
              <p className="text-slate-300 mb-6">First time setup (~35MB)</p>
              <Progress value={modelProgress} className="h-3 mb-2" />
              <p className="text-sm text-slate-400">{modelProgress}%</p>
            </div>
          </div>
        )}

        {/* Ready State - Upload Zone */}
        {appState === 'ready' && (
          <div
            {...getRootProps()}
            className={`
              bg-white/10 backdrop-blur-lg rounded-2xl border-2 border-dashed
              transition-all duration-300 cursor-pointer
              ${
                isDragActive
                  ? 'border-emerald-400 bg-emerald-500/20 scale-105'
                  : 'border-white/30 hover:border-emerald-400/50 hover:bg-white/15'
              }
              p-16
            `}
          >
            <input {...getInputProps()} />
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full mb-6">
                <Upload
                  className={`h-10 w-10 text-emerald-400 ${isDragActive ? 'animate-bounce' : ''}`}
                />
              </div>
              <h2 className="text-3xl font-semibold text-white mb-4">
                {isDragActive ? 'Drop it here!' : 'Drop image to clean'}
              </h2>
              <p className="text-slate-300 mb-6">or click to select a file</p>
              <p className="text-sm text-slate-400">
                Supports: JPG, PNG, WEBP (Max 20MB)
              </p>
            </div>
          </div>
        )}

        {/* Processing State */}
        {appState === 'processing' && originalImageUrl && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalImageUrl}
                alt="Processing"
                className="w-full h-auto rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-4">
                    <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    Removing watermark...
                  </h2>
                  <p className="text-slate-300">This may take a moment</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete State */}
        {appState === 'complete' && cleanedImageUrl && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cleanedImageUrl}
                alt="Cleaned"
                className="w-full h-auto rounded-lg shadow-2xl"
              />
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleDownload}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Clean Image
              </Button>

              <Button
                onClick={handleReset}
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Try Another
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-slate-400 text-sm">
          <p>100% client-side • Your images never leave your device</p>
        </div>
      </div>
    </div>
  );
}
