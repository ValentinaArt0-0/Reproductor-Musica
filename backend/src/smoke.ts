/**
 * End-to-end smoke test: boots the API on a random port with temporary folders and
 * exercises every endpoint. Run with `npm run smoke`.
 */
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app";
import type { AppConfig } from "./config/env";

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(`FAILED: ${message}`);
};

/** Builds a tiny valid MP3 (ID3v2.3 tag + silent MPEG-1 Layer III frames, ~2.6 s). */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function buildMp3(title: string, artist: string, withCover = false): Buffer {
  const textFrame = (id: string, text: string): Buffer => {
    const data = Buffer.concat([Buffer.from([0]), Buffer.from(text, "latin1")]);
    const header = Buffer.alloc(10);
    header.write(id, 0, "ascii");
    header.writeUInt32BE(data.length, 4);
    return Buffer.concat([header, data]);
  };
  const coverFrame = (): Buffer => {
    const data = Buffer.concat([
      Buffer.from([0]), Buffer.from("image/png\0", "latin1"), Buffer.from([3, 0]), TINY_PNG,
    ]);
    const header = Buffer.alloc(10);
    header.write("APIC", 0, "ascii");
    header.writeUInt32BE(data.length, 4);
    return Buffer.concat([header, data]);
  };
  const frames = Buffer.concat([
    textFrame("TIT2", title),
    textFrame("TPE1", artist),
    ...(withCover ? [coverFrame()] : []),
  ]);
  const tagHeader = Buffer.from([
    0x49, 0x44, 0x33, 3, 0, 0,
    (frames.length >> 21) & 0x7f, (frames.length >> 14) & 0x7f,
    (frames.length >> 7) & 0x7f, frames.length & 0x7f,
  ]);
  const frame = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(413)]);
  return Buffer.concat([tagHeader, frames, ...Array.from({ length: 100 }, () => frame)]);
}

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "player-smoke-"));
  const config: AppConfig = {
    port: 0,
    clientOrigin: "http://localhost:3000",
    searchProvider: "mock",
    uploadDir: path.join(root, "uploads"),
    dataDir: path.join(root, "data"),
    maxUploadBytes: 5 * 1024 * 1024,
  };

  const start = (): Promise<{ base: string; close: () => void }> =>
    new Promise((resolve) => {
      const server = createApp(config).listen(0, () => {
        resolve({
          base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
          close: () => server.close(),
        });
      });
    });

  let { base, close } = await start();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = async (method: string, url: string, body?: unknown, form?: FormData): Promise<{ status: number; json: any }> => {
    const response = await fetch(base + url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null };
  };
  const song = (title: string, artist = "Artista") => ({
    title, artist, durationSeconds: 100, source: "web", uri: `mock:${title}`,
  });
  const mp3Files = () => fs.readdirSync(config.uploadDir).filter((name) => name.endsWith(".mp3"));
  const titles = (playlist: { songs: Array<{ title: string }> }) => playlist.songs.map((s) => s.title).join(",");

  // --- Playlist CRUD ---
  let res = await api("POST", "/api/playlists", { name: "  Relax  " });
  assert(res.status === 201 && res.json.playlist.name === "Relax", "create playlist trims the name");
  const id: string = res.json.playlist.id;
  assert((await api("POST", "/api/playlists", { name: "" })).status === 400, "empty name rejected");
  assert((await api("PATCH", `/api/playlists/${id}`, { name: "Zen" })).json.playlist.name === "Zen", "rename");
  assert((await api("GET", "/api/playlists")).json.playlists.length === 1, "list playlists");
  assert((await api("GET", "/api/playlists/nope")).status === 404, "unknown playlist is 404");

  // --- Songs: start / end / index ---
  await api("POST", `/api/playlists/${id}/songs`, { song: song("B") });
  await api("POST", `/api/playlists/${id}/songs`, { song: song("D"), position: "end" });
  await api("POST", `/api/playlists/${id}/songs`, { song: song("A"), position: "start" });
  res = await api("POST", `/api/playlists/${id}/songs`, { song: song("C"), position: 2 });
  assert(titles(res.json.playlist) === "A,B,C,D", `insert order (got ${titles(res.json.playlist)})`);
  res = await api("POST", `/api/playlists/${id}/songs`, { song: song("X"), position: 99 });
  assert(res.status === 400 && res.json.error.code === "INVALID_POSITION", "out of range index rejected");
  res = await api("POST", `/api/playlists/${id}/songs`, { song: { ...song("L"), source: "local", uri: "https://evil" } });
  assert(res.status === 400, "local songs require a /media/ uri");

  // --- Navigation ---
  res = await api("GET", `/api/playlists/${id}/current`);
  assert(res.json.currentSong.title === "B" && res.json.hasPrev, "adding at start does not move the current song");
  const firstId = (await api("GET", `/api/playlists/${id}`)).json.playlist.songs[0].id;
  res = await api("PUT", `/api/playlists/${id}/current`, { songId: firstId });
  assert(res.json.currentSong.title === "A" && !res.json.hasPrev, "select first song");
  await api("POST", `/api/playlists/${id}/next`);
  res = await api("POST", `/api/playlists/${id}/prev`);
  assert(res.json.currentSong.title === "A", "prev goes back");
  for (let i = 0; i < 3; i++) await api("POST", `/api/playlists/${id}/next`);
  res = await api("POST", `/api/playlists/${id}/next`);
  assert(res.json.reachedEnd === true && res.json.currentSong.title === "D", "stops at the end");
  res = await api("PUT", `/api/playlists/${id}/current`, { songId: firstId });
  assert(res.json.currentSong.title === "A", "select current song");

  // --- Shuffle / restore ---
  res = await api("POST", `/api/playlists/${id}/shuffle`);
  assert(res.json.playlist.isShuffled && res.json.playlist.songs[0].title === "A", "shuffle pins current song");
  res = await api("POST", `/api/playlists/${id}/restore-order`);
  assert(!res.json.playlist.isShuffled && titles(res.json.playlist) === "A,B,C,D", "restore order");

  // --- Remove song ---
  const bId = res.json.playlist.songs[1].id;
  res = await api("DELETE", `/api/playlists/${id}/songs/${bId}`);
  assert(titles(res.json.playlist) === "A,C,D", "remove song");
  assert((await api("DELETE", `/api/playlists/${id}/songs/${bId}`)).status === 404, "remove twice is 404");

  // --- Move (drag & drop) ---
  const currentBefore = (await api("GET", `/api/playlists/${id}`)).json.playlist.currentSongId;
  const aId = (await api("GET", `/api/playlists/${id}`)).json.playlist.songs[0].id;
  res = await api("POST", `/api/playlists/${id}/songs/${aId}/move`, { toIndex: 2 });
  assert(titles(res.json.playlist) === "C,D,A", `move to index 2 (got ${titles(res.json.playlist)})`);
  assert(res.json.playlist.currentSongId === currentBefore, "current song is unchanged by a move");
  res = await api("POST", `/api/playlists/${id}/songs/${aId}/move`, { toIndex: 0 });
  assert(titles(res.json.playlist) === "A,C,D", "move back to the start");
  res = await api("POST", `/api/playlists/${id}/songs/${aId}/move`, { toIndex: 1 });
  assert(titles(res.json.playlist) === "C,A,D", "move to the middle");
  await api("POST", `/api/playlists/${id}/songs/${aId}/move`, { toIndex: 0 });
  assert((await api("POST", `/api/playlists/${id}/songs/${aId}/move`, { toIndex: 3 })).status === 400, "move out of range rejected");
  assert((await api("POST", `/api/playlists/${id}/songs/nope/move`, { toIndex: 0 })).status === 404, "move unknown song is 404");
  assert((await api("POST", `/api/playlists/${id}/songs/${aId}/move`, {})).status === 400, "move without index rejected");

  // --- Search ---
  res = await api("GET", "/api/search?q=brisa");
  assert(res.json.results.length === 2 && res.json.provider === "mock", "mock search (accent/case insensitive)");
  assert((await api("GET", "/api/search?q=")).status === 400, "empty search rejected");

  // --- Upload ---
  let form = new FormData();
  form.append("playlistId", id);
  form.append("position", "start");
  form.append("files", new Blob([buildMp3("Canción Uno", "Niño Pez", true)], { type: "audio/mpeg" }), "uno.mp3");
  form.append("files", new Blob([buildMp3("Dos", "Dúo")], { type: "audio/mpeg" }), "dos.mp3");
  form.append("files", new Blob(["not audio at all"], { type: "audio/mpeg" }), "fake.mp3");
  res = await api("POST", "/api/uploads", undefined, form);
  assert(res.status === 201 && res.json.tracks.length === 2 && res.json.rejected.length === 1, "upload accepts valid, rejects fake");
  const [t1] = res.json.tracks;
  assert(t1.title === "Canción Uno" && t1.artist === "Niño Pez", "ID3 tags (with accents) read");
  assert(t1.durationSeconds > 2 && t1.durationSeconds < 3.2, `duration read (got ${t1.durationSeconds})`);
  assert(titles(res.json.playlist).startsWith("Canción Uno,Dos,A"), `uploaded songs placed at start in order (got ${titles(res.json.playlist)})`);
  assert(mp3Files().length === 2, "rejected file removed from disk");

  form = new FormData();
  form.append("files", new Blob(["x"], { type: "text/plain" }), "notes.txt");
  assert((await api("POST", "/api/uploads", undefined, form)).status === 415, "non-mp3 rejected");
  form = new FormData();
  form.append("playlistId", "missing");
  form.append("files", new Blob([buildMp3("Z", "Z")], { type: "audio/mpeg" }), "z.mp3");
  assert((await api("POST", "/api/uploads", undefined, form)).status === 404, "unknown playlist rejected");
  assert(mp3Files().length === 2, "files discarded when playlist missing");
  assert((await api("POST", "/api/uploads")).status === 400, "no files rejected");

  // --- Album art ---
  assert(/^\/media\/covers\/.+\.png$/.test(t1.coverUri), `cover extracted from ID3 (got ${t1.coverUri})`);
  assert(res.json.tracks[1].coverUri === undefined, "no cover when the file has none");
  const coverRes = await fetch(base + t1.coverUri);
  assert(coverRes.status === 200 && coverRes.headers.get("content-type") === "image/png", "cover served as image/png");
  assert(res.json.playlist.songs.find((song: { title: string }) => song.title === "Canción Uno").coverUrl === t1.coverUri, "song carries coverUrl");
  res = await api("POST", `/api/playlists/${id}/songs`, { song: { ...song("Cov"), coverUrl: "javascript:alert(1)" } });
  assert(res.status === 400, "unsafe coverUrl rejected");
  res = await api("POST", `/api/playlists/${id}/songs`, { song: { ...song("Cov"), coverUrl: "https://i.ytimg.com/vi/x/mqdefault.jpg" } });
  assert(res.status === 201 && res.json.song.coverUrl.startsWith("https://"), "https coverUrl accepted");
  await api("DELETE", `/api/playlists/${id}/songs/${res.json.song.id}`);

  // --- Web songs: an iTunes-style preview becomes a real node; other hosts are refused ---
  const preview = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview1/v4/ab/cd/preview.m4a";
  res = await api("POST", `/api/playlists/${id}/songs`, {
    song: { title: "Preview", artist: "Artista", durationSeconds: 30, source: "web", uri: preview, coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/x/300x300bb.jpg" },
    position: 1,
  });
  assert(res.status === 201 && res.json.song.uri === preview, "iTunes preview URL accepted as a song");
  assert(res.json.playlist.songs[1].title === "Preview", "web song inserted at index 1 of the linked list");
  const previewId = res.json.song.id;
  for (const bad of ["https://evil.example.com/a.m4a", "http://audio-ssl.itunes.apple.com/a.m4a", "https://apple.com.evil.com/a.m4a"]) {
    res = await api("POST", `/api/playlists/${id}/songs`, { song: { title: "Bad", artist: "x", durationSeconds: 1, source: "web", uri: bad } });
    assert(res.status === 400, `audio URL refused: ${bad}`);
  }
  await api("DELETE", `/api/playlists/${id}/songs/${previewId}`);

  // --- Streaming with Range (seeker) ---
  const media = await fetch(base + t1.uri, { headers: { Range: "bytes=0-99" } });
  assert(media.status === 206 && media.headers.get("content-type") === "audio/mpeg", "range request served");
  assert(media.headers.get("accept-ranges") === "bytes", "accept-ranges header");

  // --- Persistence across restarts ---
  close();
  ({ base, close } = await start());
  res = await api("GET", `/api/playlists/${id}`);
  assert(titles(res.json.playlist) === "Canción Uno,Dos,A,C,D", `playlist survived restart (got ${titles(res.json.playlist)})`);
  assert((await api("GET", "/api/uploads")).json.tracks.length === 2, "library survived restart");

  // --- Delete library file cascades to playlists ---
  assert((await api("DELETE", `/api/uploads/${t1.id}`)).status === 204, "delete track");
  res = await api("GET", `/api/playlists/${id}`);
  assert(titles(res.json.playlist) === "Dos,A,C,D", "track removed from playlists");
  assert(mp3Files().length === 1, "file removed from disk");
  assert(fs.readdirSync(path.join(config.uploadDir, "covers")).length === 0, "cover removed from disk");

  // --- Delete playlist ---
  assert((await api("DELETE", `/api/playlists/${id}`)).status === 204, "delete playlist");
  assert((await api("GET", `/api/playlists/${id}`)).status === 404, "playlist gone");

  close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log("All API checks passed ✔");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
