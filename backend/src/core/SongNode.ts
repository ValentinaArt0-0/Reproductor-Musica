import type { SongMetadata, SongSource } from "./types";

/**
 * A single node of the playlist: one song plus links to its neighbours.
 */
export class SongNode {
  public readonly id: string;
  public readonly title: string;
  public readonly artist: string;
  public readonly durationSeconds: number;
  public readonly source: SongSource;
  public readonly uri?: string;
  public readonly coverUrl?: string;

  public prev: SongNode | null = null;
  public next: SongNode | null = null;

  /**
   * Position the song had before a Smart Shuffle. Only meaningful while the
   * list is shuffled; it is what allows going back to the original order.
   * Managed exclusively by DoublyLinkedList.
   */
  public originalRank = 0;

  constructor(metadata: SongMetadata) {
    this.id = metadata.id;
    this.title = metadata.title;
    this.artist = metadata.artist;
    this.durationSeconds = metadata.durationSeconds;
    this.source = metadata.source;
    this.uri = metadata.uri;
    this.coverUrl = metadata.coverUrl;
  }

  /** Returns a plain, link-free copy of the metadata (safe to serialize). */
  toMetadata(): SongMetadata {
    return {
      id: this.id,
      title: this.title,
      artist: this.artist,
      durationSeconds: this.durationSeconds,
      source: this.source,
      uri: this.uri,
      coverUrl: this.coverUrl,
    };
  }
}
