import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { HttpError } from "../errors/HttpError";
import { isAllowedMediaUrl } from "../lib/allowedMedia";
import { asyncHandler } from "../middleware/asyncHandler";

const MAX_REDIRECTS = 3;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_BYTES = 25 * 1024 * 1024; // previews are ~1 MB; this only guards against abuse
const RANGE_PATTERN = /^bytes=\d*-\d*$/;

/** Follows redirects by hand so that EVERY hop is checked against the allowlist. */
async function fetchUpstream(
  fetchFn: typeof fetch,
  url: string,
  range: string | undefined,
  signal: AbortSignal,
): Promise<Response> {
  let target = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchFn(target, {
      headers: { Accept: "audio/*,*/*;q=0.5", ...(range ? { Range: range } : {}) },
      redirect: "manual",
      signal,
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, target).toString();
      if (!isAllowedMediaUrl(next)) {
        throw new HttpError(502, "STREAM_REDIRECT_BLOCKED", "El audio redirige a una dirección no permitida.");
      }
      await response.body?.cancel();
      target = next;
      continue;
    }
    return response;
  }
  throw new HttpError(502, "STREAM_TOO_MANY_REDIRECTS", "El audio redirige demasiadas veces.");
}

/**
 * GET /api/stream?url=<https preview URL>
 *
 * Streams a remote audio file (iTunes previews) through the backend. Why: the browser then sees
 * a same-origin file, so playback never depends on the CDN's CORS headers, the Zen mode analyser
 * can read it, and seeking works because HTTP Range requests are forwarded.
 * Only https URLs on the allowlist are served (see lib/allowedMedia.ts).
 */
export function createStreamRouter(fetchFn: typeof fetch = fetch): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
      if (!isAllowedMediaUrl(rawUrl)) {
        throw new HttpError(400, "STREAM_URL_NOT_ALLOWED", "La dirección del audio no está permitida.");
      }

      const rangeHeader = req.headers.range;
      const range = rangeHeader && RANGE_PATTERN.test(rangeHeader) ? rangeHeader : undefined;

      // Stop the upstream download as soon as the browser goes away (skips, seeks, closes the tab).
      const controller = new AbortController();
      res.on("close", () => controller.abort());
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

      let upstream: Response;
      try {
        upstream = await fetchUpstream(fetchFn, rawUrl, range, controller.signal);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(502, "STREAM_UNAVAILABLE", "No se pudo obtener el audio. Inténtalo de nuevo.");
      } finally {
        clearTimeout(timer);
      }

      if (upstream.status === 404 || upstream.status === 410) {
        throw new HttpError(404, "STREAM_NOT_FOUND", "El audio ya no está disponible.");
      }
      if (upstream.status === 416) {
        res.status(416);
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) res.setHeader("Content-Range", contentRange);
        res.end();
        return;
      }
      if (!upstream.ok) {
        throw new HttpError(502, "STREAM_UPSTREAM_ERROR", "El servidor de audio devolvió un error.");
      }

      const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const looksLikeAudio =
        contentType === "" ||
        contentType.startsWith("audio/") ||
        contentType === "video/mp4" ||
        contentType === "application/octet-stream";
      if (!looksLikeAudio) {
        throw new HttpError(415, "STREAM_NOT_AUDIO", "El recurso solicitado no es audio.");
      }
      const length = Number(upstream.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES) {
        throw new HttpError(413, "STREAM_TOO_LARGE", "El archivo de audio es demasiado grande.");
      }

      res.status(upstream.status === 206 ? 206 : 200);
      res.setHeader("Content-Type", contentType.startsWith("audio/") ? contentType : "audio/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400"); // previews never change
      const contentLength = upstream.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);
      const contentRange = upstream.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);

      if (!upstream.body) {
        res.end();
        return;
      }
      try {
        await pipeline(Readable.fromWeb(upstream.body as unknown as WebReadableStream), res);
      } catch {
        // The browser left or the upstream died mid-stream: headers are already sent, just close.
        res.destroy();
      }
    }),
  );

  return router;
}
