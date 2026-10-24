'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import MovieRatingControl from './MovieRatingControl';
import StreamingLogo from './StreamingLogo';
import type { DiscoveryMode, LibraryView, Movie } from './types';
import { calculateMatchScore, getMatchColorBand, type MatchPreferences } from '../lib/recommendations/matchScore';

interface MovieGridProps {
  movies: Movie[];
  libraryView: LibraryView;
  discoveryMode: DiscoveryMode;
  searchQuery: string;
  referenceMovie?: Movie;
  watchlistIds: number[];
  watchedIds: number[];
  recentlyWatchedMovies: Movie[];
  preferredGenres: string[];
  selectedPlatforms: string[];
  minimumImdbRating: number;
  releaseYearBefore: number | null;
  maxRuntimeMinutes: number | null;
  matchPreferences: MatchPreferences;
  hasMoreMovies: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelectMovie: (movie: Movie) => void;
  ratings: Record<number, number>;
  onEditRating: (movie: Movie) => void;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched: (movie: Movie) => void;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
}

interface MovieCardProps extends Pick<MovieGridProps, 'watchlistIds' | 'watchedIds' | 'onSelectMovie' | 'ratings' | 'onEditRating' | 'onToggleWatchlist' | 'onToggleWatched' | 'onSelectPerson'> {
  movie: Movie;
  railCard?: boolean;
  highlightUserRating?: boolean;
  compactPoster?: boolean;
  showWatchedBadge?: boolean;
}

interface MovieRailProps extends Omit<MovieCardProps, 'movie' | 'railCard'> {
  title: string;
  movies: Movie[];
}

interface DynamicMovieRailRequest {
  key: string;
  title: string;
  parameter: 'genre' | 'similarTo' | 'imdb';
  value: string;
  genre?: string;
  minimumRating?: number;
  excludedMovieId?: number;
}

const TARGET_RAIL_COUNT = 25;

function RatingBadge({ rating, source }: { rating?: string | null; source?: Movie['rating_source'] }) {
  if (!rating) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 backdrop-blur-md">
      <span className={`rounded-sm px-1 text-[8px] font-black leading-3 ${source === 'IMDb' ? 'bg-[#f5c518] text-black' : 'text-neutral-300'}`}>
        {source || 'Score'}
      </span>
      <span className="text-[10px] font-bold text-amber-200">{rating}</span>
    </span>
  );
}

function MovieCard({
  movie,
  watchlistIds,
  watchedIds,
  onSelectMovie,
  ratings,
  onEditRating,
  onToggleWatchlist,
  onToggleWatched,
  railCard = false,
  highlightUserRating = false,
  compactPoster = false,
  showWatchedBadge = false,
}: MovieCardProps) {
  const [imageError, setImageError] = useState(false);
  const isWatchlisted = watchlistIds.includes(movie.id);
  const isWatched = watchedIds.includes(movie.id);
  const userRating = ratings[movie.id];
  const matchBand = getMatchColorBand(movie.match_percentage || 0);

  const hasValidPoster = Boolean(
    movie.poster_path &&
    typeof movie.poster_path === 'string' &&
    movie.poster_path.trim() !== '' &&
    movie.poster_path !== 'null' &&
    movie.poster_path !== 'undefined' &&
    !imageError
  );

  return (
    <article className={`movie-card-reveal group flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 hover:border-white/25 transition duration-300 ${railCard ? 'w-[148px] shrink-0 snap-start sm:w-[170px]' : 'w-full'}`}>
      <button
        onClick={() => onSelectMovie(movie)}
        title={`Toon ${movie.title} bovenaan`}
        aria-label={`Toon ${movie.title} als uitgelichte poster`}
        className={`relative block aspect-[2/3] overflow-hidden bg-slate-900 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 ${compactPoster ? 'mx-auto w-[90%]' : 'w-full'}`}
      >
        {hasValidPoster ? (
          <Image
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            fill
            unoptimized
            onError={() => setImageError(true)}
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-neutral-800 to-neutral-900">
            <span className="text-2xl opacity-40 mb-1">🎬</span>
            <span className="text-[10px] font-bold text-neutral-400 line-clamp-2 leading-tight">
              {movie.title}
            </span>
          </div>
        )}
        <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-black backdrop-blur-md ${matchBand === 'strong' ? 'bg-emerald-300 text-[#07110d]' : matchBand === 'medium' ? 'bg-amber-300 text-[#1f1605]' : 'bg-rose-400 text-[#2b080d]'}`}>
            {movie.match_percentage}%
          </span>
          <RatingBadge
            rating={movie.rating}
            source={movie.rating_source}
          />
        </div>
        {showWatchedBadge && isWatched && (
          <span className="absolute bottom-2 left-2 rounded-full border border-emerald-200/30 bg-emerald-950/90 px-2 py-1 text-[9px] font-bold text-emerald-100 shadow-lg backdrop-blur-sm">
            Gezien
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col justify-between p-3">
        <div>
          <h3 className="truncate text-xs font-bold text-white transition group-hover:text-rose-200" title={movie.title}>
            <button type="button" onClick={() => onSelectMovie(movie)} className="truncate text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400">
              {movie.title}
            </button>
          </h3>
          <p className="mt-0.5 text-[10px] text-neutral-300 truncate">
            {movie.release_date?.split('-')[0]} &bull; {movie.genres?.[0] || 'Film'}
          </p>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.12] pt-2">
          <div className="flex items-center gap-1">
            {movie.providers?.slice(0, 2).map((provider) => (
              <StreamingLogo
                key={provider.provider_id}
                name={provider.provider_name}
                logoPath={provider.logo_path}
                className="h-6 w-6 rounded"
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleWatchlist(movie)}
              title={isWatchlisted ? 'Verwijder uit watchlist' : 'Bewaar voor later'}
              aria-label={isWatchlisted ? `Verwijder ${movie.title} uit watchlist` : `Bewaar ${movie.title} voor later`}
              aria-pressed={isWatchlisted}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition ${isWatchlisted ? 'bg-amber-300 text-slate-950' : 'bg-amber-300/15 text-amber-100 hover:bg-amber-300/30'}`}
            >
              {isWatchlisted ? '✓' : '+'}
            </button>
            <button
              onClick={() => onToggleWatched(movie)}
              title={isWatched ? 'Verwijder markering gezien' : 'Markeer als gezien'}
              aria-label={isWatched ? `Verwijder markering gezien voor ${movie.title}` : `Markeer ${movie.title} als gezien`}
              aria-pressed={isWatched}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition ${isWatched ? 'bg-emerald-300 text-slate-950' : 'bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/30'}`}
            >
              ✓
            </button>
          </div>
        </div>

        {/* Cijfer en 'Wijzig' worden UITSLUITEND getoond als highlightUserRating aan staat (in het Gezien-overzicht) */}
        {highlightUserRating && (isWatched || userRating !== undefined) && (
          <div className="mt-2 border-t border-white/[0.08] pt-2">
            <MovieRatingControl rating={userRating} onEdit={() => onEditRating(movie)} prominent={highlightUserRating} />
          </div>
        )}
      </div>
    </article>
  );
}

function MovieRail({
  title,
  movies,
  watchlistIds,
  watchedIds,
  onSelectMovie,
  ratings,
  onEditRating,
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
}: MovieRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, dragged: false, startX: 0, startScroll: 0 });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !railRef.current) return;
    drag.current = { active: true, dragged: false, startX: event.clientX, startScroll: railRef.current.scrollLeft };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !railRef.current) return;
    const distance = event.clientX - drag.current.startX;
    if (Math.abs(distance) > 4 && !drag.current.dragged) {
      drag.current.dragged = true;
      railRef.current.setPointerCapture(event.pointerId);
    }
    railRef.current.scrollLeft = drag.current.startScroll - distance;
  };

  const handlePointerUp = () => {
    drag.current.active = false;
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!drag.current.dragged) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.dragged = false;
  };

  const scrollRail = (direction: -1 | 1) => {
    if (!railRef.current) return;
    railRef.current.scrollBy({ left: direction * railRef.current.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold text-white md:text-base">{title}</h2>
          <span className="text-[10px] text-neutral-300">{movies.length}</span>
        </div>
        <div className="hidden gap-1 sm:flex">
          <button onClick={() => scrollRail(-1)} aria-label={`Vorige films: ${title}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-slate-900/40 text-xs text-white transition hover:bg-white/15">←</button>
          <button onClick={() => scrollRail(1)} aria-label={`Volgende films: ${title}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-slate-900/40 text-xs text-white transition hover:bg-white/15">→</button>
        </div>
      </div>
      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [scrollbar-width:thin] touch-pan-x"
      >
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            railCard
            watchlistIds={watchlistIds}
            watchedIds={watchedIds}
            onSelectMovie={onSelectMovie}
            ratings={ratings}
            onEditRating={onEditRating}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            onSelectPerson={onSelectPerson}
          />
        ))}
      </div>
    </section>
  );
}

export default function MovieGrid({
  movies,
  libraryView,
  discoveryMode,
  searchQuery,
  watchlistIds,
  watchedIds,
  hasMoreMovies,
  loadingMore,
  onLoadMore,
  onSelectMovie,
  ratings,
  onEditRating,
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
  recentlyWatchedMovies,
  preferredGenres,
  selectedPlatforms,
  minimumImdbRating,
  releaseYearBefore,
  maxRuntimeMinutes,
  matchPreferences,
}: MovieGridProps) {
  const [similarIndex, setSimilarIndex] = useState(0);
  const [dynamicRailMovies, setDynamicRailMovies] = useState<Record<string, Movie[]>>({});
  const [loadingRailKeys, setLoadingRailKeys] = useState<Record<string, boolean>>({});

  const positiveRecentMovies = useMemo(() => {
    return recentlyWatchedMovies
      .filter((movie) => {
        const userScore = ratings[movie.id];
        return typeof userScore === 'number' && userScore >= 7;
      })
      .slice(0, 3);
  }, [recentlyWatchedMovies, ratings]);

  const recentMovieKey = positiveRecentMovies.map((movie) => movie.id).join(',');
  const genreNames = preferredGenres.slice(0, 2);
  const selectedPlatformKey = selectedPlatforms.join(',');
  const watchedMovieKey = watchedIds.join(',');

  const selectedSimilarMovie = positiveRecentMovies.length > 0
    ? positiveRecentMovies[similarIndex % positiveRecentMovies.length]
    : undefined;

  const railFilterKey = [
    selectedPlatformKey,
    minimumImdbRating,
    releaseYearBefore ?? '',
    maxRuntimeMinutes ?? '',
    watchedMovieKey,
  ].join('|');

  const genreRailRequests: DynamicMovieRailRequest[] = genreNames.map((genre) => ({
    key: `genre:${genre}:${railFilterKey}`,
    title: `Meer ${genre} films`,
    parameter: 'genre',
    value: genre,
    genre,
  }));

  const imdbRailRequest: DynamicMovieRailRequest = {
    key: `imdb:${railFilterKey}`,
    title: 'Best beoordeelde IMDb-films',
    parameter: 'imdb',
    value: 'imdbCandidates',
    minimumRating: Math.max(7, minimumImdbRating),
  };

  const similarRailRequest: DynamicMovieRailRequest | null = selectedSimilarMovie
    ? {
        key: `similar:${selectedSimilarMovie.id}:${railFilterKey}`,
        title: `Meer films zoals ${selectedSimilarMovie.title}`,
        parameter: 'similarTo',
        value: String(selectedSimilarMovie.id),
        excludedMovieId: selectedSimilarMovie.id,
      }
    : null;

  const baseMatchMap = useMemo(() => {
    const map = new Map<number, number>();
    movies.forEach((movie) => {
      const score = calculateMatchScore(
        {
          id: movie.id,
          genres: movie.genres || [],
          director: movie.director,
          cast: movie.cast,
          rating: movie.rating,
        },
        matchPreferences
      );
      map.set(movie.id, score);
    });
    return map;
  }, [movies, matchPreferences]);

  const synchronizedMovies = useMemo(() => {
    return movies.map((movie) => ({
      ...movie,
      match_percentage: baseMatchMap.get(movie.id) ?? calculateMatchScore(
        {
          id: movie.id,
          genres: movie.genres || [],
          director: movie.director,
          cast: movie.cast,
          rating: movie.rating,
        },
        matchPreferences
      ),
    }));
  }, [movies, baseMatchMap, matchPreferences]);

  useEffect(() => {
    setSimilarIndex(0);
    if (positiveRecentMovies.length < 2) return;
    const timer = window.setInterval(() => {
      setSimilarIndex((current) => (current + 1) % positiveRecentMovies.length);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [recentMovieKey, positiveRecentMovies.length]);

  useEffect(() => {
    if (libraryView !== 'discover' || searchQuery.trim()) return;

    const requests = [
      imdbRailRequest,
      ...genreRailRequests,
      ...(similarRailRequest ? [similarRailRequest] : []),
    ];

    const missingRequests = requests.filter(
      (request) => !Object.prototype.hasOwnProperty.call(dynamicRailMovies, request.key)
    );

    if (missingRequests.length === 0) return;

    let isActive = true;

    setLoadingRailKeys((current) => ({
      ...current,
      ...Object.fromEntries(missingRequests.map((request) => [request.key, true])),
    }));

    const loadRail = async (request: DynamicMovieRailRequest): Promise<[string, Movie[]]> => {
      const railMovies: Movie[] = [];
      const seenMovieIds = new Set<number>();
      const watchedMovieIds = new Set(watchedMovieKey.split(',').filter(Boolean).map(Number));

      try {
        let page = 1;
        let totalPages = 5;

        while (railMovies.length < TARGET_RAIL_COUNT && page <= totalPages && page <= 6) {
          const params = new URLSearchParams({
            page: String(page),
            providers: selectedPlatformKey,
            rail: '1',
          });

          if (request.parameter === 'imdb') {
            params.set('sortBy', request.value);
          } else {
            params.set(request.parameter, request.value);
          }

          const response = await fetch(`/api/movies?${params.toString()}`);
          if (!response.ok) break;

          const data = await response.json();
          if (data.totalPages) totalPages = Number(data.totalPages);
          const list = Array.isArray(data.movies) ? (data.movies as Movie[]) : [];

          if (list.length === 0) break;

          for (const movie of list) {
            if (seenMovieIds.has(movie.id)) continue;
            if (watchedMovieIds.has(movie.id)) continue;
            if (request.excludedMovieId && movie.id === request.excludedMovieId) continue;

            seenMovieIds.add(movie.id);

            const score = baseMatchMap.get(movie.id) ?? calculateMatchScore(
              {
                id: movie.id,
                genres: movie.genres || [],
                director: movie.director,
                cast: movie.cast,
                rating: movie.rating,
              },
              matchPreferences
            );

            railMovies.push({
              ...movie,
              match_percentage: score,
            });

            if (railMovies.length >= TARGET_RAIL_COUNT) break;
          }

          page++;
        }
      } catch (err) {
        console.warn(`Rail load failed for ${request.title}:`, err);
      }

      if (request.parameter === 'imdb') {
        railMovies.sort((a, b) => Number.parseFloat(b.rating || '0') - Number.parseFloat(a.rating || '0'));
      } else {
        railMovies.sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));
      }

      return [request.key, railMovies];
    };

    void Promise.all(missingRequests.map(loadRail)).then((results) => {
      if (!isActive) return;
      setDynamicRailMovies((current) => ({
        ...current,
        ...Object.fromEntries(results),
      }));
      setLoadingRailKeys((current) => {
        const next = { ...current };
        missingRequests.forEach((request) => delete next[request.key]);
        return next;
      });
    });

    return () => {
      isActive = false;
    };
  }, [
    libraryView,
    searchQuery,
    railFilterKey,
    selectedPlatformKey,
    watchedMovieKey,
    matchPreferences,
    dynamicRailMovies,
    baseMatchMap,
    similarRailRequest?.key,
    genreNames.join('|'),
  ]);

  const displayedMovies = synchronizedMovies;

  const heading = libraryView === 'watchlist'
    ? null
    : libraryView === 'watched'
      ? null
      : libraryView === 'cinema'
        ? null
        : searchQuery
          ? 'Alle resultaten'
          : discoveryMode === 'new_releases'
            ? 'Nieuwe releases'
            : discoveryMode === 'popular'
              ? 'Populair in NL'
              : 'Aanbevolen op basis van jouw smaak';

  if (libraryView === 'discover' && !searchQuery.trim()) {
    const rails = [
      {
        id: 'hits',
        title: 'Beste filmhits',
        movies: [...synchronizedMovies]
          .filter((movie) => (movie.match_percentage || 0) >= 68)
          .sort((first, second) => (second.match_percentage || 0) - (first.match_percentage || 0))
          .slice(0, TARGET_RAIL_COUNT),
        loading: false,
      },
      ...(similarRailRequest ? [{
        id: similarRailRequest.key,
        title: similarRailRequest.title,
        movies: dynamicRailMovies[similarRailRequest.key] || [],
        loading: loadingRailKeys[similarRailRequest.key] || false,
      }] : []),
      ...genreRailRequests.map((request) => ({
        id: request.key,
        title: request.title,
        movies: dynamicRailMovies[request.key] || [],
        loading: loadingRailKeys[request.key] || false,
      })),
      {
        id: imdbRailRequest.key,
        title: imdbRailRequest.title,
        movies: dynamicRailMovies[imdbRailRequest.key] || [],
        loading: loadingRailKeys[imdbRailRequest.key] || false,
      },
    ];

    const visibleRails = rails.filter((rail) => rail.movies.length > 0 || rail.loading);

    return (
      <div className="space-y-8">
        {visibleRails.map((rail) => (
          rail.movies.length > 0 ? (
            <MovieRail
              key={rail.id}
              title={rail.title}
              movies={rail.movies}
              watchlistIds={watchlistIds}
              watchedIds={watchedIds}
              onSelectMovie={onSelectMovie}
              ratings={ratings}
              onEditRating={onEditRating}
              onToggleWatchlist={onToggleWatchlist}
              onToggleWatched={onToggleWatched}
              onSelectPerson={onSelectPerson}
            />
          ) : rail.loading ? (
            <section key={rail.id} className="space-y-3" aria-label={rail.title}>
              <h2 className="text-sm font-bold text-white md:text-base">{rail.title}</h2>
              <div className="flex gap-3 overflow-hidden py-1">
                {[1, 2, 3, 4, 5].map((skeletonId) => (
                  <div
                    key={skeletonId}
                    className="w-[148px] sm:w-[170px] aspect-[2/3] shrink-0 rounded-xl bg-white/[0.04] animate-pulse border border-white/5"
                  />
                ))}
              </div>
            </section>
          ) : null
        ))}
        {hasMoreMovies && (
          <div className="flex justify-center pt-2">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="rounded-full border border-white/20 bg-white/[0.08] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.15] disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore ? 'Films ophalen…' : 'Laad meer films'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {heading && (
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-wider text-white">{heading}</h2>
          <span className="text-xs text-neutral-100">{displayedMovies.length} films</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {displayedMovies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            watchlistIds={watchlistIds}
            watchedIds={watchedIds}
            onSelectMovie={onSelectMovie}
            ratings={ratings}
            onEditRating={onEditRating}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            onSelectPerson={onSelectPerson}
            highlightUserRating={libraryView === 'watched'}
            compactPoster={libraryView === 'watched' || libraryView === 'watchlist'}
            showWatchedBadge={libraryView === 'discover' && Boolean(searchQuery.trim())}
          />
        ))}
      </div>
    </section>
  );
}