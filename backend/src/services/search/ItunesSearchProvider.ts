import { HttpError } from "../../errors/HttpError";
import { isAllowedMediaUrl } from "../../lib/allowedMedia";
import type { SearchProvider, SearchResult } from "./types";

const API_URL = "https://itunes.apple.com/search";

/** iTunes previews are 30-second clips: the playlist node represents the clip, so it lasts 30 s. */
export const PREVIEW_SECONDS = 30;

interface ItunesTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
}

/** "…/100x100bb.jpg" -> "…/300x300bb.jpg" (Apple serves any size from the same path). */
const upscaleArtwork = (url?: string): string | undefined =>
  url?.startsWith("https://") ? url.replace(/\/\d+x\d+bb\./, "/300x300bb.") : undefined;

/**
 * iTunes Search API: free, public and WITHOUT an API key.
 * https://performance-partners.apple.com/search-api
 *
 * Every result carries a 30-second audio preview (`previewUrl`, AAC in an .m4a file) and
 * artwork, so songs found here are really playable. The API allows roughly 20 requests per
 * minute per IP: wrap this provider in CachedSearchProvider (createSearchProvider does).
 */
export class ItunesSearchProvider implements SearchProvider {
  readonly name = "itunes";

  constructor(
    /** Two-letter store country (catalogue and preview availability depend on it). */
    private readonly country = "US",
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 8000,
  ) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      term: query,
      media: "music",
      entity: "song",
      country: this.country,
      // Ask for extra: some tracks have no preview and are dropped below.
      limit: String(Math.min(limit * 2, 50)),
    });

    let response: Response;
    try {
      response = await this.fetchFn(`${API_URL}?${params}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new HttpError(502, "SEARCH_TIMEOUT", "iTunes tardó demasiado en responder. Inténtalo de nuevo.");
      }
      throw new HttpError(502, "SEARCH_UNAVAILABLE", "No se pudo conectar con iTunes.");
    }

    if (!response.ok) {
      console.error(`[itunes] HTTP ${response.status}`);
      if (response.status === 403 || response.status === 429) {
        throw new HttpError(
          429,
          "SEARCH_QUOTA_EXCEEDED",
          "iTunes limita las búsquedas por minuto. Espera unos segundos e inténtalo de nuevo.",
        );
      }
      throw new HttpError(502, "SEARCH_PROVIDER_ERROR", "iTunes devolvió un error al buscar.");
    }

    let body: { results?: ItunesTrack[] };
    try {
      // iTunes labels its JSON as text/javascript; .json() does not care about the label.
      body = (await response.json()) as { results?: ItunesTrack[] };
    } catch {
      throw new HttpError(502, "SEARCH_PROVIDER_ERROR", "iTunes devolvió una respuesta que no se pudo leer.");
    }

    const seen = new Set<number>();
    const results: SearchResult[] = [];
    for (const track of body.results ?? []) {
      if (results.length >= limit) break;
      if (!track.trackId || !track.trackName || !track.previewUrl || seen.has(track.trackId)) continue;

      const previewUrl = track.previewUrl.replace(/^http:\/\//i, "https://");
      // Only keep previews the stream proxy is allowed to serve, so every result can be played.
      if (!isAllowedMediaUrl(previewUrl)) continue;

      seen.add(track.trackId);
      results.push({
        externalId: String(track.trackId),
        title: track.trackName,
        artist: track.artistName?.trim() || "Artista desconocido",
        durationSeconds: PREVIEW_SECONDS,
        source: "web",
        uri: previewUrl,
        provider: this.name,
        thumbnailUrl: upscaleArtwork(track.artworkUrl100),
      });
    }
    return results;
  }
}
