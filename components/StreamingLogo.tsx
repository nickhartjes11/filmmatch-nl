'use client';

import { useState } from 'react';
import Image from 'next/image';

const STREAMING_BRANDS: Record<string, { mark: string; color: string }> = {
  Netflix: { mark: 'N', color: '#e50914' },
  'Prime Video': { mark: 'prime', color: '#146eb4' },
  'Disney+': { mark: 'D+', color: '#172b73' },
  'HBO Max': { mark: 'HBO', color: '#5428a8' },
  Videoland: { mark: 'V', color: '#e30a64' },
};

interface StreamingLogoProps {
  name: string;
  logoPath?: string;
  mark?: string;
  color?: string;
  className?: string;
}

export default function StreamingLogo({ name, logoPath, mark, color, className = 'h-6 w-6' }: StreamingLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const brand = STREAMING_BRANDS[name] || { mark: name.slice(0, 1).toUpperCase(), color: '#475569' };
  const fallbackMark = mark || brand.mark;

  return (
    <span
      title={name}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
      style={{ backgroundColor: color || brand.color }}
    >
      <span
        aria-hidden="true"
        className={`font-black leading-none text-white ${fallbackMark.length > 2 ? 'text-[6px]' : 'text-[9px]'}`}
      >
        {fallbackMark}
      </span>
      {logoPath && !imageFailed && (
        <Image
          src={`https://image.tmdb.org/t/p/original${logoPath}`}
          alt={name}
          fill
          unoptimized
          onError={() => setImageFailed(true)}
          className="z-10 object-contain p-0.5"
        />
      )}
    </span>
  );
}
