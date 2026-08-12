import { useEffect, useMemo, useRef, useState } from 'react';
import { themes, defaultThemeId } from './themes/registry';
import ThemeShell from './components/ThemeShell';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const USE_YOUTUBE_STREAM = import.meta.env.VITE_USE_YOUTUBE_STREAM === 'true';

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function App() {
  const audioRef = useRef(null);
  const [rotation, setRotation] = useState(null);
  const [song, setSong] = useState(null);
  const [offset, setOffset] = useState(0);
  const [listenerCount, setListenerCount] = useState(0);
  const [status, setStatus] = useState('Loading live radio...');
  const [isPlaying, setIsPlaying] = useState(false);
  const [youtubePlaylist, setYoutubePlaylist] = useState(null);
  const [selectedYoutubeIndex, setSelectedYoutubeIndex] = useState(null);
  const [manualYoutubeSelection, setManualYoutubeSelection] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState(defaultThemeId);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeTransition, setThemeTransition] = useState(false);
  const [lyrics, setLyrics] = useState(null);

  const theme = useMemo(() => themes.find((item) => item.id === activeThemeId) || themes[0], [activeThemeId]);
  const currentSong = USE_YOUTUBE_STREAM ? youtubePlaylist?.entries?.[selectedYoutubeIndex] || song : song;
  const songDuration = currentSong?.duration || 0;
  const songThumbnail = currentSong?.thumbnail || '';
  useEffect(() => {
    let cancelled = false;

    async function fetchLyrics() {
      if (!USE_YOUTUBE_STREAM || !currentSong?.id) {
        setLyrics(null);
        return;
      }

      setLyrics(null);

      try {
        const response = await fetch(
          `${BACKEND_URL}/api/youtube-lyrics/${encodeURIComponent(currentSong.id)}`
        );

        if (!response.ok) {
          throw new Error(
            `Lyrics request failed: ${response.status}`
          );
        }

        const data = await response.json();

        if (cancelled) return;

        if (data?.available && data?.lyrics?.plainText) {
          setLyrics(data.lyrics);
        } else {
          setLyrics(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn(
            'Lyrics unavailable:',
            error
          );
          setLyrics(null);
        }
      }
    }

    fetchLyrics();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id]);
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setOffset(audio.currentTime || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (!USE_YOUTUBE_STREAM || !youtubePlaylist || youtubePlaylist.entries.length === 0) {
      setSelectedYoutubeIndex(null);
      setManualYoutubeSelection(false);
      return;
    }

    if (manualYoutubeSelection && selectedYoutubeIndex !== null) {
      return;
    }

    setSelectedYoutubeIndex(0);
  }, [youtubePlaylist]);

  useEffect(() => {
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

    const src = `${BACKEND_URL}/stream/youtube/${currentSong.id}`;
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
  }, [currentSong?.id]);

  async function fetchYoutubePlaylist(themeId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-playlist?themeId=${themeId || activeThemeId}`);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`YouTube playlist fetch failed: ${msg}`);
      }
      const data = await res.json();
      if (!data?.entries || data.entries.length === 0) {
        throw new Error('YouTube playlist contains no valid entries.');
      }
      setYoutubePlaylist(data);
      setStatus('YouTube playlist loaded.');
    } catch (error) {
      console.error('Unable to fetch YouTube playlist:', error);
      setStatus('Unable to load YouTube playlist.');
      setYoutubePlaylist(null);
    }
  }

  async function selectYoutubeByIndex(index) {
    if (!youtubePlaylist || youtubePlaylist.entries.length === 0) return;
    const normalized = ((index % youtubePlaylist.entries.length) + youtubePlaylist.entries.length) % youtubePlaylist.entries.length;
    setSelectedYoutubeIndex(normalized);
    setManualYoutubeSelection(true);
    const selected = youtubePlaylist.entries[normalized];

    const audio = audioRef.current;
    if (audio) {
      const src = `${BACKEND_URL}/stream/youtube/${selected.id}`;
      if (audio.src !== src) {
        audio.src = src;
        audio.load();
      }
      audio.currentTime = 0;
      try {
        await audio.play();
        setIsPlaying(true);
        setStatus('Playing selected YouTube track.');
      } catch (playError) {
        console.warn('Audio playback blocked or unavailable:', playError);
        setIsPlaying(false);
        setStatus('Live stream ready; click Play to start audio.');
      }
    }
  }

  function handlePrevious() {
    if (selectedYoutubeIndex === null) return;
    selectYoutubeByIndex(selectedYoutubeIndex - 1);
  }

  function handleNext() {
    if (selectedYoutubeIndex === null) return;
    selectYoutubeByIndex(selectedYoutubeIndex + 1);
  }

  async function fetchNowPlaying() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/now-playing`);
      const data = await res.json();
      setRotation(data.rotation);
      setSong(data.song);
      setOffset(data.offset);
      setListenerCount(data.listenerCount ?? 0);
      setStatus('Live radio data loaded.');

      const audio = audioRef.current;
      const isYoutubeNow = USE_YOUTUBE_STREAM && data.mode === 'youtube';

      if (isYoutubeNow) {
        if (data.index !== undefined && data.index !== null) {
          setSelectedYoutubeIndex(data.index);
        } else if (data.id && youtubePlaylist?.entries) {
          const playlistIndex = youtubePlaylist.entries.findIndex((entry) => entry.id === data.id);
          if (playlistIndex !== -1) {
            setSelectedYoutubeIndex(playlistIndex);
          }
        }
      }

      if (audio && data.song) {
        const src = isYoutubeNow
          ? data.streamUrl || `${BACKEND_URL}/stream/youtube/${data.id}`
          : data.song.filename
            ? `${BACKEND_URL}/audio/${data.song.filename}`
            : '';

        if (src && audio.src !== src) {
          audio.src = src;
          audio.load();
        }

        if (!isYoutubeNow && !manualYoutubeSelection) {
          audio.currentTime = Math.max(0, data.offset);
        }

        try {
          await audio.play();
          setIsPlaying(true);
          setStatus('Live radio is playing now.');
        } catch (playError) {
          console.warn('Audio playback blocked or unavailable:', playError);
          setIsPlaying(false);
          setStatus('Live stream ready; click Play to start audio.');
        }
      }
    } catch (error) {
      console.error(error);
      setStatus('Unable to fetch live stream data. Is backend running?');
    }
  }

  async function togglePlay() {
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
  }

  function handlePlayerSeek(value) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setOffset(value);
  }

  function handleThemeOpen() {
    setThemeOpen((state) => !state);
  }

  function handleThemeSelect(themeId) {
    setThemeTransition(true);
    setThemeOpen(false);
    setTimeout(() => setActiveThemeId(themeId), 120);
    setTimeout(() => setThemeTransition(false), 520);
  }

  return (
    <div className="app-shell">
      <ThemeShell
        theme={theme}
        themes={themes}
        now={now}
        currentSong={currentSong}
        rotation={rotation}
        listenerCount={listenerCount}
        status={status}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onPrevious={handlePrevious}
        onNext={handleNext}
        playerOffset={offset}
        onPlayerSeek={handlePlayerSeek}
        songDuration={songDuration}
        songThumbnail={songThumbnail}
        lyrics={lyrics}
        lyricsCurrentTime={offset}
        onThemeOpen={handleThemeOpen}
        themeOpen={themeOpen}
        onThemeSelect={handleThemeSelect}
        activeThemeId={activeThemeId}
        themeTransition={themeTransition}
      />
      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}


