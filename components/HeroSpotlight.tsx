'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { Movie } from './types';
import { calculateMatchScore, getMatchColorBand, type MatchPreferences } from '../lib/recommendations/matchScore';

export interface EditorialTip {
  tmdbId: number;
  reasonTitle: string;
  reason: string;
}

export const MONTHLY_TIPS: EditorialTip[] = [
  {
    tmdbId: 671, // Harry Potter and the Philosopher's Stone
    reasonTitle: 'Terug naar Hogwarts',
    reason: 'Omdat de gloednieuwe HBO-serie eraan komt: hét perfecte moment om te herontdekken waar de magie ooit begon.',
  },
  {
    tmdbId: 299534, // Avengers: Endgame
    reasonTitle: 'Opwarmen voor Doomsday',
    reason: 'Met Avengers: Doomsday in aantocht in de bioscoop is dit het ideale moment voor de ultieme Marvel-climax.',
  },
  {
    tmdbId: 438631, // Dune (Part One)
    reasonTitle: 'Het begin van een meesterwerk',
    reason: 'Fenomenale cinematografie en meeslepende worldbuilding van Denis Villeneuve die je gezien moet hebben.',
  },
  {
    tmdbId: 693134, // Dune: Part Two
    reasonTitle: 'Moderne sci-fi mijlpaal',
    reason: 'Visueel spektakel van de bovenste plank — een adembenemend vervolg dat alle verwachtingen overtrof.',
  },
  {
    tmdbId: 157336, // Interstellar
    reasonTitle: 'Tijdloze klassieker',
    reason: 'Christopher Nolans audiovisuele meesterwerk over liefde, zwarte gaten en de tijd blijft onovertroffen.',
  },
];

interface HeroSpotlightProps {
  movie?: Movie | null;
  allMovies?: Movie[];
  watchlistIds?: number[];
  watchedIds?: number[];
  matchPreferences?: MatchPreferences;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched: (movie: Movie) => void;
  onSelectMovie?: (movie: Movie | undefined) => void;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
}

export default function HeroSpotlight({
  movie: activeMovieProp,
  allMovies = [],
  watchlistIds = [],
  watchedIds = [],
  matchPreferences,
  onToggleWatchlist,
  onToggleWatched,
  onSelectMovie,
  onSelectPerson,
}: HeroSpotlightProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [editorialMovies, setEditorialMovies] = useState<Record<number, Movie>>({});
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [userPausedTips, setUserPausedTips] = useState(false);

  useEffect(() => {
    const tipIds = MONTHLY_TIPS.map((tip) => tip.tmdbId);
    let isMounted = true;

    fetch(`/api/movies?metadataIds=${tipIds.join(',')}`)
      .then((res) => (res.ok ? res.json() : { movies: [] }))
      .then((data) => {
        if (!isMounted) return;
        const map: Record<number, Movie> = {};
        (data.movies || []).forEach((m: Movie) => {
          map[m.id] = m;
        });
        setEditorialMovies(map);
      })
      .catch((err) => console.warn('Kon tips niet laden:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeMovieProp || userPausedTips || MONTHLY_TIPS.length <= 1) return;

    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % MONTHLY_TIPS.length);
    }, 10_000);

    return () => clearInterval(interval);
  }, [activeMovieProp, userPausedTips]);

  const currentTipConfig = MONTHLY_TIPS[tipIndex % MONTHLY_TIPS.length];
  const activeTipMovie = currentTipConfig ? editorialMovies[currentTipConfig.tmdbId] : undefined;

  const isSelectedByUser = Boolean(activeMovieProp);
  const displayedMovie: Movie | undefined = activeMovieProp || activeTipMovie || allMovies[0];

  useEffect(() => {
    if (!displayedMovie?.id) {
      setTrailerKey(null);
      return;
    }

    let isMounted = true;
    setLoadingTrailer(true);

    fetch(`/api/movies?trailerMovieId=${displayedMovie.id}`)
      .then((res) => (res.ok ? res.json() : { youtubeKey: null }))
      .then((data) => {
        if (!isMounted) return;
        setTrailerKey(data.youtubeKey || null);
      })
      .catch(() => {
        if (!isMounted) return;
        setTrailerKey(null);
      })
      .finally(() => {
        if (isMounted) setLoadingTrailer(false);
      });

    return () => {
      isMounted = false;
    };
  }, [displayedMovie?.id]);

  if (!displayedMovie) return null;

  const isWatchlisted = Boolean(watchlistIds?.includes(displayedMovie.id));
  const isWatched = Boolean(watchedIds?.includes(displayedMovie.id));

  const matchScore = matchPreferences
    ? calculateMatchScore(
        {
          id: displayedMovie.id,
          genres: displayedMovie.genres || [],
          director: displayedMovie.director,
          cast: displayedMovie.cast,
          rating: displayedMovie.rating,
        },
        matchPreferences
      )
    : displayedMovie.match_percentage || 88;

  const matchBand = getMatchColorBand(matchScore);

  const handlePrevTip = () => {
    setUserPausedTips(true);
    setTipIndex((current) => (current === 0 ? MONTHLY_TIPS.length - 1 : current - 1));
  };

  const handleNextTip = () => {
    setUserPausedTips(true);
    setTipIndex((current) => (current + 1) % MONTHLY_TIPS.length);
  };

  const backdropSrc = displayedMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${displayedMovie.backdrop_path}`
    : displayedMovie.poster_path
      ? `https://image.tmdb.org/t/p/original${displayedMovie.poster_path}`
      : null;

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-6 md:p-8 shadow-2xl">
        {/* Subtiele achtergrond overlay */}
        {backdropSrc && (
          <div className="pointer-events-none absolute inset-0 -z-0 opacity-20">
            <Image
              src={backdropSrc}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover object-center filter blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-slate-950/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-transparent" />
          </div>
        )}

        {/* Layout: Poster links, content rechts */}
        <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 md:gap-8">
          {/* Filmposter LINKS */}
          {displayedMovie.poster_path && (
            <div className="shrink-0 w-36 sm:w-44 md:w-52 mx-auto md:mx-0">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
                <Image
                  src={`https://image.tmdb.org/t/p/w500${displayedMovie.poster_path}`}
                  alt={displayedMovie.title}
                  fill
                  priority
                  unoptimized
                  className="object-cover"
                />
              </div>
            </div>
          )}

          {/* Informatie en acties RECHTS */}
          <div className="flex-1 space-y-3.5 min-w-0">
            {/* Header tags & Navigatie */}
            <div className="flex flex-wrap items-center gap-2.5">
              {!isSelectedByUser ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md">
                    <span>⭐</span> Tip van de maand
                  </span>

                  <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-white/10 backdrop-blur-md">
                    <button
                      onClick={handlePrevTip}
                      aria-label="Vorige tip"
                      className="text-xs text-neutral-400 hover:text-white px-1 font-bold"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-semibold text-neutral-300">
                      {tipIndex + 1} / {MONTHLY_TIPS.length}
                    </span>
                    <button
                      onClick={handleNextTip}
                      aria-label="Volgende tip"
                      className="text-xs text-neutral-400 hover:text-white px-1 font-bold"
                    >
                      ›
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300 backdrop-blur-md">
                    <span>🎬</span> Geselecteerde film
                  </span>
                  {onSelectMovie && (
                    <button
                      onClick={() => onSelectMovie(undefined)}
                      className="text-[11px] text-neutral-400 hover:text-white underline underline-offset-2 ml-1"
                    >
                      Terug naar tips van de maand
                    </button>
                  )}
                </>
              )}

              {displayedMovie.release_date && (
                <span className="text-xs text-neutral-400">
                  {displayedMovie.release_date.split('-')[0]}
                </span>
              )}
              {displayedMovie.genres?.[0] && (
                <span className="text-xs text-neutral-400">&bull; {displayedMovie.genres[0]}</span>
              )}
              {displayedMovie.runtime && (
                <span className="text-xs text-neutral-400">&bull; {displayedMovie.runtime}</span>
              )}
            </div>

            {/* Titel */}
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
              {displayedMovie.title}
            </h1>

            {/* Redactietip: Geen fel geel vak, maar een stijlvolle geïntegreerde quote-stijl */}
            {!isSelectedByUser && activeTipMovie && activeTipMovie.id === displayedMovie.id && currentTipConfig?.reason && (
              <div className="border-l-2 border-amber-400/70 pl-3.5 py-0.5">
                <p className="text-xs text-neutral-200 leading-relaxed">
                  <span className="font-semibold text-amber-300">
                    {currentTipConfig.reasonTitle}:
                  </span>{' '}
                  {currentTipConfig.reason}
                </p>
              </div>
            )}

            {/* Synopsis */}
            <p className="line-clamp-3 text-xs leading-relaxed text-neutral-300 sm:text-sm">
              {displayedMovie.overview || 'Geen beschrijving beschikbaar.'}
            </p>

            {/* Regisseur & Cast (weer klikbaar!) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-0.5">
              {displayedMovie.director && (
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">Regie:</span>
                  <button
                    type="button"
                    onClick={() => onSelectPerson?.(displayedMovie.director!, 'Directing')}
                    className="font-medium text-white hover:text-rose-300 underline underline-offset-2 transition"
                  >
                    {displayedMovie.director}
                  </button>
                </div>
              )}

              {displayedMovie.cast && displayedMovie.cast.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-neutral-400">Cast:</span>
                  {displayedMovie.cast.slice(0, 4).map((actor, idx) => (
                    <span key={actor} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => onSelectPerson?.(actor, 'Acting')}
                        className="font-medium text-white hover:text-rose-300 underline underline-offset-2 transition"
                      >
                        {actor}
                      </button>
                      {idx < Math.min(displayedMovie.cast!.length, 4) - 1 && (
                        <span className="text-neutral-400 ml-1">,</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Match score, Rating & Streaming providers */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-black backdrop-blur-md ${
                  matchBand === 'strong'
                    ? 'bg-emerald-400 text-slate-950'
                    : matchBand === 'medium'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-rose-400 text-slate-950'
                }`}
              >
                {matchScore}% FilmMatch
              </span>

              {displayedMovie.rating && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white border border-white/10 backdrop-blur-md">
                  <span className="rounded bg-[#f5c518] px-1 text-[9px] font-black text-black">
                    {displayedMovie.rating_source || 'IMDb'}
                  </span>
                  <span>{displayedMovie.rating}</span>
                </span>
              )}

              {displayedMovie.providers && displayedMovie.providers.length > 0 && (
                <div className="flex items-center gap-1.5 pl-1">
                  {displayedMovie.providers.slice(0, 4).map((provider) => (
                    <StreamingLogo
                      key={provider.provider_id}
                      name={provider.provider_name}
                      logoPath={provider.logo_path}
                      className="h-7 w-7 rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Actieknoppen */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => trailerKey && setShowTrailerModal(true)}
                disabled={!trailerKey || loadingTrailer}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>▶</span>
                <span>{loadingTrailer ? 'Trailer laden…' : 'Bekijk Trailer'}</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(displayedMovie)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition border ${
                  isWatchlisted
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}
              >
                <span>{isWatchlisted ? '✓' : '+'}</span>
                <span>{isWatchlisted ? 'In Watchlist' : 'Watchlist'}</span>
              </button>

              <button
                onClick={() => onToggleWatched(displayedMovie)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition border ${
                  isWatched
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}
              >
                <span>✓</span>
                <span>{isWatched ? 'Gezien' : 'Markeer als gezien'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trailer Modal */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-bold text-white">{displayedMovie.title} — Officiële Trailer</h3>
              <button
                onClick={() => setShowTrailerModal(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white"
                aria-label="Sluit trailer"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                title={`${displayedMovie.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}