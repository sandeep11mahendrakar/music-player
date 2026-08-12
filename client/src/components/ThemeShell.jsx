import React from 'react';
import ThemeBackground from './ThemeBackground';
import ThemeHero from './ThemeHero';
import ThemeText from './ThemeText';
import TopStatusBar from './TopStatusBar';
import LyricsPanel from './LyricsPanel';
import MusicPlayer from './MusicPlayer';
import StartEngineButton from './StartEngineButton';

export default function ThemeShell({
  theme,
  themes,
  now,
  currentSong,
  rotation,
  listenerCount,
  status,
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  playerOffset,
  onPlayerSeek,
  songDuration,
  songThumbnail,
  lyrics,
  lyricsCurrentTime,
  onThemeOpen,
  themeOpen,
  onThemeSelect,
  activeThemeId,
  themeTransition,
}) {
  return (
    <div className={`theme-shell ${themeTransition ? 'theme-transitioning' : ''}`} data-theme={theme.id}>
      <ThemeBackground theme={theme} />

      <div className="theme-overlay" style={{ background: theme.overlay }} />

      <div className="app-shell">
        <TopStatusBar
          now={now}
          listenerCount={listenerCount}
          sourceLabel="YouTube"
          theme={theme}
          themes={themes}
          onThemeOpen={onThemeOpen}
          themeOpen={themeOpen}
          onThemeSelect={onThemeSelect}
          activeThemeId={activeThemeId}
        />

        <main className="theme-main-grid">
          <section className="theme-copy-column">
            <ThemeText theme={theme} />
            <LyricsPanel lyrics={lyrics} theme={theme} currentTime={lyricsCurrentTime} />
          </section>

          <section className="theme-hero-column">
            <ThemeHero theme={theme} isPlaying={isPlaying} />
          </section>
        </main>

        <footer className="theme-player-zone">
          <MusicPlayer
            theme={theme}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onPrevious={onPrevious}
            onNext={onNext}
            playerOffset={playerOffset}
            onPlayerSeek={onPlayerSeek}
            songDuration={songDuration}
            songThumbnail={songThumbnail}
          />
          <StartEngineButton onClick={onTogglePlay} theme={theme} isPlaying={isPlaying} />
          <div className="theme-status-copy">{status}</div>
        </footer>
      </div>
    </div>
  );
}
