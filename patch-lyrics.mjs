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

// =========================================================
// App.jsx — keep lines[] not just plainText, pass currentTime
// =========================================================
patchFile("./client/src/App.jsx", [
  [
    "fetchLyrics: store full lyrics object (plainText + timed lines)",
    `        if (data?.available && data?.lyrics?.plainText) {
          setLyrics(data.lyrics.plainText);
        } else {
          setLyrics(null);
        }`,
    `        if (data?.available && data?.lyrics?.plainText) {
          setLyrics(data.lyrics);
        } else {
          setLyrics(null);
        }`,
  ],
  [
    "pass playerOffset as lyricsCurrentTime to ThemeShell",
    `        songThumbnail={songThumbnail}
        lyrics={lyrics}`,
    `        songThumbnail={songThumbnail}
        lyrics={lyrics}
        lyricsCurrentTime={offset}`,
  ],
]);

// =========================================================
// ThemeShell.jsx — forward lyricsCurrentTime to LyricsPanel
// =========================================================
patchFile("./client/src/components/ThemeShell.jsx", [
  [
    "accept lyricsCurrentTime prop",
    `  lyrics,
  onThemeOpen,`,
    `  lyrics,
  lyricsCurrentTime,
  onThemeOpen,`,
  ],
  [
    "pass currentTime into LyricsPanel",
    `            <LyricsPanel lyrics={lyrics} theme={theme} />`,
    `            <LyricsPanel lyrics={lyrics} theme={theme} currentTime={lyricsCurrentTime} />`,
  ],
]);

// =========================================================
// LyricsPanel.jsx — rewrite entirely: highlight + auto-scroll to active line
// =========================================================
const newLyricsPanel = `import React, { useEffect, useRef } from 'react';

export default function LyricsPanel({ lyrics, currentTime = 0 }) {
  const contentRef = useRef(null);
  const activeLineRef = useRef(null);

  const lines = lyrics?.lines || [];
  const plainText = lyrics?.plainText || '';

  const activeIndex = lines.length
    ? lines.findIndex(
        (line, index) =>
          currentTime >= line.startTime &&
          (index === lines.length - 1 || currentTime < lines[index + 1].startTime)
      )
    : -1;

  useEffect(() => {
    if (!activeLineRef.current || !contentRef.current) return;
    activeLineRef.current.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }, [activeIndex]);

  return (
    <div className="lyrics-panel">
      <div className="lyrics-header">Lyrics</div>

      {lines.length > 0 ? (
        <div ref={contentRef} className="lyrics-content">
          {lines.map((line, index) => (
            <div
              key={index}
              ref={index === activeIndex ? activeLineRef : null}
              className={
                index === activeIndex
                  ? 'lyrics-line lyrics-line-active'
                  : 'lyrics-line'
              }
            >
              {line.text}
            </div>
          ))}
        </div>
      ) : plainText ? (
        <div ref={contentRef} className="lyrics-content">
          {plainText}
        </div>
      ) : (
        <div className="lyrics-empty">
          Lyrics unavailable
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync("./client/src/components/LyricsPanel.jsx", newLyricsPanel, "utf8");
console.log("OK: [./client/src/components/LyricsPanel.jsx] full rewrite (timed highlight + auto-scroll)");

console.log("\nPatch complete. CSS not yet patched — waiting on responsive block content.");
