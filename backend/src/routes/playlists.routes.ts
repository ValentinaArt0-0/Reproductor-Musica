import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  addSongSchema,
  createPlaylistSchema,
  moveSongSchema,
  setCurrentSchema,
  updatePlaylistSchema,
} from "../schemas";
import type { PlaylistService } from "../services/PlaylistService";

export function createPlaylistsRouter(service: PlaylistService): Router {
  const router = Router();

  // ---- Playlist CRUD ----
  router.get("/", (_req, res) => {
    res.json({ playlists: service.list() });
  });

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const { name } = createPlaylistSchema.parse(req.body);
      res.status(201).json({ playlist: await service.create(name) });
    }),
  );

  router.get("/:id", (req, res) => {
    res.json({ playlist: service.get(req.params.id) });
  });

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const { name } = updatePlaylistSchema.parse(req.body);
      res.json({ playlist: await service.rename(req.params.id, name) });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      await service.delete(req.params.id);
      res.status(204).end();
    }),
  );

  // ---- Songs (linked list operations) ----
  router.post(
    "/:id/songs",
    asyncHandler(async (req, res) => {
      const { song, position } = addSongSchema.parse(req.body);
      const result = await service.addSong(req.params.id, song, position);
      res.status(201).json(result);
    }),
  );

  router.delete(
    "/:id/songs/:songId",
    asyncHandler(async (req, res) => {
      res.json({ playlist: await service.removeSong(req.params.id, req.params.songId) });
    }),
  );

  router.post(
    "/:id/songs/:songId/move",
    asyncHandler(async (req, res) => {
      const { toIndex } = moveSongSchema.parse(req.body);
      res.json({ playlist: await service.moveSong(req.params.id, req.params.songId, toIndex) });
    }),
  );

  // ---- Playback navigation ----
  router.get("/:id/current", (req, res) => {
    res.json(service.getPlaybackState(req.params.id));
  });

  router.put(
    "/:id/current",
    asyncHandler(async (req, res) => {
      const { songId } = setCurrentSchema.parse(req.body);
      res.json(await service.setCurrent(req.params.id, songId));
    }),
  );

  router.post(
    "/:id/next",
    asyncHandler(async (req, res) => {
      res.json(await service.moveNext(req.params.id));
    }),
  );

  router.post(
    "/:id/prev",
    asyncHandler(async (req, res) => {
      res.json(await service.movePrev(req.params.id));
    }),
  );

  // ---- Smart Shuffle ----
  router.post(
    "/:id/shuffle",
    asyncHandler(async (req, res) => {
      res.json({ playlist: await service.shuffle(req.params.id) });
    }),
  );

  router.post(
    "/:id/restore-order",
    asyncHandler(async (req, res) => {
      res.json({ playlist: await service.restoreOrder(req.params.id) });
    }),
  );

  return router;
}
