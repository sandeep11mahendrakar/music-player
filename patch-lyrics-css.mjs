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

patchFile("./client/src/index.css", [
  [
    "base .lyrics-panel: fixed position, no bg/border, light blur",
    `.lyrics-panel {
  position: absolute;

  /* upper-right / centered vertically in upper area */
  top: clamp(115px, 17vh, 175px);
  right: clamp(40px, 7vw, 110px);

  width: min(28vw, 400px);
  height: clamp(145px, 20vh, 215px);

  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.65rem;

  padding: 1rem 1.1rem;

  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;

  /* 70% opaque / 30% transparent */
  background: rgba(8, 12, 18, 0.70);

  backdrop-filter: blur(10px);

  overflow: hidden;
  pointer-events: auto;
}`,
    `.lyrics-panel {
  position: fixed;
  z-index: 30;

  /* upper-right, screen-relative */
  top: clamp(115px, 17vh, 175px);
  right: clamp(40px, 7vw, 110px);

  width: min(28vw, 400px);
  height: clamp(145px, 20vh, 215px);

  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.65rem;

  padding: 1rem 1.1rem;

  border: none;
  border-radius: 18px;

  background: transparent;

  backdrop-filter: blur(4px);

  overflow: hidden;
  pointer-events: auto;
}

.lyrics-line {
  opacity: 0.5;
  transition: opacity 0.3s ease, color 0.3s ease;
}

.lyrics-line-active {
  opacity: 1;
  color: rgba(255, 255, 255, 0.98);
  font-weight: 600;
}`,
  ],
  [
    "responsive .lyrics-panel: fixed position, no bg/border, light blur",
    `  .lyrics-panel {
  position: absolute;
  top: clamp(120px, 18vh, 180px);
  right: clamp(34px, 7vw, 110px);

  width: min(30vw, 430px);
  height: clamp(150px, 22vh, 230px);

  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.65rem;

  padding: 1rem 1.1rem;

  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 20px;

  /* ~70% opaque */
  background: rgba(8, 12, 18, 0.70);

  backdrop-filter: blur(12px);

  overflow: hidden;
  pointer-events: auto;
}`,
    `  .lyrics-panel {
  position: fixed;
  z-index: 30;
  top: clamp(120px, 18vh, 180px);
  right: clamp(34px, 7vw, 110px);

  width: min(30vw, 430px);
  height: clamp(150px, 22vh, 230px);

  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.65rem;

  padding: 1rem 1.1rem;

  border: none;
  border-radius: 20px;

  background: transparent;

  backdrop-filter: blur(4px);

  overflow: hidden;
  pointer-events: auto;
}`,
  ],
]);

console.log("\nPatch complete.");
