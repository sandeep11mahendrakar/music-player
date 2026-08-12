import fs from "node:fs";

function patchFile(path, replacements) {
  const raw = fs.readFileSync(path, "utf8");
  const usesCRLF = raw.includes("\r\n");
  let src = raw.replace(/\r\n/g, "\n");
  let changed = 0;

  for (const [label, oldStrRaw, newStrRaw] of replacements) {
    const oldStr = oldStrRaw.replace(/\r\n/g, "\n");
    const newStr = newStrRaw.replace(/\r\n/g, "\n");

    if (!src.includes(oldStr)) {
      console.error(`SKIP (not found): [${path}] ${label}`);
      continue;
    }
    const count = src.split(oldStr).length - 1;
    if (count > 1) {
      console.error(`SKIP (matched ${count}x, not unique): [${path}] ${label}`);
      continue;
    }
    src = src.replace(oldStr, newStr);
    changed++;
    console.log(`OK: [${path}] ${label}`);
  }

  const out = usesCRLF ? src.replace(/\n/g, "\r\n") : src;
  fs.writeFileSync(path, out, "utf8");
  return changed;
}

patchFile("./server/services/themePlaylists.js", [
  [
    "normalizeEntry: cleaner artist/title/thumbnail extraction",
    `function normalizeEntry(entry, index, themeId) {
  if (!entry?.id || !entry?.title) return null;
  return {
    id: entry.id,
    title: entry.title || '',
    artist: entry.artist || entry.uploader || entry.channel || '',
    duration: Number(entry.duration) || 0,
    thumbnail: entry.thumbnail || \`https://i.ytimg.com/vi/\${entry.id}/hqdefault.jpg\`,
    streamUrl: \`/stream/youtube/\${entry.id}\`,
    youtubeUrl: \`https://www.youtube.com/watch?v=\${entry.id}\`,
    playlistIndex: index,
    themeId,
  };
}`,
    `function cleanArtistName(value = '') {
  return String(value)
    .replace(/\\s*-\\s*Topic\\s*$/i, '')
    .trim();
}

function bestThumbnail(entry) {
  if (Array.isArray(entry?.thumbnails) && entry.thumbnails.length > 0) {
    const sorted = [...entry.thumbnails].sort(
      (a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0)
    );
    if (sorted[0]?.url) return sorted[0].url;
  }
  return entry?.thumbnail || \`https://i.ytimg.com/vi/\${entry.id}/hqdefault.jpg\`;
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
    streamUrl: \`/stream/youtube/\${entry.id}\`,
    youtubeUrl: \`https://www.youtube.com/watch?v=\${entry.id}\`,
    playlistIndex: index,
    themeId,
  };
}`,
  ],
]);

console.log("\nPatch complete.");
