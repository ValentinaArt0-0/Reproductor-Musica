import yts from "yt-search";
import { HttpError } from "../../errors/HttpError";
import type { SearchProvider, SearchResult } from "./types";

type VideoResult = Pick<yts.VideoSearchResult, "videoId" | "title" | "author" | "seconds" | "thumbnail">;
type SearchVideos = (query: string) => Promise<VideoResult[]>;

export class YouTubeSearchProvider implements SearchProvider {
  readonly name = "youtube";

  constructor(
    private readonly searchVideos: SearchVideos = async (query) =>
      (await yts({ query, pages: 1 })).videos,
  ) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    let videos: VideoResult[];
    try {
      // Usamos "lyrics" para evitar los videos bloqueados por copyright
      videos = await this.searchVideos(`${query} lyrics`);
    } catch (error) {
      console.error("[youtube] Search failed", error);
      throw new HttpError(502, "SEARCH_UNAVAILABLE", "No se pudo buscar en YouTube.");
    }

    return videos
      .filter((video) => /^[\w-]{11}$/.test(video.videoId))
      .slice(0, limit)
      .map((video) => ({
        externalId: video.videoId,
        title: video.title,
        artist: video.author.name || "Artista desconocido",
        durationSeconds: video.seconds || 0,
        source: "web",
        // DEVOLVEMOS LA URL REAL PARA QUE EL BACKEND NO DE ERROR
        uri: `https://www.youtube.com/watch?v=${video.videoId}`,
        provider: this.name,
        thumbnailUrl: video.thumbnail,
      }));
  }
}