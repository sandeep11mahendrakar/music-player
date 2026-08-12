import React from 'react';

export default function ThemeText({ theme }) {
  return (
    <div className="theme-text-block">
      <div className="theme-headline">
        <span className="theme-headline-line">{theme.customTitle}</span>
        <span className="theme-headline-line theme-headline-accent">{theme.customSubtext}</span>
      </div>
      <p className="theme-tagline">{theme.tagline}</p>
      <div className="theme-description">{theme.description}</div>
    </div>
  );
}
