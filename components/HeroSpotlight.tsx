'use client';

import { useEffect, useState } from 'react';
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
  onSelectMovie?: (movie?: Movie | null) => void;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
  onFindMovie?: () => void;
}

export default function HeroSpotlight({
  movie: activeMovieProp,
  allMovies = [],
  watchlistIds = [],
  watchedIds = [],
  matchPreferences,
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
  onFindMovie,
}: HeroSpotlightProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [editorialMovies, setEditorialMovies] = useState<Record<number, Movie>>({});
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);

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
    if (activeMovieProp || MONTHLY_TIPS.length <= 1) return;

    const interval = setInterval(() => {
      setTipIndex((current) => (current + 1) % MONTHLY_TIPS.length);
    }, 10_000);

    return () => clearInterval(interval);
  }, [activeMovieProp]);

  const currentTipConfig = MONTHLY_TIPS[tipIndex % MONTHLY_TIPS.length];
  const activeTipMovie = currentTipConfig
    ? editorialMovies[currentTipConfig.tmdbId]
    : undefined;

  const isSelectedByUser = Boolean(activeMovieProp);
  const displayedMovie: Movie | undefined =
    activeMovieProp || activeTipMovie || allMovies[0];

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

  const backdropSrc = displayedMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${displayedMovie.backdrop_path}`
    : displayedMovie.poster_path
      ? `https://image.tmdb.org/t/p/original${displayedMovie.poster_path}`
      : null;

  const releaseYear = displayedMovie.release_date?.split('-')[0] || '';

  return (
    <>
      <section className="relative w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,180,255,0.2)] bg-[#070c18] min-h-[520px] flex items-center">
        {/* Achtergrond met filmbackdrop, donker verloop en blauwe sfeergloed */}
        {backdropSrc && (
          <div className="absolute inset-0 z-0">
            <img
              src={backdropSrc}
              alt={displayedMovie.title}
              className="w-full h-full object-cover object-[center_25%] opacity-55 scale-105 filter contrast-110 brightness-90 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060913] via-[#060913]/85 to-transparent w-full md:w-3/5" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-transparent to-transparent" />
            <div className="absolute top-1/4 left-10 w-96 h-96 bg-cyan-600/15 rounded-full blur-[130px] pointer-events-none" />
          </div>
        )}

        <div className="relative z-10 w-full px-6 sm:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Linkerzijde: Titels & Actieknoppen */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold tracking-widest uppercase">
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
                onClick={
                  onFindMovie ||
                  (() => {
                    document.getElementById('film-catalog')?.scrollIntoView({ behavior: 'smooth' });
                  })
                }
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition-all shadow-[0_0_25px_rgba(56,189,248,0.4)] active:scale-95"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Vind jouw film</span>
              </button>
            </div>
          </div>

          {/* Rechterzijde: Film Spotlight Glass Card */}
          <div className="lg:col-span-5 flex flex-col items-end">
            <div className="w-full max-w-md rounded-2xl bg-slate-900/50 border border-white/10 p-5 backdrop-blur-xl shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-sky-300 uppercase">
                  {isSelectedByUser ? 'Geselecteerde Film' : 'Film van de week'}
                </span>
                
                {/* Carrousel dots (bij maandtips) of matchpercentage */}
                {!isSelectedByUser ? (
                  <div className="flex items-center gap-1.5">
                    {MONTHLY_TIPS.map((tip, idx) => (
                      <button
                        key={tip.tmdbId}
                        type="button"
                        onClick={() => setTipIndex(idx)}
                        aria-label={`Tip ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === tipIndex % MONTHLY_TIPS.length
                            ? 'w-4 bg-sky-400'
                            : 'w-1.5 bg-slate-600 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-black backdrop-blur-md ${
                      matchBand === 'strong'
                        ? 'bg-emerald-400 text-slate-950'
                        : matchBand === 'medium'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-rose-400 text-slate-950'
                    }`}
                  >
                    {matchScore}% Match
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                  {displayedMovie.title}
                </h2>
                
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {displayedMovie.rating && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                      ★ {displayedMovie.rating}
                    </span>
                  )}
                  {releaseYear && (
                    <span className="text-xs text-slate-400">{releaseYear}</span>
                  )}
                  {displayedMovie.runtime && (
                    <span className="text-xs text-slate-400">· {displayedMovie.runtime}</span>
                  )}
                  {displayedMovie.genres?.slice(0, 2).map((g) => (
                    <span
                      key={g}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Reden bij de tip */}
              {!isSelectedByUser &&
                activeTipMovie &&
                activeTipMovie.id === displayedMovie.id &&
                currentTipConfig?.reason && (
                  <p className="text-xs font-medium text-sky-200/90 bg-sky-950/40 p-2 rounded-lg border border-sky-800/30">
                    💡 {currentTipConfig.reason}
                  </p>
                )}

              {/* Synopsis */}
              <p className="text-xs text-slate-300/80 line-clamp-3 leading-relaxed">
                {displayedMovie.overview || 'Geen beschrijving beschikbaar.'}
              </p>

              {/* Regisseur & Cast (klikbaar) */}
              {(displayedMovie.director || (displayedMovie.cast && displayedMovie.cast.length > 0)) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1">
                  {displayedMovie.director && (
                    <div>
                      <span>Regie: </span>
                      <button
                        type="button"
                        onClick={() => onSelectPerson?.(displayedMovie.director!, 'Directing')}
                        className="text-white hover:text-sky-300 underline underline-offset-2 transition"
                      >
                        {displayedMovie.director}
                      </button>
                    </div>
                  )}
                  {displayedMovie.cast && displayedMovie.cast.length > 0 && (
                    <div>
                      <span>Cast: </span>
                      {displayedMovie.cast.slice(0, 3).map((actor, idx) => (
                        <span key={actor}>
                          <button
                            type="button"
                            onClick={() => onSelectPerson?.(actor, 'Acting')}
                            className="text-white hover:text-sky-300 underline underline-offset-2 transition"
                          >
                            {actor}
                          </button>
                          {idx < Math.min(displayedMovie.cast!.length, 3) - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Providers */}
              {displayedMovie.providers && displayedMovie.providers.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1">Te zien op:</span>
                  {displayedMovie.providers.slice(0, 4).map((provider) => (
                    <StreamingLogo
                      key={provider.provider_id}
                      name={provider.provider_name}
                      logoPath={provider.logo_path}
                      className="h-6 w-6 rounded-md"
                    />
                  ))}
                </div>
              )}

              {/* Actieknoppen */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => trailerKey && setShowTrailerModal(true)}
                  disabled={!trailerKey || loadingTrailer}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-sky-400" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>{loadingTrailer ? 'Laden…' : 'Trailer'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWatchlist(displayedMovie)}
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
                  onClick={() => onToggleWatched(displayedMovie)}
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
      </section>

      {/* Trailer Modal */}
      {showTrailerModal && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="text-sm font-bold text-white uppercase">
                {displayedMovie.title} — Officiële Trailer
              </span>
              <button
                type="button"
                onClick={() => setShowTrailerModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                aria-label="Sluit trailer"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                title={`Trailer ${displayedMovie.title}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}