'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import HeroSpotlight from './HeroSpotlight';
import { MovieCard } from './MovieGrid';
import type { FriendActivityItem, Movie } from './types';
import { calculateMatchScore, type MatchPreferences } from '../lib/recommendations/matchScore';

export interface FriendProfile {
  id: string;
  display_name: string;
  streaming_services?: string[];
  favorite_movie_ids?: number[];
  preferred_genres?: string[];
  disliked_genres?: string[];
}

interface FriendActivityPageProps {
  currentUserId?: string | null;
  currentUserName?: string;
  myStreamingServices?: string[];
  allMovies: Movie[];
  myWatchedIds?: number[];
  myWatchlistIds: number[];
  activities: FriendActivityItem[];
  friends?: FriendProfile[];
  matchPreferences?: MatchPreferences;
  onFriendshipChanged?: () => void;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched?: (movie: Movie) => void;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
}

const EMPTY_FRIENDS: FriendProfile[] = [];
const EMPTY_MOVIE_IDS: number[] = [];
const AVATAR_COLORS = 'from-sky-500 to-indigo-600';

function getFriendKey(item: FriendActivityItem) {
  return String(item.friendId ?? item.name);
}

function formatElapsedTime(minutesAgo: number) {
  if (minutesAgo < 1) return 'Zojuist';
  if (minutesAgo < 60) return `${minutesAgo} min geleden`;
  if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)} uur geleden`;
  const days = Math.floor(minutesAgo / (24 * 60));
  return days === 1 ? 'Gisteren' : `${days} dagen geleden`;
}

export default function FriendActivityPage({
  allMovies,
  myWatchlistIds,
  myWatchedIds = EMPTY_MOVIE_IDS,
  activities,
  friends = EMPTY_FRIENDS,
  matchPreferences,
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
}: FriendActivityPageProps) {
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'rating'>('recent');
  const [spotlightActivity, setSpotlightActivity] = useState<FriendActivityItem | null>(null);

  const [activityMovieMetadata, setActivityMovieMetadata] = useState<Record<number, Movie>>({});
  const requestedMetadataIds = useRef(new Set<number>());
  const moviesById = useMemo(() => new Map(allMovies.map((movie) => [movie.id, movie])), [allMovies]);

  const friendList = useMemo(() => {
    const avatars = new Map<string, FriendActivityItem>();
    activities.forEach((item) => {
      const id = getFriendKey(item);
      if (!avatars.has(id)) avatars.set(id, item);
    });
    const people = new Map(friends.map(({ id, display_name }) => [id, display_name]));
    avatars.forEach((item, id) => {
      if (!people.has(id)) people.set(id, item.name);
    });
    return Array.from(people, ([id, displayName]) => {
      const item = avatars.get(id);
      const name = displayName.trim() || 'Vriend';
      return { id, name, initial: item?.initial || name.charAt(0).toUpperCase(), colors: item?.avatarGradient || AVATAR_COLORS };
    });
  }, [activities, friends]);
  const activeFriend = friendList.find((friend) => friend.id === selectedFriendFilter);
  const activeFriendId = activeFriend?.id;

  const displayedActivities = useMemo(() => {
    const list = activeFriendId ? activities.filter((item) => getFriendKey(item) === activeFriendId) : [...activities];
    if (sortOrder === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.minutesAgo - b.minutesAgo);
    } else {
      list.sort((a, b) => a.minutesAgo - b.minutesAgo);
    }
    return list;
  }, [activities, activeFriendId, sortOrder]);

  useEffect(() => {
    const idsToLoad = Array.from(new Set(activities.map((item) => item.movieId))).filter(
      (movieId) => {
        const existingMovie = moviesById.get(movieId);
        return !requestedMetadataIds.current.has(movieId) &&
          (!existingMovie?.providers?.length || !existingMovie.rating_source || !existingMovie.backdrop_path ||
            !existingMovie.director || !existingMovie.cast?.length);
      }
    );

    if (idsToLoad.length === 0) return;
    idsToLoad.forEach((movieId) => requestedMetadataIds.current.add(movieId));

    const loadActivityMovieMetadata = async () => {
      for (let index = 0; index < idsToLoad.length; index += 25) {
        const batch = idsToLoad.slice(index, index + 25);
        try {
          const response = await fetch(`/api/movies?metadataIds=${batch.join(',')}`);
          if (!response.ok) throw new Error('Fout bij laden metadata');
          const data = await response.json();
          const fetchedMovies: Movie[] = Array.isArray(data.movies) ? data.movies : [];

          setActivityMovieMetadata((current) => {
            const next = { ...current };
            fetchedMovies.forEach((movie) => {
              next[movie.id] = movie;
            });
            return next;
          });

        } catch {
          // Keep the activity visible with the film data already available.
        }
      }
    };

    void loadActivityMovieMetadata();
  }, [activities, moviesById]);

  const handleSelectMovieForSpotlight = (activity: FriendActivityItem) => {
    setSpotlightActivity(activity);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.dashboard-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }

  };

  const resolveMovie = (item: FriendActivityItem): Movie => {
    const fromLibrary = moviesById.get(item.movieId);
    const metadata = activityMovieMetadata[item.movieId];
    const runtimeMinutes = metadata?.runtime_minutes ?? fromLibrary?.runtime_minutes;
    const scoreSource = metadata?.rating ? metadata : fromLibrary;
    const movie: Movie = {
      ...fromLibrary,
      ...metadata,
      id: item.movieId,
      title: metadata?.title || fromLibrary?.title || item.recentFilm,
      overview: metadata?.overview || fromLibrary?.overview || '',
      release_date: metadata?.release_date || fromLibrary?.release_date || '',
      poster_path: metadata?.poster_path || fromLibrary?.poster_path || item.poster_path,
      backdrop_path: metadata?.backdrop_path || fromLibrary?.backdrop_path,
      runtime_minutes: runtimeMinutes,
      runtime: runtimeMinutes ? String(runtimeMinutes) : metadata?.runtime || fromLibrary?.runtime,
      genres: metadata?.genres?.length ? metadata.genres : fromLibrary?.genres,
      director: metadata?.director || fromLibrary?.director,
      cast: metadata?.cast?.length ? metadata.cast : fromLibrary?.cast,
      rating: scoreSource?.rating,
      rating_source: scoreSource?.rating_source,
      providers: metadata?.providers ?? fromLibrary?.providers ?? [],
    };
    if (matchPreferences && (metadata || fromLibrary)) {
      movie.match_percentage = calculateMatchScore({ ...movie, genres: movie.genres || [] }, matchPreferences);
    }
    return movie;
  };
  const spotlightMovie = spotlightActivity ? resolveMovie(spotlightActivity) : null;

  return (
    <div className="space-y-4 pb-6 text-sky-50">
      <section aria-labelledby="mijn-vrienden-titel" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <h1 id="mijn-vrienden-titel" className="text-lg font-black tracking-tight sm:text-xl">Mijn vrienden</h1>
          <span className="text-xs text-sky-100/75">{friendList.length === 1 ? '1 vriend' : friendList.length + ' vrienden'}</span>
        </div>

        {friendList.length > 0 && (
          <div role="group" aria-label="Filter op vriend" className="flex min-w-0 gap-2 overflow-x-auto p-1">
            <button type="button" aria-pressed={!activeFriend} onClick={() => setSelectedFriendFilter('all')} className="shrink-0 rounded-full border border-sky-200/25 px-3 py-2 text-xs font-bold transition hover:bg-sky-200/15 aria-pressed:border-rose-300/60 aria-pressed:bg-rose-400/20">
              Iedereen
            </button>
            {friendList.map((friend) => (
              <button
                key={friend.id}
                type="button"
                aria-pressed={friend.id === activeFriendId}
                onClick={() => setSelectedFriendFilter(friend.id === activeFriendId ? 'all' : friend.id)}
                className="flex max-w-52 shrink-0 items-center gap-2 rounded-full border border-sky-200/25 py-1 pl-1 pr-3 text-xs font-bold transition hover:bg-sky-200/15 aria-pressed:border-rose-300/60 aria-pressed:bg-rose-400/20"
              >
                <span aria-hidden="true" className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-xs font-black text-white ' + friend.colors}>{friend.initial}</span>
                <span className="truncate">{friend.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {spotlightMovie && spotlightActivity && (
        <HeroSpotlight
          movie={spotlightMovie}
          friendActivity={spotlightActivity}
          watchlistIds={myWatchlistIds}
          watchedIds={myWatchedIds}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched || (() => {})}
          onSelectPerson={onSelectPerson}
          onSelectMovie={() => setSpotlightActivity(null)}
        />
      )}

      <section aria-labelledby="recent-gekeken-titel" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 id="recent-gekeken-titel" className="text-lg font-black tracking-tight sm:text-xl">Recent gekeken</h2>
            {activeFriend && <span className="text-sm text-sky-100/80">{activeFriend.name}</span>}
          </div>
          {displayedActivities.length > 1 && (
            <div role="group" aria-label="Sorteer activiteiten" className="flex flex-wrap gap-0.5 rounded-full border border-sky-200/20 bg-[#15354f] p-0.5">
              {([
                ['recent', 'Recent'],
                ['rating', 'Hoogste cijfer'],
              ] as const).map(([order, label]) => (
                <button key={order} type="button" onClick={() => setSortOrder(order)} aria-pressed={sortOrder === order} className="rounded-full px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-200/10 aria-pressed:bg-sky-200/20 aria-pressed:text-white">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {displayedActivities.length === 0 ? (
          <p role="status" className="rounded-xl border border-sky-200/20 bg-[#21445e] px-4 py-3 text-sm text-sky-100/90">
            {activeFriend
              ? activeFriend.name + ' heeft nog geen beoordelingen in dit overzicht.'
              : 'Zodra je vrienden films beoordelen, zie je die hier.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
            {displayedActivities.map((item) => {
              const movie = resolveMovie(item);
              const rating = item.rating > 0 ? item.rating.toFixed(1).replace('.', ',') : null;

              return (
                <div key={item.id} className="min-w-0">
                  <MovieCard
                    movie={movie}
                    watchlistIds={myWatchlistIds}
                    watchedIds={myWatchedIds}
                    onSelectMovie={() => handleSelectMovieForSpotlight(item)}
                    onToggleWatchlist={onToggleWatchlist}
                    onToggleWatched={onToggleWatched}
                    showMatchScore={typeof movie.match_percentage === 'number'}
                  />
                  <div className="mt-1.5 flex items-center gap-1.5 px-0.5 sm:gap-2">
                    <span aria-hidden="true" className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-[10px] font-black text-white ' + (item.avatarGradient || AVATAR_COLORS)}>
                      {item.initial || item.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p title={item.name} className="truncate text-xs font-bold text-white">{item.name}</p>
                      <p className="text-[10px] leading-tight text-sky-100/75">{formatElapsedTime(item.minutesAgo)}</p>
                    </div>
                    {rating && (
                      <span aria-label={item.name + ' gaf ' + rating + ' van de 10'} className="shrink-0 rounded-lg bg-sky-200/15 px-1.5 py-0.5 text-base font-black text-white sm:px-2">
                        {rating}<span aria-hidden="true" className="text-[9px] font-semibold text-sky-100/75">/10</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
