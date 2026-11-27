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
}

export const TransparentAssetImage: React.FC<TransparentAssetProps> = ({
  src,
  alt,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    canvas.width = 0;
    canvas.height = 0;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas 2D context is unavailable');
        context.drawImage(image, 0, 0);
        removeDarkPixels(context, canvas.width, canvas.height);
      } catch (error) {
        canvas.width = 0;
        canvas.height = 0;
        console.error('Unable to make dark asset pixels transparent:', src, error);
      }
    };
    image.onerror = (error) => {
      console.error('Unable to load transparent asset image:', src, error);
    };
    image.src = src;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

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
  }, [src]);

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
