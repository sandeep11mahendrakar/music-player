import React from 'react';

export default function ThemeBackground({ theme }) {
  return (
    <div className="theme-background">
      <img src={theme.background} alt={`${theme.name} background`} />
    </div>
  );
}
