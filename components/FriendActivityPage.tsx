'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
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
}

export default function FriendActivityPage({
  allMovies,
  myWatchlistIds,
  activities,
  onToggleWatchlist,
}: FriendActivityPageProps) {
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'rating'>('recent');

  const [activeModalMovie, setActiveModalMovie] = useState<Movie | null>(null);
  const [modalDetails, setModalDetails] = useState<{ director?: string; cast?: string[] }>({});
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [activityMovieMetadata, setActivityMovieMetadata] = useState<Record<number, Movie>>({});
  const [providerLoadStatus, setProviderLoadStatus] = useState<
    Record<number, 'loading' | 'loaded' | 'error'>
  >({});
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

  const handleOpenMovie = async (movie: Movie) => {
    setActiveModalMovie(movie);
    setTrailerKey(null);
    setModalDetails({
      director: movie.director,
      cast: movie.cast,
    });

    if (!movie.director || !movie.cast || movie.cast.length === 0) {
      try {
        const res = await fetch(`/api/movies?metadataIds=${movie.id}`);
        if (res.ok) {
          const data = await res.json();
          const detail = data.movies?.[0];

          if (detail) {
            setModalDetails({
              director: detail.director || movie.director,
              cast: detail.cast || movie.cast,
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openTrailer = async (movieId: number) => {
    setTrailerLoading(true);
    setTrailerKey(null);

    try {
      const res = await fetch(`/api/movies?trailerMovieId=${movieId}`);
      if (res.ok) {
        const data = await res.json();
        setTrailerKey(data.youtubeKey || null);
      }
    } catch {
      setTrailerKey(null);
    } finally {
      setTrailerLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-rose-950/40 p-3 shadow-lg shadow-black/15 sm:p-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-rose-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-rose-100">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,0.8)]" />
              Jullie filmfeed
            </span>

            <h1 className="mt-2 flex items-center gap-2.5 text-xl font-black tracking-tight text-white sm:text-2xl">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xl shadow-inner"
              >
                🎬
              </span>
              Vriendenactiviteit
            </h1>

            <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-neutral-300">
              Ontdek wat je vrienden kijken, wat ze ervan vinden en welke film jij nog wilt
              toevoegen.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-sm" aria-hidden="true">
                  👥
                </span>
                <span className="text-xs font-bold text-white">{uniqueFriendsInFeed.length}</span>
                <span className="text-[10px] text-neutral-400">vrienden</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-sm" aria-hidden="true">
                  ✨
                </span>
                <span className="text-xs font-bold text-white">{activities.length}</span>
                <span className="text-[10px] text-neutral-400">updates</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5 backdrop-blur-sm sm:flex-row sm:items-center">
            {uniqueFriendsInFeed.length > 1 && (
              <label className="flex min-w-0 flex-col gap-1">
                <span className="px-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                  Vriend
                </span>
                <select
                  value={selectedFriendFilter}
                  onChange={(event) => setSelectedFriendFilter(event.target.value)}
                  aria-label="Filter op vriend"
                  className="min-w-40 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold text-neutral-100 outline-none transition focus:border-rose-400/60"
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
              <span className="px-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                Sorteren
              </span>
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setSortOrder('recent')}
                  aria-pressed={sortOrder === 'recent'}
                  className={
                    sortOrder === 'recent'
                      ? 'rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white shadow-sm'
                      : 'rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 transition hover:text-white'
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
                      ? 'flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200'
                      : 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 transition hover:text-white'
                  }
                >
                  <span aria-hidden="true">★</span>
                  Hoogste cijfer
                </button>
              </div>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1700px]:grid-cols-5">
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
                <button
                  type="button"
                  onClick={() => handleOpenMovie(matchedMovie)}
                  aria-label="Open filmdetails"
                  className="relative block aspect-[2/3] w-full cursor-pointer overflow-hidden bg-slate-900/60 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                >
                  {item.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={item.recentFilm}
                      fill
                      unoptimized
                      className="object-cover transition duration-500 group-hover:scale-105"
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
                        onClick={() => handleOpenMovie(matchedMovie)}
                        className="truncate text-left focus:outline-none"
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
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${item.avatarGradient} text-xs font-black text-white ring-2 ring-white/10`}
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
                              : providerLoadStatus[item.movieId] === 'loaded'
                                ? 'Geen streamingdiensten gevonden'
                                : providerLoadStatus[item.movieId] === 'error'
                                  ? 'Streamingdiensten niet geladen'
                                  : 'Streamingdiensten laden…'}
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

      {activeModalMovie && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModalMovie(null)}
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-6"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-y-auto rounded-3xl border border-white/15 bg-neutral-950 shadow-2xl md:flex-row"
          >
            <div className="relative aspect-[2/3] w-full shrink-0 bg-neutral-900 md:aspect-auto md:w-5/12">
              {activeModalMovie.poster_path && (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${activeModalMovie.poster_path}`}
                  alt={activeModalMovie.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between space-y-6 p-6 sm:p-8">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                      {activeModalMovie.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-400">
                      <span>{activeModalMovie.release_date?.slice(0, 4)}</span>
                      {activeModalMovie.runtime && (
                        <span>&bull; {activeModalMovie.runtime}</span>
                      )}
                      {activeModalMovie.rating && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-400/10 px-2 py-0.5 font-bold text-amber-300">
                          <span className="rounded bg-[#f5c518] px-1 text-[9px] font-black text-black">
                            IMDb
                          </span>
                          {activeModalMovie.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModalMovie(null)}
                    aria-label="Sluiten"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-300 transition hover:bg-white/20 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {activeModalMovie.providers && activeModalMovie.providers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400">Te zien op:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeModalMovie.providers.map((provider) => (
                        <span
                          key={provider.provider_id}
                          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          <StreamingLogo
                            name={provider.provider_name}
                            logoPath={provider.logo_path}
                            className="h-4 w-4 rounded"
                          />
                          <span>{provider.provider_name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeModalMovie.genres && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeModalMovie.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-neutral-200"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 border-t border-white/10 pt-2 text-xs">
                  {modalDetails.director && (
                    <p className="text-neutral-300">
                      <span className="font-bold text-neutral-500">Regie: </span>
                      <span className="font-medium text-white">{modalDetails.director}</span>
                    </p>
                  )}
                  {modalDetails.cast && modalDetails.cast.length > 0 && (
                    <p className="text-neutral-300">
                      <span className="font-bold text-neutral-500">Cast: </span>
                      <span className="font-medium text-white">
                        {modalDetails.cast.slice(0, 5).join(', ')}
                      </span>
                    </p>
                  )}
                </div>

                <p className="pt-2 text-xs leading-relaxed text-neutral-300 sm:text-sm">
                  {activeModalMovie.overview || 'Geen beschrijving beschikbaar voor deze titel.'}
                </p>
              </div>

              <div className="space-y-3 border-t border-white/10 pt-4">
                {trailerKey ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-inner">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                      title="Trailer"
                      allow="autoplay; encrypted-media; fullscreen"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openTrailer(activeModalMovie.id)}
                      disabled={trailerLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-xs font-bold text-white shadow-lg transition hover:bg-rose-500 sm:text-sm"
                    >
                      <span aria-hidden="true">▶</span>
                      {trailerLoading ? 'Trailer laden...' : 'Bekijk Trailer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(activeModalMovie)}
                      className="flex items-center gap-1.5 rounded-2xl bg-white/10 px-5 py-3 text-xs font-bold text-white transition hover:bg-white/20 sm:text-sm"
                    >
                      {myWatchlistIds.includes(activeModalMovie.id)
                        ? '✓ Op watchlist'
                        : '+ Watchlist'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}