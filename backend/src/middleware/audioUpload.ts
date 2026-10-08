import { randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import type { AppConfig } from "../config/env";
import { HttpError } from "../errors/HttpError";

export const MAX_FILES_PER_REQUEST = 20;
const ALLOWED_MIME_TYPES = new Set(["audio/mpeg", "audio/mp3"]);

/**
 * Multer instance for MP3 uploads.
 * Files are stored with a random name (never the client's), so there is no path traversal
 * or collision risk. The real format check happens afterwards by parsing the file itself.
 */
export function createAudioUpload(config: AppConfig): multer.Multer {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadDir),
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.mp3`),
  });

  return multer({
    storage,
    limits: { fileSize: config.maxUploadBytes, files: MAX_FILES_PER_REQUEST },
    fileFilter: (_req, file, cb) => {
      const looksLikeMp3 =
        ALLOWED_MIME_TYPES.has(file.mimetype) ||
        path.extname(file.originalname).toLowerCase() === ".mp3";
      if (looksLikeMp3) return cb(null, true);
      cb(new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Solo se permiten archivos MP3."));
    },
  });
}
