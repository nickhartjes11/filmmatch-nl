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

function RatingBadge({ rating, source }: { rating?: string | null; source?: Movie['rating_source'] }) {
  if (!rating) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 backdrop-blur-md">
      <span className={`rounded-sm px-1 text-[8px] font-black leading-3 ${source === 'IMDb' ? 'bg-[#f5c518] text-black' : 'text-neutral-300'}`}>
        {source || 'Score'}
      </span>
      <span className="text-[10px] font-bold text-sky-200">{rating}</span>
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
  showWatchedBadge = false,
}: MovieCardProps) {
  const [imageError, setImageError] = useState(false);
  useEffect(() => setImageError(false), [movie.poster_path]);
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
    <article className={`group flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-200/10 bg-[#0c1930] shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-950/40 motion-reduce:transform-none ${railCard ? 'w-[164px] shrink-0 snap-start sm:w-[196px] lg:w-[212px]' : 'w-full'}`}>
      <button
        type="button"
        onClick={() => onSelectMovie(movie)}
        title={`Toon ${movie.title} bovenaan`}
        aria-label={`Toon ${movie.title} als uitgelichte poster`}
        className={`relative block aspect-[2/3] overflow-hidden bg-slate-900 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 w-full`}
      >
        {hasValidPoster ? (
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#172f50] via-[#10213b] to-[#081222]">
            <span className="text-2xl opacity-40 mb-1">🎬</span>
            <span className="text-[10px] font-bold text-neutral-400 line-clamp-2 leading-tight">
              {movie.title}
            </span>
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c1930]/80 via-transparent to-black/30" />
        <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-1">
          <span className={`rounded-lg border border-white/15 px-2 py-1 text-[10px] font-bold shadow-lg backdrop-blur-md ${matchBand === 'strong' ? 'bg-[#082b3e]/95 text-cyan-200' : matchBand === 'medium' ? 'bg-[#102c52]/95 text-blue-200' : 'bg-[#16243c]/95 text-slate-200'}`}>
            {movie.match_percentage ?? 0}% match
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

      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5">
        <div>
          <h3 className="truncate text-sm font-semibold text-slate-100 transition group-hover:text-sky-200" title={movie.title}>
            <button type="button" onClick={() => onSelectMovie(movie)} className="block w-full truncate text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">
              {movie.title}
            </button>
          </h3>
          <p className="mt-1 truncate text-[11px] text-slate-400">
            {movie.release_date?.split('-')[0]} &bull; {movie.genres?.[0] || 'Film'}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-blue-200/10 pt-3">
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
              type="button"
              onClick={() => onToggleWatchlist(movie)}
              title={isWatchlisted ? 'Verwijder uit watchlist' : 'Bewaar voor later'}
              aria-label={isWatchlisted ? `Verwijder ${movie.title} uit watchlist` : `Bewaar ${movie.title} voor later`}
              aria-pressed={isWatchlisted}
              className={`flex h-9 w-9 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 text-sm font-bold transition ${isWatchlisted ? 'bg-blue-500 text-white' : 'bg-blue-400/10 text-blue-200 hover:bg-blue-400/25'}`}
            >
              {isWatchlisted ? '✓' : '+'}
            </button>
            <button
              type="button"
              onClick={() => onToggleWatched(movie)}
              title={isWatched ? 'Verwijder markering gezien' : 'Markeer als gezien'}
              aria-label={isWatched ? `Verwijder markering gezien voor ${movie.title}` : `Markeer ${movie.title} als gezien`}
              aria-pressed={isWatched}
              className={`flex h-9 w-9 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 text-xs font-bold transition ${isWatched ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              ✓
            </button>
          </div>
        </div>

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
    if (event.buttons === 0) { drag.current.active = false; return; }
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
          <h2 className="text-lg font-semibold tracking-tight text-slate-100 md:text-xl">{title}</h2>
          {headerAction}
          <span className="text-[10px] text-neutral-300">{movies.length}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => scrollRail(-1)} aria-label={`Vorige films: ${title}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200/15 bg-[#10223d] text-sm text-blue-100 transition hover:border-blue-400/50 hover:bg-blue-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">←</button>
          <button type="button" onClick={() => scrollRail(1)} aria-label={`Volgende films: ${title}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200/15 bg-[#10223d] text-sm text-blue-100 transition hover:border-blue-400/50 hover:bg-blue-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">→</button>
        </div>
      </div>
      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        tabIndex={0}
        role="region"
        aria-label={`Filmrij: ${title}`}
        onClickCapture={handleClickCapture}
        className="flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-1 pb-4 pt-2 sm:gap-4 [scrollbar-color:rgba(96,165,250,0.3)_transparent] [scrollbar-width:thin]"
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
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-neutral-200 transition hover:border-blue-400/60 hover:text-white"
      >
        Genres <span className="text-sky-200">{selectedGenres.length}</span>
        <span aria-hidden="true">{isGenreMenuOpen ? '⌃' : '⌄'}</span>
      </button>
      {isGenreMenuOpen && (
        <div
          role="dialog"
          aria-label="Kies filmgenres"
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/15 bg-[#0c1930] p-3 shadow-2xl shadow-black/60 sm:w-72"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white">Kies genres</span>
            <button
              type="button"
              onClick={() => setDraftGenres([defaultGenre])}
              className="text-[10px] font-semibold text-sky-200 hover:text-sky-100"
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
                  className="accent-blue-400"
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
              className="rounded-full bg-blue-400 px-3 py-1.5 text-[10px] font-bold text-slate-950 transition hover:bg-blue-300"
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
              : 'Aanbevolen op basis van jouw smaak';

  if (libraryView === 'discover' && !searchQuery.trim()) {
    const rails: RecommendationRail[] = [
      {
        id: 'hits',
        title: 'Beste filmhits',
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
      <div className="min-w-0 space-y-10 rounded-2xl bg-[#070f1e] p-3 text-slate-100 sm:p-5 lg:space-y-12 lg:p-6">
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
                  <h2 className="text-lg font-semibold tracking-tight text-slate-100 md:text-xl">{rail.title}</h2>
                  {rail.headerAction}
                </div>
                <div className="flex gap-3 overflow-hidden py-1">
                  {[1, 2, 3, 4, 5].map((skeletonId) => (
                    <div
                      key={skeletonId}
                      className="w-[164px] sm:w-[196px] lg:w-[212px] aspect-[2/3] shrink-0 rounded-2xl bg-[#10213b] motion-safe:animate-pulse border border-blue-200/10"
                    />
                  ))}
                </div>
              </section>
            ) : rail.id === selectedGenreRailRequest?.key ? (
              <section className="space-y-2" aria-label={rail.title}>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-100 md:text-xl">{rail.title}</h2>
                  {rail.headerAction}
                </div>
                <p className="text-xs text-neutral-400">Geen films gevonden voor deze selectie. Kies andere genres.</p>
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
              className="rounded-full border border-blue-400/30 bg-blue-500/15 px-6 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore ? 'Films ophalen…' : 'Laad meer films'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-5 rounded-2xl bg-[#070f1e] p-3 text-slate-100 sm:p-5 lg:p-6">
      {heading && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">{heading}</h2>
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