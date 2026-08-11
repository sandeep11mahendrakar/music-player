import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load data files
const songs = JSON.parse(readFileSync(path.join(__dirname, 'data/songs.json'), 'utf8'));
const rotations = JSON.parse(readFileSync(path.join(__dirname, 'data/rotations.json'), 'utf8'));

// Create a map for quick song lookup
const songMap = new Map(songs.map(song => [song.id, song]));

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

// Serve static audio files with proper Range request support (built into Express)
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// Serve static scene images
app.use('/scenes', express.static(path.join(__dirname, 'public/scenes')));

// Phase 4 API endpoint — returns current rotation, song, and sync offset
app.get('/api/now-playing', (req, res) => {
  const currentRotation = getCurrentRotation();
  const { song, offset } = getCurrentSongAndOffset(currentRotation);
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

// Socket.io for real-time listener count and rotation changes
let lastRotationId = null;

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
httpServer.listen(PORT, () => {
  console.log(`Deluxe Saloon server running on port ${PORT}`);
  console.log(`Audio files served from: /audio`);
  console.log(`Listener count: ${listenerCount}`);
});
