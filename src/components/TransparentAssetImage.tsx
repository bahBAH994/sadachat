import React, { useEffect, useRef } from 'react';

const removeDarkPixels = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 35 && pixels[index + 1] < 35 && pixels[index + 2] < 35) {
      pixels[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
};

interface TransparentAssetProps {
  src: string;
  alt: string;
  className?: string;
  onDominantColor?: (color: string) => void;
}

const getDominantColor = (imageData: ImageData): string | null => {
  const colors = new Map<number, { red: number; green: number; blue: number; count: number }>();
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 64) continue;
    const red = Math.min(255, Math.round(pixels[index] / 32) * 32);
    const green = Math.min(255, Math.round(pixels[index + 1] / 32) * 32);
    const blue = Math.min(255, Math.round(pixels[index + 2] / 32) * 32);
    const key = (red << 16) | (green << 8) | blue;
    const color = colors.get(key);
    if (color) {
      color.count += 1;
    } else {
      colors.set(key, { red, green, blue, count: 1 });
    }
  }

  let dominant: { red: number; green: number; blue: number; count: number } | null = null;
  for (const color of colors.values()) {
    if (!dominant || color.count > dominant.count) dominant = color;
  }
  if (!dominant) return null;

  return `#${[dominant.red, dominant.green, dominant.blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};

const getVisibleBounds = (imageData: ImageData) => {
  let left = imageData.width;
  let top = imageData.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      if (imageData.data[(y * imageData.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  return right < left || bottom < top
    ? null
    : { left, top, width: right - left + 1, height: bottom - top + 1 };
};

export const TransparentAssetImage: React.FC<TransparentAssetProps> = ({
  src,
  alt,
  className,
  onDominantColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    canvas.width = 0;
    canvas.height = 0;
    const image = new window.Image();
    const sourceCanvas = document.createElement('canvas');
    let animationFrame = 0;
    let active = true;
    let lastAnimatedFrameAt = 0;
    let hasReportedDominantColor = false;
    const isAnimatedImage = /\.(gif|webp)(?:[?#]|$)/i.test(src);
    image.crossOrigin = 'anonymous';
    const drawFrame = () => {
      try {
        if (
          sourceCanvas.width !== image.naturalWidth ||
          sourceCanvas.height !== image.naturalHeight
        ) {
          sourceCanvas.width = image.naturalWidth;
          sourceCanvas.height = image.naturalHeight;
        }
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (!sourceContext) throw new Error('Canvas 2D context is unavailable');
        sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
        sourceContext.drawImage(image, 0, 0);
        removeDarkPixels(sourceContext, sourceCanvas.width, sourceCanvas.height);

        const imageData = sourceContext.getImageData(
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height
        );
        const bounds = getVisibleBounds(imageData);
        if (!bounds) {
          if (canvas.width !== 512 || canvas.height !== 512) {
            canvas.width = 512;
            canvas.height = 512;
          }
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }

        if (!hasReportedDominantColor) {
          const dominantColor = getDominantColor(imageData);
          if (dominantColor) {
            hasReportedDominantColor = true;
            onDominantColor?.(dominantColor);
          }
        }

        const outputSize = 512;
        const padding = 8;
        const scale = Math.min(
          (outputSize - padding * 2) / bounds.width,
          (outputSize - padding * 2) / bounds.height
        );
        const outputWidth = bounds.width * scale;
        const outputHeight = bounds.height * scale;
        if (canvas.width !== outputSize || canvas.height !== outputSize) {
          canvas.width = outputSize;
          canvas.height = outputSize;
        }
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context is unavailable');
        context.clearRect(0, 0, outputSize, outputSize);
        context.drawImage(
          sourceCanvas,
          bounds.left,
          bounds.top,
          bounds.width,
          bounds.height,
          (outputSize - outputWidth) / 2,
          (outputSize - outputHeight) / 2,
          outputWidth,
          outputHeight
        );
      } catch (error) {
        active = false;
        canvas.width = 0;
        canvas.height = 0;
        window.cancelAnimationFrame(animationFrame);
        console.error('Unable to make dark asset pixels transparent:', src, error);
      }
    };
    image.onload = () => {
      drawFrame();
      if (!isAnimatedImage) return;

      const drawAnimatedFrame = (timestamp: number) => {
        if (!active) return;
        if (timestamp - lastAnimatedFrameAt >= 100) {
          lastAnimatedFrameAt = timestamp;
          drawFrame();
        }
        animationFrame = window.requestAnimationFrame(drawAnimatedFrame);
      };
      animationFrame = window.requestAnimationFrame(drawAnimatedFrame);
    };
    image.onerror = (error) => {
      console.error('Unable to load transparent asset image:', src, error);
    };
    image.src = src;

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      image.onload = null;
      image.onerror = null;
    };
  }, [onDominantColor, src]);

  return (
    <canvas
      ref={canvasRef}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt}
      className={className}
      style={{ opacity: 1 }}
    />
  );
};

export const TransparentAssetVideo: React.FC<TransparentAssetProps> = ({
  src,
  alt,
  className,
  onDominantColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !video || !context || !src) return;

    let animationFrame = 0;
    let lastFrameTime = -1;
    let hasReportedColor = false;

    const drawFrame = () => {
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.currentTime !== lastFrameTime
      ) {
        lastFrameTime = video.currentTime;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          removeDarkPixels(context, canvas.width, canvas.height);
          if (!hasReportedColor && onDominantColor) {
            const dominantColor = getDominantColor(
              context.getImageData(0, 0, canvas.width, canvas.height)
            );
            if (dominantColor) {
              hasReportedColor = true;
              onDominantColor(dominantColor);
            }
          }
        } catch (error) {
          canvas.width = 0;
          canvas.height = 0;
          console.error('Unable to make dark asset video pixels transparent:', src, error);
          return;
        }
      }

      if (!video.paused && !video.ended) {
        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    };

    video.crossOrigin = 'anonymous';
    video.onloadeddata = () => {
      void video.play().then(drawFrame).catch((error: unknown) => {
        console.error('Unable to play transparent asset video:', src, error);
      });
    };
    video.onerror = () => {
      console.error('Unable to load transparent asset video:', src, video.error);
    };
    video.src = src;

    return () => {
      window.cancelAnimationFrame(animationFrame);
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [onDominantColor, src]);

  return (
    <>
      <canvas
        ref={canvasRef}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={!alt}
        className={className}
        style={{ opacity: 1 }}
      />
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        className="hidden"
      />
    </>
  );
};
