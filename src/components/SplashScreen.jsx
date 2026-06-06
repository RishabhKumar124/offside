import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2200);
    const doneTimer = setTimeout(() => onDone(), 2800);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-600 ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{
        backgroundImage: `url(https://media.base44.com/images/public/6a2349f5b560428513bb1b6d/ca68282d8_Players.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Logo */}
      <div className="relative z-10 text-center">
        <h1 className="font-display text-8xl md:text-9xl tracking-widest text-white drop-shadow-2xl">
          OFF<span className="text-primary">SIDE</span>
        </h1>
        <p className="text-white/70 text-sm tracking-[0.3em] uppercase mt-2 font-body">
          Find your next game
        </p>
      </div>
    </div>
  );
}