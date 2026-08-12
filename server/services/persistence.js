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

export async function initializePersistence() {
  return connectMongoDB();
}

export function getPersistenceStatus() {
  return {
    connected: isMongoDBConnected(),
  };
}

export async function saveTheme(data) {
  if (!isMongoDBConnected()) return null;

  return Theme.findOneAndUpdate(
    { themeId: data.themeId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function savePlaylist(data) {
  if (!isMongoDBConnected()) return null;

  return Playlist.findOneAndUpdate(
    { youtubePlaylistId: data.youtubePlaylistId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function saveLyrics(data) {
  if (!isMongoDBConnected()) return null;

  return Lyrics.findOneAndUpdate(
    { youtubeVideoId: data.youtubeVideoId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function recordHistory(data) {
  if (!isMongoDBConnected()) return null;

  return ListeningHistory.create(data);
}

export async function recordPlayEvent(data) {
  if (!isMongoDBConnected()) return null;

  return PlayEvent.create(data);
}

export async function savePreferences(userId, data) {
  if (!isMongoDBConnected()) return null;

  return UserPreferences.findOneAndUpdate(
    { userId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function saveSession(data) {
  if (!isMongoDBConnected()) return null;

  return ListeningSession.findOneAndUpdate(
    { sessionId: data.sessionId },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
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
