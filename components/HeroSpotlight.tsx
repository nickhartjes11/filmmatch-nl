'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { Movie } from './types';
import { calculateMatchScore, getMatchColorBand, type MatchPreferences } from '../lib/recommendations/matchScore';

export interface EditorialTip {
  tmdbId: number;
  reason: string;
}

export const MONTHLY_TIPS: EditorialTip[] = [
  {
    tmdbId: 671, // Harry Potter and the Philosopher's Stone
    reason: 'Met de nieuwe HBO-serie in aantocht is dit een mooi moment om terug te gaan naar Hogwarts.',
  },
  {
    tmdbId: 299534, // Avengers: Endgame
    reason: 'Herbeleef de ultieme Marvel-climax voordat je aan het volgende hoofdstuk begint.',
  },
  {
    tmdbId: 438631, // Dune (Part One)
    reason: 'Begin bij het eerste deel voor Villeneuves indrukwekkende wereld en cinematografie.',
  },
  {
    tmdbId: 693134, // Dune: Part Two
    reason: 'Een visueel verbluffend vervolg dat Arrakis nog grootser maakt.',
  },
  {
    tmdbId: 157336, // Interstellar
    reason: 'Een tijdloos sci-fi-epos over liefde, zwarte gaten en tijd.',
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
  const trailerButtonRef = useRef<HTMLButtonElement>(null);
  const trailerDialogRef = useRef<HTMLDivElement>(null);
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
    if (activeMovieProp || userPausedTips || showTrailerModal || MONTHLY_TIPS.length <= 1) return;

    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % MONTHLY_TIPS.length);
    }, 10_000);

    return () => clearInterval(interval);
  }, [activeMovieProp, userPausedTips, showTrailerModal]);

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
    setTrailerKey(null);
    setShowTrailerModal(false);
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

  useEffect(() => {
    if (!showTrailerModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    trailerDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowTrailerModal(false);
      if (event.key !== 'Tab') return;
      const elements = trailerDialogRef.current?.querySelectorAll<HTMLElement>('button, iframe');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      (previousFocus || trailerButtonRef.current)?.focus();
    };
  }, [showTrailerModal]);

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
    : displayedMovie.match_percentage ?? 88;

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
      <section aria-label="Film in de spotlight" className="fm-hero relative isolate overflow-hidden rounded-3xl border border-blue-200/15 bg-[#081426] p-6 text-white shadow-2xl shadow-black/30 sm:p-7 lg:p-10">
        {backdropSrc && (
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
            <Image
              src={backdropSrc}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover object-[65%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081426] via-[#081426]/30 to-[#081426]/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#081426] via-[#081426]/90 to-[#081426]/10" />
          </div>
        )}

        <div className="relative z-10 flex min-h-[440px] flex-col items-start gap-7 lg:min-h-[400px] lg:flex-row-reverse lg:items-center lg:gap-10">
          {/* Filmposter LINKS */}
          {displayedMovie.poster_path && (
            <div className="hidden w-48 shrink-0 rotate-3 lg:block xl:w-56">
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
          <div className="min-w-0 flex-1 space-y-4">
            {/* Compacte bediening voor de maandtips */}
            {!isSelectedByUser && (
              <div className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.08] py-1 pl-3 pr-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                  <span aria-hidden="true">⭐</span>
                  Tip van de maand
                </span>
                <span className="mx-1 h-3 w-px bg-amber-200/25" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handlePrevTip}
                  aria-label="Vorige tip"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-amber-100/75 transition hover:bg-white/10 hover:text-white"
                >
                  ‹
                </button>
                <span className="min-w-8 text-center text-[10px] font-semibold tabular-nums text-amber-100/80" aria-live="polite">
                  {tipIndex + 1} / {MONTHLY_TIPS.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextTip}
                  aria-label="Volgende tip"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-amber-100/75 transition hover:bg-white/10 hover:text-white"
                >
                  ›
                </button>
              </div>
            )}

            {/* Titel van de film */}
            <h1 className="max-w-3xl text-[2.125rem] font-black leading-[1.05] tracking-tight text-white sm:text-[2.75rem] xl:text-[3.375rem]">
              {displayedMovie.title}
            </h1>

            {/* Filminformatie */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
              {displayedMovie.release_date && (
                <span>{displayedMovie.release_date.split('-')[0]}</span>
              )}
              {displayedMovie.genres?.[0] && (
                <span>{displayedMovie.release_date ? '• ' : ''}{displayedMovie.genres[0]}</span>
              )}
              {displayedMovie.runtime && (
                <span>{displayedMovie.release_date || displayedMovie.genres?.[0] ? '• ' : ''}{displayedMovie.runtime}</span>
              )}
            </div>

            {/* Korte reden voor de maandtip */}
            {!isSelectedByUser && activeTipMovie && activeTipMovie.id === displayedMovie.id && currentTipConfig?.reason && (
              <div className="max-w-2xl rounded-xl border border-blue-200/15 bg-blue-300/[0.06] px-4 py-3">
                <p className="text-xs leading-relaxed text-neutral-300">
                  <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Waarom nu?
                  </span>
                  {currentTipConfig.reason}
                </p>
              </div>
            )}

            {/* Synopsis */}
            <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              {displayedMovie.overview || 'Geen beschrijving beschikbaar.'}
            </p>

            {/* Regisseur & Cast (klikbaar) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-0.5">
              {displayedMovie.director && (
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">Regie:</span>
                  <button
                    type="button"
                    onClick={() => onSelectPerson?.(displayedMovie.director!, 'Directing')}
                    className="font-medium text-white hover:text-sky-300 underline underline-offset-2 transition"
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
                        className="font-medium text-white hover:text-sky-300 underline underline-offset-2 transition"
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

            {/* Match score, Rating & Streamingdiensten */}
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

            {isSelectedByUser && onSelectMovie && (
              <button type="button" onClick={() => onSelectMovie(undefined)} className="text-xs font-semibold text-sky-200 hover:text-white">← Terug naar de maandtips</button>
            )}

            {/* Knoppen */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => trailerKey && setShowTrailerModal(true)}
                disabled={!trailerKey || loadingTrailer}
                ref={trailerButtonRef} type="button" className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>▶</span>
                <span>{loadingTrailer ? 'Trailer laden…' : 'Bekijk Trailer'}</span>
              </button>

              <button
                type="button" aria-pressed={isWatchlisted}
                onClick={() => onToggleWatchlist(displayedMovie)}
                className={`inline-flex items-center gap-1.5 rounded-xl min-h-12 px-4 py-3 text-sm font-bold transition border ${
                  isWatchlisted
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                }`}
              >
                <span>{isWatchlisted ? '✓' : '+'}</span>
                <span>{isWatchlisted ? 'In Watchlist' : 'Watchlist'}</span>
              </button>

              <button
                type="button" aria-pressed={isWatched}
                onClick={() => onToggleWatched(displayedMovie)}
                className={`inline-flex items-center gap-1.5 rounded-xl min-h-12 px-4 py-3 text-sm font-bold transition border ${
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

      <style jsx>{`
        .fm-hero :global(button:focus-visible) { outline: 2px solid #7dd3fc; outline-offset: 4px; }
        .fm-hero :global(button) { touch-action: manipulation; }
      `}</style>

      {/* Trailer Modal */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={(event) => { if (event.target === event.currentTarget) setShowTrailerModal(false); }}>
          <div ref={trailerDialogRef} role="dialog" aria-modal="true" aria-labelledby="fm-trailer-title" className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 id="fm-trailer-title" className="text-sm font-bold text-white">{displayedMovie.title} — Officiële Trailer</h3>
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