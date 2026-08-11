# Deluxe Saloon Architecture and Learning Guide

## 1. PROJECT OVERVIEW

### What this application does
This project is a synced, always-on Hindi radio web app. It can run in two modes:
- **YouTube streaming mode** (`USE_YOUTUBE_STREAM=true`): streams audio from a YouTube playlist using `yt-dlp` and a Node.js proxy.
- **Local audio mode** (`USE_YOUTUBE_STREAM=false`): serves local `.opus`/`.mp3` files and uses a local song/rotation catalog.

The app shows:
- current rotation metadata (scene image, display name)
- currently playing track
- listener count
- play/pause controls
- next/previous controls in YouTube mode
- YouTube playlist selection when enabled

### Major features
- live synced playback using wall-clock rotation logic
- YouTube playlist metadata extraction via `yt-dlp`
- streaming YouTube audio through Express
- a React frontend built with Vite
- environment-driven mode switching
- local static audio support
- a lightweight scene/rotation system loaded from JSON
- a Socket.io server for real-time events (listener count, rotation changes)

### Frontend
- file: `client/src/App.jsx`
- built with React and Vite
- loads at `client/src/main.jsx`
- uses browser `fetch()` to call backend REST APIs
- contains the full UI in one component
- manages audio playback with an `<audio>` element and React state

### Backend
- file: `server/index.js`
- Node.js + Express server
- reads `server/data/songs.json` and `server/data/rotations.json`
- supports HTTP routes for playlist metadata, now-playing info, static audio, and YouTube streaming
- uses `dotenv` to configure mode and playlist URL

### Real-time communication
- uses `socket.io` in `server/index.js`
- server emits `listener_count` and `rotation_changed`
- the current frontend does not import or use Socket.io directly, but the server is prepared for real-time events

### YouTube streaming
- `server/index.js` uses `yt-dlp` via `child_process.spawn`
- `loadYoutubePlaylist()` uses `yt-dlp --dump-single-json` to load playlist metadata
- `/stream/youtube/:videoId` proxies audio streamed from YouTube into the browser

### Audio player
- React manages an `audioRef` to an HTML `<audio>` element
- toggles play/pause
- updates the `src` to either local `/audio/:filename` or `/stream/youtube/:videoId`
- resets playback position when switching tracks

### Scene/rotation system
- `server/data/rotations.json` defines broadcast rotations by IST time ranges
- each rotation has `sceneImage`, `startHourIST`, `endHourIST`, and a list of song IDs
- `server/index.js` computes the active rotation with `getCurrentRotation()`
- `server/index.js` uses `getRotationEpoch()` to sync playback position

### Responsibility boundaries
- `client/src/App.jsx`: UI, playback controls, data fetching, YouTube selection
- `server/index.js`: API, playlist loading, live timing, stream proxy, routes, Socket.io
- `server/data/`: static playlists and rotations
- `.env` / `.env.local`: runtime configuration

#### Architecture diagram

React
↓
HTTP API
↓
Express / Node.js
↓
yt-dlp
↓
YouTube

React
↕
Socket.io
↕
Node.js

---

## 2. IS THIS ACTUALLY MERN?

The short answer: **No, this project is not currently a full MERN application.**

### M — MongoDB
- **Used?** No
- **Exact files:** none
- **What it does here:** not implemented
- **What data it handles:** no MongoDB data
- **Why it would be useful:** user playlists, history, metadata persistence

### E — Express.js
- **Used?** Yes
- **Exact files:** `server/index.js`
- **What it does here:** defines all HTTP routes, static file serving, and middleware
- **What data it handles:** local song JSON, rotation JSON, YouTube playlist metadata
- **Why useful:** provides the backend API the React app consumes

### R — React
- **Used?** Yes
- **Exact files:** `client/src/App.jsx`, `client/src/main.jsx`
- **What it does here:** renders UI, manages player state, fetches backend data
- **What data it handles:** current rotation, now-playing info, playlist, selected track, playback status
- **Why useful:** provides the interactive frontend experience

### N — Node.js
- **Used?** Yes
- **Exact files:** `server/index.js`
- **What it does here:** runtime for Express, child processes, file I/O, server startup
- **What data it handles:** JSON data, environment config, yt-dlp output
- **Why useful:** executes backend logic and streams audio

### Actual stack
Since MongoDB is not present, the real stack is:
- React
- Vite
- Node.js
- Express
- Socket.io
- yt-dlp
- music-metadata
- dotenv
- CORS

This is a **React + Node/Express + streaming** application, not a full MERN app.

---

## 3. TECHNOLOGY STACK TABLE

| Technology | Used? | Where? | Purpose |
|---|---|---|---|
| React | Yes | `client/src/App.jsx`, `client/src/main.jsx` | UI rendering and state management |
| Vite | Yes | `client/package.json` | frontend build/dev tooling |
| Node.js | Yes | `server/index.js` | backend runtime |
| Express | Yes | `server/index.js` | HTTP API, routes, static assets |
| MongoDB | No | N/A | not used |
| Socket.io | Yes | `server/index.js` | real-time event engine |
| yt-dlp | Yes | `server/index.js` | load YouTube playlist metadata and proxy audio stream |
| music-metadata | Yes | `server/index.js` | optionally reads local audio duration for songs |
| dotenv | Yes | `server/index.js`, `server/.env`, `client/.env.local` | runtime configuration |
| CORS | Yes | `server/index.js` | enables frontend to call backend APIs from the browser |
| Fetch/API layer | Yes | `client/src/App.jsx` | calls `/api/now-playing`, `/api/youtube-playlist` |
| CSS/styling | Yes | `client/src/index.css` | global styles for the app |
| Routing library | No | N/A | single-page app is one component only |
| State management library | No | N/A | React `useState`/`useEffect` only |

---

## 4. FRONTEND IMPLEMENTATION

### Entry point
- `client/src/main.jsx`
- mounts React into the DOM element with `id="root"`
- renders `<App />` inside `React.StrictMode`

### Component structure
- The frontend is currently a single main component: `client/src/App.jsx`
- There are no additional React pages, routes, or subcomponents in `src/components`
- The app is a single-page UI that combines status, controls, playlist list, and scene image

### State and hooks
- `useState` stores:
  - `rotation`: current rotation metadata
  - `song`: current song metadata
  - `offset`: current audio offset
  - `listenerCount`: broadcast listener count
  - `status`: status text
  - `isPlaying`: play/pause state
  - `youtubePlaylist`: loaded YouTube playlist data
  - `youtubeEntry`: selected YouTube track
  - `selectedYoutubeIndex`: selected index in the playlist
  - `manualYoutubeSelection`: whether user selected a track manually
- `useRef` stores `audioRef`, the HTML audio element
- `useEffect` runs once on mount to fetch live data and playlist data
- `useMemo` builds `sceneImage` URL from rotation data

### API calls
- `fetchNowPlaying()` calls `GET ${BACKEND_URL}/api/now-playing`
- `fetchYoutubePlaylist()` calls `GET ${BACKEND_URL}/api/youtube-playlist`
- `BACKEND_URL` defaults to `http://localhost:4000`
- `USE_YOUTUBE_STREAM` is driven by `client/.env.local`

### Audio element and controls
- an `<audio>` element is rendered with `ref={audioRef}`
- `togglePlay()` starts or pauses playback
- the app sets `audio.src` to either:
  - local route: `${BACKEND_URL}/audio/${data.song.filename}`
  - YouTube stream route: `${BACKEND_URL}/stream/youtube/${youtubeEntry.id}`
- the app updates `audio.currentTime` when fresh now-playing data arrives unless a manual YouTube selection is active

### YouTube playlist state
- `fetchYoutubePlaylist()` loads the playlist and stores it in `youtubePlaylist`
- if the playlist is valid, it selects index `0` by default
- `selectYoutubeByIndex(index)` updates selected track and starts playback
- `handlePlaylistClick(videoId)` finds a track by `videoId` and selects it
- playlist buttons are rendered in the UI when `USE_YOUTUBE_STREAM` is true

### Play/pause and skipping
- `togglePlay()` toggles playback on the audio element
- `handlePrevious()` and `handleNext()` adjust `selectedYoutubeIndex`
- previous/next are only enabled in YouTube mode

### Seeking
- The app sets `audio.currentTime` based on `data.offset` from the backend
- seeking is not implemented as a direct user drag control; the app only syncs to the backend offset

### Error handling
- `fetchYoutubePlaylist()` updates `status` on failure and logs errors to console
- `fetchNowPlaying()` catches fetch failures and shows a warning status
- `selectYoutubeByIndex()` catches playback errors from `audio.play()` and updates state
- the app uses simple status text to explain load state

### Socket.io interaction
- the current frontend does not connect to Socket.io
- `server/index.js` provides Socket.io support, but the present `App.jsx` only uses standard HTTP fetches
- this means real-time subscription exists on the server but is not consumed by the frontend yet

### Theme/UI state
- no theme toggling or advanced UI state is present
- the UI is data-driven by backend responses and local YouTube mode config

### Component responsibilities
- `client/src/App.jsx`: owns all UI, player state, backend integration, playlist selection
- `client/src/main.jsx`: bootstraps React
- `client/src/index.css`: provides app styling

---

## 5. BACKEND IMPLEMENTATION

### Server startup
- `server/index.js` is the backend entry point
- it imports `dotenv/config` to load `server/.env`
- it reads `server/data/songs.json` and `server/data/rotations.json` at startup
- `const USE_YOUTUBE_STREAM = process.env.USE_YOUTUBE_STREAM === 'true'`
- `startServer()` conditionally runs `enrichSongDurations()` only when YouTube mode is disabled
- if YouTube is enabled, local `.opus` duration scanning is skipped
- the server attempts to load the YouTube playlist during startup if enabled

### Express application
- the Express app is created with `const app = express()`
- middleware:
  - `app.use(cors())`
  - `app.use(express.json())`
- `app.get('/', ...)` returns a simple backend status JSON
- static scene images are served from `/scenes` using `express.static`

### HTTP server and Socket.io
- HTTP server: `const httpServer = createServer(app)`
- Socket.io server: `const io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET'] } })`
- Socket.io connection lifecycle increments/decrements `listenerCount`
- the backend emits `listener_count` whenever connections change

### Routes and endpoints

| Method | Endpoint | Purpose | Request | Response | Used by |
|---|---|---|---|---|---|
| GET | `/` | Backend status and API pointers | none | status JSON | developer/debugging |
| GET | `/audio/:filename` | serve local audio file | filename param | audio file stream | local mode playback |
| GET | `/api/youtube-playlist` | fetch YouTube playlist metadata | optional `refresh=true` | playlist JSON | frontend playlist load |
| POST | `/api/youtube/select/:videoId` | select a specific YouTube track | `videoId` param | selected song metadata | frontend manual selection (planned) |
| POST | `/api/youtube/next` | move to next YouTube track | none | selected song metadata | frontend next button |
| POST | `/api/youtube/previous` | move to previous YouTube track | none | selected song metadata | frontend prev button |
| GET | `/stream/youtube/:videoId` | proxy YouTube audio | `videoId` param | audio stream | frontend audio playback |
| GET | `/api/now-playing` | current rotation/song state | none | now-playing JSON | frontend periodic poll |
| GET | `/api/songs` | list songs or YouTube playlist entries | none | songs JSON | optional frontend use |
| GET | `/api/songs/:id` | single song entry by id | `id` param | song JSON | optional frontend use |
| GET | `/api/health` | health status + listener count | none | status JSON | monitoring |

### Static file handling
- `app.use('/scenes', express.static(path.join(__dirname, 'public/scenes')))` serves scene images
- `/audio/:filename` resolves local file paths from:
  - `server/public/audio` if present
  - `OPUS_SOURCE_DIR` environment path
  - `.mp3` to `.opus` fallback

### Environment variables
- `server/.env` contains:
  - `USE_YOUTUBE_STREAM=true`
  - `YOUTUBE_PLAYLIST_URL=<playlist URL>`
- `client/.env.local` controls frontend mode:
  - `VITE_USE_YOUTUBE_STREAM=true`
- `server/index.js` uses `process.env.USE_YOUTUBE_STREAM` and `YOUTUBE_PLAYLIST_URL`
- `client/src/App.jsx` uses `import.meta.env.VITE_USE_YOUTUBE_STREAM`

### YouTube playlist loading
- `loadYoutubePlaylist()` calls `yt-dlp --dump-single-json --no-warnings <playlist URL>`
- it parses JSON output and builds entries via `buildYoutubeEntry(entry)`
- only valid entries are kept:
  - entry has `id`
  - `!entry.is_live`
  - `duration` is a positive number
- it sets:
  - `youtubePlaylist = validEntries`
  - `youtubeCurrentIndex = 0`
  - `youtubeEntryMap` for fast lookup
- cached playlist metadata is reused for 5 minutes by `getCachedYoutubePlaylist()`

### yt-dlp process handling
- metadata extraction: `execFileSync('yt-dlp', ['--dump-single-json', '--no-warnings', YOUTUBE_PLAYLIST_URL])`
- stream proxy: `spawn('yt-dlp', ['-f', 'bestaudio[ext=webm]/bestaudio', '-o', '-', '--no-playlist', videoUrl])`
- audio is piped from `ytdlp.stdout` directly to the Express response
- in case of `req`/`res` close, the child process is killed with `SIGKILL`
- the server does not permanently download files

### Local audio route
- `GET /audio/:filename` resolves local files and sends the file with audio MIME type
- this route is only used in local mode or fallback when `USE_YOUTUBE_STREAM=false`

### Now-playing endpoint
- `GET /api/now-playing` computes the current rotation and current song
- in YouTube mode it returns:
  - `mode: 'youtube'`
  - `index` and `id`
  - `title`, `duration`, `thumbnail`, `streamUrl`
- in local mode it returns the local song object from `songs.json`
- it also returns `rotation` and `rotationEndsAt`

### Song catalogue endpoint
- `GET /api/songs` returns either:
  - YouTube playlist entries when YouTube mode is enabled
  - local `songs.json` when disabled
- `GET /api/songs/:id` returns a single song or playlist entry by id

### Scene endpoints
- there are no dedicated scene API endpoints
- rotation metadata is embedded inside `/api/now-playing`
- scene images are served statically from `/scenes`

---

## 6. YT-DLP IMPLEMENTATION

### Why yt-dlp is used
`yt-dlp` is used because the browser cannot directly play YouTube Music playlist audio without YouTube's restrictions. The backend uses `yt-dlp` to resolve the actual audio stream and proxy it to the browser.

### How the playlist URL is passed
- `YOUTUBE_PLAYLIST_URL` is loaded from `server/.env`
- `loadYoutubePlaylist()` runs:
  - `yt-dlp --dump-single-json --no-warnings ${YOUTUBE_PLAYLIST_URL}`
- this produces JSON metadata for the playlist and its entries

### How metadata is extracted
- `execFileSync` captures the yt-dlp JSON output directly
- `JSON.parse(rawJson)` turns it into an object
- `playlistData.entries` contains the track list
- `buildYoutubeEntry(entry)` extracts:
  - `id`
  - `title`
  - `artist` (from `entry.uploader`)
  - `duration`
  - `thumbnail`
  - `streamUrl`

### How video IDs are obtained
- each playlist entry includes `entry.id`
- YouTube video IDs are validated with `isYoutubeVideoId(id)`
- the frontend uses these IDs to select tracks and build stream URLs

### How audio streams are resolved
- `/stream/youtube/:videoId` constructs the YouTube watch URL
- it spawns `yt-dlp` with `-f bestaudio[ext=webm]/bestaudio -o - --no-playlist <videoUrl>`
- the stdout of yt-dlp becomes the HTTP response body
- the browser receives `Content-Type: audio/webm`

### Node server proxy behavior
- this route does not send a redirect; it streams audio bytes through Node
- the browser requests the proxy URL, and Node forwards the stream from yt-dlp
- if the client closes the connection, cleanup kills the child process

### File download behavior
- no permanent files are downloaded to disk by the current implementation
- yt-dlp writes to stdout only

### Child process creation
- `execFileSync` is used for synchronous playlist metadata loading
- `spawn` is used for live audio proxying
- child processes are killed using `SIGKILL` when the client disconnects

### Limitations
- no HTTP range request support is implemented
- no seeking inside the YouTube stream beyond resetting playback time in the browser
- stream URL depends on the active playlist metadata cache and server-managed `youtubeEntryMap`

### Full flow example
1. user clicks a YouTube playlist item in React
2. React sets `audio.src = ${BACKEND_URL}/stream/youtube/${selected.id}`
3. browser requests `/stream/youtube/:videoId`
4. Express validates the `videoId`
5. Node starts `yt-dlp` for that video URL
6. `yt-dlp` resolves a best-audio stream and writes bytes to stdout
7. Express pipes `stdout` to the browser response
8. browser plays the audio in the `<audio>` element

---

## 7. SOCKET.IO IMPLEMENTATION

### Why Socket.io is used
Socket.io is added to support real-time listener count and rotation change events.
It is useful when the UI should update instantly without polling.

### Server-side setup
- `const io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET'] } });`
- on connection:
  - increments `listenerCount`
  - emits `listener_count`
- on disconnect:
  - decrements `listenerCount`
  - emits `listener_count`

### Events in the code
- `listener_count` — emitted on connection and disconnect
- `rotation_changed` — emitted when the backend detects a rotation change or when a YouTube track selection changes

### Rotation change flow
- a `setInterval` every 10 seconds calls `getCurrentRotation()`
- if the rotation id changes, the server emits `rotation_changed`
- `/api/youtube/select/:videoId`, `/api/youtube/next`, `/api/youtube/previous` also call `emitRotationChanged(entry)`

### Frontend consumption
- currently the frontend does not import `socket.io-client`
- `client/src/App.jsx` performs polling only with `fetch()`
- this means Socket.io is prepared on the backend but not actively consumed by the UI in this codebase

### YouTube mode vs local mode
- the Socket.io server exists in both modes
- in YouTube mode it can emit `rotation_changed` with YouTube entries
- in local mode it would still emit rotation changes, but the frontend does not subscribe

### Synchronization
- the backend computes timing deterministically from wall-clock time and rotation epochs
- the frontend polls `/api/now-playing` every 30 seconds
- Socket.io is a future-ready realtime layer, but not yet integrated in the current client code

---

## 8. YOUTUBE MODE VS LOCAL MODE

| Feature | YouTube Mode | Local Mode |
|---|---|---|
| source of songs | YouTube playlist via `yt-dlp` | local `server/data/songs.json` + local audio files |
| song IDs | YouTube video IDs | local IDs like `song-001` |
| playlist state | `youtubePlaylist`, `youtubeCurrentIndex` in memory | `rotation.songIds` from `rotations.json` |
| audio URL | `/stream/youtube/:videoId` | `/audio/:filename` |
| now-playing | returns `mode: 'youtube'` and YouTube entry | returns local song object |
| metadata | YouTube metadata from `yt-dlp` | static JSON metadata and `music-metadata` durations |
| local files | not needed | required for audio playback and duration scanning |
| Socket.io behavior | server emits same events, but frontend not yet subscribed | same server-side behavior |
| fallback behavior | no fallback to local songs in current backend | uses local `songs.json` and file lookup |

### Why the separation exists
- YouTube mode depends on an external playlist and streaming proxy
- local mode depends on on-disk audio assets and built-in song metadata
- the app uses `USE_YOUTUBE_STREAM` as a runtime switch to avoid mixing sources
- local duration scanning is intentionally skipped when YouTube streaming is enabled

---

## 9. DATA FLOW

### A. Application startup
1. React loads `client/src/main.jsx`
2. `<App />` mounts
3. `useEffect` calls `fetchNowPlaying()` and `fetchYoutubePlaylist()` if enabled
4. backend `server/index.js` starts Express + Socket.io
5. if `USE_YOUTUBE_STREAM`, backend loads YouTube playlist from `yt-dlp`
6. frontend shows data once APIs respond

### B. Loading YouTube playlist
1. frontend calls `/api/youtube-playlist`
2. backend runs `getCachedYoutubePlaylist()`
3. if stale, backend calls `loadYoutubePlaylist()`
4. `yt-dlp --dump-single-json` returns playlist metadata
5. backend validates entries and returns JSON
6. frontend stores `youtubePlaylist`

### C. Playing a song
1. frontend selects a track or receives now-playing data
2. `audio.src` is set to `/stream/youtube/:videoId` or `/audio/:filename`
3. browser requests audio stream
4. backend proxies or serves audio bytes
5. browser audio element plays the data

### D. Next song
1. user clicks `Next`
2. `handleNext()` increments `selectedYoutubeIndex`
3. `selectYoutubeByIndex()` sets the new entry and updates `audio.src`
4. backend will stream the new video

### E. Previous song
1. user clicks `Previous`
2. `handlePrevious()` decrements `selectedYoutubeIndex`
3. `selectYoutubeByIndex()` updates the selected entry
4. playback starts from the new track

### F. Manual song selection
1. user clicks a playlist button in React
2. `handlePlaylistClick(videoId)` finds the index and calls `selectYoutubeByIndex()`
3. audio source changes to the selected YouTube stream
4. `manualYoutubeSelection` prevents automatic offset overrides

### G. Socket.io rotation
1. backend `io.on('connection')` increments listeners
2. backend emits `listener_count`
3. every 10 seconds, rotation id is checked
4. if rotation changed, backend emits `rotation_changed`
5. frontend is not currently wired to listen, so this remains a server-side capability

### H. Now-playing request
1. frontend polls `/api/now-playing`
2. backend computes current rotation with `getCurrentRotation()`
3. backend computes song/offset with `getCurrentSongAndOffset()`
4. response is returned to frontend
5. frontend updates UI and may update audio `src`

---

## 10. API LEARNING GUIDE

### `GET /api/now-playing`
- **What it does:** returns the current broadcast rotation and currently playing song
- **Why it exists:** frontend needs sync information and current track metadata
- **Who calls it:** `client/src/App.jsx` via `fetchNowPlaying()`
- **Example response (YouTube mode):**
```json
{
  "mode": "youtube",
  "index": 0,
  "id": "lIp-yNyghDI",
  "title": "Aaja Sanam Madhur Chandni Men",
  "duration": 266,
  "thumbnail": "https://i.ytimg.com/vi_webp/lIp-yNyghDI/maxresdefault.webp",
  "streamUrl": "/stream/youtube/lIp-yNyghDI",
  "song": { ... },
  "offset": 0,
  "rotationEndsAt": "2026-08-12T05:00:00.000+05:30",
  "rotation": { ... },
  "listenerCount": 0
}
```
- **Frontend consumption:** updates track UI, scene image, audio source, and listener count

### `GET /api/youtube-playlist`
- **What it does:** returns the YouTube playlist metadata loaded from `yt-dlp`
- **Why it exists:** frontend needs the playlist to display selectable tracks
- **Who calls it:** `client/src/App.jsx` via `fetchYoutubePlaylist()`
- **Example response:**
```json
{
  "title": "B & W bollywood",
  "url": "https://music.youtube.com/...",
  "entries": [
    { "id": "lIp-yNyghDI", "title": "Aaja Sanam...", "artist": "Lata Mangeshkar - Topic", "duration": 266, "thumbnail": "...", "streamUrl": "/stream/youtube/lIp-yNyghDI" },
    ...
  ]
}
```
- **Frontend consumption:** renders playlist buttons and default selection

### `GET /stream/youtube/:videoId`
- **What it does:** proxies YouTube audio through `yt-dlp`
- **Why it exists:** browser cannot directly play the YouTube Music stream
- **Who calls it:** React when playing a selected YouTube track
- **Response:** audio/webm stream bytes from yt-dlp

### `GET /audio/:filename`
- **What it does:** serves local audio files from disk
- **Why it exists:** local audio playback mode
- **Who calls it:** frontend in local mode or fallback scenarios
- **Response:** audio file stream with correct MIME type

### `GET /api/songs`
- **What it does:** returns the configured song collection
- **Why it exists:** optional frontend/catalog use
- **Who calls it:** not actively used in current `App.jsx`
- **Returns:** playlist entries in YouTube mode, local `songs.json` in local mode

### `GET /api/songs/:id`
- **What it does:** returns a single song or playlist entry by id
- **Why it exists:** support direct lookups or detail pages
- **Who calls it:** not currently used by `App.jsx`

### `GET /api/health`
- **What it does:** returns service health and listener count
- **Why it exists:** simple monitoring endpoint
- **Who calls it:** not currently used by frontend

---

## 11. DATABASE / MONGODB ANALYSIS

### Is MongoDB implemented?
- No. There is no MongoDB integration in this codebase.
- Search results for `mongoose`, `MongoClient`, `mongodb`, `MongoDB` are empty.
- `server/package.json` does not list any MongoDB-related packages.

### Why the app works without MongoDB
- static JSON files provide data persistence for songs and rotations
- YouTube playlist metadata is loaded at runtime from `yt-dlp`
- listener count is kept in process memory
- no database is needed for the current single-user, static-data use case

### What data is kept in memory
- `youtubePlaylist`, `youtubeCurrentIndex`, `youtubeEntryMap`
- `songMap` for local song lookup
- `listenerCount`
- cached playlist metadata (`youtubePlaylistCache`)

### What would move to MongoDB in the future
Possible future data models:
- `users`
- `playlists`
- `favorites`
- `listeningHistory`
- `uploadedMetadata`
- `preferences`

### What would benefit from MongoDB
- storing user-specific playlist selections
- persisting playback history across restarts
- saving curated song metadata
- sharing favorites and playlists across sessions
- reducing reliance on static JSON files

---

## 12. HOW THE PROJECT WOULD BECOME FULL MERN

### Architecture required
React
↓
Express API
↓
Node.js
↓
MongoDB

### What to add
- MongoDB connection in `server/index.js` or a new `server/db.js`
- Mongoose models for `User`, `Playlist`, `Song`, `Rotation`, `History`
- CRUD API routes such as `/api/users`, `/api/playlists`, `/api/history`
- store local song metadata and playlist config in MongoDB instead of JSON files
- user auth and sessions for personalized playlists
- update frontend to call the new CRUD routes

### What would stay the same
- React frontend architecture and `fetch()` usage
- Express route structure and `server/index.js` API approach
- yt-dlp streaming proxy logic
- rotation code could remain but use MongoDB for configuration

### What would change
- `server/data/songs.json` and `server/data/rotations.json` would become database collections
- `songMap` would be populated from MongoDB instead of file system JSON
- YouTube playlist metadata could still be cached in memory, but persistent playlists could be stored in DB
- API endpoints would become more dynamic and support create/update/delete operations

---

## 13. CODE-TO-CONCEPT LEARNING MAP

| Concept | Actual file | What to study |
|---|---|---|
| React entry point | `client/src/main.jsx` | app bootstrapping |
| React component | `client/src/App.jsx` | single-page component design |
| React state | `client/src/App.jsx` | `useState` and component data |
| React hooks | `client/src/App.jsx` | `useEffect`, `useMemo`, `useRef` |
| API requests | `client/src/App.jsx` | `fetch()` usage |
| HTML audio | `client/src/App.jsx` | media playback and refs |
| Express routing | `server/index.js` | `app.get`, `app.post` |
| Middleware | `server/index.js` | `cors`, `express.json()` |
| Environment variables | `server/.env`, `client/.env.local` | runtime configuration |
| Node child process | `server/index.js` | `spawn`, `execFileSync` |
| Socket.io server | `server/index.js` | real-time connections |
| Streaming | `server/index.js` | audio proxying with `yt-dlp` |
| Error handling | `server/index.js` | try/catch, process events |
| Static JSON data | `server/data/*.json` | local content configuration |
| Static assets | `public/scenes` | image serving with Express |

---

## 14. BEGINNER LEARNING PATH

1. **React basics**
   - study `client/src/main.jsx` and `client/src/App.jsx`
   - learn components, JSX, and rendering
2. **React state and hooks**
   - learn `useState`, `useEffect`, `useMemo`, `useRef`
   - see how `App.jsx` manages playlist and playback
3. **HTTP APIs**
   - understand `fetch()` in `App.jsx`
   - learn request/response JSON handling
4. **Express basics**
   - read `server/index.js` route definitions
   - learn how Express handles `GET` and `POST`
5. **Node.js fundamentals**
   - learn `require('fs')`, `process.env`, and async/await
   - study startup flow in `server/index.js`
6. **Streaming audio**
   - learn how browser plays audio from a URL
   - inspect `/stream/youtube/:videoId` proxy logic
7. **Socket.io concepts**
   - understand real-time communication and event emission
   - see server-side connection events in `server/index.js`
8. **Environment configuration**
   - learn `dotenv` and Vite environment variables
   - compare `server/.env` and `client/.env.local`
9. **Static data management**
   - inspect `server/data/songs.json` and `server/data/rotations.json`
   - learn how JSON config drives the app
10. **Streaming integration with yt-dlp**
    - understand how the backend uses external CLI tooling
    - learn child process management and cleanup
11. **Database concepts**
    - note that MongoDB is not present, but would be useful for persistence
    - understand how the current app simulates data with JSON files

---

## 15. INTERVIEW / VIVA QUESTIONS

1. **Why use Express?**
   - Express is used as the backend HTTP framework to expose API routes and serve static assets.
2. **Why use Socket.io?**
   - Socket.io is included for real-time events like listener count and rotation changes.
3. **Why use Node.js?**
   - Node.js runs the backend server and spawns `yt-dlp` child processes.
4. **Why does the frontend not call yt-dlp directly?**
   - the browser cannot run `yt-dlp`, and YouTube audio must be proxied through the backend.
5. **Why does the backend proxy the stream?**
   - to avoid browser restrictions and hide YouTube stream resolution logic from the client.
6. **What is the purpose of `/api/now-playing`?**
   - to provide the current rotation and track metadata for UI synchronization.
7. **What happens when the YouTube playlist changes?**
   - the backend can refresh via `getCachedYoutubePlaylist(true)` and reload metadata from yt-dlp.
8. **What is the difference between HTTP and WebSocket communication?**
   - HTTP is request/response polling, WebSocket/Socket.io supports push updates.
9. **Why is MongoDB not required for the current implementation?**
   - static JSON files and runtime memory are sufficient for this app's data needs.
10. **How would you add authentication?**
    - add an auth layer, session tokens, and protected API routes in Express.
11. **How would you add user playlists?**
    - introduce persistent storage, user models, and playlist CRUD APIs.
12. **What does `USE_YOUTUBE_STREAM` control?**
    - it switches between YouTube streaming mode and local audio mode.
13. **What is `yt-dlp` used for?**
    - it loads playlist metadata and resolves YouTube audio streams.
14. **What does `music-metadata` do?**
    - it reads duration metadata from local audio files.
15. **How does the app compute current playback time?**
    - it uses a time-based rotation epoch and modulo arithmetic to sync playback.
16. **What is `rotation.wrapAround`?**
    - it handles rotations that span midnight, such as 22:00–05:00 IST.
17. **How does the frontend select a YouTube track?**
    - it uses `videoId` and `selectYoutubeByIndex()` to load a new stream.
18. **Why is `useRef` used for the audio element?**
    - to directly access the browser audio DOM node and control playback.
19. **What data is cached in memory on the backend?**
    - YouTube playlist metadata, entries, current index, and listener count.
20. **Why does the backend use `express.json()`?**
    - to parse JSON payloads for future POST endpoints like track selection.

---

## 16. WHAT I ACTUALLY LEARNED FROM BUILDING THIS

### CURRENTLY IMPLEMENTED
- a React single-page UI with play/pause and playlist selection
- a Node/Express API for current playback state
- YouTube metadata loading with `yt-dlp`
- streaming audio proxy through a Node child process
- a rotation-based broadcast schedule using time-based sync
- environment-driven mode switching

### NOT YET IMPLEMENTED
- full frontend Socket.io consumption
- MongoDB or persistent database storage
- user accounts or playlists
- granular seek/RANGE handling for streams
- separate React components/pages for better structure
- backend-side playlist persistence beyond in-memory cache

### GOOD NEXT FEATURES FOR LEARNING
- add Socket.io client integration in `client/src/App.jsx`
- build a real playlist UI with currently playing highlights
- migrate `songs.json`/`rotations.json` to a database
- add authentication and user-specific playlists
- improve stream range requests and resume support

---

## 17. FINAL STACK SUMMARY

| Layer | Technology | Actual role |
|---|---|---|
| Frontend | React | renders the UI and controls audio playback |
| Backend | Node.js | runs Express, child processes, and file I/O |
| API | Express | provides REST endpoints for playback and metadata |
| Realtime | Socket.io | server-side event emission for listener count and rotation changes |
| Streaming | yt-dlp | resolves YouTube audio and streams it through Node |
| Database | none | static JSON files are used instead of a DB |
| Configuration | dotenv | controls YouTube mode and playlist URL |
| Build tooling | Vite | builds the frontend app |

**Current project classification:** React + Node.js + Express + Socket.io + yt-dlp (not full MERN)
