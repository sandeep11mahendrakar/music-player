# Deluxe Saloon

Deluxe Saloon is a full-screen, synchronized music-player web application built with React, Node.js, Express, Socket.io, yt-dlp, and MongoDB/Mongoose.

The application supports four visual themes, each with its own YouTube playlist, theme-specific artwork, live playlist metadata, YouTube audio streaming, lyrics retrieval where available, and persistent MongoDB metadata.
## Theme Asset Source Paths

The following theme preview/source images are stored in the repository root:

| Theme | GitHub Asset |
|---|---|
| Set 1 | `./Picture1.png` |
| Set 2 | `./Picture2.png` |
| Set 3 | `./Picture3.png` |
| Set 4 | `./Picture4.png` |
## Stack

- React + Vite — frontend UI and browser audio control
- Node.js + Express — backend API and streaming proxy
- yt-dlp — YouTube playlist metadata and audio-stream resolution
- Socket.io — realtime backend events such as listener count and rotation changes
- MongoDB + Mongoose — persistent songs, playlists, themes, lyrics, history, preferences, sessions, and events
- CSS — responsive full-screen theme UI

## Project Structure

```text
music-player-main/
├── client/
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── components/
│       │   ├── ThemeShell.jsx
│       │   ├── ThemeBackground.jsx
│       │   ├── ThemeHero.jsx
│       │   ├── ThemeText.jsx
│       │   ├── TopStatusBar.jsx
│       │   ├── LyricsPanel.jsx
│       │   ├── MusicPlayer.jsx
│       │   └── StartEngineButton.jsx
│       └── themes/
│           ├── registry.js
│           ├── set1/
│           ├── set2/
│           ├── set3/
│           └── set4/
│
├── server/
│   ├── index.js
│   ├── .env
│   ├── config/
│   │   └── database.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Theme.js
│   │   ├── Playlist.js
│   │   ├── Song.js
│   │   ├── Lyrics.js
│   │   ├── Favorite.js
│   │   ├── ListeningHistory.js
│   │   ├── UserPreferences.js
│   │   ├── ListeningSession.js
│   │   ├── AppSetting.js
│   │   └── PlayEvent.js
│   └── services/
│       ├── mongodb.js
│       ├── youtubeLyrics.js
│       └── preloadAllThemes.js
│
└── README.md
```

## Theme Playlists

Each theme owns its own YouTube playlist URL in its `config.js`.

| Theme | Playlist |
|---|---|
| Set 1 — Black & White Bollywood | `https://youtube.com/playlist?list=PLWxAXdt3DK0w` |
| Set 2 — Sita Ramam / Telugu | `https://youtube.com/playlist?list=PLJXVSEYu0fWDtJon31Z4NurKfT1qe7s11` |
| Set 3 — Rave Girls | `https://youtube.com/playlist?list=PLFLXWCUsy8nY` |
| Set 4 — Fight Mode / Boxing Motivation | `https://youtube.com/playlist?list=PLWd4gmX2j6dOUpWveHdipQ-vqlPX1A0f1` |

The backend reads all four theme configs at startup and preloads every playlist instead of depending on one global playlist URL.

## Current Demo Dataset

The verified startup currently loads:

```text
set1: 13 songs
set2: 8 songs
set3: 18 songs
set4: 16 songs
Total: 55 songs
```

The backend keeps these playlists separate by `themeId`.

## YouTube Playback Flow

```text
Theme config
   ↓
playlistUrl
   ↓
yt-dlp playlist metadata
   ↓
YouTube entries in memory
   ↓
MongoDB metadata upsert
   ↓
React selects a video ID
   ↓
/stream/youtube/<videoId>
   ↓
yt-dlp resolves audio
   ↓
Express pipes audio to browser
   ↓
HTMLAudioElement
```

The application does not permanently download YouTube songs into MP3/Opus files for playback.

## MongoDB

MongoDB runs locally during development:

```text
mongodb://127.0.0.1:27017/deluxe_saloon
```

Main collections/models:

- users
- themes
- playlists
- songs
- lyrics
- favorites
- listening history
- user preferences
- listening sessions
- app settings
- play events

Stable YouTube IDs are used as the song identity. Playlist and song metadata are upserted so repeated startups do not intentionally create duplicate song records.

## Important API Endpoints

```text
GET  /api/health
GET  /api/db/status
GET  /api/all-playlists
GET  /api/youtube-playlist?themeId=set1
GET  /api/youtube-playlist?themeId=set2
GET  /api/youtube-playlist?themeId=set3
GET  /api/youtube-playlist?themeId=set4
GET  /api/now-playing
GET  /api/youtube-lyrics/:videoId
GET  /stream/youtube/:videoId
GET  /api/songs
GET  /api/songs/:id
```

## Lyrics

Lyrics are not guaranteed for every song.

For a selected YouTube video, the backend uses yt-dlp subtitle/caption metadata, parses usable subtitle data, and returns lyrics when available. Successful lyric data can also be persisted in MongoDB.

A song without an available subtitle/lyrics source is expected to return an unavailable state rather than being treated as a system error.

## Local Audio Mode

The existing local mode remains supported:

```text
USE_YOUTUBE_STREAM=false
```

Local audio routes and files must not be removed just because the demo currently uses YouTube mode.

## Running the Project

### 1. Start MongoDB

MongoDB Community Server must be installed and running on port `27017`.

Verify:

```powershell
Test-NetConnection 127.0.0.1 -Port 27017 | Select-Object TcpTestSucceeded
```

### 2. Start the backend

```powershell
cd "C:\Users\sandeep\pes\temp\music-player-main\music-player-main\server"
npm start
```

The backend should report that all four theme playlists were loaded, MongoDB is connected, and port `4000` is listening.

### 3. Start the frontend

In another terminal:

```powershell
cd "C:\Users\sandeep\pes\temp\music-player-main\music-player-main\client"
npm run dev
```

Open:

```text
http://localhost:5173
```

## Useful Verification

Check database status:

```powershell
Invoke-RestMethod "http://localhost:4000/api/db/status" | ConvertTo-Json
```

Check all theme playlists:

```powershell
Invoke-RestMethod "http://localhost:4000/api/all-playlists" | ConvertTo-Json -Depth 8
```

Check one theme:

```powershell
Invoke-RestMethod "http://localhost:4000/api/youtube-playlist?themeId=set1" | ConvertTo-Json -Depth 6
```

Check lyrics for a video:

```powershell
Invoke-RestMethod "http://localhost:4000/api/youtube-lyrics/<videoId>" | ConvertTo-Json -Depth 10
```

## Design Intent

The frontend is intentionally a fixed, full-screen visual composition rather than a traditional scrolling website. The center hero/vinyl is the primary visual element, the player stays near the bottom, lyrics occupy the upper-right area, and each theme controls its own artwork and playlist identity.

Theme assets are stored inside the corresponding `client/src/themes/setN/` directory so they can be replaced without changing the rest of the application.

## Safety / Non-Destructive Development Rule

Before major architectural changes:

1. Back up the current working file.
2. Change one subsystem at a time.
3. Run backend syntax checks.
4. Run the frontend production build.
5. Start MongoDB, backend, and frontend.
6. Verify actual audio playback rather than only API responses.

Do not delete local media or backups as part of normal development.
