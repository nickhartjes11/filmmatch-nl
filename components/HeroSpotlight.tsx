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
  allMovies,
  watchlistIds,
  watchedIds,
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
  onFindMovie,
}: HeroSpotlightProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [trailerLoading, setTrailerLoading] = useState(false);

  const activeMovie = movie || allMovies?.[0] || null;

  useEffect(() => {
    if (!activeMovie?.id) {
      setTrailerKey(null);
      return;
    }

    let isMounted = true;
    setTrailerLoading(true);

    fetch(`/api/movies?trailerMovieId=${activeMovie.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted) {
          setTrailerKey(data?.youtubeKey || null);
          setTrailerLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTrailerKey(null);
          setTrailerLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeMovie?.id]);

  if (!activeMovie) return null;

  const isWatchlisted = watchlistIds.includes(activeMovie.id);
  const isWatched = Boolean(watchedIds?.includes(activeMovie.id));

  const backdropUrl = activeMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${activeMovie.backdrop_path}`
    : activeMovie.poster_path
    ? `https://image.tmdb.org/t/p/original${activeMovie.poster_path}`
    : '/fallback-backdrop.jpg';

  const imdbScore = activeMovie.rating || (activeMovie as any).imdb_rating || '8.5';
  const releaseYear = activeMovie.release_date?.slice(0, 4) || '';

  return (
    <section className="relative w-full rounded-3xl overflow-hidden min-h-[480px] lg:min-h-[540px] flex flex-col justify-between p-6 sm:p-10 lg:p-12 border border-white/10 shadow-2xl bg-neutral-950">
      {/* Achtergrondafbeelding met cinematische gradient overlays */}
      <div className="absolute inset-0 z-0">
        <img
          src={backdropUrl}
          alt={activeMovie.title}
          className="w-full h-full object-cover object-center filter brightness-[0.40] contrast-125 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent w-full lg:w-3/4" />
      </div>

      {/* Bovenste rij: Hero titel & Actieknop */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Linker kolom: Belofte / CTA */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold tracking-widest uppercase">
            FilmMatch.nl
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            De juiste film <br />
            voor <span className="text-cyan-400">vanavond</span>
          </h1>

          <p className="text-sm sm:text-base text-neutral-300 max-w-xl leading-relaxed">
            Persoonlijke filmtips, je watchlist, bioscooptijden en samen kijken met vrienden — allemaal op één plek.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onFindMovie}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-sm transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Vind jouw film</span>
            </button>
          </div>
        </div>

        {/* Rechter kolom: Spotlight Film Kaart */}
        <div className="lg:col-span-5 flex justify-end">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900/85 border border-white/15 p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">
                Film in de spotlight
              </span>
              {activeMovie.match_percentage && (
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ⚡ {activeMovie.match_percentage}% match
                </span>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-black text-white tracking-wide uppercase">
                {activeMovie.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2.5 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-md">
                  ★ {imdbScore}
                </span>
                {releaseYear && <span className="text-xs text-neutral-400">{releaseYear}</span>}
                {activeMovie.runtime && <span className="text-xs text-neutral-400">· {activeMovie.runtime}</span>}
                {activeMovie.genres?.slice(0, 2).map((genre) => (
                  <span key={genre} className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-neutral-300">
                    {genre}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-xs text-neutral-300 line-clamp-3 leading-relaxed">
              {activeMovie.overview || 'Geen samenvatting beschikbaar.'}
            </p>

            {/* Regisseur & Cast (Klikbaar) */}
            <div className="space-y-1.5 pt-1 text-xs text-neutral-400 border-t border-white/10">
              {activeMovie.director && (
                <p>
                  <span className="text-neutral-500">Regie:</span>{' '}
                  <button
                    type="button"
                    onClick={() => onSelectPerson && onSelectPerson(activeMovie.director!)}
                    className="text-cyan-300 hover:underline font-medium"
                  >
                    {activeMovie.director}
                  </button>
                </p>
              )}
              {activeMovie.cast && activeMovie.cast.length > 0 && (
                <p className="truncate">
                  <span className="text-neutral-500">Cast:</span>{' '}
                  {activeMovie.cast.slice(0, 3).map((actor, idx) => (
                    <span key={actor}>
                      {idx > 0 && ', '}
                      <button
                        type="button"
                        onClick={() => onSelectPerson && onSelectPerson(actor)}
                        className="text-neutral-300 hover:text-cyan-300 hover:underline"
                      >
                        {actor}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </div>

            {/* Actieknoppen */}
            <div className="flex items-center gap-2 pt-2">
              {trailerKey ? (
                <button
                  type="button"
                  onClick={() => setShowTrailerModal(true)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-rose-500" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Trailer
                </button>
              ) : (
                <button
                  type="button"
                  disabled={trailerLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-neutral-500 text-xs font-semibold"
                >
                  {trailerLoading ? 'Trailer zoekt...' : 'Geen trailer'}
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleWatchlist(activeMovie)}
                className={`py-2.5 px-3.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                  isWatchlisted
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill={isWatchlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {isWatchlisted ? 'Bewaard' : 'Watchlist'}
              </button>

              <button
                type="button"
                onClick={() => onToggleWatched(activeMovie)}
                className={`py-2.5 px-3.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                  isWatched
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                }`}
              >
                ★ {isWatched ? 'Beoordeeld' : 'Cijfer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Modal Overlay */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-neutral-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Trailer: {activeMovie.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowTrailerModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                title={`Trailer ${activeMovie.title}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}