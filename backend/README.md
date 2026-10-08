# Reproductor de música — Backend (Módulo 2)

API REST con Express + TypeScript sobre la lista doblemente enlazada del Módulo 1 (`src/core`).

## Puesta en marcha

```bash
npm install
cp .env.example .env     # opcional: sin .env también funciona (yt-search no requiere API key)
npm run dev              # http://localhost:4000
npm run smoke            # prueba de punta a punta (arranca la API con carpetas temporales)
```

## Endpoints

Los errores siempre tienen la forma `{ "error": { "code", "message", "details?" } }`
(`code` en inglés para el código, `message` en español para mostrar en la interfaz).

### Playlists (CRUD)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/playlists` | Lista resumida (id, nombre, nº de canciones, duración total) |
| POST | `/api/playlists` | Crea una playlist. Body: `{ "name": "Relax" }` |
| GET | `/api/playlists/:id` | Detalle con canciones en orden, canción actual y estado del shuffle |
| PATCH | `/api/playlists/:id` | Renombra. Body: `{ "name": "..." }` |
| DELETE | `/api/playlists/:id` | Elimina la playlist completa (204) |

### Canciones (operaciones sobre la lista enlazada)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/playlists/:id/songs` | Body: `{ "song": {...}, "position": "start" \| "end" \| 0..n }` (por defecto `"end"`) |
| DELETE | `/api/playlists/:id/songs/:songId` | Elimina una canción por id |
| POST | `/api/playlists/:id/songs/:songId/move` | Mueve una canción. Body: `{ "toIndex": 0..n-1 }` (posición final). Usado por el Drag & Drop |

`song` = `{ title, artist, durationSeconds, source: "local" | "web", uri, coverUrl? }`. `coverUrl` debe ser una ruta `/media/...` o una URL `https://`. El servidor asigna el `id`,
así que una misma canción puede repetirse en una playlist.

### Reproducción
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/playlists/:id/current` | Canción actual + `hasNext` / `hasPrev` |
| PUT | `/api/playlists/:id/current` | Salta a una canción. Body: `{ "songId": "..." }` |
| POST | `/api/playlists/:id/next` | Avanza. En la última canción responde `reachedEnd: true` y no se mueve |
| POST | `/api/playlists/:id/prev` | Retrocede |

### Smart Shuffle
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/playlists/:id/shuffle` | Reordena los nodos (la canción actual queda al inicio) |
| POST | `/api/playlists/:id/restore-order` | Vuelve al orden original |

### Búsqueda externa (sin clave)
`GET /api/search?q=lofi&limit=10` → `{ query, provider, results: [{ externalId, title, artist, durationSeconds, source: "web", uri, provider, thumbnailUrl? }] }`

Para agregar un resultado a una playlist, envía `title`, `artist`, `durationSeconds`, `source`, `uri` y `coverUrl` (= `thumbnailUrl`) a `POST /api/playlists/:id/songs`. Se convierte en un nodo real de la `DoublyLinkedList` (al inicio, al final o en un índice).

- `auto` (por defecto) o `youtube`: **YouTube**, mediante `yt-search` y sin API key. Los resultados incluyen la URL del video, duración completa y miniatura; las búsquedas se guardan en caché durante 10 minutos.
- `mock`: catálogo ficticio sin audio, solo para pruebas.

> Si tu `.env` tiene `SEARCH_PROVIDER=mock`, cámbialo a `auto` para buscar música real.

`GET /api/health` indica qué proveedor está activo.

La ruta `GET /api/yt-stream/:videoId.mp3` retransmite únicamente el audio del video de YouTube
identificado para que el reproductor del frontend pueda avanzar la barra de tiempo y reproducirlo
como medio de audio.

### Audio web heredado: `GET /api/stream?url=<https://...>`
El endpoint sigue retransmitiendo medios alojados en dominios `*.apple.com` y `*.mzstatic.com` para canciones guardadas con URLs previas de iTunes.
No acepta URLs de YouTube ni actúa como proxy abierto. La reproducción nueva de YouTube se delega al reproductor del frontend.

### Pruebas sin internet
`npm run check` ejecuta: `check:search` (mapeo de resultados yt-search y validación de URL), `check:stream` (el proxy, incluidos los intentos de acceder a direcciones prohibidas) y `smoke` (toda la API).

### Archivos MP3 locales
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/uploads` | `multipart/form-data`: campo `files` (hasta 20 MP3), y opcionalmente `playlistId` y `position` para agregarlos directo a una playlist |
| GET | `/api/uploads` | Biblioteca de archivos subidos |
| DELETE | `/api/uploads/:id` | Borra el archivo y lo quita de todas las playlists |
| GET | `/media/<archivo>.mp3` | Streaming del audio (soporta `Range`, necesario para el seeker) |

El servidor lee las etiquetas ID3 (título, artista, duración) con `music-metadata`, extrae la **portada incrustada** (JPEG/PNG, máx. 5 MB) a `uploads/covers/` y la sirve en `/media/covers/<id>.<ext>` (las canciones llevan el campo `coverUrl`), valida que el archivo sea un MP3 real
(no basta con la extensión), y guarda el archivo con un nombre aleatorio. Si no hay etiquetas usa el nombre del archivo y "Artista desconocido".

## Estructura

```
src/
  core/        Módulo 1: SongNode, DoublyLinkedList (+ toSnapshot/fromSnapshot para persistir)
  services/    PlaylistService, TrackLibraryService, search/ (proveedores)
  routes/      playlists, search, uploads
  middleware/  errores, multer, asyncHandler
  storage/     JsonCollection (JSON en disco; reemplazable por una base de datos)
  schemas.ts   validación con zod
```

Los datos se guardan en `data/` y los MP3 en `uploads/` (ambos ignorados por git).
