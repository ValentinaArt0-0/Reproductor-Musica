/** A song found in an external catalogue; the client can turn it into a playlist song. */
export interface SearchResult {
  /** Provider-specific id (e.g. a YouTube video id). */
  externalId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  source: "web";
  /** Provider reference stored as the song's `uri`, e.g. a YouTube watch URL. */
  uri: string;
  provider: string;
  thumbnailUrl?: string;
}

/** Contract every catalogue integration (YouTube, Spotify, ...) must implement. */
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<SearchResult[]>;
}
