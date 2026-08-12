import React from 'react';

export default function ThemeHero({ theme, isPlaying }) {
  return (
    <div className="theme-hero-wrapper">
      <div className={`theme-hero-card ${isPlaying ? 'theme-hero-active' : ''}`}>
        <img src={theme.hero} alt={`${theme.name} hero`} className="theme-hero-image" />
      </div>
    </div>
  );
}
