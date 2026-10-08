import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "./config/env";
import { createAudioUpload } from "./middleware/audioUpload";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createPlaylistsRouter } from "./routes/playlists.routes";
import { createSearchRouter } from "./routes/search.routes";
import { createStreamRouter } from "./routes/stream.routes";
import { createUploadsRouter } from "./routes/uploads.routes";
import { PlaylistService, type PlaylistRecord } from "./services/PlaylistService";
import { createSearchProvider } from "./services/search/createSearchProvider";
import { TrackLibraryService, type UploadedTrackRecord } from "./services/TrackLibraryService";
import { JsonCollection } from "./storage/JsonCollection";
import ytdl from "@distube/ytdl-core"; // NUEVA LIBRERÍA

export function createApp(config: AppConfig): Express {
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const playlists = new PlaylistService(
    new JsonCollection<PlaylistRecord>(path.join(config.dataDir, "playlists.json")),
  );
  const library = new TrackLibraryService(
    new JsonCollection<UploadedTrackRecord>(path.join(config.dataDir, "uploads.json")),
    config.uploadDir,
  );
  const searchProvider = createSearchProvider(config);
  const audioUpload = createAudioUpload(config);

  const app = express();
  app.disable("x-powered-by");
 app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.use(
    "/media",
    express.static(config.uploadDir, {
      index: false,
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", searchProvider: searchProvider.name });
  });

  app.get("/api/yt-stream/:videoId.mp3", (req, res) => {
    const videoId = req.params.videoId;
    if (!ytdl.validateID(videoId)) {
      res.status(400).json({
        error: { code: "INVALID_VIDEO_ID", message: "El identificador del video no es válido." },
      });
      return;
    }

    const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
      filter: "audioonly",
      quality: "highestaudio",
    });
    stream.on("info", (_info, format) => {
      res.setHeader("Content-Type", format.mimeType.split(";")[0]);
      res.setHeader("X-Content-Type-Options", "nosniff");
    });
    stream.on("error", (error) => {
      console.error("[youtube] Audio stream failed", error);
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.status(502).json({
        error: { code: "STREAM_UNAVAILABLE", message: "No se pudo obtener el audio del video." },
      });
    });
    stream.pipe(res);
  });

  app.use("/api/playlists", createPlaylistsRouter(playlists));
  app.use("/api/search", createSearchRouter(searchProvider));
  app.use("/api/uploads", createUploadsRouter(library, playlists, audioUpload));
  app.use("/api/stream", createStreamRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}