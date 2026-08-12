import React from 'react';

export default function ThemeSwitcher({ open, onToggle, options, activeThemeId, onSelect }) {
  return (
    <div className={`theme-switcher ${open ? 'open' : ''}`}>
      <button className="theme-switcher-toggle" onClick={onToggle}>
        Themes
      </button>
      {open && (
        <div className="theme-switcher-menu">
          {options.map((option) => (
            <button
              key={option.id}
              className={`theme-switcher-item ${activeThemeId === option.id ? 'active' : ''}`}
              onClick={() => onSelect(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
