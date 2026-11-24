import { Package } from 'lucide-react';
import { useState } from 'react';

interface ProductThumbnailProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProductThumbnail({ src, alt, size = 'md' }: ProductThumbnailProps) {
  const [failed, setFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-12 h-12'
      : size === 'lg'
        ? 'w-28 h-28'
        : 'w-20 h-20';

  if (!src || failed) {
    return (
      <div
        className={`${dims} shrink-0 rounded-lg bg-[#F2F6F3] border border-[#E4EAE6] flex flex-col items-center justify-center text-[#5A6E62]`}
        aria-label={alt}
      >
        <Package className={size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div
      className={`${dims} shrink-0 rounded-lg bg-white border border-[#E4EAE6] overflow-hidden flex items-center justify-center p-1`}
    >
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
