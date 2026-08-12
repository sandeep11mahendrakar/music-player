# =========================================================
# fix-theme-playlists.ps1
# Run from: music-player-main\music-player-main (project root)
# Usage:    .\fix-theme-playlists.ps1
# =========================================================

$ErrorActionPreference = "Stop"

$root       = Get-Location
$indexPath  = Join-Path $root "server\index.js"
$envPath    = Join-Path $root "server\.env"
$svcPath    = Join-Path $root "server\services\themePlaylists.js"

if (-not (Test-Path $indexPath)) {
    Write-Host "ERROR: server\index.js not found. Run this from the project root." -ForegroundColor Red
    exit 1
}

# =========================================================
# 1. BACKUP
# =========================================================
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $indexPath "$indexPath.backup-$stamp" -Force
if (Test-Path $envPath) {
    Copy-Item $envPath "$envPath.backup-$stamp" -Force
}
Write-Host "Backed up index.js and .env (suffix: $stamp)" -ForegroundColor Green

# =========================================================
# 2. WRITE services/themePlaylists.js
# =========================================================
$themePlaylistsSvc = @'
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

function normalizeEntry(entry, index, themeId) {
  if (!entry?.id || !entry?.title) return null;
  return {
    id: entry.id,
    title: entry.title || '',
    artist: entry.artist || entry.uploader || entry.channel || '',
    duration: Number(entry.duration) || 0,
    thumbnail: entry.thumbnail || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
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
'@

New-Item -ItemType Directory -Force -Path (Split-Path $svcPath) | Out-Null
Set-Content -Path $svcPath -Value $themePlaylistsSvc -Encoding UTF8
Write-Host "Wrote server\services\themePlaylists.js" -ForegroundColor Green

# =========================================================
# 3. PATCH index.js — done in NODE, not PowerShell, so no JS
#    syntax ever hits the PowerShell parser.
# =========================================================
$patchScriptPath = Join-Path $root "server\_patch-index.mjs"

$patchScript = @'
import fs from "node:fs";

const path = "./index.js";
let src = fs.readFileSync(path, "utf8");
const original = src;

// 1. Remove old global playlist constant
src = src.replace(/^const YOUTUBE_PLAYLIST_URL.*\r?\n/m, "");

// 2. Remove old loadYoutubePlaylist() function block (best-effort)
src = src.replace(
  /function loadYoutubePlaylist\(\)[\s\S]*?\n\}\r?\n/,
  ""
);

// 3. Remove old call to loadYoutubePlaylist();
src = src.replace(/^\s*loadYoutubePlaylist\(\);\s*$/m, "");

// 4. Remove old /api/youtube-playlist route entirely (we re-add below)
src = src.replace(
  /app\.get\(\s*['"]\/api\/youtube-playlist['"][\s\S]*?\n\}\);\r?\n/,
  ""
);

// 5. Add import for the new service (only if not already present)
if (!src.includes("themePlaylists.js")) {
  const importLine = "import { preloadAllThemePlaylists, getAllThemePlaylists, getThemePlaylist } from './services/themePlaylists.js';\n";
  // insert after the last existing import line
  const lastImportMatch = [...src.matchAll(/^import .*\r?\n/gm)].pop();
  if (lastImportMatch) {
    const insertAt = lastImportMatch.index + lastImportMatch[0].length;
    src = src.slice(0, insertAt) + importLine + src.slice(insertAt);
  } else {
    src = importLine + src;
  }
}

// 6. Add the new routes + startup preload call (only if not already present)
if (!src.includes("MULTI-THEME PLAYLIST ROUTES")) {
  const addition = `
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
    return res.status(404).json({ ok: false, error: \`Playlist for \${themeId} not found.\` });
  }

  return res.json({ ok: true, ...playlist });
});
`;

  // Insert before the first startServer(...) call if present, else append at end.
  const startServerMatch = src.match(/^\s*startServer\(/m);
  if (startServerMatch) {
    src = src.slice(0, startServerMatch.index) + addition + "\n" + src.slice(startServerMatch.index);
    src = src.replace(
      /^(\s*)startServer\(/m,
      "$1preloadAllThemePlaylists();\n$1startServer("
    );
  } else {
    src += addition;
    src += "\npreloadAllThemePlaylists();\n";
  }
}

if (src === original) {
  console.log("No changes were necessary (patterns already absent/applied).");
} else {
  fs.writeFileSync(path, src, "utf8");
  console.log("index.js patched.");
}
'@

Set-Content -Path $patchScriptPath -Value $patchScript -Encoding UTF8

Push-Location (Join-Path $root "server")
try {
    node "_patch-index.mjs"
} finally {
    Remove-Item "_patch-index.mjs" -Force -ErrorAction SilentlyContinue
    Pop-Location
}

# =========================================================
# 4. NEUTRALIZE OLD YOUTUBE_PLAYLIST_URL IN .env (comment out, don't delete)
# =========================================================
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "(?m)^YOUTUBE_PLAYLIST_URL=") {
        $envContent = $envContent -replace "(?m)^YOUTUBE_PLAYLIST_URL=", "# (disabled, replaced by per-theme configs) YOUTUBE_PLAYLIST_URL="
        Set-Content -Path $envPath -Value $envContent -Encoding UTF8
        Write-Host "Commented out YOUTUBE_PLAYLIST_URL in .env" -ForegroundColor Yellow
    }
}

# =========================================================
# 5. SYNTAX CHECK
# =========================================================
Write-Host "`n=== SYNTAX CHECK ===" -ForegroundColor Cyan

node --check $svcPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "themePlaylists.js failed syntax check." -ForegroundColor Red
    exit 1
}

node --check $indexPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "index.js failed syntax check. Restore backup: $indexPath.backup-$stamp" -ForegroundColor Red
    exit 1
}

Write-Host "`nDone. Backend multi-playlist code written and verified." -ForegroundColor Green
Write-Host "Backups: *.backup-$stamp"
Write-Host "Next: cd server; npm start"
