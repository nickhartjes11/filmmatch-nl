'use client';

import { useState } from 'react';
import type { Movie } from './types';

interface CinematicHeroProps {
  movie: Movie | null;
  onFindMovie?: () => void;
  onToggleWatchlist?: (movie: Movie) => void;
  onToggleWatched?: (movie: Movie) => void;
  isWatchlisted?: boolean;
  isWatched?: boolean;
}

export default function CinematicHero({
  movie,
  onFindMovie,
  onToggleWatchlist,
  onToggleWatched,
  isWatchlisted = false,
  isWatched = false,
}: CinematicHeroProps) {
  const [showTrailer, setShowTrailer] = useState(false);

  if (!movie) return null;

  const backdrop = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : movie.poster_path
    ? `https://image.tmdb.org/t/p/original${movie.poster_path}`
    : '/fallback-backdrop.jpg';

  const score = movie.rating || (movie as any).imdb_rating || '8.5';
  const year = movie.release_date?.slice(0, 4) || '';

  return (
    <div className="relative w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,180,255,0.2)] bg-[#070c18] min-h-[500px] flex items-center mb-8">
      {/* 1. Backdrop met cinematische gradient overlays & blauwe sfeergloed */}
      <div className="absolute inset-0 z-0">
        <img
          src={backdrop}
          alt={movie.title}
          className="w-full h-full object-cover object-[center_25%] opacity-60 filter contrast-110 brightness-90 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060913] via-[#060913]/80 to-transparent w-full md:w-3/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-transparent to-transparent" />
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />
      </div>

      {/* 2. Content grid */}
      <div className="relative z-10 w-full px-6 sm:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Linker kolom: Hero call-to-action */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold tracking-widest uppercase">
            FilmMatch.nl
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-white tracking-tight leading-[1.1]">
            De juiste film <br />
            voor <span className="text-cyan-400">vanavond</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300/90 max-w-lg leading-relaxed">
            Persoonlijke filmtips, je watchlist, bioscooptijden en samen kijken met vrienden — allemaal op één plek.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onFindMovie}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-neutral-950 font-bold text-sm transition-all shadow-[0_0_25px_rgba(56,189,248,0.35)] hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Vind jouw film</span>
            </button>
          </div>
        </div>

        {/* Rechter kolom: Spotlight Card met frosted glass */}
        <div className="lg:col-span-5 flex flex-col items-end">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900/40 border border-white/10 p-5 backdrop-blur-xl shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                Film van de week
              </span>
              {movie.match_percentage && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ⚡ {movie.match_percentage}% match
                </span>
              )}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
                {movie.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  ★ {score}
                </span>
                {year && <span className="text-xs text-slate-400">{year}</span>}
                {movie.genres?.slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-300/80 line-clamp-3 leading-relaxed">
              {movie.overview || 'Geen samenvatting beschikbaar.'}
            </p>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => onToggleWatchlist?.(movie)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  isWatchlisted
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {isWatchlisted ? '✓ Watchlist' : '+ Watchlist'}
              </button>
              <button
                type="button"
                onClick={() => onToggleWatched?.(movie)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  isWatched
                    ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                ★ Cijfer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}