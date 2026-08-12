import fs from "node:fs";

function patchFile(path, replacements) {
  const raw = fs.readFileSync(path, "utf8");
  const usesCRLF = raw.includes("\r\n");
  let src = raw.replace(/\r\n/g, "\n"); // normalize to LF for matching
  let changed = 0;

  for (const [label, oldStrRaw, newStrRaw] of replacements) {
    const oldStr = oldStrRaw.replace(/\r\n/g, "\n");
    const newStr = newStrRaw.replace(/\r\n/g, "\n");

    if (!src.includes(oldStr)) {
      console.error(`SKIP (not found, check manually): [${path}] ${label}`);
      continue;
    }
    const count = src.split(oldStr).length - 1;
    if (count > 1) {
      console.error(`SKIP (matched ${count} times, not unique): [${path}] ${label}`);
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

// =========================================================
// server/index.js — fix Content-Type/format mismatch
// =========================================================
patchFile("./server/index.js", [
  [
    "stream Content-Type + yt-dlp format",
    `  const videoUrl = getYoutubeVideoUrl(videoId);
  res.setHeader('Content-Type', 'audio/mp4');
  res.setHeader('Cache-Control', 'no-cache');

  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '-o', '-',
    '--no-playlist',
    videoUrl
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });`,
    `  const videoUrl = getYoutubeVideoUrl(videoId);
  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Cache-Control', 'no-cache');

  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=webm]/bestaudio',
    '-o', '-',
    '--no-playlist',
    videoUrl
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });`,
  ],
]);

// =========================================================
// client/src/App.jsx — fix togglePlay, theme switch, playlist fetch
// =========================================================
patchFile("./client/src/App.jsx", [
  [
    "togglePlay: await play() and report failure",
    `  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }`,
    `  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
        setStatus('Playing.');
      } catch (playError) {
        console.warn('Playback failed:', playError);
        setIsPlaying(false);
        setStatus('Unable to play this stream.');
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }`,
  ],
  [
    "fetchYoutubePlaylist: accept themeId",
    `  async function fetchYoutubePlaylist() {
    try {
      const res = await fetch(\`\${BACKEND_URL}/api/youtube-playlist\`);
      if (!res.ok) {`,
    `  async function fetchYoutubePlaylist(themeId) {
    try {
      const res = await fetch(\`\${BACKEND_URL}/api/youtube-playlist?themeId=\${themeId || activeThemeId}\`);
      if (!res.ok) {`,
  ],
  [
    "mount effect: drop bare fetchYoutubePlaylist call (moved to theme-switch effect)",
    `  useEffect(() => {
    fetchNowPlaying();
    if (USE_YOUTUBE_STREAM) {
      fetchYoutubePlaylist();
    }
    const interval = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(interval);
  }, []);`,
    `  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!USE_YOUTUBE_STREAM) return;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    }
    setIsPlaying(false);
    setManualYoutubeSelection(false);
    setSelectedYoutubeIndex(null);
    fetchYoutubePlaylist(activeThemeId);
  }, [activeThemeId]);

  useEffect(() => {
    if (!USE_YOUTUBE_STREAM) return;
    const audio = audioRef.current;
    if (!audio || !currentSong?.id) return;

    const src = \`\${BACKEND_URL}/stream/youtube/\${currentSong.id}\`;
    if (audio.src !== src) {
      const wasPlaying = !audio.paused;
      audio.src = src;
      audio.load();
      if (wasPlaying) {
        audio.play().catch((err) => {
          console.warn('Auto-continue playback failed:', err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentSong?.id]);`,
  ],
]);

patchFile("./server/index.js", [
  [
    "populate youtubeEntryMap from preloaded theme playlists",
    `preloadAllThemePlaylists();`,
    `preloadAllThemePlaylists();

for (const playlist of Object.values(getAllThemePlaylists())) {
  for (const entry of playlist.entries) {
    youtubeEntryMap.set(entry.id, entry);
  }
}`,
  ],
]);

console.log("\nPatch complete.");
