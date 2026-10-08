/**
 * Checks for the audio stream proxy (/api/stream). Apple's CDN is replaced by a fake `fetch`, so
 * no internet is needed. Run with `npm run check:stream`.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { errorHandler } from "./middleware/errorHandler";
import { createStreamRouter } from "./routes/stream.routes";

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`FAILED: ${message}`);
};

const PREVIEW = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview1/v4/preview.m4a";
const REDIRECTING = "https://audio-ssl.itunes.apple.com/itunes-assets/redirect.m4a";
const EVIL_REDIRECT = "https://audio-ssl.itunes.apple.com/itunes-assets/evil-redirect.m4a";
const HTML = "https://audio-ssl.itunes.apple.com/itunes-assets/page.m4a";
const MISSING = "https://audio-ssl.itunes.apple.com/itunes-assets/missing.m4a";
const HUGE = "https://audio-ssl.itunes.apple.com/itunes-assets/huge.m4a";
const OCTET = "https://audio-ssl.itunes.apple.com/itunes-assets/octet.m4a";
const BAD_RANGE = "https://audio-ssl.itunes.apple.com/itunes-assets/range-416.m4a";

const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
const upstreamCalls: Array<{ url: string; range?: string }> = [];

const fakeApple = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  const range = (init?.headers as Record<string, string> | undefined)?.Range;
  upstreamCalls.push({ url, range });

  if (url === PREVIEW) {
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range)!;
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : bytes.length - 1;
      return new Response(bytes.subarray(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": "audio/x-m4a",
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new Response(bytes, { status: 200, headers: { "Content-Type": "audio/x-m4a", "Content-Length": String(bytes.length) } });
  }
  if (url === REDIRECTING) return new Response(null, { status: 302, headers: { Location: PREVIEW } });
  if (url === EVIL_REDIRECT) return new Response(null, { status: 302, headers: { Location: "https://evil.example.com/steal.m4a" } });
  if (url === HTML) return new Response("<html>not audio</html>", { status: 200, headers: { "Content-Type": "text/html" } });
  if (url === MISSING) return new Response("gone", { status: 404 });
  if (url === HUGE) return new Response("x", { status: 200, headers: { "Content-Type": "audio/mp4", "Content-Length": String(100 * 1024 * 1024) } });
  if (url === OCTET) return new Response(bytes.subarray(0, 10), { status: 200, headers: { "Content-Type": "application/octet-stream" } });
  if (url === BAD_RANGE) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */1000" } });
  throw new Error(`unexpected upstream fetch: ${url}`);
}) as typeof fetch;

async function main(): Promise<void> {
  const app = express();
  app.use("/api/stream", createStreamRouter(fakeApple));
  app.use(errorHandler);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = (url: string, headers?: Record<string, string>) =>
    fetch(`${base}/api/stream?url=${encodeURIComponent(url)}`, { headers });

  // ---- full file ---------------------------------------------------------------------------
  let res = await get(PREVIEW);
  let body = Buffer.from(await res.arrayBuffer());
  assert(res.status === 200 && body.equals(bytes), "streams the whole file, byte for byte");
  assert(res.headers.get("content-type") === "audio/x-m4a", "keeps the audio content type");
  assert(res.headers.get("accept-ranges") === "bytes", "advertises range support (needed for seeking)");
  assert(res.headers.get("cache-control")?.includes("max-age"), "cacheable");
  assert(res.headers.get("x-content-type-options") === "nosniff", "nosniff");
  assert(upstreamCalls.at(-1)?.range === undefined, "no Range header when the browser sent none");

  // ---- seeking: Range is forwarded and 206 comes back ----------------------------------------------
  res = await get(PREVIEW, { Range: "bytes=100-199" });
  body = Buffer.from(await res.arrayBuffer());
  assert(res.status === 206 && body.length === 100 && body.equals(bytes.subarray(100, 200)), "partial content for a Range request");
  assert(res.headers.get("content-range") === "bytes 100-199/1000", "Content-Range passed through");
  assert(upstreamCalls.at(-1)?.range === "bytes=100-199", "Range forwarded upstream");

  res = await get(PREVIEW, { Range: "bytes=500-" });
  assert(res.status === 206 && (await res.arrayBuffer()).byteLength === 500, "open-ended Range (what browsers send first/when seeking)");

  const before = upstreamCalls.length;
  res = await get(PREVIEW, { Range: "bytes=abc; evil" });
  assert(res.status === 200 && upstreamCalls.at(-1)?.range === undefined && upstreamCalls.length === before + 1, "malformed Range is not forwarded");

  res = await get(BAD_RANGE, { Range: "bytes=5000-6000" });
  assert(res.status === 416 && res.headers.get("content-range") === "bytes */1000", "416 passed through");

  // ---- redirects: followed only inside the allowlist -------------------------------------------------------
  res = await get(REDIRECTING);
  assert(res.status === 200 && (await res.arrayBuffer()).byteLength === 1000, "redirect to an allowed host is followed");
  res = await get(EVIL_REDIRECT);
  let json = (await res.json()) as { error: { code: string } };
  assert(res.status === 502 && json.error.code === "STREAM_REDIRECT_BLOCKED", "redirect to a foreign host is blocked");

  // ---- upstream problems ------------------------------------------------------------------------------------------
  res = await get(HTML);
  json = (await res.json()) as { error: { code: string } };
  assert(res.status === 415 && json.error.code === "STREAM_NOT_AUDIO", "HTML is not relayed as audio");
  res = await get(MISSING);
  json = (await res.json()) as { error: { code: string } };
  assert(res.status === 404 && json.error.code === "STREAM_NOT_FOUND", "missing file -> 404");
  res = await get(HUGE);
  json = (await res.json()) as { error: { code: string } };
  assert(res.status === 413 && json.error.code === "STREAM_TOO_LARGE", "oversized file refused");
  res = await get(OCTET);
  assert(res.status === 200 && res.headers.get("content-type") === "audio/mp4", "octet-stream from the CDN is served as audio/mp4");
  await res.arrayBuffer();

  // ---- SSRF: nothing outside the allowlist ever reaches the network ---------------------------------------------------
  const callsBefore = upstreamCalls.length;
  const blocked = [
    "https://evil.example.com/a.m4a", "http://audio-ssl.itunes.apple.com/a.m4a", "https://audio-ssl.itunes.apple.com.evil.com/a.m4a",
    "https://evilapple.com/a.m4a", "https://user:pw@audio-ssl.itunes.apple.com/a.m4a", "https://audio-ssl.itunes.apple.com:8443/a.m4a",
    "https://127.0.0.1/a.m4a", "https://localhost/a.m4a", "https://169.254.169.254/latest/meta-data", "file:///etc/passwd", "",
  ];
  for (const url of blocked) {
    res = await get(url);
    json = (await res.json()) as { error: { code: string } };
    assert(res.status === 400 && json.error.code === "STREAM_URL_NOT_ALLOWED", `blocked: "${url}"`);
  }
  res = await fetch(`${base}/api/stream`);
  assert(res.status === 400, "missing url parameter");
  assert(upstreamCalls.length === callsBefore, "no blocked request produced an upstream fetch");

  server.close();
  console.log("Stream proxy checks passed ✔");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
