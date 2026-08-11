'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export default function Home() {
  const [listenerCount, setListenerCount] = useState(0);
  const [nowPlaying, setNowPlaying] = useState(null);

  useEffect(() => {
    // Fetch initial now-playing data
    fetch(`${BACKEND_URL}/api/now-playing`)
      .then(res => res.json())
      .then(data => setNowPlaying(data));

    // Connect to socket for real-time listener count
    const socket = io(BACKEND_URL);
    
    socket.on('listener_count', (count) => {
      setListenerCount(count);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-yellow-400">
          DELUXE SALOON
        </h1>
        <p className="text-gray-400">
          24/7 Synced 90s Hindi Radio
        </p>
        
        {nowPlaying && (
          <div className="bg-white/10 rounded-lg p-6 max-w-md">
            <p className="text-sm text-gray-400">STATUS</p>
            <p className="text-green-400">{nowPlaying.message || 'Loading...'}</p>
          </div>
        )}

        <div className="bg-white/10 rounded-lg p-4 inline-block">
          <span className="text-yellow-400 font-bold">{listenerCount}</span>
          <span className="text-gray-400 ml-2">listening now</span>
        </div>

        <p className="text-xs text-gray-500 mt-8">
          Phase 1 Complete — Server scaffold with sync mechanism documented
        </p>
      </div>
    </main>
  );
}
