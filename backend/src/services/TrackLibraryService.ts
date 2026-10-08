import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parseFile, selectCover, type IPicture } from "music-metadata";
import { HttpError } from "../errors/HttpError";
import type { NewSong } from "../schemas";
import type { JsonCollection } from "../storage/JsonCollection";

export interface UploadedTrackRecord {
  id: string;
  originalName: string;
  /** Name of the file inside the upload directory. */
  storedName: string;
  sizeBytes: number;
  title: string;
  artist: string;
  durationSeconds: number;
  /** Public URL served by the static /media route. */
  uri: string;
  /** Embedded album art extracted from the ID3 tags, when the file has one. */
  coverUri?: string;
  coverStoredName?: string;
  uploadedAt: string;
}

const UNKNOWN_ARTIST = "Artista desconocido";
const COVER_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Multer decodes multipart filenames as latin1; this restores accents and "ñ". */
const decodeFileName = (name: string): string => Buffer.from(name, "latin1").toString("utf8");

/** Manages the library of uploaded MP3 files (metadata, album art and files on disk). */
export class TrackLibraryService {
  constructor(
    private readonly store: JsonCollection<UploadedTrackRecord>,
    private readonly uploadDir: string,
  ) {}

  list(): UploadedTrackRecord[] {
    return this.store.list().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  get(id: string): UploadedTrackRecord {
    const track = this.store.get(id);
    if (!track) throw new HttpError(404, "TRACK_NOT_FOUND", "El archivo no existe en la biblioteca.");
    return track;
  }

  /**
   * Reads the ID3 tags / duration of a file already saved by multer and registers it.
   * Files that are not valid MP3s are deleted and rejected with a 422.
   */
  async register(file: Express.Multer.File): Promise<UploadedTrackRecord> {
    const originalName = decodeFileName(file.originalname);

    let metadata;
    try {
      metadata = await parseFile(file.path, { duration: true });
    } catch {
      metadata = null;
    }

    if (!metadata || metadata.format.container !== "MPEG") {
      await fs.rm(file.path, { force: true });
      throw new HttpError(
        422,
        "INVALID_AUDIO",
        `"${originalName}" no es un archivo MP3 válido.`,
      );
    }

    const id = randomUUID();
    const cover = await this.saveCover(id, metadata.common.picture);

    const record: UploadedTrackRecord = {
      id,
      originalName,
      storedName: path.basename(file.path),
      sizeBytes: file.size,
      title: metadata.common.title?.trim() || path.parse(originalName).name,
      artist: metadata.common.artist?.trim() || UNKNOWN_ARTIST,
      durationSeconds: Math.round((metadata.format.duration ?? 0) * 1000) / 1000,
      uri: `/media/${path.basename(file.path)}`,
      ...cover,
      uploadedAt: new Date().toISOString(),
    };
    await this.store.upsert(record);
    return record;
  }

  /** Deletes the record, the audio file and its cover. */
  async remove(id: string): Promise<UploadedTrackRecord> {
    const record = this.get(id);
    await this.store.remove(id);
    await fs.rm(path.join(this.uploadDir, record.storedName), { force: true });
    if (record.coverStoredName) {
      await fs.rm(path.join(this.uploadDir, record.coverStoredName), { force: true });
    }
    return record;
  }

  /** Shape expected by the "add song to playlist" operation. */
  toNewSong(record: UploadedTrackRecord): NewSong {
    return {
      title: record.title,
      artist: record.artist,
      durationSeconds: record.durationSeconds,
      source: "local",
      uri: record.uri,
      coverUrl: record.coverUri,
    };
  }

  /** Saves the embedded cover (JPEG/PNG only). A bad cover never fails the upload. */
  private async saveCover(
    id: string,
    pictures: IPicture[] | undefined,
  ): Promise<{ coverUri?: string; coverStoredName?: string }> {
    const picture = selectCover(pictures);
    if (!picture || picture.data.length > MAX_COVER_BYTES) return {};
    const extension = COVER_EXTENSIONS[picture.format.toLowerCase()];
    if (!extension) return {};

    const coverStoredName = `covers/${id}.${extension}`;
    try {
      await fs.mkdir(path.join(this.uploadDir, "covers"), { recursive: true });
      await fs.writeFile(path.join(this.uploadDir, coverStoredName), picture.data);
    } catch {
      return {};
    }
    return { coverStoredName, coverUri: `/media/${coverStoredName}` };
  }
}
