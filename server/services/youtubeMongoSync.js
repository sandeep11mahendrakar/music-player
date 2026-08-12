import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';
import Theme from '../models/Theme.js';

const execFileAsync = promisify(execFile);

function extractPlaylistId(url = '') {
  try {
    return new URL(url).searchParams.get('list') || '';
  } catch {
    return '';
  }
}

function normalizeEntry(entry, position = 0) {
  if (!entry?.id || !entry?.title) {
    return null;
  }

  return {
    videoId: entry.id,
    position,
    title: entry.title || '',
    artist: entry.artist || entry.uploader || entry.channel || '',
    uploader: entry.uploader || '',
    duration: Number(entry.duration) || 0,
    thumbnail:
      entry.thumbnail ||
      `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
    youtubeUrl: `https://www.youtube.com/watch?v=${entry.id}`,
    lyricsAvailable: Boolean(
      entry.lyricsAvailable ||
      entry.subtitles ||
      entry.automatic_captions
    ),
  };
}

export async function fetchYoutubePlaylistMetadata(playlistUrl) {
  const { stdout } = await execFileAsync(
    'yt-dlp',
    [
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--ignore-errors',
      playlistUrl,
    ],
    {
      maxBuffer: 25 * 1024 * 1024,
      windowsHide: true,
    }
  );

  return JSON.parse(stdout);
}

export async function syncYoutubePlaylistToMongo({
  playlistUrl,
  themeId = '',
}) {
  if (!playlistUrl) {
    throw new Error('playlistUrl is required');
  }

  const metadata = await fetchYoutubePlaylistMetadata(playlistUrl);

  const playlistId =
    extractPlaylistId(playlistUrl) ||
    metadata?.id ||
    `local-${Date.now()}`;

  const rawEntries = Array.isArray(metadata?.entries)
    ? metadata.entries
    : [];

  const entries = rawEntries
    .map((entry, index) => normalizeEntry(entry, index))
    .filter(Boolean);

  const playlist = await Playlist.findOneAndUpdate(
    { youtubePlaylistId: playlistId },
    {
      $set: {
        youtubePlaylistId: playlistId,
        url: playlistUrl,
        title: metadata?.title || '',
        description: metadata?.description || '',
        thumbnail: metadata?.thumbnail || '',
        channelId: metadata?.channel_id || '',
        channelTitle: metadata?.uploader || metadata?.channel || '',
        songCount: entries.length,
        themeId,
        lastSyncedAt: new Date(),
        entries,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  for (const entry of entries) {
    await Song.findOneAndUpdate(
      { youtubeVideoId: entry.videoId },
      {
        $set: {
          youtubeVideoId: entry.videoId,
          title: entry.title,
          artist: entry.artist,
          uploader: entry.uploader,
          duration: entry.duration,
          thumbnail: entry.thumbnail,
          youtubeUrl: entry.youtubeUrl,
          lyricsAvailable: entry.lyricsAvailable,
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

  if (themeId) {
    await Theme.findOneAndUpdate(
      { themeId },
      {
        $set: {
          themeId,
          name: themeId,
          playlistId: playlist._id,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  return {
    playlistId,
    themeId,
    title: playlist.title,
    songCount: entries.length,
    entries,
  };
}
