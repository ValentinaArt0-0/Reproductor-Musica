import { useEffect, useMemo, useState } from "react";
import { extractPalette, fallbackPalette, type Palette } from "../lib/palette";
import type { Song } from "../types";

/**
 * Colors for the current song: from its cover when readable, otherwise a calm palette that is
 * stable for that song. The fallback is available immediately, so nothing waits on the image.
 */
export function useAlbumPalette(song: Song | null): Palette {
  const seed = song?.id ?? "";
  const coverUrl = song?.coverUrl;
  const fallback = useMemo(() => fallbackPalette(seed), [seed]);
  const [extracted, setExtracted] = useState<{ url: string; palette: Palette } | null>(null);

  useEffect(() => {
    if (!coverUrl) return;
    let cancelled = false;
    void extractPalette(coverUrl).then((palette) => {
      if (!cancelled && palette) setExtracted({ url: coverUrl, palette });
    });
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  return extracted && extracted.url === coverUrl ? extracted.palette : fallback;
}
