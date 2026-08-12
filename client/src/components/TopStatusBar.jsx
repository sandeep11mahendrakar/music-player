import React from 'react';

export default function TopStatusBar({ now, listenerCount, sourceLabel, theme, themes, onThemeOpen, themeOpen, onThemeSelect, activeThemeId }) {
  return (
    <div className="top-status-bar">
      <div className="top-status-group top-left">
        <div className="top-status-time">{now}</div>
        <button className="theme-switcher-button" onClick={onThemeOpen}>
          {theme.name}
        </button>
      </div>

      <div className="top-status-group top-center">
        <span className="status-badge">●</span>
        <span>{listenerCount} ON ROAD</span>
      </div>

      <div className="top-status-group top-right">
        <span className="source-label">{sourceLabel}</span>
      </div>

      {themeOpen && (
        <div className="theme-picker-panel">
          {themes.map((option) => (
            <button
              key={option.id}
              className={`theme-picker-item ${activeThemeId === option.id ? 'active' : ''}`}
              onClick={() => onThemeSelect(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
