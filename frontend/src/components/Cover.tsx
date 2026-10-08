import { useState } from "react";
import { MusicNoteIcon } from "./icons";

interface CoverProps {
  src?: string;
  /** Size, radius and any extra classes for the box. */
  className?: string;
  iconClassName?: string;
}

/** Album cover with a graceful placeholder when there is none (or it fails to load). */
export function Cover({ src, className = "", iconClassName = "size-1/3" }: CoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-lavender-200 via-sage-200 to-sage-300 text-sage-700/80 ${className}`}
    >
      <MusicNoteIcon className={iconClassName} />
      {showImage && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedSrc(src ?? null)}
          onError={() => setFailedSrc(src ?? null)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
            loadedSrc === src ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
