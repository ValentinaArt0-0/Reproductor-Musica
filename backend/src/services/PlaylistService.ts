import { randomUUID } from "node:crypto";
import { DoublyLinkedList, type ListSnapshot, type SongMetadata } from "../core";
import { HttpError } from "../errors/HttpError";
import type { NewSong, SongPosition } from "../schemas";
import type { JsonCollection } from "../storage/JsonCollection";

/** What is persisted for each playlist. */
export interface PlaylistRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: ListSnapshot;
}

interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  list: DoublyLinkedList;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  songCount: number;
  totalDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  currentSongId: string | null;
  isShuffled: boolean;
  songs: SongMetadata[];
}

export interface PlaybackState {
  currentSong: SongMetadata | null;
  hasNext: boolean;
  hasPrev: boolean;
  /** True when "next" was requested on the last song: the player should stop. */
  reachedEnd: boolean;
}

/**
 * Application layer on top of DoublyLinkedList: every playlist lives in memory as a
 * linked list and is saved to the store after each change.
 */
export class PlaylistService {
  private readonly playlists = new Map<string, Playlist>();

  constructor(private readonly store: JsonCollection<PlaylistRecord>) {
    for (const record of store.list()) {
      this.playlists.set(record.id, {
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        list: DoublyLinkedList.fromSnapshot(record.snapshot),
      });
    }
  }

  // ---- Playlist CRUD ---------------------------------------------------------

  list(): PlaylistSummary[] {
    return Array.from(this.playlists.values()).map((p) => this.toSummary(p));
  }

  get(id: string): PlaylistDetail {
    return this.toDetail(this.require(id));
  }

  async create(name: string): Promise<PlaylistDetail> {
    const now = new Date().toISOString();
    const playlist: Playlist = {
      id: randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      list: new DoublyLinkedList(),
    };
    this.playlists.set(playlist.id, playlist);
    await this.persist(playlist, false);
    return this.toDetail(playlist);
  }

  async rename(id: string, name: string): Promise<PlaylistDetail> {
    const playlist = this.require(id);
    playlist.name = name;
    await this.persist(playlist);
    return this.toDetail(playlist);
  }

  async delete(id: string): Promise<void> {
    const playlist = this.require(id);
    playlist.list.clear();
    this.playlists.delete(id);
    await this.store.remove(id);
  }

  // ---- Songs -----------------------------------------------------------------

  async addSong(
    playlistId: string,
    input: NewSong,
    position: SongPosition = "end",
  ): Promise<{ song: SongMetadata; playlist: PlaylistDetail }> {
    const playlist = this.require(playlistId);
    // The server owns ids: the same track can appear twice in a playlist.
    const metadata: SongMetadata = { ...input, id: randomUUID() };

    let node;
    try {
      if (position === "start") node = playlist.list.addToStart(metadata);
      else if (position === "end") node = playlist.list.addToEnd(metadata);
      else node = playlist.list.insertAt(position, metadata);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpError(
          400,
          "INVALID_POSITION",
          `La posición debe estar entre 0 y ${playlist.list.size}.`,
        );
      }
      throw error;
    }

    await this.persist(playlist);
    return { song: node.toMetadata(), playlist: this.toDetail(playlist) };
  }

  async removeSong(playlistId: string, songId: string): Promise<PlaylistDetail> {
    const playlist = this.require(playlistId);
    if (!playlist.list.removeById(songId)) {
      throw new HttpError(404, "SONG_NOT_FOUND", "La canción no existe en esta playlist.");
    }
    await this.persist(playlist);
    return this.toDetail(playlist);
  }

  /** Moves a song to a new position (used by drag & drop in the UI). */
  async moveSong(playlistId: string, songId: string, toIndex: number): Promise<PlaylistDetail> {
    const playlist = this.require(playlistId);

    let found: boolean;
    try {
      found = playlist.list.moveTo(songId, toIndex);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new HttpError(
          400,
          "INVALID_POSITION",
          `La posición debe estar entre 0 y ${playlist.list.size - 1}.`,
        );
      }
      throw error;
    }
    if (!found) {
      throw new HttpError(404, "SONG_NOT_FOUND", "La canción no existe en esta playlist.");
    }

    await this.persist(playlist);
    return this.toDetail(playlist);
  }

  /** Removes every song that points to `uri` from all playlists (used when a file is deleted). */
  async removeSongsByUri(uri: string): Promise<void> {
    for (const playlist of this.playlists.values()) {
      const doomedIds: string[] = [];
      for (const node of playlist.list) {
        if (node.uri === uri) doomedIds.push(node.id);
      }
      if (doomedIds.length === 0) continue;
      for (const id of doomedIds) playlist.list.removeById(id);
      await this.persist(playlist);
    }
  }

  // ---- Playback navigation -----------------------------------------------------

  getPlaybackState(playlistId: string): PlaybackState {
    return this.toPlaybackState(this.require(playlistId));
  }

  async moveNext(playlistId: string): Promise<PlaybackState> {
    const playlist = this.require(playlistId);
    const moved = playlist.list.moveNext();
    if (moved) await this.persist(playlist, false);
    return this.toPlaybackState(playlist, moved === null && !playlist.list.isEmpty);
  }

  async movePrev(playlistId: string): Promise<PlaybackState> {
    const playlist = this.require(playlistId);
    if (playlist.list.movePrev()) await this.persist(playlist, false);
    return this.toPlaybackState(playlist);
  }

  async setCurrent(playlistId: string, songId: string): Promise<PlaybackState> {
    const playlist = this.require(playlistId);
    if (!playlist.list.setCurrentById(songId)) {
      throw new HttpError(404, "SONG_NOT_FOUND", "La canción no existe en esta playlist.");
    }
    await this.persist(playlist, false);
    return this.toPlaybackState(playlist);
  }

  // ---- Smart Shuffle -------------------------------------------------------------

  async shuffle(playlistId: string): Promise<PlaylistDetail> {
    const playlist = this.require(playlistId);
    playlist.list.shuffle();
    await this.persist(playlist);
    return this.toDetail(playlist);
  }

  async restoreOrder(playlistId: string): Promise<PlaylistDetail> {
    const playlist = this.require(playlistId);
    playlist.list.restoreOrder();
    await this.persist(playlist);
    return this.toDetail(playlist);
  }

  // ---- Internals -------------------------------------------------------------------

  private require(id: string): Playlist {
    const playlist = this.playlists.get(id);
    if (!playlist) {
      throw new HttpError(404, "PLAYLIST_NOT_FOUND", "La playlist no existe.");
    }
    return playlist;
  }

  private async persist(playlist: Playlist, touch = true): Promise<void> {
    if (touch) playlist.updatedAt = new Date().toISOString();
    await this.store.upsert({
      id: playlist.id,
      name: playlist.name,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      snapshot: playlist.list.toSnapshot(),
    });
  }

  private toSummary(playlist: Playlist): PlaylistSummary {
    let totalDurationSeconds = 0;
    for (const node of playlist.list) totalDurationSeconds += node.durationSeconds;
    return {
      id: playlist.id,
      name: playlist.name,
      songCount: playlist.list.size,
      totalDurationSeconds,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    };
  }

  private toDetail(playlist: Playlist): PlaylistDetail {
    return {
      ...this.toSummary(playlist),
      currentSongId: playlist.list.getCurrent()?.id ?? null,
      isShuffled: playlist.list.isShuffled,
      songs: playlist.list.toArray(),
    };
  }

  private toPlaybackState(playlist: Playlist, reachedEnd = false): PlaybackState {
    return {
      currentSong: playlist.list.getCurrent()?.toMetadata() ?? null,
      hasNext: playlist.list.hasNext,
      hasPrev: playlist.list.hasPrev,
      reachedEnd,
    };
  }
}
