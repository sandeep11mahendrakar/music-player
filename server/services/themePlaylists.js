import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEMES_DIR = path.join(__dirname, '..', '..', 'client', 'src', 'themes');

let allThemePlaylists = {};

function extractPlaylistUrl(configPath) {
  const text = fs.readFileSync(configPath, 'utf8');
  const match = text.match(/playlistUrl:\s*['"`]([^'"`]+)['"`]/);
  return match?.[1] || '';
}

function extractPlaylistId(url) {
  try {
    return new URL(url).searchParams.get('list') || '';
  } catch {
    return '';
  }
}

function cleanArtistName(value = '') {
  return String(value)
    .replace(/\s*-\s*Topic\s*$/i, '')
    .trim();
}

function bestThumbnail(entry) {
  if (Array.isArray(entry?.thumbnails) && entry.thumbnails.length > 0) {
    const sorted = [...entry.thumbnails].sort(
      (a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0)
    );
    if (sorted[0]?.url) return sorted[0].url;
  }
  return entry?.thumbnail || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
}

function normalizeEntry(entry, index, themeId) {
  if (!entry?.id || !entry?.title) return null;

  const rawArtist =
    (Array.isArray(entry.artists) && entry.artists.map((a) => a.name || a).join(', ')) ||
    entry.artist ||
    entry.uploader ||
    entry.channel ||
    '';

  return {
    id: entry.id,
    title: entry.track || entry.title || '',
    artist: cleanArtistName(rawArtist),
    duration: Number(entry.duration) || 0,
    thumbnail: bestThumbnail(entry),
    streamUrl: `/stream/youtube/${entry.id}`,
    youtubeUrl: `https://www.youtube.com/watch?v=${entry.id}`,
    playlistIndex: index,
    themeId,
  };
}

export function preloadAllThemePlaylists() {
  const dirs = fs.readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((item) => item.isDirectory() && /^set\d+$/i.test(item.name))
    .sort((a, b) => Number(a.name.replace(/\D/g, '')) - Number(b.name.replace(/\D/g, '')));

  const loaded = {};

  console.log(`Found ${dirs.length} theme playlists.`);

  for (const dir of dirs) {
    const themeId = dir.name;
    const configPath = path.join(THEMES_DIR, themeId, 'config.js');

    if (!fs.existsSync(configPath)) {
      console.warn(`${themeId}: config.js missing`);
      continue;
    }

    const playlistUrl = extractPlaylistUrl(configPath);

    if (!playlistUrl) {
      console.warn(`${themeId}: playlistUrl missing`);
      continue;
    }

    console.log(`Loading ${themeId}: ${playlistUrl}`);

    try {
      const output = execFileSync(
        'yt-dlp',
        ['--dump-single-json', '--no-warnings', '--ignore-errors', '--flat-playlist', playlistUrl],
        { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024, windowsHide: true }
      );

      const metadata = JSON.parse(output);
      const entries = Array.isArray(metadata?.entries)
        ? metadata.entries.map((entry, index) => normalizeEntry(entry, index, themeId)).filter(Boolean)
        : [];

      loaded[themeId] = {
        themeId,
        playlistId: extractPlaylistId(playlistUrl),
        playlistUrl,
        title: metadata?.title || themeId,
        entries,
        count: entries.length,
      };

      console.log(`${themeId}: loaded ${entries.length} songs`);
    } catch (error) {
      console.error(`${themeId}: failed to load playlist`);
      console.error(error.message);

      loaded[themeId] = {
        themeId,
        playlistId: extractPlaylistId(playlistUrl),
        playlistUrl,
        title: themeId,
        entries: [],
        count: 0,
        error: error.message,
      };
    }
  }

  allThemePlaylists = loaded;

  const total = Object.values(loaded).reduce((sum, p) => sum + p.entries.length, 0);
  console.log(`ALL THEME PLAYLISTS PRELOADED: ${total} songs across ${Object.keys(loaded).length} themes`);

  return allThemePlaylists;
}

export function getAllThemePlaylists() {
  return allThemePlaylists;
}

export function getThemePlaylist(themeId) {
  return allThemePlaylists[themeId] || null;
}
