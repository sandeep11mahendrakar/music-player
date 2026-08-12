import React from 'react';

function formatTime(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');

  return `${mins}:${secs}`;
}

export default function MusicPlayer({
  theme,
  currentSong,
  isPlaying,
  onTogglePlay,
  onPrevious,
  onNext,
  playerOffset,
  onPlayerSeek,
  songDuration,
  songThumbnail,
}) {
  const duration = Number(songDuration) || 0;
  const currentTime = Math.min(Number(playerOffset) || 0, duration || 0);

  return (
    <div
      className="music-player-card"
      style={{ backdropFilter: `blur(${theme.playerBlur})` }}
    >
      <div className="player-artwork">
        {songThumbnail ? (
          <img
            src={songThumbnail}
            alt={currentSong?.title || 'Album artwork'}
          />
        ) : (
          <div className="player-artwork-fallback">Artwork</div>
        )}
      </div>

      <div className="player-details">
        <div className="player-title">
          {currentSong?.title || 'Loading...'}
        </div>

        <div className="player-subtitle">
          {currentSong?.artist || 'Unknown Artist'}
        </div>

        <div className="player-progress-group">
          <span>{formatTime(currentTime)}</span>

          <input
            className="player-progress"
            type="range"
            min="0"
            max={duration || 1}
            value={duration ? currentTime : 0}
            onChange={(event) => onPlayerSeek(Number(event.target.value))}
            aria-label="Song progress"
          />

          <span>{formatTime(duration)}</span>
        </div>

        <div className="player-controls">
          <button
            type="button"
            onClick={onPrevious}
            className="player-control-button"
            aria-label="Previous song"
          >
            ◀
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="player-control-button player-control-play"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="player-control-button"
            aria-label="Next song"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
