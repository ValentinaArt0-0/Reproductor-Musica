import fs from "node:fs/promises";
import { Router } from "express";
import type multer from "multer";
import { MAX_FILES_PER_REQUEST } from "../middleware/audioUpload";
import { HttpError } from "../errors/HttpError";
import { asyncHandler } from "../middleware/asyncHandler";
import { uploadBodySchema } from "../schemas";
import type { PlaylistService } from "../services/PlaylistService";
import type { TrackLibraryService, UploadedTrackRecord } from "../services/TrackLibraryService";

interface RejectedFile {
  fileName: string;
  message: string;
}

export function createUploadsRouter(
  library: TrackLibraryService,
  playlists: PlaylistService,
  upload: multer.Multer,
): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ tracks: library.list() });
  });

  /**
   * POST /api/uploads  (multipart/form-data)
   *   files       one or more MP3 files (max 20)
   *   playlistId  optional: also add the tracks to this playlist
   *   position    optional: "start" | "end" | index (default "end")
   */
  router.post(
    "/",
    upload.array("files", MAX_FILES_PER_REQUEST),
    asyncHandler(async (req, res) => {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const discardFiles = () => Promise.all(files.map((f) => fs.rm(f.path, { force: true })));

      // Everything that can fail before registering anything: clean the temp files first.
      let body;
      try {
        if (files.length === 0) {
          throw new HttpError(400, "NO_FILES", 'No se recibió ningún archivo en el campo "files".');
        }
        body = uploadBodySchema.parse(req.body);
        if (body.playlistId) playlists.get(body.playlistId); // throws 404 if missing
      } catch (error) {
        await discardFiles();
        throw error;
      }

      const tracks: UploadedTrackRecord[] = [];
      const rejected: RejectedFile[] = [];
      for (const file of files) {
        try {
          tracks.push(await library.register(file));
        } catch (error) {
          if (!(error instanceof HttpError)) throw error;
          rejected.push({
            fileName: Buffer.from(file.originalname, "latin1").toString("utf8"),
            message: error.message,
          });
        }
      }

      if (tracks.length === 0) {
        throw new HttpError(422, "INVALID_AUDIO", "Ningún archivo es un MP3 válido.", rejected);
      }

      let playlist;
      if (body.playlistId) {
        // "start" must keep the upload order, so each file gets its own index.
        for (const [i, track] of tracks.entries()) {
          const position =
            body.position === "start" ? i : body.position === "end" ? "end" : body.position + i;
          ({ playlist } = await playlists.addSong(
            body.playlistId,
            library.toNewSong(track),
            position,
          ));
        }
      }

      res.status(201).json({ tracks, rejected, playlist });
    }),
  );

  /** Deletes the file and removes it from every playlist that used it. */
  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const removed = await library.remove(req.params.id);
      await playlists.removeSongsByUri(removed.uri);
      res.status(204).end();
    }),
  );

  return router;
}
