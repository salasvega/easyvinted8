export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

export interface CompressionResult {
  base64: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.85,
  mimeType: 'image/jpeg',
};

export async function compressBase64Image(
  base64Image: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const originalBase64 = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image;

  const originalSize = Math.ceil((originalBase64.length * 3) / 4);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;

        if (width > opts.maxWidth || height > opts.maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = opts.maxWidth;
            height = Math.round(width / aspectRatio);
          } else {
            height = opts.maxHeight;
            width = Math.round(height * aspectRatio);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL(opts.mimeType, opts.quality);
        const compressedData = compressedBase64.split('base64,')[1];
        const compressedSize = Math.ceil((compressedData.length * 3) / 4);
        const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

        console.log(`[Virtual Stylist] Image compression:
  Original: ${formatFileSize(originalSize)}
  Compressed: ${formatFileSize(compressedSize)}
  Reduction: ${compressionRatio.toFixed(1)}%
  Dimensions: ${width}x${height}px`);

        resolve({
          base64: compressedBase64,
          originalSize,
          compressedSize,
          compressionRatio,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
  });
}

export async function compressAvatarImage(base64Image: string): Promise<string> {
  const result = await compressBase64Image(base64Image, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.85,
  });
  return result.base64;
}

export async function compressLocationImage(base64Image: string): Promise<string> {
  const result = await compressBase64Image(base64Image, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.85,
  });
  return result.base64;
}

export async function compressStylistPhoto(base64Image: string): Promise<string> {
  const result = await compressBase64Image(base64Image, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
  });
  return result.base64;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
