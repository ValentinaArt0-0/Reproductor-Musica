import { z } from "zod";
import { isAllowedMediaUrl } from "./lib/allowedMedia";

function isYouTubeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
      return false;
    }
    if (url.hostname === "youtu.be") return /^\/[\w-]{11}$/.test(url.pathname);
    return (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname) &&
      url.pathname === "/watch" &&
      /^[\w-]{11}$/.test(url.searchParams.get("v") ?? "")
    );
  } catch {
    return false;
  }
}

export const playlistNameSchema = z
  .string({ required_error: "El nombre es obligatorio." })
  .trim()
  .min(1, "El nombre es obligatorio.")
  .max(80, "El nombre no puede superar los 80 caracteres.");

export const createPlaylistSchema = z.object({ name: playlistNameSchema });
export const updatePlaylistSchema = z.object({ name: playlistNameSchema });

export const songInputSchema = z
  .object({
    title: z.string().trim().min(1, "El título es obligatorio.").max(200),
    artist: z.string().trim().min(1, "El artista es obligatorio.").max(200),
    durationSeconds: z.number().finite().nonnegative(),
    source: z.enum(["local", "web"]),
    uri: z.string().trim().min(1).max(2048).optional(),
    coverUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (url) => (url.startsWith("/media/") && !url.includes("..")) || url.startsWith("https://"),
        'La portada debe ser una ruta "/media/..." o una URL https.',
      )
      .optional(),
  })
  .superRefine((song, ctx) => {
    if (song.source === "local") {
      const valid = song.uri?.startsWith("/media/") && !song.uri.includes("..");
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["uri"],
          message: 'Las canciones locales deben usar una ruta que empiece por "/media/".',
        });
      }
    } else if (!song.uri) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uri"],
        message: "Las canciones web necesitan una referencia (uri) del proveedor.",
      });
    } else if (
      /^https?:\/\//i.test(song.uri) &&
      !isAllowedMediaUrl(song.uri) &&
      !isYouTubeVideoUrl(song.uri)
    ) {
      // Audio URLs are streamed through /api/stream; YouTube URLs are handed to the player.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uri"],
        message: "La dirección del audio no está permitida.",
      });
    }
  });

/** "start", "end" or a 0-based index. */
export const positionSchema = z
  .union([z.literal("start"), z.literal("end"), z.number().int().nonnegative()])
  .default("end");

export const addSongSchema = z.object({
  song: songInputSchema,
  position: positionSchema,
});

export const moveSongSchema = z.object({
  toIndex: z.number({ required_error: "Indica la posición de destino." }).int().nonnegative(),
});

export const setCurrentSchema = z.object({
  songId: z.string().min(1, "El id de la canción es obligatorio."),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Escribe algo para buscar.").max(100),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

/** Optional extra fields of the upload form: add the new tracks straight to a playlist. */
export const uploadBodySchema = z.object({
  playlistId: z.string().min(1).optional(),
  position: z
    .union([z.literal("start"), z.literal("end"), z.coerce.number().int().nonnegative()])
    .default("end"),
});

export type NewSong = z.infer<typeof songInputSchema>;
export type SongPosition = z.infer<typeof positionSchema>;
