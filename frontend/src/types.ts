/** Same shapes the backend (Module 2) returns. */
export type SongSource = "local" | "web";

export interface Song {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  source: SongSource;
  uri?: string;
  /** Album cover: "/media/covers/..." (uploaded MP3s) or an https URL (web results). */
  coverUrl?: string;
}

export type InsertPosition = "start" | "end";

export interface PlaylistSummary {
  id: string;
  name: string;
  songCount: number;
  totalDurationSeconds: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  currentSongId: string | null;
  isShuffled: boolean;
  songs: Song[];
}

export interface PlaybackState {
  currentSong: Song | null;
  hasNext: boolean;
  hasPrev: boolean;
  /** True when "next" was requested on the last node (currentNode.next === null). */
  reachedEnd: boolean;
}

export interface UploadResponse {
  tracks: Array<{ id: string; title: string }>;
  rejected: Array<{ fileName: string; message: string }>;
  playlist?: PlaylistDetail;
}

/** A song found by the backend's search provider (YouTube, demo catalogue, ...). */
export interface SearchResult {
  externalId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  source: "web";
  uri: string;
  provider: string;
  thumbnailUrl?: string;
}

export interface SearchResponse {
  query: string;
  provider: string;
  results: SearchResult[];
}

/** Body accepted by POST /api/playlists/:id/songs (the server assigns the id). */
export type NewSongInput = Omit<Song, "id">;
