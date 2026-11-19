import React, { memo, useEffect, useState } from 'react';
import { getFluent3DUrl } from '../lib/fluent3d';

interface Fluent3DAssetProps {
  glyph: string;
  alt?: string;
  sizeClass?: string;
  className?: string;
  fallbackTextClass?: string;
  priority?: boolean;
}

/**
 * Renders a high-resolution transparent-background 3D Microsoft Fluent PNG asset
 * with an elegant metallic/glass medallion fallback while loading or if CDN fails.
 */
export const Fluent3DAsset: React.FC<Fluent3DAssetProps> = memo(
  ({
    glyph,
    alt,
    sizeClass = 'w-10 h-10',
    className = '',
    fallbackTextClass = 'text-2xl',
    priority = false,
  }) => {
    const src = getFluent3DUrl(glyph);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      setLoaded(false);
      setFailed(false);
    }, [src]);

    if (!src || failed) {
      return (
        <span
          className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#FDE68A]/25 via-[#D4AF37]/15 to-black/30 border border-[#FCE9A6]/35 shadow-inner select-none ${sizeClass} ${className}`}
          aria-label={alt || glyph}
        >
          <span className={`${fallbackTextClass} leading-none drop-shadow`}>{glyph}</span>
        </span>
      );
    }

    return (
      <span
        className={`relative inline-flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      >
        {!loaded && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#FCE9A6]/20 via-[#D4AF37]/10 to-white/5 border border-[#F3D37A]/25 flex items-center justify-center"
          >
            <span className={`${fallbackTextClass} opacity-65 leading-none`}>{glyph}</span>
          </span>
        )}
        <img
          src={src}
          alt={alt || glyph}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-contain pointer-events-none transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
    );
  }
);
