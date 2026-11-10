'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import HeroSpotlight from './HeroSpotlight';
import StreamingLogo from './StreamingLogo';
import type { FriendActivityItem, Movie } from './types';
import { getMatchColorBand } from '../lib/recommendations/matchScore';

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
  onFriendshipChanged?: () => void;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched?: (movie: Movie) => void;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
}

const EMPTY_FRIENDS: FriendProfile[] = [];
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
  myWatchedIds,
  activities,
  friends = EMPTY_FRIENDS,
  onToggleWatchlist,
  onToggleWatched,
  onSelectPerson,
}: FriendActivityPageProps) {
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'rating'>('recent');
  const [spotlightMovie, setSpotlightMovie] = useState<Movie | null>(null);

  const [activityMovieMetadata, setActivityMovieMetadata] = useState<Record<number, Movie>>({});
  const [providerLoadStatus, setProviderLoadStatus] = useState<
    Record<number, 'loading' | 'loaded' | 'error'>
  >({});
  const requestedMetadataIds = useRef(new Set<number>());

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
        const existingMovie = allMovies.find((movie) => movie.id === movieId);
        return !existingMovie?.providers?.length && !requestedMetadataIds.current.has(movieId);
      }
    );

    if (idsToLoad.length === 0) return;
    idsToLoad.forEach((movieId) => requestedMetadataIds.current.add(movieId));

    setProviderLoadStatus((current) => {
      const next = { ...current };
      idsToLoad.forEach((movieId) => {
        next[movieId] = 'loading';
      });
      return next;
    });

    const loadActivityMovieMetadata = async () => {
      for (let index = 0; index < idsToLoad.length; index += 25) {
        const batch = idsToLoad.slice(index, index + 25);
        try {
          const response = await fetch(`/api/movies?metadataIds=${batch.join(',')}`);
          if (!response.ok) throw new Error('Fout bij laden metadata');
          const data = await response.json();
          const fetchedMovies: Movie[] = Array.isArray(data.movies) ? data.movies : [];
          const fetchedIds = new Set(fetchedMovies.map((movie) => movie.id));

          setActivityMovieMetadata((current) => {
            const next = { ...current };
            fetchedMovies.forEach((movie) => {
              next[movie.id] = movie;
            });
            return next;
          });

          setProviderLoadStatus((current) => {
            const next = { ...current };
            batch.forEach((movieId) => {
              next[movieId] = fetchedIds.has(movieId) ? 'loaded' : 'error';
            });
            return next;
          });
        } catch {
          setProviderLoadStatus((current) => {
            const next = { ...current };
            batch.forEach((movieId) => {
              next[movieId] = 'error';
            });
            return next;
          });
        }
      }
    };

    void loadActivityMovieMetadata();
  }, [activities, allMovies]);

  const handleSelectMovieForSpotlight = async (movie: Movie) => {
    setSpotlightMovie(movie);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.dashboard-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (!movie.director || !movie.cast || movie.cast.length === 0) {
      try {
        const res = await fetch(`/api/movies?metadataIds=${movie.id}`);
        if (res.ok) {
          const data = await res.json();
          const detail = data?.movies?.[0];
          if (detail) {
            setSpotlightMovie((prev) => (prev?.id === movie.id ? { ...prev, ...detail } : prev));
          }
        }
      } catch (e) {
        console.warn('Kon spotlight details niet verrijken:', e);
      }
    }
  };

  return (
    <div className="space-y-4 pb-6 text-sky-50">
      <section aria-labelledby="mijn-vrienden-titel" className="rounded-2xl border border-sky-200/20 bg-[#21445e] px-4 py-3.5">
        <div className="flex items-baseline gap-2">
          <h1 id="mijn-vrienden-titel" className="text-lg font-black tracking-tight sm:text-xl">Mijn vrienden</h1>
          <span className="text-xs text-sky-100/75">{friendList.length === 1 ? '1 vriend' : friendList.length + ' vrienden'}</span>
        </div>

        {friendList.length > 0 && (
          <div role="group" aria-label="Filter op vriend" className="mt-2 flex gap-2 overflow-x-auto p-1">
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

      {spotlightMovie && (
        <HeroSpotlight
          movie={spotlightMovie}
          watchlistIds={myWatchlistIds}
          watchedIds={myWatchedIds}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched || (() => {})}
          onSelectPerson={onSelectPerson}
          onSelectMovie={(movie) => setSpotlightMovie(movie || null)}
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
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,11rem))]">
            {displayedActivities.map((item) => {
              const movieFromList = allMovies.find((movie) => movie.id === item.movieId);
              const metadataMovie = activityMovieMetadata[item.movieId];
              const movie: Movie = {
                ...metadataMovie,
                ...movieFromList,
                id: item.movieId,
                title: movieFromList?.title ?? metadataMovie?.title ?? item.recentFilm,
                overview: movieFromList?.overview ?? metadataMovie?.overview ?? '',
                release_date: movieFromList?.release_date ?? metadataMovie?.release_date ?? '',
                poster_path: movieFromList?.poster_path || metadataMovie?.poster_path || item.poster_path,
                providers: movieFromList?.providers?.length ? movieFromList.providers : metadataMovie?.providers || [],
              };
              const posterSrc = movie.poster_path?.startsWith('/') ? 'https://image.tmdb.org/t/p/w500' + movie.poster_path : movie.poster_path;
              const isWatchlisted = myWatchlistIds.includes(item.movieId);
              const match = movie.match_percentage;
              const band = typeof match === 'number' ? getMatchColorBand(match) : null;
              const providerStatus = providerLoadStatus[item.movieId];

              return (
                <article key={item.id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-sky-200/20 bg-[#18374f] transition hover:border-sky-200/45">
                  <button
                    type="button"
                    onClick={() => void handleSelectMovieForSpotlight(movie)}
                    aria-label={'Bekijk ' + movie.title}
                    aria-pressed={spotlightMovie?.id === movie.id}
                    className="relative isolate flex aspect-[2/3] w-full items-end overflow-hidden bg-[#10283e] p-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-300"
                  >
                    {posterSrc && <img src={posterSrc} alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-105" />}
                    <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-[#10283e] via-[#10283e]/20 to-transparent" />
                    {band && (
                      <span className={'absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-bold ' + (band === 'strong' ? 'border-emerald-300/40 bg-emerald-950 text-emerald-100' : band === 'medium' ? 'border-amber-300/40 bg-amber-950 text-amber-100' : 'border-rose-300/40 bg-rose-950 text-rose-100')}>
                        {match}% match
                      </span>
                    )}
                    <span className="line-clamp-2 text-sm font-extrabold leading-tight text-white">{movie.title}</span>
                  </button>

                  <div className="flex flex-1 flex-col justify-between gap-2 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <span aria-hidden="true" className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-[10px] font-black ' + (item.avatarGradient || AVATAR_COLORS)}>
                        {item.initial || item.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p title={item.name} className="truncate text-xs font-bold">{item.name}</p>
                        <p className="text-[10px] leading-tight text-sky-100/75">{formatElapsedTime(item.minutesAgo)}</p>
                      </div>
                      {item.rating ? (
                        <span aria-label={item.name + ' gaf ' + item.rating + ' van de 10'} className="shrink-0 rounded-md bg-amber-300/15 px-1.5 py-1 text-xs font-black text-amber-200">
                          {item.rating.toFixed(1).replace('.', ',')}
                        </span>
                      ) : <span className="text-[10px] text-sky-100/75">Gezien</span>}
                    </div>

                    <div className="flex items-center justify-between gap-1 border-t border-sky-200/15 pt-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {movie.providers.length > 0 ? movie.providers.slice(0, 3).map((provider) => (
                          <StreamingLogo key={provider.provider_id} name={provider.provider_name} logoPath={provider.logo_path} className="h-5 w-5 rounded" />
                        )) : <span className="text-[10px] text-sky-100/70">
                          {providerStatus === 'loading' ? 'Streaming laden…' : providerStatus === 'loaded' ? 'Geen streaming' : 'Streaming onbekend'}
                        </span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleWatchlist(movie)}
                        aria-pressed={isWatchlisted}
                        aria-label={isWatchlisted ? 'Verwijder ' + movie.title + ' uit watchlist' : 'Voeg ' + movie.title + ' toe aan watchlist'}
                        className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black transition ' + (isWatchlisted ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-sky-200/15 text-sky-50 hover:bg-sky-200/30')}
                      >
                        {isWatchlisted ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
