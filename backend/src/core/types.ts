/** Where the audio of a song comes from. */
export type SongSource = "local" | "web";

/** Plain metadata describing a song (what the API / UI will exchange). */
export interface SongMetadata {
  id: string;
  title: string;
  artist: string;
  /** Duration in seconds. */
  durationSeconds: number;
  source: SongSource;
  /**
   * Playable location:
   * - local songs: "/media/<file>.mp3"
   * - web songs: provider reference such as "youtube:<videoId>"
   */
  uri?: string;
  /** Album cover: "/media/covers/<id>.jpg" for uploaded MP3s, or an https URL for web results. */
  coverUrl?: string;
}

/** A song plus the rank it had before a Smart Shuffle (used for persistence). */
export interface ListSnapshotEntry extends SongMetadata {
  originalRank: number;
}

/** Serializable picture of a DoublyLinkedList (storage only, never used to order songs at runtime). */
export interface ListSnapshot {
  songs: ListSnapshotEntry[];
  currentId: string | null;
  shuffled: boolean;
}
