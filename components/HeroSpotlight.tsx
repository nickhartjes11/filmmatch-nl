'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import MovieRatingControl from './MovieRatingControl';
import StreamingLogo from './StreamingLogo';
import type { Movie } from './types';
import { getMatchColorBand } from '../lib/recommendations/matchScore';

interface HeroSpotlightProps {
  movie: Movie;
  featuredMovies: Movie[];
  activeFeaturedIndex: number;
  rotationPaused: boolean;
  isSearch: boolean;
  spotlightLabel: string;
  isWatchlisted: boolean;
  isWatched: boolean;
  userRating?: number;
  onSelectPerson: (name: string, department: 'Acting' | 'Directing') => void;
  onSelectFeatured: (index: number) => void;
  onToggleRotation: () => void;
  onEditRating: (movie: Movie) => void;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched: (movie: Movie) => void;
}

function RatingBadge({ rating, source }: { rating: string; source?: Movie['rating_source'] }) {
  const isImdb = source === 'IMDb';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/80 px-2 py-0.5 border border-white/10 backdrop-blur-md shadow-md">
      <span
        className={`rounded px-1 text-[9px] font-black leading-3 tracking-wider ${
          isImdb ? 'bg-[#f5c518] text-black font-extrabold' : 'bg-white/10 text-neutral-300'
        }`}
      >
        {isImdb ? 'IMDb' : source || 'Score'}
      </span>
      <span className="text-xs font-black text-amber-400 tabular-nums">{rating}</span>
    </span>
  );
}

export default function HeroSpotlight({
  movie,
  featuredMovies,
  activeFeaturedIndex,
  rotationPaused,
  isSearch,
  spotlightLabel,
  isWatchlisted,
  isWatched,
  userRating,
  onSelectPerson,
  onSelectFeatured,
  onToggleRotation,
  onEditRating,
  onToggleWatchlist,
  onToggleWatched,
}: HeroSpotlightProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [trailerError, setTrailerError] = useState<string | null>(null);

  const matchBand = getMatchColorBand(movie.match_percentage || 0);
  const matchColor =
    matchBand === 'strong'
      ? 'text-emerald-400'
      : matchBand === 'medium'
        ? 'text-amber-400'
        : 'text-rose-400';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTrailerModalOpen(false);
    };
    if (trailerModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trailerModalOpen]);

  const handleOpenTrailer = async () => {
    setTrailerError(null);
    setTrailerModalOpen(true);
    setTrailerLoading(true);

    try {
      const res = await fetch(`/api/movies?trailerMovieId=${movie.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.youtubeKey) {
          setTrailerKey(data.youtubeKey);
        } else {
          setTrailerError('Geen officiële trailer beschikbaar voor deze film.');
        }
      } else {
        setTrailerError('Kon trailer niet inladen.');
      }
    } catch {
      setTrailerError('Er is een fout opgetreden bij het laden van de trailer.');
    } finally {
      setTrailerLoading(false);
    }
  };

  return (
    <>
      <section
        key={movie.id}
        className="dashboard-feature relative overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-950 p-4 md:p-6 shadow-2xl transition duration-500"
      >
        {movie.backdrop_path ? (
          <div className="absolute inset-0 pointer-events-none">
            <Image
              src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
              alt=""
              fill
              unoptimized
              sizes="100vw"
              className="cinema-backdrop object-cover opacity-20 scale-105 transition duration-700 blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/90 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/40" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/90 to-neutral-950 pointer-events-none" />
        )}

        <div className="relative z-10 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="group relative aspect-[2/3] w-28 sm:w-36 md:w-44 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-neutral-900 shadow-xl">
            {movie.poster_path ? (
              <Image
                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                alt={movie.title}
                fill
                unoptimized
                className="object-cover transition duration-300 group-hover:scale-105"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-600 font-bold">
                Geen poster
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                {spotlightLabel}
              </span>

              {!isSearch && featuredMovies.length > 1 && (
                <div
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 backdrop-blur-md"
                  role="group"
                  aria-label="Uitgelichte films"
                >
                  {featuredMovies.map((featuredMovie, index) => (
                    <button
                      key={featuredMovie.id}
                      onClick={() => onSelectFeatured(index)}
                      title={`Toon ${featuredMovie.title}`}
                      aria-label={`Toon aanbeveling ${index + 1}: ${featuredMovie.title}`}
                      aria-pressed={index === activeFeaturedIndex}
                      className={`h-1.5 rounded-full transition-all ${
                        index === activeFeaturedIndex
                          ? 'w-4 bg-rose-500'
                          : 'w-1.5 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={onToggleRotation}
                    title={rotationPaused ? 'Hervat wisselen' : 'Pauzeer wisselen'}
                    className="ml-1 text-[10px] text-neutral-400 hover:text-white transition"
                  >
                    {rotationPaused ? '▶' : '⏸'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                {movie.title}
              </h2>

              <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-neutral-300">
                <span>{movie.release_date?.split('-')[0] || 'Jaar onbekend'}</span>
                {movie.runtime && (
                  <>
                    <span className="text-neutral-500">&bull;</span>
                    <span>{movie.runtime}</span>
                  </>
                )}
                {movie.genres?.length ? (
                  <>
                    <span className="text-neutral-500">&bull;</span>
                    <span>{movie.genres.slice(0, 3).join(', ')}</span>
                  </>
                ) : null}
                {movie.rating ? (
                  <>
                    <span className="text-neutral-500">&bull;</span>
                    <RatingBadge rating={movie.rating} source={movie.rating_source} />
                  </>
                ) : (
                  <>
                    <span className="text-neutral-500">&bull;</span>
                    <span className="text-[11px] font-semibold text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                      IMDb: N/A
                    </span>
                  </>
                )}
              </div>

              {/* REGIE: Weer terug in de spotlight */}
              {movie.director && (
                <p className="mt-1.5 text-xs text-neutral-300 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                  <span className="text-neutral-400 font-semibold">Regisseur:</span>
                  <button
                    type="button"
                    onClick={() => onSelectPerson(movie.director!, 'Directing')}
                    className="font-bold text-white underline decoration-white/40 underline-offset-2 hover:text-rose-300 hover:decoration-rose-300 transition"
                  >
                    {movie.director}
                  </button>
                </p>
              )}

              {/* ACTEURS: Weer terug in de spotlight */}
              {movie.cast && movie.cast.length > 0 && (
                <div className="mt-0.5 text-xs text-neutral-300 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                  <span className="text-neutral-400 font-semibold">Acteurs:</span>
                  <div className="flex flex-wrap gap-1">
                    {movie.cast.slice(0, 4).map((actor, idx) => (
                      <span key={actor} className="inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => onSelectPerson(actor, 'Acting')}
                          className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:text-rose-300 hover:decoration-rose-300 transition"
                        >
                          {actor}
                        </button>
                        {idx < Math.min(movie.cast!.length, 4) - 1 && (
                          <span className="text-neutral-500 ml-1">,</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="max-w-3xl text-xs text-neutral-300 line-clamp-2 leading-relaxed pt-0.5">
              {movie.overview || 'Geen omschrijving beschikbaar.'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-white/[0.08]">
              <div className="mr-2 flex items-center gap-1.5">
                <span className={`text-xl font-black ${matchColor}`}>
                  {movie.match_percentage || 85}%
                </span>
                <span className="text-[9px] font-bold uppercase leading-tight text-neutral-400 text-left">
                  Film<br />match
                </span>
              </div>

              {movie.providers && movie.providers.length > 0 && (
                <div className="flex items-center gap-1 mr-2">
                  {movie.providers.slice(0, 3).map((provider) => (
                    <span
                      key={provider.provider_id}
                      title={`Beschikbaar op ${provider.provider_name}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/40 overflow-hidden shadow"
                    >
                      <StreamingLogo
                        name={provider.provider_name}
                        logoPath={provider.logo_path}
                        className="h-5 w-5 rounded"
                      />
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleOpenTrailer}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-600 to-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:from-rose-500 hover:to-rose-600 active:scale-95"
              >
                <span>▶</span>
                <span>Trailer</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleWatchlist(movie)}
                aria-pressed={isWatchlisted}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-md ${
                  isWatchlisted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
              >
                {isWatchlisted ? '✓ Op watchlist' : '+ Watchlist'}
              </button>

              <button
                type="button"
                onClick={() => onToggleWatched(movie)}
                aria-pressed={isWatched}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-md ${
                  isWatched
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                }`}
              >
                {isWatched ? '✓ Gezien' : 'Gezien'}
              </button>

              {(isWatched || userRating !== undefined) && (
                <MovieRatingControl rating={userRating} onEdit={() => onEditRating(movie)} />
              )}
            </div>
          </div>
        </div>
      </section>

      {trailerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Trailer voor ${movie.title}`}
          onClick={() => setTrailerModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 md:p-10 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-rose-500">▶</span>
                <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
                  {movie.title} &bull; Trailer
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTrailerModalOpen(false)}
                title="Sluiten (Esc)"
                aria-label="Sluit trailer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-neutral-300 transition hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {trailerLoading ? (
                <div className="flex flex-col items-center gap-2 text-neutral-400">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
                  <span className="text-xs">Trailer opzoeken...</span>
                </div>
              ) : trailerError ? (
                <div className="p-6 text-center text-xs text-neutral-400">
                  <p className="font-bold text-white mb-1">Geen trailer gevonden</p>
                  <p>{trailerError}</p>
                </div>
              ) : trailerKey ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
                  title={`${movie.title} officiële trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}