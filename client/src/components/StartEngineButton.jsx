import React from 'react';

export default function StartEngineButton({ onClick, theme, isPlaying }) {
  return (
    <button className="start-engine-button" style={{ background: theme.accent }} onClick={onClick}>
      {isPlaying ? 'PAUSE ENGINE' : 'START ENGINE'}
    </button>
  );
}
