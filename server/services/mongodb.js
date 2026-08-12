import { connectMongoDB, isMongoDBConnected } from '../config/database.js';

import User from '../models/User.js';
import Theme from '../models/Theme.js';
import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';
import Lyrics from '../models/Lyrics.js';
import Favorite from '../models/Favorite.js';
import ListeningHistory from '../models/ListeningHistory.js';
import UserPreferences from '../models/UserPreferences.js';
import ListeningSession from '../models/ListeningSession.js';
import AppSetting from '../models/AppSetting.js';
import PlayEvent from '../models/PlayEvent.js';

export async function initializeMongoDB() {
  return connectMongoDB();
}

export function mongoStatus() {
  return {
    connected: isMongoDBConnected(),
  };
}

function extractPlaylistId(url = '') {
  try {
    return new URL(url).searchParams.get('list') || '';
  } catch {
    return '';
  }
}

function normalizePlaylistEntry(entry, position) {
  if (!entry?.id || !entry?.title) {
    return null;
  }

  return {
    videoId: entry.id,
    position,
    title: entry.title || '',
    artist: entry.artist || entry.uploader || '',
    uploader: entry.uploader || '',
    duration: Number(entry.duration) || 0,
    thumbnail:
      entry.thumbnail ||
      `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
    streamUrl: `/stream/youtube/${entry.id}`,
    youtubeUrl: `https://www.youtube.com/watch?v=${entry.id}`,
    lyricsAvailable: Boolean(entry.lyricsAvailable),
  };
}

export async function saveTheme(data) {
  if (!isMongoDBConnected()) return null;

  return Theme.findOneAndUpdate(
    { themeId: data.themeId },
    { $set: data },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function savePlaylist(data) {
  if (!isMongoDBConnected()) return null;

  return Playlist.findOneAndUpdate(
    { youtubePlaylistId: data.youtubePlaylistId },
    { $set: data },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function saveSong(data) {
  if (!isMongoDBConnected()) return null;

  return Song.findOneAndUpdate(
    { youtubeVideoId: data.youtubeVideoId },
    {
      $set: {
        ...data,
        lastMetadataSyncAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function saveLyrics(data) {
  if (!isMongoDBConnected()) return null;

  return Lyrics.findOneAndUpdate(
    { youtubeVideoId: data.youtubeVideoId },
    { $set: data },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function savePreference(query, data) {
  if (!isMongoDBConnected()) return null;

  return UserPreferences.findOneAndUpdate(
    query,
    { $set: data },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function saveHistory(data) {
  if (!isMongoDBConnected()) return null;
  return ListeningHistory.create(data);
}

export async function saveFavorite(data) {
  if (!isMongoDBConnected()) return null;
  return Favorite.findOneAndUpdate(
    {
      ...(data.visitorId
        ? { visitorId: data.visitorId }
        : { userId: data.userId }),
      youtubeVideoId: data.youtubeVideoId,
    },
    {
      $set: data,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function removeFavorite({ visitorId, userId, youtubeVideoId }) {
  if (!isMongoDBConnected()) return null;

  return Favorite.deleteOne({
    ...(visitorId ? { visitorId } : { userId }),
    youtubeVideoId,
  });
}

export async function saveSession(data) {
  if (!isMongoDBConnected()) return null;

  return ListeningSession.findOneAndUpdate(
    { sessionId: data.sessionId },
    { $set: data },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function savePlayEvent(data) {
  if (!isMongoDBConnected()) return null;
  return PlayEvent.create(data);
}

export async function syncPlaylist({
  playlistUrl,
  themeId = '',
  entries = [],
  metadata = {},
}) {
  if (!isMongoDBConnected()) {
    throw new Error('MongoDB is not connected.');
  }

  const playlistId =
    extractPlaylistId(playlistUrl) ||
    metadata.id ||
    `playlist-${Date.now()}`;

  const normalizedEntries = entries
    .map((entry, index) =>
      normalizePlaylistEntry(entry, index)
    )
    .filter(Boolean);

  const playlist = await Playlist.findOneAndUpdate(
    { youtubePlaylistId: playlistId },
    {
      $set: {
        youtubePlaylistId: playlistId,
        url: playlistUrl,
        title: metadata.title || '',
        description: metadata.description || '',
        thumbnail: metadata.thumbnail || '',
        channelId: metadata.channel_id || '',
        channelTitle:
          metadata.uploader ||
          metadata.channel ||
          '',
        themeId,
        songCount: normalizedEntries.length,
        entries: normalizedEntries,
        lastSyncedAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  for (const entry of normalizedEntries) {
    await saveSong({
      youtubeVideoId: entry.videoId,
      title: entry.title,
      artist: entry.artist,
      uploader: entry.uploader,
      duration: entry.duration,
      thumbnail: entry.thumbnail,
      youtubeUrl: entry.youtubeUrl,
      lyricsAvailable: entry.lyricsAvailable,
      metadataSource: 'youtube',
    });
  }

  return playlist;
}

export {
  User,
  Theme,
  Playlist,
  Song,
  Lyrics,
  Favorite,
  ListeningHistory,
  UserPreferences,
  ListeningSession,
  AppSetting,
  PlayEvent,
};
