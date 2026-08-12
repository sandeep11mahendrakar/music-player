import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { existsSync, readFileSync } from 'fs';
import { parseFile } from 'music-metadata';
import { execFileSync, spawn } from 'child_process';
import { preloadAllThemePlaylists, getAllThemePlaylists, getThemePlaylist } from './services/themePlaylists.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPUS_SOURCE_DIR = process.env.OPUS_SOURCE_DIR || path.resolve('C:/Users/sandeep/Music/B & W bollywood');
const USE_YOUTUBE_STREAM = process.env.USE_YOUTUBE_STREAM === 'true';

// Load data files
const songs = JSON.parse(readFileSync(path.join(__dirname, 'data/songs.json'), 'utf8'));
const rotations = JSON.parse(readFileSync(path.join(__dirname, 'data/rotations.json'), 'utf8'));

const YOUTUBE_PLAYLIST_TTL_MS = 5 * 60 * 1000;
let youtubePlaylistCache = { playlist: null, fetchedAt: 0 };
let youtubePlaylist = [];
let youtubeCurrentIndex = 0;
let youtubeEntryMap = new Map();

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

function isYoutubeVideoId(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

function getCurrentYoutubeEntry() {
  return youtubePlaylist[youtubeCurrentIndex] || null;
}

function selectYoutubeIndex(index) {
  if (!Array.isArray(youtubePlaylist) || youtubePlaylist.length === 0) {
    return null;
  }
  youtubeCurrentIndex = ((index % youtubePlaylist.length) + youtubePlaylist.length) % youtubePlaylist.length;
  return youtubePlaylist[youtubeCurrentIndex];
}

function emitRotationChanged(songEntry) {
  const currentRotation = getCurrentRotation();
  io.emit('rotation_changed', {
    rotation: {
      id: currentRotation.id,
      name: currentRotation.name,
      displayName: currentRotation.displayName,
      sceneImage: currentRotation.sceneImage
    },
    song: songEntry
  });
}

function resolveAudioPath(filename) {
  const publicPath = path.join(__dirname, 'public/audio', filename);
  if (existsSync(publicPath)) {
    return publicPath;
  }

  const sourcePath = path.join(OPUS_SOURCE_DIR, filename);
  if (existsSync(sourcePath)) {
    return sourcePath;
  }

  const alternateOpus = filename.replace(/\.mp3$/i, '.opus');
  if (alternateOpus !== filename) {
    const alternateSource = path.join(OPUS_SOURCE_DIR, alternateOpus);
    if (existsSync(alternateSource)) {
      return alternateSource;
    }
  }

  return null;
}

async function enrichSongDurations() {
  for (const song of songs) {
    if (song.duration && !song.filename.endsWith('.opus')) {
      continue;
    }

    const songPath = resolveAudioPath(song.filename);
    if (!songPath) {
      console.warn(`Song file not found for duration check: ${song.filename}`);
      continue;
    }

    try {
      const metadata = await parseFile(songPath);
      if (metadata?.format?.duration) {
        song.duration = Math.round(metadata.format.duration);
      }
    } catch (error) {
      console.warn(`Unable to read duration for ${song.filename}: ${error.message}`);
    }
  }
}

function getYoutubeVideoUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildYoutubeEntry(entry) {
  const thumbnail = Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0
    ? entry.thumbnails[entry.thumbnails.length - 1].url
    : entry.thumbnail || null;

  return {
    id: entry.id,
    title: entry.title || 'Unknown title',
    artist: entry.uploader || 'Unknown artist',
    duration: entry.duration || 0,
    thumbnail,
    streamUrl: `/stream/youtube/${entry.id}`
  };
}


function getCachedYoutubePlaylist(forceRefresh = false) {
  const now = Date.now();
  if (
    forceRefresh ||
    !youtubePlaylistCache.playlist ||
    now - youtubePlaylistCache.fetchedAt > YOUTUBE_PLAYLIST_TTL_MS
  ) {
    return loadYoutubePlaylist();
  }
  return youtubePlaylistCache.playlist;
}

let songMap;

/**
 * SYNC ENGINE (Phase 3) — Playlist-Aware, Restart-Safe
 * =====================================================
 * Instead of running a loop that accumulates time, we compute the current
 * playback position from wall-clock time using a fixed reference epoch.
 * 
 * Formula: elapsed = (Date.now() - epoch) % totalDuration
 * 
 * This means:
 * - Server restarts don't desync anyone — position recalculates correctly
 * - Every client gets the same song + offset for the same moment in time
 * - We extend this to playlists by walking the song list with the elapsed time
 */

/**
 * Get the start of today's rotation window in IST
 * For wraparound rotations (22:00-05:00), handles midnight crossing
 */
function getRotationEpoch(rotation) {
  const nowIST = DateTime.now().setZone('Asia/Kolkata');
  let startDate = nowIST.set({ hour: rotation.startHourIST, minute: 0, second: 0, millisecond: 0 });
  
  // If current time is before start hour and this is a wraparound rotation, use yesterday's start
  if (rotation.wrapAround && nowIST.hour < rotation.endHourIST) {
    startDate = startDate.minus({ days: 1 });
  } else if (!rotation.wrapAround && nowIST < startDate) {
    // For non-wraparound, if we're before the start, use yesterday
    startDate = startDate.minus({ days: 1 });
  }
  
  return startDate.toMillis();
}

/**
 * Given a rotation and current timestamp, find which song is playing and the offset within it
 * Returns: { song, offset, totalElapsed, playlistDuration }
 */
function getCurrentSongAndOffset(rotation, now = Date.now()) {
  if (USE_YOUTUBE_STREAM) {
    if (!Array.isArray(youtubePlaylist) || youtubePlaylist.length === 0) {
      return null;
    }

    const entry = getCurrentYoutubeEntry();
    if (!entry) {
      return null;
    }

    return {
      song: entry,
      offset: 0,
      totalElapsed: 0,
      playlistDuration: entry.duration
    };
  }

  // Build the playlist with full song data
  const playlist = rotation.songIds.map(id => songMap.get(id)).filter(Boolean);
  
  if (playlist.length === 0) {
    return null;
  }
  
  // Calculate total playlist duration
  const playlistDuration = playlist.reduce((sum, song) => sum + song.duration, 0) * 1000; // ms
  
  // Get the epoch for this rotation's current cycle
  const epoch = getRotationEpoch(rotation);
  
  // Calculate elapsed time within the playlist loop
  const totalElapsed = (now - epoch) % playlistDuration;
  
  // Walk through songs to find which one we're in
  let cumulativeTime = 0;
  for (const song of playlist) {
    const songDurationMs = song.duration * 1000;
    if (totalElapsed >= cumulativeTime && totalElapsed < cumulativeTime + songDurationMs) {
      const offset = (totalElapsed - cumulativeTime) / 1000; // offset in seconds
      return {
        song,
        offset,
        totalElapsed: totalElapsed / 1000,
        playlistDuration: playlistDuration / 1000
      };
    }
    cumulativeTime += songDurationMs;
  }
  
  // Edge case: if we're exactly at the end, loop back to first song
  return {
    song: playlist[0],
    offset: 0,
    totalElapsed: 0,
    playlistDuration: playlistDuration / 1000
  };
}

/**
 * Determine which rotation is currently active based on IST
 */
function getCurrentRotation(now = DateTime.now().setZone('Asia/Kolkata')) {
  const currentHour = now.hour;
  
  for (const rotation of rotations) {
    if (rotation.wrapAround) {
      // Handles 22:00-05:00 crossing midnight
      if (currentHour >= rotation.startHourIST || currentHour < rotation.endHourIST) {
        return rotation;
      }
    } else {
      // Normal range (e.g., 6:00-12:00)
      if (currentHour >= rotation.startHourIST && currentHour < rotation.endHourIST) {
        return rotation;
      }
    }
  }
  
  // Fallback to first rotation if nothing matches (shouldn't happen with proper config)
  return rotations[0];
}

/**
 * Get when the current rotation ends (in IST)
 */
function getRotationEndsAt(rotation) {
  const nowIST = DateTime.now().setZone('Asia/Kolkata');
  let endDate = nowIST.set({ hour: rotation.endHourIST, minute: 0, second: 0, millisecond: 0 });
  
  if (endDate <= nowIST) {
    endDate = endDate.plus({ days: 1 });
  }
  
  return endDate.toISO();
}

// In-memory listener count (resets on cold start — acceptable for hobby project)
let listenerCount = 0;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET']
  }
});

io.on('connection', (socket) => {
  listenerCount++;
  io.emit('listener_count', listenerCount);
  
  socket.on('disconnect', () => {
    listenerCount--;
    io.emit('listener_count', listenerCount);
  });
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'Deluxe Saloon backend is running',
    api: {
      nowPlaying: '/api/now-playing',
      health: '/api/health',
      songs: '/api/songs'
    }
  });
});

app.get('/audio/:filename', (req, res, next) => {
  const filename = req.params.filename;
  const filePath = resolveAudioPath(filename);

  if (!filePath) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.opus') {
    res.setHeader('Content-Type', 'audio/ogg');
  } else if (ext === '.mp3') {
    res.setHeader('Content-Type', 'audio/mpeg');
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      next(err);
    }
  });
});


app.post('/api/youtube/select/:videoId', (req, res) => {
  if (!USE_YOUTUBE_STREAM) {
    return res.status(400).json({ error: 'YouTube streaming is not enabled on this server.' });
  }

  const videoId = req.params.videoId;
  if (!isYoutubeVideoId(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID.' });
  }

  const index = youtubePlaylist.findIndex((entry) => entry.id === videoId);
  if (index === -1) {
    return res.status(404).json({ error: 'Video not found in YouTube playlist.' });
  }

  const entry = selectYoutubeIndex(index);
  emitRotationChanged(entry);
  res.json({ mode: 'youtube', index: youtubeCurrentIndex, song: entry });
});

app.post('/api/youtube/next', (req, res) => {
  if (!USE_YOUTUBE_STREAM) {
    return res.status(400).json({ error: 'YouTube streaming is not enabled on this server.' });
  }

  if (!Array.isArray(youtubePlaylist) || youtubePlaylist.length === 0) {
    return res.status(500).json({ error: 'YouTube playlist is not loaded.' });
  }

  const entry = selectYoutubeIndex(youtubeCurrentIndex + 1);
  emitRotationChanged(entry);
  res.json({ mode: 'youtube', index: youtubeCurrentIndex, song: entry });
});

app.post('/api/youtube/previous', (req, res) => {
  if (!USE_YOUTUBE_STREAM) {
    return res.status(400).json({ error: 'YouTube streaming is not enabled on this server.' });
  }

  if (!Array.isArray(youtubePlaylist) || youtubePlaylist.length === 0) {
    return res.status(500).json({ error: 'YouTube playlist is not loaded.' });
  }

  const entry = selectYoutubeIndex(youtubeCurrentIndex - 1);
  emitRotationChanged(entry);
  res.json({ mode: 'youtube', index: youtubeCurrentIndex, song: entry });
});

app.get('/stream/youtube/:videoId', (req, res) => {
  if (!USE_YOUTUBE_STREAM) {
    return res.status(400).json({ error: 'YouTube streaming is not enabled on this server.' });
  }

  const videoId = req.params.videoId;
  if (!isYoutubeVideoId(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID.' });
  }

  const entry = youtubeEntryMap.get(videoId);
  if (!entry) {
    return res.status(404).json({ error: 'Video not found in YouTube playlist.' });
  }

  const videoUrl = getYoutubeVideoUrl(videoId);
  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Cache-Control', 'no-cache');

  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=webm]/bestaudio',
    '-o', '-',
    '--no-playlist',
    videoUrl
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let clientClosed = false;

  ytdlp.stdout.on('error', (err) => {
    console.error('yt-dlp stdout error:', err);
  });

  ytdlp.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  ytdlp.on('error', (err) => {
    console.error('yt-dlp spawn failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start yt-dlp.' });
    }
  });

  ytdlp.stdout.pipe(res);

  const cleanup = () => {
    if (!clientClosed) {
      clientClosed = true;
      ytdlp.kill('SIGKILL');
    }
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
});

// Serve static scene images
app.use('/scenes', express.static(path.join(__dirname, 'public/scenes')));

// Phase 4 API endpoint — returns current rotation, song, and sync offset
app.get('/api/now-playing', (req, res) => {
  const currentRotation = getCurrentRotation();
  const result = getCurrentSongAndOffset(currentRotation);

  if (USE_YOUTUBE_STREAM) {
    if (!result || !result.song) {
      return res.status(500).json({ error: 'YouTube playlist is not loaded or contains no valid entry.' });
    }

    const entry = result.song;
    return res.json({
      mode: 'youtube',
      index: youtubeCurrentIndex,
      id: entry.id,
      title: entry.title,
      duration: entry.duration,
      thumbnail: entry.thumbnail,
      streamUrl: entry.streamUrl,
      song: entry,
      offset: result.offset,
      rotationEndsAt: getRotationEndsAt(currentRotation),
      rotation: {
        id: currentRotation.id,
        name: currentRotation.name,
        displayName: currentRotation.displayName,
        sceneImage: currentRotation.sceneImage
      },
      listenerCount
    });
  }

  const { song, offset } = result;
  const rotationEndsAt = getRotationEndsAt(currentRotation);
  
  res.json({
    rotation: {
      id: currentRotation.id,
      name: currentRotation.name,
      displayName: currentRotation.displayName,
      sceneImage: currentRotation.sceneImage
    },
    song,
    offset,
    rotationEndsAt,
    listenerCount
  });
});

app.get('/api/songs', (req, res) => {
  if (USE_YOUTUBE_STREAM) {
    try {
      const playlist = getCachedYoutubePlaylist();
      return res.json(playlist.entries);
    } catch (error) {
      console.error('Unable to load YouTube playlist for /api/songs:', error);
      return res.status(500).json({ error: 'Unable to load YouTube playlist metadata.' });
    }
  }

  res.json(songs);
});

app.get('/api/songs/:id', (req, res) => {
  if (USE_YOUTUBE_STREAM) {
    try {
      const playlist = getCachedYoutubePlaylist();
      const entry = (playlist.entries || []).find((item) => item.id === req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Song not found' });
      }
      return res.json(entry);
    } catch (error) {
      console.error('Unable to load YouTube playlist for /api/songs/:id:', error);
      return res.status(500).json({ error: 'Unable to load YouTube playlist metadata.' });
    }
  }

  const song = songMap.get(req.params.id);
  if (!song) {
    return res.status(404).json({ error: 'Song not found' });
  }
  res.json(song);
});

// Socket.io for real-time listener count and rotation changes
let lastRotationId = getCurrentRotation().id;

setInterval(() => {
  const currentRotation = getCurrentRotation();
  if (lastRotationId && lastRotationId !== currentRotation.id) {
    io.emit('rotation_changed', {
      rotation: {
        id: currentRotation.id,
        name: currentRotation.name,
        displayName: currentRotation.displayName,
        sceneImage: currentRotation.sceneImage
      }
    });
  }
  lastRotationId = currentRotation.id;
}, 10000); // Check every 10 seconds

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', listenerCount });
});

const PORT = process.env.PORT || 4000;
console.log(`Starting Deluxe Saloon server with USE_YOUTUBE_STREAM=${USE_YOUTUBE_STREAM} PORT=${PORT}`);

async function startServer() {
  if (!USE_YOUTUBE_STREAM) {
    await enrichSongDurations();
  } else {
    console.log('USE_YOUTUBE_STREAM=true, skipping local audio duration enrichment.');
  }

  songMap = new Map(songs.map(song => [song.id, song]));

  try {
    if (USE_YOUTUBE_STREAM) {
    }
  } catch (error) {
    console.error('Unable to initialize YouTube playlist:', error);
  }

  httpServer.on('error', (err) => {
    console.error('HTTP server error during startup:', err);
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    console.log(`Deluxe Saloon server running on port ${PORT}`);
    console.log(`Audio files served from: /audio`);
    if (USE_YOUTUBE_STREAM) {
      console.log('YouTube streaming is enabled. Playlist endpoint: /api/youtube-playlist');
      console.log('Stream endpoint: /stream/youtube/:videoId');
    }
    console.log(`Listener count: ${listenerCount}`);
  });
}
// ========================================================
// MULTI-THEME PLAYLIST ROUTES
// ========================================================
app.get('/api/all-playlists', (_req, res) => {
  const themes = getAllThemePlaylists();
  const totalSongs = Object.values(themes).reduce(
    (sum, playlist) => sum + (playlist?.entries?.length || 0),
    0
  );
  res.json({ ok: true, themes, totalSongs });
});

app.get('/api/youtube-playlist', (req, res) => {
  const themeId = String(req.query.themeId || 'set1');
  const playlist = getThemePlaylist(themeId);

  if (!playlist) {
    return res.status(404).json({ ok: false, error: `Playlist for ${themeId} not found.` });
  }

  return res.json({ ok: true, ...playlist });
});



preloadAllThemePlaylists();

for (const playlist of Object.values(getAllThemePlaylists())) {
  for (const entry of playlist.entries) {
    youtubeEntryMap.set(entry.id, entry);
  }
}



startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

/* =========================================================
   OPTIONAL MONGODB PERSISTENCE
   Does NOT block the music server if MongoDB is unavailable.
   ========================================================= */

import('./services/persistence.js')
  .then(({ initializePersistence }) => initializePersistence())
  .catch((error) => {
    console.warn(`MongoDB initialization failed: ${error.message}`);
  });

if (typeof app !== 'undefined') {
  app.get('/api/db/status', async (_req, res) => {
    try {
      const { getPersistenceStatus } =
        await import('./services/persistence.js');

      res.json({
        ok: true,
        database: 'mongodb',
        ...getPersistenceStatus(),
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        database: 'mongodb',
        connected: false,
        error: error.message,
      });
    }
  });

  app.get('/api/db/models', async (_req, res) => {
    res.json({
      collections: [
        'users',
        'themes',
        'playlists',
        'songs',
        'lyrics',
        'favorites',
        'listeningHistory',
        'userPreferences',
        'listeningSessions',
        'appSettings',
        'playEvents',
      ],
    });
  });
}

/* =========================================================
   MONGODB DATA SYNC ROUTES
   ========================================================= */

if (typeof app !== 'undefined') {
  app.post('/api/db/sync/youtube', async (req, res) => {
    try {
      const { isMongoDBConnected } =
        await import('./config/database.js');

      if (!isMongoDBConnected()) {
        return res.status(503).json({
          ok: false,
          error: 'MongoDB is not connected.',
        });
      }

      const {
        syncYoutubePlaylistToMongo,
      } = await import('./services/youtubeMongoSync.js');

      const playlistUrl =
        req.body?.playlistUrl ||
        process.env.YOUTUBE_PLAYLIST_URL ||
        '';

      const themeId =
        req.body?.themeId ||
        'set1';

      if (!playlistUrl) {
        return res.status(400).json({
          ok: false,
          error: 'No YouTube playlist URL provided.',
        });
      }

      const result = await syncYoutubePlaylistToMongo({
        playlistUrl,
        themeId,
      });

      res.json({
        ok: true,
        message: 'YouTube playlist synchronized to MongoDB.',
        ...result,
      });
    } catch (error) {
      console.error(
        'MongoDB YouTube sync failed:',
        error
      );

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.get('/api/db/playlists', async (_req, res) => {
    try {
      const { isMongoDBConnected } =
        await import('./config/database.js');

      if (!isMongoDBConnected()) {
        return res.status(503).json({
          ok: false,
          error: 'MongoDB is not connected.',
        });
      }

      const { Playlist } =
        await import('./services/persistence.js');

      const playlists = await Playlist.find()
        .sort({ updatedAt: -1 })
        .lean();

      res.json({
        ok: true,
        count: playlists.length,
        playlists,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.get('/api/db/songs', async (req, res) => {
    try {
      const { isMongoDBConnected } =
        await import('./config/database.js');

      if (!isMongoDBConnected()) {
        return res.status(503).json({
          ok: false,
          error: 'MongoDB is not connected.',
        });
      }

      const { Song } =
        await import('./services/persistence.js');

      const limit = Math.min(
        Math.max(Number(req.query.limit) || 50, 1),
        500
      );

      const songs = await Song.find()
        .sort({ title: 1 })
        .limit(limit)
        .lean();

      res.json({
        ok: true,
        count: songs.length,
        songs,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.get('/api/db/themes', async (_req, res) => {
    try {
      const { isMongoDBConnected } =
        await import('./config/database.js');

      if (!isMongoDBConnected()) {
        return res.status(503).json({
          ok: false,
          error: 'MongoDB is not connected.',
        });
      }

      const { Theme } =
        await import('./services/persistence.js');

      const themes = await Theme.find()
        .sort({ themeId: 1 })
        .populate('playlistId')
        .lean();

      res.json({
        ok: true,
        count: themes.length,
        themes,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.get('/api/db/history', async (req, res) => {
    try {
      const { isMongoDBConnected } =
        await import('./config/database.js');

      if (!isMongoDBConnected()) {
        return res.status(503).json({
          ok: false,
          error: 'MongoDB is not connected.',
        });
      }

      const { ListeningHistory } =
        await import('./services/persistence.js');

      const limit = Math.min(
        Math.max(Number(req.query.limit) || 50, 1),
        500
      );

      const history = await ListeningHistory.find()
        .sort({ playedAt: -1 })
        .limit(limit)
        .lean();

      res.json({
        ok: true,
        count: history.length,
        history,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });
}

/* =========================================================
   OPTIONAL INITIAL YOUTUBE -> MONGODB SYNC
   ========================================================= */

setTimeout(async () => {
  try {
    const { isMongoDBConnected } =
      await import('./config/database.js');

    if (!isMongoDBConnected()) {
      console.log(
        'MongoDB sync skipped: database unavailable.'
      );
      return;
    }

    const playlistUrl =
      process.env.YOUTUBE_PLAYLIST_URL || '';

    if (!playlistUrl) {
      console.log(
        'MongoDB sync skipped: YOUTUBE_PLAYLIST_URL not configured.'
      );
      return;
    }

    const { syncYoutubePlaylistToMongo } =
      await import('./services/youtubeMongoSync.js');

    const result = await syncYoutubePlaylistToMongo({
      playlistUrl,
      themeId: 'set1',
    });

    console.log(
      `MongoDB playlist sync complete: ${result.songCount} songs.`
    );
  } catch (error) {
    console.warn(
      `MongoDB initial sync skipped: ${error.message}`
    );
  }
}, 3000);

/* =========================================================
   YOUTUBE LYRICS API
   ========================================================= */

app.get('/api/youtube-lyrics/:videoId', async (req, res) => {
  try {
    const videoId = String(req.params.videoId || '').trim();

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid YouTube video ID.',
      });
    }

    const {
      fetchYoutubeLyrics,
    } = await import('./services/youtubeLyrics.js');

    const result = await fetchYoutubeLyrics(videoId);

    if (!result.available) {
      return res.json({
        ok: true,
        available: false,
        videoId,
        lyrics: null,
      });
    }

    /* Persist lyrics when MongoDB is available. */
    try {
      const {
        isMongoDBConnected,
      } = await import('./config/database.js');

      if (isMongoDBConnected()) {
        const {
          saveLyrics,
        } = await import('./services/mongodb.js');

        await saveLyrics({
          youtubeVideoId: videoId,
          language: result.language || 'en',
          source: result.source,
          synced: true,
          plainText: result.plainText,
          lines: result.lines,
          lastSyncedAt: new Date(),
        });
      }
    } catch (dbError) {
      console.warn(
        `Lyrics MongoDB save skipped: ${dbError.message}`
      );
    }

    res.json({
      ok: true,
      available: true,
      videoId,
      language: result.language,
      source: result.source,
      lyrics: {
        plainText: result.plainText,
        lines: result.lines,
      },
    });
  } catch (error) {
    console.error(
      `Lyrics fetch failed for ${req.params.videoId}:`,
      error
    );

    res.status(500).json({
      ok: false,
      available: false,
      error: 'Unable to fetch YouTube lyrics.',
    });
  }
});

