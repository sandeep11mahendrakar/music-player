import React, { useEffect, useRef } from 'react';

export default function LyricsPanel({ lyrics, currentTime = 0 }) {
  const contentRef = useRef(null);
  const activeLineRef = useRef(null);

  const lines = lyrics?.lines || [];
  const plainText = lyrics?.plainText || '';

  const activeIndex = lines.length
    ? lines.findIndex(
        (line, index) =>
          currentTime >= line.startTime &&
          (index === lines.length - 1 || currentTime < lines[index + 1].startTime)
      )
    : -1;

  useEffect(() => {
    if (!activeLineRef.current || !contentRef.current) return;
    activeLineRef.current.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }, [activeIndex]);

  return (
    <div className="lyrics-panel">
      <div className="lyrics-header">Lyrics</div>

      {lines.length > 0 ? (
        <div ref={contentRef} className="lyrics-content">
          {lines.map((line, index) => (
            <div
              key={index}
              ref={index === activeIndex ? activeLineRef : null}
              className={
                index === activeIndex
                  ? 'lyrics-line lyrics-line-active'
                  : 'lyrics-line'
              }
            >
              {line.text}
            </div>
          ))}
        </div>
      ) : plainText ? (
        <div ref={contentRef} className="lyrics-content">
          {plainText}
        </div>
      ) : (
        <div className="lyrics-empty">
          Lyrics unavailable
        </div>
      )}
    </div>
  );
}
