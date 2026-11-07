'use client';

import { useState, useEffect } from 'react';
import type { Movie } from './types';
import type { MatchPreferences } from '@/lib/recommendations/matchScore';

interface HeroSpotlightProps {
  movie: Movie | null;
  allMovies?: Movie[];
  watchlistIds: number[];
  watchedIds?: number[];
  matchPreferences?: MatchPreferences;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched: (movie: Movie) => void;
  onSelectPerson?: (name: string, ...args: any[]) => void;
  onSelectMovie?: (movie: any) => void;
  onFindMovie?: () => void;
}

export default function HeroSpotlight({
  movie,
  allMovies = [],
  watchlistIds = [],
  watchedIds = [],
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
  onFindMovie,
}: HeroSpotlightProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  const activeMovie = movie || allMovies[0] || null;

  useEffect(() => {
    if (!activeMovie?.id) return;
    let isMounted = true;
    fetch(`/api/movies?trailerMovieId=${activeMovie.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted) setTrailerKey(data?.youtubeKey || null);
      })
      .catch(() => {
        if (isMounted) setTrailerKey(null);
      });
    return () => {
      isMounted = false;
    };
  }, [activeMovie?.id]);

  if (!activeMovie) return null;

  const isWatchlisted = Boolean(watchlistIds?.includes(activeMovie.id));
  const isWatched = Boolean(watchedIds?.includes(activeMovie.id));
  const backdropUrl = activeMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${activeMovie.backdrop_path}`
    : '/fallback-backdrop.jpg';

  const imdbScore = activeMovie.rating || '8,6';

  return (
    <div className="relative w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,180,255,0.15)] bg-[#070c18] min-h-[520px] flex items-center">
      {/* Achtergrond met film-backdrop en donkere vignettering */}
      <div className="absolute inset-0 z-0">
        <img
          src={backdropUrl}
          alt={activeMovie.title}
          className="w-full h-full object-cover object-[center_20%] opacity-55 scale-105 filter contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060913] via-[#060913]/85 to-transparent w-full md:w-3/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-transparent to-transparent" />
        {/* Subtiele blauwe sfeergloed links */}
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="relative z-10 w-full px-6 sm:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Linkerzijde: Titels & Actieknoppen */}
        <div className="lg:col-span-7 space-y-6">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">
            FILMMATCH.NL
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-white tracking-tight leading-[1.08]">
            De juiste film <br />
            voor <span className="text-sky-400">vanavond</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300/90 max-w-lg leading-relaxed font-normal">
            Persoonlijke filmtips, je watchlist, bioscooptijden en samen kijken met vrienden — allemaal op één plek.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onFindMovie}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-[0_0_25px_rgba(56,189,248,0.4)] active:scale-95"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Vind jouw film</span>
            </button>
          </div>
        </div>

        {/* Rechterzijde: Film van de week Spotlight Card */}
        <div className="lg:col-span-5 flex flex-col items-end">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900/40 border border-white/10 p-5 backdrop-blur-xl shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-sky-300 uppercase">
                Film van de week
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-1.5 rounded-full bg-sky-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase font-serif">
                {activeMovie.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                  ★ {imdbScore}
                </span>
                {activeMovie.genres?.slice(0, 3).map((g) => (
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
              {activeMovie.overview || 'Geen samenvatting beschikbaar.'}
            </p>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              {trailerKey && (
                <button
                  type="button"
                  onClick={() => setShowTrailerModal(true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-sky-400" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Trailer
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggleWatchlist(activeMovie)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  isWatchlisted
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {isWatchlisted ? '✓ Watchlist' : '+ Watchlist'}
              </button>
              <button
                type="button"
                onClick={() => onToggleWatched(activeMovie)}
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

      {/* Trailer Modal */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="text-sm font-bold text-white uppercase">{activeMovie.title}</span>
              <button
                type="button"
                onClick={() => setShowTrailerModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                title={`Trailer ${activeMovie.title}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}