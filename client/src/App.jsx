import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [isPlaying, setIsPlaying] = useState(true);
  const [youtubePlaylist, setYoutubePlaylist] = useState(null);
  const [youtubeEntry, setYoutubeEntry] = useState(null);
  const [selectedYoutubeIndex, setSelectedYoutubeIndex] = useState(null);
  const [manualYoutubeSelection, setManualYoutubeSelection] = useState(false);

  const sceneImage = useMemo(() => {
    if (!rotation?.sceneImage) return '';
    return rotation.sceneImage.startsWith('http') ? rotation.sceneImage : `${BACKEND_URL}${rotation.sceneImage}`;
  }, [rotation]);

  useEffect(() => {
    if (!USE_YOUTUBE_STREAM || !youtubePlaylist || youtubePlaylist.entries.length === 0) {
      setYoutubeEntry(null);
      setSelectedYoutubeIndex(null);
      setManualYoutubeSelection(false);
      return;
    }

    if (manualYoutubeSelection && selectedYoutubeIndex !== null) {
      setYoutubeEntry(youtubePlaylist.entries[selectedYoutubeIndex] || null);
      return;
    }

    setSelectedYoutubeIndex(0);
    setYoutubeEntry(youtubePlaylist.entries[0]);
  }, [youtubePlaylist]);

  useEffect(() => {
    fetchNowPlaying();
    if (USE_YOUTUBE_STREAM) {
      fetchYoutubePlaylist();
    }
    const interval = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchYoutubePlaylist() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-playlist`);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`YouTube playlist fetch failed: ${msg}`);
      }
      const data = await res.json();
      if (!data?.entries || data.entries.length === 0) {
        throw new Error('YouTube playlist contains no valid entries.');
      }
      setYoutubePlaylist(data);
      setSelectedYoutubeIndex(0);
      setYoutubeEntry(data.entries[0]);
      setStatus('YouTube playlist loaded. Click Play to start audio.');
    } catch (error) {
      console.error('Unable to fetch YouTube playlist:', error);
      setStatus('Unable to load YouTube playlist.');
      setYoutubePlaylist(null);
      setYoutubeEntry(null);
    }
  }

  async function selectYoutubeByIndex(index) {
    if (!youtubePlaylist || youtubePlaylist.entries.length === 0) return;
    const normalized = ((index % youtubePlaylist.entries.length) + youtubePlaylist.entries.length) % youtubePlaylist.entries.length;
    setSelectedYoutubeIndex(normalized);
    setManualYoutubeSelection(true);
    const selected = youtubePlaylist.entries[normalized];
    setYoutubeEntry(selected);

    const audio = audioRef.current;
    if (audio) {
      const src = `${BACKEND_URL}/stream/youtube/${selected.id}`;
      if (audio.src !== src) {
        audio.src = src;
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

  async function handlePlaylistClick(videoId) {
    if (!youtubePlaylist) return;
    const index = youtubePlaylist.entries.findIndex((entry) => entry.id === videoId);
    if (index === -1) return;
    await selectYoutubeByIndex(index);
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
      setStatus('Live radio data loaded. Click Play to start audio.');

      if (USE_YOUTUBE_STREAM && data.mode === 'youtube') {
        if (data.index !== undefined && data.index !== null) {
          setSelectedYoutubeIndex(data.index);
        } else if (data.id && youtubePlaylist?.entries) {
          const playlistIndex = youtubePlaylist.entries.findIndex((entry) => entry.id === data.id);
          if (playlistIndex !== -1) {
            setSelectedYoutubeIndex(playlistIndex);
          }
        }
      }

      const audio = audioRef.current;
      const isYoutubeNow = USE_YOUTUBE_STREAM && data.mode === 'youtube';
      if (audio && data.song) {
        const src = isYoutubeNow
          ? data.streamUrl || `${BACKEND_URL}/stream/youtube/${data.id}`
          : data.song.filename
            ? `${BACKEND_URL}/audio/${data.song.filename}`
            : '';

        if (src) {
          if (audio.src !== src) {
            audio.src = src;
          }
          if (!isYoutubeNow || !manualYoutubeSelection) {
            audio.currentTime = Math.max(0, data.offset);
          }
        }

        if (isYoutubeNow && !manualYoutubeSelection) {
          const playlistIndex = youtubePlaylist?.entries?.findIndex((entry) => entry.id === data.id);
          if (playlistIndex !== undefined && playlistIndex !== -1) {
            setSelectedYoutubeIndex(playlistIndex);
            setYoutubeEntry(youtubePlaylist.entries[playlistIndex]);
          }
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

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Deluxe Saloon</div>
          <h1>24/7 Synced Hindi Radio</h1>
        </div>
      </header>

      <main className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Now Live</p>
          <h2>{rotation?.displayName || 'Loading...'}</h2>
          <p>A synced 24/7 broadcast of Hindi classics. All listeners hear the same track position.</p>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Current track</div>
              <div className="stat-value">{song?.title || '...'}</div>
              <div className="stat-meta">{song?.artist || '...'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Listener count</div>
              <div className="stat-value">{listenerCount}</div>
              <div className="stat-meta">currently tuned in</div>
            </div>
          </div>

          <div className="hero-actions">
            <button onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button onClick={handlePrevious} disabled={!USE_YOUTUBE_STREAM || selectedYoutubeIndex === null}>Previous</button>
            <button onClick={handleNext} disabled={!USE_YOUTUBE_STREAM || selectedYoutubeIndex === null}>Next</button>
            <span>Live offset: {formatTime(offset)} / {song ? formatTime(song.duration) : '00:00'}</span>
          </div>
          {USE_YOUTUBE_STREAM && youtubeEntry && (
            <div className="hero-meta">
              <div>YouTube stream: {youtubeEntry.title}</div>
              <div>Artist: {youtubeEntry.artist}</div>
              <div>Video ID: {youtubeEntry.id}</div>
            </div>
          )}
          {USE_YOUTUBE_STREAM && youtubePlaylist && (
            <div className="playlist-list">
              <h3>YouTube Playlist</h3>
              <ul>
                {youtubePlaylist.entries.map((entry, index) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => handlePlaylistClick(entry.id)}>
                      {entry.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="status-text">{status}</p>
        </div>

        <div className="hero-image-wrapper">
          {sceneImage ? <img src={sceneImage} alt={rotation?.displayName || 'Scene'} /> : <div className="hero-image-placeholder">Scene image</div>}
        </div>
      </main>

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
