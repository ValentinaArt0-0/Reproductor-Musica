# Sosiego — Frontend (Módulos 3 a 6)

React + Vite + TypeScript + Tailwind CSS v4 + Framer Motion, conectado al backend.

## Puesta en marcha (necesitas DOS terminales)

```bash
# Terminal 1: carpeta backend
npm install
npm run dev              # http://localhost:4000   (no hace falta ninguna clave)

# Terminal 2: carpeta frontend
npm install
npm run dev              # http://localhost:3000  <- abre esta en el navegador
```

## Cómo se usa

1. **Buscar música**: escribe en el buscador (mínimo 2 letras). Cada resultado es una canción de YouTube con portada y duración completa.
   Usa "+ Inicio" o "+ Final": se agrega como un nodo de la lista doblemente enlazada.
2. **Música local**: botones "MP3 al inicio / al final", o arrastra archivos a cualquier parte de la página.
3. **Controles**: Play/Pause, Siguiente, Anterior y el slider de tiempo. "Siguiente" en la última canción detiene la reproducción.
4. **Smart Shuffle** (flechas cruzadas junto a Play), **listas** (el título abre el selector: cambiar, crear, eliminar),
   **reordenar** arrastrando desde el icono de seis puntos, y **Modo Zen** (arriba a la derecha, Esc para salir).

## Reproductor: ReactPlayer

`hooks/usePlayer.ts` toma el nodo actual de la playlist (el que identifica `currentSongId`) y entrega su URL a `ReactPlayer`.
El componente está oculto y mantiene la barra de tiempo sincronizada mediante `onProgress` y `onDuration`.

| Canción | Motor | Fuente |
|---|---|---|
| MP3 local | ReactPlayer | `/media/...` |
| Canción de YouTube | ReactPlayer | Audio retransmitido por `/api/yt-stream/<videoId>.mp3` |
| Audio web legado | ReactPlayer | `/api/stream?url=...` (el backend lo retransmite) |

El slider permite avanzar y retroceder en el medio actual.

## Limitaciones conocidas

- Los colores de portada del Modo Zen dependen de poder leer la imagen de Apple desde el navegador; si no, se usa una paleta de la marca.
