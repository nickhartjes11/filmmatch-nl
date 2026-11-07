'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
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
  headerAction?: ReactNode;
  onViewAll?: () => void;
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

interface RecommendationRail {
  id: string;
  title: string;
  movies: Movie[];
  loading: boolean;
  headerAction?: ReactNode;
}

const TARGET_RAIL_COUNT = 25;

const MOVIE_GENRES = [
  'Actie', 'Avontuur', 'Animatie', 'Komedie', 'Misdaad', 'Documentaire', 'Drama', 'Familie',
  'Fantasy', 'Historisch', 'Horror', 'Muziek', 'Mysterie', 'Romantiek', 'Sciencefiction',
  'Thriller', 'Oorlog', 'Western',
];

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
}: MovieCardProps) {
  const [imageError, setImageError] = useState(false);
  const isWatchlisted = watchlistIds.includes(movie.id);
  const isWatched = watchedIds.includes(movie.id);
  const userRating = ratings[movie.id];
  const matchBand = getMatchColorBand(movie.match_percentage || 0);

  // We verkiezen de 16:9 backdrop, met poster als fallback
  const imageSrc = !imageError && movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
    : !imageError && movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null;

  const score = movie.rating || '7.5';

  return (
    <article
      onClick={() => onSelectMovie(movie)}
      className={`group relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:border-sky-400/50 hover:shadow-[0_10px_30px_rgba(56,189,248,0.2)] ${
        railCard ? 'w-[240px] sm:w-[280px] shrink-0 snap-start' : 'w-full'
      }`}
    >
      {/* 16:9 Achtergrondbeeld */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={movie.title}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-slate-800 to-slate-950">
          <span className="text-2xl opacity-40 mb-1">🎬</span>
          <span className="text-xs font-bold text-slate-300 line-clamp-2 leading-tight">
            {movie.title}
          </span>
        </div>
      )}

      {/* Donkerblauw verloop voor leesbaarheid tekst */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06111e] via-[#06111e]/40 to-transparent pointer-events-none" />

      {/* Linksboven: Match-percentage */}
      {movie.match_percentage ? (
        <div className="absolute top-2.5 left-2.5 z-10">
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-black backdrop-blur-md shadow-md ${
              matchBand === 'strong'
                ? 'bg-emerald-400 text-slate-950'
                : matchBand === 'medium'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-rose-400 text-slate-950'
            }`}
          >
            {movie.match_percentage}%
          </span>
        </div>
      ) : null}

      {/* Rechtsboven: Subtiele Actieknoppen (+ Watchlist en ✓ Gezien - Optie B) */}
      <div
        className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onToggleWatchlist(movie)}
          title={isWatchlisted ? 'Verwijder uit watchlist' : 'Bewaar voor later'}
          aria-label={isWatchlisted ? `Verwijder ${movie.title} uit watchlist` : `Bewaar ${movie.title} voor later`}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold backdrop-blur-md transition shadow-md ${
            isWatchlisted
              ? 'bg-amber-400 text-slate-950 border border-amber-300'
              : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
          }`}
        >
          {isWatchlisted ? '✓' : '+'}
        </button>
        <button
          type="button"
          onClick={() => onToggleWatched(movie)}
          title={isWatched ? 'Verwijder markering gezien' : 'Markeer als gezien'}
          aria-label={isWatched ? `Verwijder markering gezien voor ${movie.title}` : `Markeer ${movie.title} als gezien`}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold backdrop-blur-md transition shadow-md ${
            isWatched
              ? 'bg-emerald-400 text-slate-950 border border-emerald-300'
              : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
          }`}
        >
          ✓
        </button>
      </div>

      {/* Onderaan: Titel, ster-score, releasejaar en genres */}
      <div className="absolute bottom-2.5 left-3 right-3 z-10 space-y-0.5 pointer-events-none">
        <h3 className="truncate text-sm font-bold text-white group-hover:text-sky-300 transition">
          {movie.title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <span className="text-amber-400 font-bold flex items-center gap-0.5">
            ★ {score}
          </span>
          {movie.release_date && (
            <span className="text-slate-400">· {movie.release_date.split('-')[0]}</span>
          )}
          {movie.genres?.[0] && (
            <span className="text-slate-400 truncate">· {movie.genres[0]}</span>
          )}
        </div>

        {/* Rating balk indien van toepassing */}
        {highlightUserRating && (isWatched || userRating !== undefined) && (
          <div className="pt-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
  headerAction,
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">{title}</h2>
          {headerAction}
          <span className="text-xs text-slate-400">({movies.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => scrollRail(1)}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
          >
            Bekijk alles <span aria-hidden="true">→</span>
          </button>
          <div className="hidden gap-1 sm:flex">
            <button type="button" onClick={() => scrollRail(-1)} aria-label={`Vorige films: ${title}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-xs text-white transition hover:bg-white/15">←</button>
            <button type="button" onClick={() => scrollRail(1)} aria-label={`Volgende films: ${title}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-900/60 text-xs text-white transition hover:bg-white/15">→</button>
          </div>
        </div>
      </div>
      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
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
  const [dynamicRailMovies, setDynamicRailMovies] = useState<Record<string, Movie[]>>({});
  const [loadingRailKeys, setLoadingRailKeys] = useState<Record<string, boolean>>({});
  const defaultGenre = preferredGenres[0] || 'Drama';
  const [selectedGenres, setSelectedGenres] = useState<string[]>([defaultGenre]);
  const [draftGenres, setDraftGenres] = useState<string[]>([defaultGenre]);
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);

  const positiveRecentMovies = useMemo(() => {
    return recentlyWatchedMovies
      .filter((movie) => {
        const userScore = ratings[movie.id];
        return typeof userScore === 'number' && userScore >= 7;
      })
      .slice(0, 3);
  }, [recentlyWatchedMovies, ratings]);

  const similarSourceMovies = useMemo(() => {
    const seenIds = new Set<number>();
    return [...positiveRecentMovies, ...movies]
      .filter((movie) => {
        if (seenIds.has(movie.id)) return false;
        seenIds.add(movie.id);
        return true;
      })
      .slice(0, 2);
  }, [positiveRecentMovies, movies]);

  const selectedGenresKey = selectedGenres.join('|');
  const selectedPlatformKey = selectedPlatforms.join(',');
  const watchedMovieKey = watchedIds.join(',');

  const railFilterKey = [
    selectedPlatformKey,
    minimumImdbRating,
    releaseYearBefore ?? '',
    maxRuntimeMinutes ?? '',
    watchedMovieKey,
  ].join('|');

  const similarRailRequests: DynamicMovieRailRequest[] = similarSourceMovies.map((movie) => ({
    key: 'similar:' + movie.id + ':' + railFilterKey,
    title: 'Meer films zoals ' + movie.title,
    parameter: 'similarTo',
    value: String(movie.id),
    excludedMovieId: movie.id,
  }));

  const selectedGenreRailRequest: DynamicMovieRailRequest | null = selectedGenres.length > 0
    ? {
        key: 'genre:' + selectedGenresKey + ':' + railFilterKey,
        title: selectedGenres.length === 1
          ? 'Meer ' + selectedGenres[0] + ' films'
          : 'Meer films in ' + selectedGenres.length + ' genres',
        parameter: 'genre',
        value: selectedGenres.join('|'),
        genre: selectedGenres.join('|'),
      }
    : null;

  const toggleGenreMenu = () => {
    if (!isGenreMenuOpen) setDraftGenres(selectedGenres);
    setIsGenreMenuOpen((open) => !open);
  };

  const toggleDraftGenre = (genre: string) => {
    setDraftGenres((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre]
    );
  };

  const applyGenreSelection = () => {
    setSelectedGenres(draftGenres.length > 0 ? draftGenres : [defaultGenre]);
    setIsGenreMenuOpen(false);
  };

  const genreFilterControl = (
    <div className="relative z-50">
      <button
        type="button"
        onClick={toggleGenreMenu}
        aria-expanded={isGenreMenuOpen}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-300 transition hover:bg-sky-500/20"
      >
        Genres <span className="text-white">({selectedGenres.length})</span>
        <span aria-hidden="true">{isGenreMenuOpen ? '⌃' : '⌄'}</span>
      </button>
      {isGenreMenuOpen && (
        <div
          role="dialog"
          aria-label="Kies filmgenres"
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/15 bg-slate-950 p-3 shadow-2xl sm:w-72"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white">Kies genres</span>
            <button
              type="button"
              onClick={() => setDraftGenres([defaultGenre])}
              className="text-[10px] font-semibold text-sky-400 hover:text-sky-300"
            >
              Standaard
            </button>
          </div>
          <div className="grid max-h-56 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto pr-1">
            {MOVIE_GENRES.map((genre) => (
              <label key={genre} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[11px] text-neutral-200 hover:bg-white/[0.06]">
                <input
                  type="checkbox"
                  checked={draftGenres.includes(genre)}
                  onChange={() => toggleDraftGenre(genre)}
                  className="accent-sky-400"
                />
                {genre}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="text-[10px] text-neutral-400">{draftGenres.length} geselecteerd</span>
            <button
              type="button"
              onClick={applyGenreSelection}
              className="rounded-full bg-sky-500 px-3 py-1.5 text-[10px] font-bold text-slate-950 transition hover:bg-sky-400"
            >
              Toepassen
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const imdbRailRequest: DynamicMovieRailRequest = {
    key: 'imdb:' + railFilterKey,
    title: 'Best beoordeelde IMDb-films',
    parameter: 'imdb',
    value: 'imdbCandidates',
    minimumRating: Math.max(7, minimumImdbRating),
  };

  const similarRailKeys = similarRailRequests.map((request) => request.key).join('|');
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
    if (libraryView !== 'discover' || searchQuery.trim()) return;

    const requests = [
      ...similarRailRequests,
      ...(selectedGenreRailRequest ? [selectedGenreRailRequest] : []),
      imdbRailRequest,
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

            if (request.parameter === 'imdb') {
              const imdbRating = Number.parseFloat(movie.rating || '');

              if (
                movie.rating_source !== 'IMDb' ||
                !Number.isFinite(imdbRating) ||
                imdbRating < (request.minimumRating ?? 7)
              ) {
                continue;
              }
            }

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
    similarRailKeys,
    selectedGenreRailRequest?.key,
    selectedGenresKey,
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
              : 'Aanbevolen voor jou';

  if (libraryView === 'discover' && !searchQuery.trim()) {
    const rails: RecommendationRail[] = [
      {
        id: 'hits',
        title: 'Aanbevolen voor jou',
        movies: [...synchronizedMovies]
          .filter((movie) => (movie.match_percentage || 0) >= 68)
          .sort((first, second) => (second.match_percentage || 0) - (first.match_percentage || 0))
          .slice(0, TARGET_RAIL_COUNT),
        loading: false,
      },
      ...similarRailRequests.map((request) => ({
        id: request.key,
        title: request.title,
        movies: dynamicRailMovies[request.key] || [],
        loading: loadingRailKeys[request.key] || false,
      })),
      ...(selectedGenreRailRequest ? [{
        id: selectedGenreRailRequest.key,
        title: selectedGenreRailRequest.title,
        movies: dynamicRailMovies[selectedGenreRailRequest.key] || [],
        loading: loadingRailKeys[selectedGenreRailRequest.key] || false,
        headerAction: genreFilterControl,
      }] : []),
      {
        id: imdbRailRequest.key,
        title: imdbRailRequest.title,
        movies: dynamicRailMovies[imdbRailRequest.key] || [],
        loading: loadingRailKeys[imdbRailRequest.key] || false,
      },
    ];

    const visibleRails = rails.filter((rail) =>
      rail.id === selectedGenreRailRequest?.key || rail.movies.length > 0 || rail.loading
    );

    return (
      <div className="space-y-8">
        {visibleRails.map((rail) => (
          <Fragment key={rail.id}>
            {rail.movies.length > 0 ? (
              <MovieRail
                key={rail.id}
                title={rail.title}
                movies={rail.movies}
                headerAction={rail.headerAction}
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
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">{rail.title}</h2>
                  {rail.headerAction}
                </div>
                <div className="flex gap-4 overflow-hidden py-1">
                  {[1, 2, 3, 4, 5].map((skeletonId) => (
                    <div
                      key={skeletonId}
                      className="w-[240px] sm:w-[280px] aspect-[16/9] shrink-0 rounded-2xl bg-slate-900/40 animate-pulse border border-white/5"
                    />
                  ))}
                </div>
              </section>
            ) : rail.id === selectedGenreRailRequest?.key ? (
              <section className="space-y-2" aria-label={rail.title}>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">{rail.title}</h2>
                  {rail.headerAction}
                </div>
                <p className="text-xs text-slate-400">Geen films gevonden voor deze selectie. Kies andere genres.</p>
              </section>
            ) : null}
          </Fragment>
        ))}
        {hasMoreMovies && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-6 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-wait disabled:opacity-60"
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
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">{heading}</h2>
          <span className="text-xs text-slate-400">{displayedMovies.length} films</span>
        </div>
      )}

      {/* Grid weergave in 16:9 breedbeeldformaat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          />
        ))}
      </div>
    </section>
  );
}