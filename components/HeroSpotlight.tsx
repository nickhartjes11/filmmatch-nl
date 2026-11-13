'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { FriendActivityItem, Movie } from './types';
import { calculateMatchScore, getMatchColorBand, type MatchPreferences } from '../lib/recommendations/matchScore';

// Standard theatrical runtimes for the curated monthly tips, used only
// when the movie metadata does not include a usable runtime.
const MONTHLY_RUNTIME_MINUTES: Record<number, number> = {
  671: 152,
  299534: 181,
  438631: 155,
  693134: 167,
  771: 103,
};

function formatFilmRuntime(runtime: unknown, movieId: number): string | null {
  let minutes: number | undefined;
  if (typeof runtime === 'number' && Number.isFinite(runtime) && runtime > 0) {
    minutes = runtime;
  } else if (typeof runtime === 'string') {
    const value = runtime.trim();
    const plain = value.match(/^(\d+)\s*(?:m|min|mins|minuten|minutes)?$/i);
    const hours = value.match(/^(\d+)\s*(?:h|u|uur)\s*(?:(\d+)\s*(?:m|min|minuten)?)?$/i);
    if (plain) minutes = Number(plain[1]);
    else if (hours) minutes = Number(hours[1]) * 60 + Number(hours[2] || 0);
  }
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) {
    minutes = MONTHLY_RUNTIME_MINUTES[movieId];
  }
  return minutes ? `${Math.round(minutes)} min` : null;
}

export interface EditorialTip {
  tmdbId: number;
  headline: string;
  reason: string;
}

export const MONTHLY_TIPS: EditorialTip[] = [
  {
    tmdbId: 671, // Harry Potter and the Philosopher's Stone
    headline: 'Deze kerst verschijnt de nieuwe Harry Potter-serie op HBO Max.',
    reason: 'Kijk de eerste film opnieuw en beleef het originele begin voordat je aan de serie begint.',
  },
  {
    tmdbId: 299534, // Avengers: Endgame
    headline: 'In december verschijnt Avengers: Doomsday in de bioscoop.',
    reason: 'Kom alvast in de Marvel-sfeer en beleef Endgame opnieuw voordat het nieuwe avontuur begint.',
  },
  {
    tmdbId: 438631, // Dune (Part One)
    headline: 'In december verschijnt Dune: Part Three in de bioscoop.',
    reason: 'Kijk nu het eerste deel en fris je geheugen op voor het nieuwe hoofdstuk.',
  },
  {
    tmdbId: 693134, // Dune: Part Two
    headline: 'Binnenkort verder met Dune: Part Three?',
    reason: 'Kijk eerst deel twee opnieuw, zodat je het verhaal weer scherp hebt voordat je naar de bioscoop gaat.',
  },
  {
    tmdbId: 771, // Home Alone
    headline: 'Al zin in kerst?',
    reason: 'Begin de voorpret met Home Alone: een huis vol kerstversiering, twee onhandige inbrekers en Kevin die ze te slim af is.',
  },
];

interface HeroSpotlightProps {
  movie?: Movie | null;
  allMovies?: Movie[];
  watchlistIds?: number[];
  watchedIds?: number[];
  matchPreferences?: MatchPreferences;
  friendActivity?: Pick<FriendActivityItem, 'name' | 'initial' | 'avatarGradient' | 'rating'>;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched: (movie: Movie) => void;
  onSelectMovie?: (movie: Movie | undefined) => void;
  backLabel?: string;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
}

export default function HeroSpotlight({
  movie: activeMovieProp,
  watchlistIds = [],
  watchedIds = [],
  matchPreferences,
  friendActivity,
  onToggleWatchlist,
  onToggleWatched,

  onSelectMovie,
  backLabel,
  onSelectPerson,
}: HeroSpotlightProps) {
  const trailerButtonRef = useRef<HTMLButtonElement>(null);
  const trailerDialogRef = useRef<HTMLDivElement>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [editorialMovies, setEditorialMovies] = useState<Record<number, Movie> | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [userPausedTips, setUserPausedTips] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);

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
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Kon tips niet laden:', err);
        setEditorialMovies({});
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const availableTips = MONTHLY_TIPS.filter(({ tmdbId }) => editorialMovies?.[tmdbId]);
  const tipCount = availableTips.length;
  const currentTipConfig = tipCount ? availableTips[tipIndex % tipCount] : undefined;
  const activeTipMovie = currentTipConfig ? editorialMovies?.[currentTipConfig.tmdbId] : undefined;

  useEffect(() => {
    if (activeMovieProp || userPausedTips || showTrailerModal || tipCount <= 1) return;

    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % tipCount);
    }, 10_000);

    return () => clearInterval(interval);
  }, [activeMovieProp, userPausedTips, showTrailerModal, tipCount]);

  const tipMonth = new Intl.DateTimeFormat('nl-NL', {
    month: 'long',
    timeZone: 'Europe/Amsterdam',
  }).format(new Date());

  const isSelectedByUser = Boolean(activeMovieProp);
  const displayedMovie = activeMovieProp || activeTipMovie;

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

  if (!displayedMovie) {
    return editorialMovies === null ? (
      <div role="status" className="flex min-h-40 items-center rounded-3xl border border-blue-200/15 bg-[#274c6b] px-5 text-sm text-sky-100 lg:min-h-64">
        Filmtips laden…
      </div>
    ) : null;
  }

  const overview = displayedMovie.overview || 'Geen beschrijving beschikbaar.';
  const compactOverview = !isSelectedByUser && overview.length > 240;
  const preview = compactOverview && !showFullOverview ? overview.slice(0, 240).replace(/\s+\S*$/, '') + '…' : overview;
  const runtimeLabel = formatFilmRuntime(displayedMovie.runtime, displayedMovie.id);
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
    : displayedMovie.match_percentage ?? (friendActivity ? null : 88);

  const matchBand = matchScore === null ? null : getMatchColorBand(matchScore);

  const handlePrevTip = () => {
    setUserPausedTips(true);
    setShowFullOverview(false);
    setTipIndex((current) => (current + tipCount - 1) % tipCount);
  };

  const handleNextTip = () => {
    setUserPausedTips(true);
    setShowFullOverview(false);
    setTipIndex((current) => (current + 1) % tipCount);
  };

  const backdropSrc = displayedMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${displayedMovie.backdrop_path}`
    : displayedMovie.poster_path
      ? `https://image.tmdb.org/t/p/original${displayedMovie.poster_path}`
      : null;

  return (
    <>
      <section aria-label="Film in de spotlight" className="fm-hero relative isolate overflow-hidden rounded-3xl border border-blue-200/15 bg-[#274c6b] text-white shadow-2xl shadow-black/30 p-5 sm:p-6 lg:p-8">
        {backdropSrc && (
          <div className="fm-hero-backdrop pointer-events-none absolute inset-0 -z-10 opacity-90">
            <Image
              src={backdropSrc}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover object-[65%_center]"
            />
            <div className="fm-hero-shade absolute inset-0 bg-gradient-to-t from-[#244967]/70 via-[#244967]/10 to-[#244967]/5" />
            <div className="fm-hero-shade absolute inset-0 bg-gradient-to-r from-[#274c6b] via-[#274c6b]/85 to-[#274c6b]/10" />
          </div>
        )}

        <div className="fm-hero-layout relative z-10" data-poster={Boolean(displayedMovie.poster_path)} data-still={Boolean(displayedMovie.backdrop_path)}>
          {/* Filmposter LINKS */}
          {displayedMovie.poster_path && (
            <div className="fm-hero-poster w-full">
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
          <div className="fm-hero-info min-w-0">
            <div className={`fm-hero-heading ${isSelectedByUser ? 'space-y-3' : 'space-y-1.5'}`}>
            {!isSelectedByUser && activeTipMovie && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-[10px] font-semibold text-sky-100/85">Filmtips van {tipMonth}</p>
                {tipCount > 1 && <div className="flex items-center gap-0.5" role="group" aria-label="Maandtips bladeren">
                  <button type="button" onClick={handlePrevTip} aria-label="Vorige tip" className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-sky-100/85 transition hover:bg-white/10 hover:text-white">‹</button>
                  <span className="min-w-7 text-center text-[10px] tabular-nums text-sky-100/80" aria-live="polite">{tipIndex + 1} / {tipCount}</span>
                  <button type="button" onClick={handleNextTip} aria-label="Volgende tip" className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-sky-100/85 transition hover:bg-white/10 hover:text-white">›</button>
                </div>}
              </div>
            )}

            {/* Titel van de film */}
            <h1 className="max-w-3xl text-[1.875rem] font-black leading-[1.05] tracking-tight text-white sm:text-[2.25rem] xl:text-[2.75rem]">
              {displayedMovie.title}
            </h1>

            {/* Filminformatie */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-100/80">
              {displayedMovie.release_date && (
                <span>{displayedMovie.release_date.split('-')[0]}</span>
              )}
              {displayedMovie.genres?.[0] && (
                <span>{displayedMovie.release_date ? '• ' : ''}{displayedMovie.genres[0]}</span>
              )}
              {runtimeLabel && (
                <span>{displayedMovie.release_date || displayedMovie.genres?.[0] ? '• ' : ''}{runtimeLabel}</span>
              )}
            </div>

            </div>

            {/* Korte reden voor de maandtip */}
            {!isSelectedByUser && activeTipMovie && activeTipMovie.id === displayedMovie.id && currentTipConfig?.reason && (
              <div className="max-w-2xl space-y-1">
                <p className="text-base font-bold leading-snug text-rose-200">{currentTipConfig.headline}</p>
                <p className="text-sm leading-6 text-rose-100/85">{currentTipConfig.reason}</p>
              </div>
            )}

            {/* Synopsis */}
            <p className={`max-w-2xl text-sm text-slate-200 ${isSelectedByUser ? 'leading-6 sm:text-base' : 'leading-5'}`}>
              {preview}
              {compactOverview && (
                <button
                  type="button"
                  aria-expanded={showFullOverview}
                  onClick={() => {
                    setUserPausedTips(true);
                    setShowFullOverview(!showFullOverview);
                  }}
                  className="ml-2 font-semibold text-sky-100 underline underline-offset-2 hover:text-white"
                >
                  {showFullOverview ? 'Lees minder' : 'Lees meer'}
                </button>
              )}
            </p>

            {/* Regisseur & Cast (klikbaar) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-0.5">
              {displayedMovie.director && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sky-100/80">Regie:</span>
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
                  <span className="text-sky-100/80">Cast:</span>
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
                        <span className="text-sky-100/80 ml-1">,</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Match score, Rating & Streamingdiensten */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {matchScore !== null && <span
                className={`rounded-lg px-2.5 py-1 text-xs font-black backdrop-blur-md ${
                  matchBand === 'strong'
                    ? 'bg-emerald-400 text-slate-950'
                    : matchBand === 'medium'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-rose-400 text-slate-950'
                }`}
              >
                {matchScore}% FilmMatch
              </span>}

              {displayedMovie.rating && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#173553]/85 px-2.5 py-1 text-xs font-bold text-white border border-white/10 backdrop-blur-md">
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

            {friendActivity && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-sky-100">
                <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr text-xs font-black text-white ${friendActivity.avatarGradient || 'from-sky-500 to-indigo-600'}`}>
                  {friendActivity.initial}
                </span>
                {friendActivity.rating > 0 ? (
                  <>
                    <span>{friendActivity.name} gaf</span>
                    <strong className="rounded-lg bg-sky-200 px-2 py-0.5 text-base font-black text-[#15354f]">{friendActivity.rating.toFixed(1).replace('.', ',')}</strong>
                  </>
                ) : <span>{friendActivity.name} heeft deze film gezien</span>}
              </div>
            )}

            {isSelectedByUser && onSelectMovie && (
              <button type="button" onClick={() => onSelectMovie(undefined)} className="text-xs font-semibold text-sky-200 hover:text-white">← {backLabel ?? (friendActivity ? 'Terug naar Recent gekeken' : 'Terug naar de maandtips')}</button>
            )}

            {/* Knoppen */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => trailerKey && setShowTrailerModal(true)}
                disabled={!trailerKey || loadingTrailer}
                ref={trailerButtonRef} type="button" className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-950/20 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                    : 'bg-sky-300/15 text-white border-sky-200/30 hover:bg-sky-300/25'
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
                    : 'bg-sky-300/15 text-white border-sky-200/30 hover:bg-sky-300/25'
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
        .fm-hero-layout { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 16px; }
        .fm-hero-layout[data-poster="true"] { grid-template-columns: 80px minmax(0, 1fr); }
        .fm-hero-poster { grid-column: 1; grid-row: 1; }
        .fm-hero-info { display: contents; }
        .fm-hero-info > :global(*) { grid-column: 1 / -1; }
        .fm-hero-layout[data-poster="true"] .fm-hero-heading { grid-column: 2; grid-row: 1; align-self: center; }
        @media (min-width: 640px) {
          .fm-hero-layout[data-poster="true"] { grid-template-columns: 112px minmax(0, 1fr); gap: 20px; }
        }
        @media (min-width: 1024px) {
          .fm-hero-layout { min-height: 330px; gap: 32px; align-items: center; }
          .fm-hero-layout[data-poster="true"] { grid-template-columns: 220px minmax(0, 1fr); gap: 32px; }
          .fm-hero-info { display: block; }
          .fm-hero-info > :global(* + *) { margin-top: 12px; }
        }
        @media (min-width: 1280px) {
          .fm-hero-layout[data-poster="true"] { grid-template-columns: 240px minmax(0, 1fr); }
        }
        @media (min-width: 1440px) {
          .fm-hero-layout[data-still="true"] { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
          .fm-hero-layout[data-still="true"][data-poster="true"] { grid-template-columns: 220px minmax(0, 1.2fr) minmax(0, 1fr); }
          .fm-hero-backdrop { left: 28%; opacity: 1; -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 55%); mask-image: linear-gradient(to right, transparent 0%, #000 55%); }
          .fm-hero-backdrop .fm-hero-shade { display: none; }
        }
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
                className="rounded-lg p-1 text-sky-100/80 hover:text-white"
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










