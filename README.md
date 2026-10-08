<div align="center">

# 🌿 Sosiego

### *Música para respirar*

Un reproductor de música web, tranquilo y hecho a mano, donde tu lista de reproducción
es una **lista doblemente enlazada** de verdad.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-Express-5FA04E?logo=nodedotjs&logoColor=white&style=flat-square)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-animaciones-8A7CF0?style=flat-square)
![Estado](https://img.shields.io/badge/estado-funcionando-8FB996?style=flat-square)

</div>

---

## 🍃 ¿De qué trata?

**Sosiego** nació como proyecto de *Estructuras de Datos*, con una pregunta simple:
**¿cómo se vería una estructura de datos "viva" dentro de una aplicación que cualquiera quisiera usar?**

La respuesta fue un reproductor de música. Cada lista de reproducción es una
**lista doblemente enlazada** que vive en el servidor: cada canción es un nodo que sabe
quién va antes y quién va después. Cuando pulsas *siguiente*, *anterior*, arrastras una
canción a otra posición o activas el modo aleatorio, lo que ves en pantalla es esa estructura
recolocando sus enlaces.

Pero también quisimos que fuera bonito y agradable. Por eso tiene una paleta suave de
salvia y arena, animaciones tranquilas y un **Modo Zen** para dejar la música sonando
mientras respiras un poco.

---

## ✨ Qué puedes hacer

| | |
|---|---|
| 🔎 **Buscar música** | Busca canciones en YouTube y agrégalas al inicio o al final de tu lista. |
| 📁 **Subir tus MP3** | Arrastra archivos a cualquier parte de la página y se agregan solos. |
| 🎶 **Varias listas** | Crea, cambia y elimina listas de reproducción. |
| ↕️ **Reordenar** | Arrastra y suelta canciones para cambiar su posición. |
| 🔀 **Smart Shuffle** | Mezcla la lista sin interrumpir la canción actual, y restaura el orden original cuando quieras. |
| ⏮️ **Anterior inteligente** | Si ya pasaron más de 3 segundos, *anterior* reinicia la canción, como en los reproductores de verdad. |
| 🌊 **Modo Zen** | Pantalla completa con ondas animadas y colores tomados de la portada. |
| ⌨️ **Teclas multimedia** | Controla la música con las teclas de tu teclado o de tus auriculares. |

---

## 🔗 La estructura de datos

Cada lista de reproducción es una lista doblemente enlazada:

```
null ⇄ [ Canción A ] ⇄ [ Canción B ] ⇄ [ Canción C ] ⇄ null
                            ▲
                     canción actual
```

Cada nodo guarda su canción y dos punteros: `prev` y `next`.
Eso hace que ciertas operaciones sean naturales:

- **Siguiente / anterior:** moverse un nodo hacia adelante o hacia atrás. Si no hay `next`,
  el servidor responde que se llegó al final y la reproducción se detiene.
- **Insertar al inicio o al final** de la lista.
- **Eliminar** una canción: se desenlaza el nodo y sus vecinos se conectan entre sí.
- **Mover** una canción: se desenlaza y se vuelve a insertar en la posición nueva.
- **Smart Shuffle:** se vuelven a enlazar los nodos en otro orden, dejando la canción actual
  en la cabeza para que el audio no se corte.

> 💡 La lista vive en el **backend**. El frontend solo pide cambios y muestra el resultado.

---

## 🧱 Cómo está construido

```
┌──────────────────────────┐        HTTP        ┌──────────────────────────┐
│   FRONTEND  ·  :3000     │  ◄──────────────►  │    BACKEND  ·  :4000     │
│                          │                    │                          │
│  React + TypeScript      │                    │  Node.js + Express       │
│  Framer Motion           │                    │  DoublyLinkedList        │
│  react-player 2.16       │                    │  yt-search (YouTube)     │
└──────────────────────────┘                    └──────────────────────────┘
```

**Frontend**
- **React + TypeScript** para la interfaz.
- **Framer Motion** para las animaciones (respeta la opción "reducir movimiento" del sistema).
- **react-player** para reproducir tanto tus MP3 como YouTube.

**Backend**
- **Node.js + Express** con la API de listas y canciones.
- **`DoublyLinkedList`** como estructura principal de cada playlist.
- **`yt-search`** para buscar en YouTube. Se añade la palabra *"lyrics"* a cada búsqueda
  para evitar en lo posible videos con la incrustación bloqueada.

---

## 🚀 Cómo ponerlo a funcionar

### Lo que necesitas

- [Node.js](https://nodejs.org/) 18 o superior
- npm

### 1. Clona el proyecto

```bash
git clone <url-del-repositorio>
cd <carpeta-del-proyecto>
```

### 2. Enciende el backend

```bash
cd backend
npm install
npm run dev
```

Debería aparecer: `API ready on http://localhost:4000`.

### 3. Enciende el frontend

En **otra terminal**:

```bash
cd frontend
npm install
npm run dev
```

### 4. Abre la aplicación

Entra a **http://localhost:3000** y agrega tu primera canción. 🎧

> ⚠️ Los dos servidores deben estar encendidos al mismo tiempo.

---

## 🧩 Si algo no suena

Estos son los tropiezos más comunes y cómo resolverlos.

**La canción está en "play" pero no avanza (0:00)**
Casi siempre es un **bloqueador de anuncios** (uBlock, AdBlock, Brave Shields...) que
bloquea el reproductor de YouTube. Desactívalo para `localhost`, o abre la app en una
**ventana de incógnito**.

**"No se pudo reproducir esta canción"**
Algunos videos tienen la incrustación desactivada por su dueño y YouTube no permite
reproducirlos fuera de su página. Prueba con otra versión de la misma canción.

**Se instaló una versión de `react-player` que no es la 2.x**
Este proyecto usa la API de la versión 2. Si aparece la 3.x, ejecuta:

```bash
npm install react-player@2.16.0
```

**El frontend no encuentra al backend**
Revisa que el backend esté corriendo en el puerto `4000` y el frontend en el `3000`.

---

## 🗂️ Estructura del proyecto

```
📦 Reproductor de Musica
 ┣ 📂 backend
 ┃ ┗ 📂 src
 ┃   ┣ 📂 providers        ← búsqueda en YouTube
 ┃   ┣ 📂 errors           ← errores HTTP
 ┃   ┗ 📜 server.ts        ← punto de entrada de la API
 ┣ 📂 frontend
 ┃ ┗ 📂 src
 ┃   ┣ 📂 components       ← reproductor, listas, búsqueda, Modo Zen...
 ┃   ┣ 📂 hooks            ← usePlayer, useMediaSession, useFileDrop...
 ┃   ┣ 📂 lib              ← API y utilidades de canciones
 ┃   ┗ 📜 App.tsx
 ┗ 📜 README.md
```

*(Los nombres de las carpetas pueden variar un poco según tu versión.)*

---

## 🎓 Sobre el proyecto

Proyecto académico de **Estructura de Datos** · IV Semestre · UCC

**Autor/es:** _[Escribe aquí tu nombre y el de tu equipo]_
**Docente:** _[Nombre del docente]_

---

<div align="center">

Hecho con paciencia, café y muchas canciones. 🌿

*Respira. Dale play.*

</div>
