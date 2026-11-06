'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  onSelectMovieSpotlight?: (movieId: number) => void;
  onToggleWatchlist: (movie: Movie) => void;
  onSelectPerson?: (name: string, department: 'Acting' | 'Directing') => void;
}

export default function FriendActivityPage({
  allMovies,
  myWatchlistIds,
  activities,
  onToggleWatchlist,
  onSelectMovieSpotlight,
}: FriendActivityPageProps) {
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'rating'>('recent');

  const [activityMovieMetadata, setActivityMovieMetadata] = useState<Record<number, Movie>>({});
  const [providerLoadStatus, setProviderLoadStatus] = useState<
    Record<number, 'loading' | 'loaded' | 'error'>
  >( {});
  const requestedMetadataIds = useRef(new Set<number>());

  const formatElapsedTime = (minutesAgo: number) => {
    if (minutesAgo < 60) return `${minutesAgo}m`;
    if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)}u`;
    return `${Math.floor(minutesAgo / (24 * 60))}d`;
  };

  const uniqueFriendsInFeed = useMemo(() => {
    const map = new Map<string, string>();

    activities.forEach((item) => {
      const friendKey = String(item.friendId ?? item.name);
      if (!map.has(friendKey)) {
        map.set(friendKey, item.name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activities]);

  const displayedActivities = useMemo(() => {
    let list = [...activities];

    if (selectedFriendFilter !== 'all') {
      list = list.filter((item) => String(item.friendId ?? item.name) === selectedFriendFilter);
    }

    if (sortOrder === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else {
      list.sort((a, b) => a.minutesAgo - b.minutesAgo);
    }

    return list;
  }, [activities, selectedFriendFilter, sortOrder]);

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
          if (!response.ok) throw new Error('Filmgegevens konden niet worden geladen.');

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

  const handleMovieClick = (movieId: number) => {
    if (onSelectMovieSpotlight) {
      onSelectMovieSpotlight(movieId);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white sm:text-xl">Vriendenactiviteit</h1>
          <p className="mt-0.5 text-xs text-neutral-400">
            Ontdek wat je vrienden kijken en wat ze ervan vinden.
          </p>
          <p className="mt-1 text-[10px] text-neutral-500">
            {uniqueFriendsInFeed.length} vrienden <span aria-hidden="true">·</span>{' '}
            {activities.length} updates
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {uniqueFriendsInFeed.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="px-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                Vriend
              </span>
              <select
                value={selectedFriendFilter}
                onChange={(event) => setSelectedFriendFilter(event.target.value)}
                aria-label="Filter op vriend"
                className="min-w-36 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-medium text-neutral-100 outline-none focus:border-white/25"
              >
                <option value="all">Alle vrienden</option>
                {uniqueFriendsInFeed.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1">
            <span className="px-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
              Sorteren
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setSortOrder('recent')}
                aria-pressed={sortOrder === 'recent'}
                className={
                  sortOrder === 'recent'
                    ? 'rounded-md bg-white/15 px-3 py-2 text-xs font-semibold text-white'
                    : 'rounded-md px-3 py-2 text-xs text-neutral-400 transition hover:text-white'
                }
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('rating')}
                aria-pressed={sortOrder === 'rating'}
                className={
                  sortOrder === 'rating'
                    ? 'rounded-md bg-white/15 px-3 py-2 text-xs font-semibold text-white'
                    : 'rounded-md px-3 py-2 text-xs text-neutral-400 transition hover:text-white'
                }
              >
                ★ Hoogste cijfer
              </button>
            </div>
          </div>
        </div>
      </section>

      {displayedActivities.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-950/80 px-5 py-16 text-center shadow-inner sm:py-24">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl"
          >
            🎞️
          </div>
          <p className="text-base font-bold text-white">Geen activiteit gevonden</p>
          <p className="text-xs text-neutral-400">
            {selectedFriendFilter !== 'all'
              ? 'Deze vriend heeft nog geen films beoordeeld.'
              : 'Zodra vrienden films beoordelen, zie je ze hier direct.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {displayedActivities.map((item) => {
            const movieFromList = allMovies.find((movie) => movie.id === item.movieId);
            const metadataMovie = activityMovieMetadata[item.movieId];

            const fallbackMovie: Movie = {
              id: item.movieId,
              title: item.recentFilm,
              poster_path: item.poster_path,
              overview: '',
              release_date: '',
              genres: [],
              providers: [],
              rating: undefined,
              match_percentage: 85,
            };

            const matchedMovie: Movie = {
              ...fallbackMovie,
              ...(metadataMovie || {}),
              ...(movieFromList || {}),
              providers: movieFromList?.providers?.length
                ? movieFromList.providers
                : metadataMovie?.providers || [],
            };

            const isWatchlisted = myWatchlistIds.includes(item.movieId);
            const matchPercentage = matchedMovie.match_percentage ?? 85;
            const matchBand = getMatchColorBand(matchPercentage);

            return (
              <article
                key={item.id}
                className="movie-card-reveal group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 shadow-lg shadow-black/15 transition duration-300 hover:-translate-y-1 hover:border-rose-300/30 hover:shadow-rose-950/20"
              >
                {/* Poster knop die direct naar Spotlight navigeert */}
                <button
                  type="button"
                  onClick={() => handleMovieClick(item.movieId)}
                  aria-label={`Bekijk ${item.recentFilm} in spotlight`}
                  className="relative block aspect-[2/3] w-full cursor-pointer overflow-hidden bg-slate-900/60 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                >
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={item.recentFilm}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-900/80 text-[10px] font-bold text-neutral-600">
                      Geen poster
                    </div>
                  )}

                  <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-black shadow-md backdrop-blur-md ${
                        matchBand === 'strong'
                          ? 'bg-emerald-300 text-[#07110d]'
                          : matchBand === 'medium'
                            ? 'bg-amber-300 text-[#1f1605]'
                            : 'bg-rose-400 text-[#2b080d]'
                      }`}
                      title={`Jouw matchscore: ${matchPercentage}%`}
                    >
                      {matchPercentage}%
                    </span>

                    {matchedMovie.rating ? (
                      <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-black/80 px-1.5 py-0.5 shadow-md backdrop-blur-md">
                        <span className="rounded-sm bg-[#f5c518] px-1 text-[8px] font-black leading-3 text-black">
                          IMDb
                        </span>
                        <span className="text-[10px] font-bold text-amber-200">
                          {matchedMovie.rating}
                        </span>
                      </span>
                    ) : (
                      <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-300 backdrop-blur-md">
                        {formatElapsedTime(item.minutesAgo)}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                  <div>
                    <h3
                      className="truncate text-xs font-bold text-white transition group-hover:text-rose-200"
                      title={item.recentFilm}
                    >
                      <button
                        type="button"
                        onClick={() => handleMovieClick(item.movieId)}
                        className="truncate text-left focus:outline-none hover:underline"
                      >
                        {item.recentFilm}
                      </button>
                    </h3>
                    <p className="mt-0.5 truncate text-[10px] text-neutral-400">
                      {matchedMovie.release_date?.slice(0, 4)} &bull;{' '}
                      {matchedMovie.genres?.[0] || 'Film'}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2.5 border-t border-white/[0.08] pt-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-gradient-to-r from-amber-400/[0.12] to-orange-300/[0.06] px-3 py-2.5 shadow-inner shadow-amber-300/[0.04]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${item.avatarGradient || 'from-rose-500 to-amber-500'} text-xs font-black text-white ring-2 ring-white/10`}
                        >
                          {item.initial}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-[10px] font-medium text-amber-100/65">
                            {item.rating ? 'gaf deze film' : 'heeft deze film gezien'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-baseline gap-1 rounded-lg px-2.5 py-1.5 ${
                          item.rating
                            ? 'bg-amber-300 text-slate-950 shadow-md shadow-amber-950/20'
                            : 'border border-white/10 bg-white/[0.06] text-neutral-200'
                        }`}
                        aria-label={
                          item.rating
                            ? `${item.name} gaf ${item.rating.toFixed(1)} van de 10`
                            : `${item.name} heeft de film gezien`
                        }
                      >
                        {item.rating ? (
                          <>
                            <span className="text-base font-black leading-none">
                              {item.rating.toFixed(1)}
                            </span>
                            <span className="text-[9px] font-bold opacity-70">/ 10</span>
                          </>
                        ) : (
                          <span className="text-[10px] font-extrabold">✓ Gezien</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] pt-2">
                      <div className="flex items-center gap-1 overflow-hidden">
                        {matchedMovie.providers && matchedMovie.providers.length > 0 ? (
                          matchedMovie.providers.slice(0, 3).map((provider) => (
                            <StreamingLogo
                              key={provider.provider_id}
                              name={provider.provider_name}
                              logoPath={provider.logo_path}
                              className="h-6 w-6 rounded"
                            />
                          ))
                        ) : (
                          <span className="text-[9px] text-neutral-500">
                            {providerLoadStatus[item.movieId] === 'loading'
                              ? 'Streamingdiensten laden…'
                              : 'Geen streaming'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleWatchlist(matchedMovie)}
                        title={isWatchlisted ? 'Verwijder uit watchlist' : 'Voeg toe aan watchlist'}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition ${
                          isWatchlisted
                            ? 'bg-amber-300 text-slate-950'
                            : 'bg-amber-300/15 text-amber-100 hover:bg-amber-300/30'
                        }`}
                      >
                        {isWatchlisted ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}