import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .trim();
}

function parseTimestamp(value) {
  const match = String(value).match(
    /(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/
  );

  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const milliseconds = Number(
    String(match[4] || '0').padEnd(3, '0')
  );

  return (
    hours * 3600 +
    minutes * 60 +
    seconds +
    milliseconds / 1000
  );
}

function parseVtt(text) {
  const blocks = String(text)
    .replace(/\r/g, '')
    .split(/\n{2,}/);

  const lines = [];

  for (const block of blocks) {
    const blockLines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const timingIndex = blockLines.findIndex((line) =>
      line.includes('-->')
    );

    if (timingIndex === -1) continue;

    const timing = blockLines[timingIndex];
    const [rawStart, rawEnd] = timing
      .split('-->')
      .map((value) => value.trim().split(/\s+/)[0]);

    const lyricText = cleanText(
      blockLines
        .slice(timingIndex + 1)
        .join(' ')
    );

    if (!lyricText) continue;

    lines.push({
      text: lyricText,
      startTime: parseTimestamp(rawStart),
      endTime: parseTimestamp(rawEnd),
    });
  }

  return lines;
}

function parseSrt(text) {
  const blocks = String(text)
    .replace(/\r/g, '')
    .split(/\n{2,}/);

  const lines = [];

  for (const block of blocks) {
    const blockLines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const timingIndex = blockLines.findIndex((line) =>
      line.includes('-->')
    );

    if (timingIndex === -1) continue;

    const [rawStart, rawEnd] = blockLines[
      timingIndex
    ]
      .split('-->')
      .map((value) => value.trim());

    const lyricText = cleanText(
      blockLines
        .slice(timingIndex + 1)
        .join(' ')
    );

    if (!lyricText) continue;

    lines.push({
      text: lyricText,
      startTime: parseTimestamp(rawStart),
      endTime: parseTimestamp(rawEnd),
    });
  }

  return lines;
}

function subtitleCandidates(info) {
  const groups = [
    info?.subtitles || {},
    info?.automatic_captions || {},
  ];

  const preferredLanguages = [
    'en',
    'en-US',
    'en-GB',
    'hi',
    'hi-IN',
  ];

  const candidates = [];

  for (const group of groups) {
    for (const language of preferredLanguages) {
      const formats = group?.[language] || [];

      for (const format of formats) {
        if (!format?.url) continue;

        candidates.push({
          url: format.url,
          ext: format.ext || '',
          language,
        });
      }
    }

    for (const [language, formats] of Object.entries(group)) {
      for (const format of formats || []) {
        if (!format?.url) continue;

        candidates.push({
          url: format.url,
          ext: format.ext || '',
          language,
        });
      }
    }
  }

  return candidates;
}

export async function fetchYoutubeLyrics(videoId) {
  if (!videoId) {
    throw new Error('YouTube video ID is required.');
  }

  const youtubeUrl =
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  const { stdout } = await execFileAsync(
    'yt-dlp',
    [
      '--dump-single-json',
      '--skip-download',
      '--no-warnings',
      youtubeUrl,
    ],
    {
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  const info = JSON.parse(stdout);
  const candidates = subtitleCandidates(info);

  if (candidates.length === 0) {
    return {
      available: false,
      videoId,
      language: null,
      source: null,
      plainText: '',
      lines: [],
    };
  }

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url);

      if (!response.ok) continue;

      const text = await response.text();

      if (!text.trim()) continue;

      const lines =
        candidate.ext === 'srt'
          ? parseSrt(text)
          : parseVtt(text);

      if (lines.length === 0) continue;

      const plainText = lines
        .map((line) => line.text)
        .filter(Boolean)
        .join('\n');

      return {
        available: true,
        videoId,
        language: candidate.language,
        source: 'youtube-subtitles',
        plainText,
        lines,
      };
    } catch {
      continue;
    }
  }

  return {
    available: false,
    videoId,
    language: null,
    source: null,
    plainText: '',
    lines: [],
  };
}
