'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { Movie, StreamingPlatform } from './types';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { calculateMatchScore, getMatchColorBand, type MatchPreferences } from '../lib/recommendations/matchScore';

interface FriendProfile {
  id: string;
  streaming_services?: string[];
  favorite_movie_ids?: number[];
  disliked_movie_ids?: number[];
  disliked_genres?: string[];
  favorite_directors?: string[];
  favorite_cast?: string[];
}

interface WatchTogetherPageProps {
  currentUserId: string | null;
  currentUserName: string;
  myWatchlist: Movie[];
  myStreamingServices: string[];
  friends: Array<{ id: string; display_name: string }>;
  platforms: StreamingPlatform[];
  onSelectMovieSpotlight: (id: number) => void;
  onToggleWatchlist: (movie: Movie) => void;
}

const panel = 'rounded-2xl border border-sky-200/20 bg-[#21445e]';
const control = 'rounded-xl border border-sky-200/25 bg-[#15354f] px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-sky-300';
const button = 'rounded-full border border-sky-200/25 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-200/15 disabled:opacity-45';
const posterGrid = 'grid grid-cols-2 gap-3 min-[360px]:grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(8rem,10rem))]';
const matchColors = {
  strong: 'border-emerald-300/40 bg-emerald-950 text-emerald-100',
  medium: 'border-amber-300/40 bg-amber-950 text-amber-100',
  low: 'border-rose-300/40 bg-rose-950 text-rose-100',
};

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

async function fetchMovies(url: string, signal: AbortSignal): Promise<Movie[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Films ophalen mislukt');
  const data = await response.json();
  return Array.isArray(data.movies) ? data.movies : [];
}

async function fetchMetadata(ids: number[], signal: AbortSignal) {
  const batches = [];
  for (let offset = 0; offset < ids.length; offset += 25) {
    batches.push(fetchMovies('/api/movies?metadataIds=' + ids.slice(offset, offset + 25).join(','), signal));
  }
  return new Map((await Promise.all(batches)).flat().map((movie) => [movie.id, movie]));
}

function taste(movie: Movie) {
  return { ...movie, genres: movie.genres || [] };
}

function scoreTogether(movie: Movie, myTaste: MatchPreferences, friendTaste: MatchPreferences) {
  const signals = taste(movie);
  const mine = calculateMatchScore(signals, myTaste);
  const theirs = calculateMatchScore(signals, friendTaste);
  return Math.round(Math.min(mine, theirs) * 0.7 + Math.max(mine, theirs) * 0.3);
}

function preferences(profile: FriendProfile | undefined, metadata: Map<number, Movie>): MatchPreferences | null {
  if (!profile) return null;
  const moviesFor = (ids: number[] = []) => ids.flatMap((id) => {
    const movie = metadata.get(Number(id));
    return movie ? [taste(movie)] : [];
  });
  const favoriteMovies = moviesFor(profile.favorite_movie_ids);
  const dislikedMovies = moviesFor(profile.disliked_movie_ids);
  if (!favoriteMovies.length && !dislikedMovies.length && !profile.disliked_genres?.length &&
      !profile.favorite_directors?.length && !profile.favorite_cast?.length) return null;
  return {
    favoriteMovies,
    dislikedMovies,
    ratedMovies: [],
    dislikedGenres: profile.disliked_genres,
    favoriteDirectors: profile.favorite_directors,
    favoriteCast: profile.favorite_cast,
  };
}

function imageUrl(path: string | undefined, size: 'original' | 'w500') {
  return path?.startsWith('/') ? 'https://image.tmdb.org/t/p/' + size + path : path;
}

function MovieCard({ movie, badge, selected, onOpen }: { movie: Movie; badge?: string; selected: boolean; onOpen: (button: HTMLButtonElement) => void }) {
  const score = movie.match_percentage;
  const runtime = formatFilmRuntime(movie.runtime_minutes ?? movie.runtime, movie.id);
  return (
    <button type="button" aria-pressed={selected} onClick={(event) => onOpen(event.currentTarget)} className={'group relative isolate flex aspect-[2/3] w-full flex-col justify-end overflow-hidden rounded-xl border bg-[#18374f] p-2.5 text-left transition hover:border-sky-200/60 focus-visible:outline-2 focus-visible:outline-sky-300 ' + (selected ? 'border-rose-400 ring-2 ring-rose-400/70' : 'border-sky-200/20')}>
      {movie.poster_path && (
        <Image src={imageUrl(movie.poster_path, 'w500') || movie.poster_path} alt="" fill unoptimized sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw" className="-z-20 object-cover transition duration-300 motion-safe:group-hover:scale-105" />
      )}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#10283e] via-[#10283e]/40 to-transparent" />
      {(badge || score !== undefined) && (
        <span className={'absolute left-2 top-2 rounded-full border px-2 py-1 text-[10px] font-bold ' + (badge ? 'border-rose-300/50 bg-rose-950 text-rose-100' : matchColors[getMatchColorBand(score ?? 0)])}>
          {badge ?? (score + '% samenmatch')}
        </span>
      )}
      <span className="line-clamp-2 text-sm font-extrabold leading-tight text-white">{movie.title}</span>
      <span className="mt-1 text-xs text-sky-100/85">{[movie.release_date?.slice(0, 4), runtime].filter(Boolean).join(' · ')}</span>
      {!!movie.providers?.length && (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {movie.providers.slice(0, 4).map((provider) => <StreamingLogo key={provider.provider_id} name={provider.provider_name} logoPath={provider.logo_path} className="h-5 w-5 rounded" />)}
        </span>
      )}
    </button>
  );
}

export default function WatchTogetherPage({
  currentUserId, currentUserName, myWatchlist, myStreamingServices, friends, platforms,
  onSelectMovieSpotlight, onToggleWatchlist,
}: WatchTogetherPageProps) {
  const [friendId, setFriendId] = useState('');
  const friend = friends.find((item) => item.id === friendId);
  const selectedId = friend?.id;
  const [location, setLocation] = useState('any');
  const [maxRuntime, setMaxRuntime] = useState('');
  const [genre, setGenre] = useState('');
  const [page, setPage] = useState(1);
  const [collection, setCollection] = useState<'all' | 'shared' | 'top'>('all');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [filmDetails, setFilmDetails] = useState<Movie | null>(null);
  const spotlightRef = useRef<HTMLElement>(null);
  const filmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const trailerTriggerRef = useRef<HTMLButtonElement>(null);
  const trailerCloseRef = useRef<HTMLButtonElement>(null);
  const [trailer, setTrailer] = useState<{ movieId: number; key?: string; failed?: boolean } | null>(null);
  const cinemaTrailerKey = trailer?.movieId === selectedMovie?.id ? trailer?.key : undefined;
  const trailerLoading = !!trailer && trailer.movieId === selectedMovie?.id && !trailer.key && !trailer.failed;
  const [session, setSession] = useState<{
    pair: string;
    shared: Set<number> | null;
    profiles: FriendProfile[];
    metadata: Map<number, Movie>;
    watched: Set<number> | null;
  } | null>(null);
  const [results, setResults] = useState<{ query: string; movies: Movie[] | null } | null>(null);
  const pair = currentUserId && selectedId ? currentUserId + ':' + selectedId : '';
  const data = session?.pair === pair ? session : null;

  useEffect(() => {
    if (!pair || !currentUserId || !selectedId) return;
    const controller = new AbortController();
    const load = async () => {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error('Supabase ontbreekt');
      const people = [currentUserId, selectedId];
      const [shared, profileRows, watched] = await Promise.all([
        supabase.rpc('watch_together_overlap', { p_friend_id: selectedId }),
        supabase.from('profiles').select('id, streaming_services, favorite_movie_ids, disliked_genres, favorite_directors, favorite_cast').in('id', people),
        supabase.from('user_watched').select('movie_id').in('user_id', people),
      ]);
      if (controller.signal.aborted) return;
      const profiles: FriendProfile[] = profileRows.data || [];
      const sharedIds = shared.error ? null : new Set<number>((shared.data || []).map((item: { movie_id: number }) => Number(item.movie_id)));
      const visibleWatched = watched.error ? null : new Set<number>((watched.data || []).map((item) => Number(item.movie_id)));
      setSession({ pair, shared: sharedIds, profiles, metadata: new Map(), watched: visibleWatched });
      // Read optional onboarding fields separately so older profiles still work.
      const extra = await supabase.from('profiles').select('id, disliked_movie_ids').in('id', people);
      if (controller.signal.aborted) return;
      const dislikes = new Map((extra.data || []).map((item) => [item.id, item.disliked_movie_ids]));
      const members = profiles.map((item) => ({ ...item, disliked_movie_ids: dislikes.get(item.id) }));
      const ids = [...new Set(members.flatMap((item) => [...(item.favorite_movie_ids || []), ...(item.disliked_movie_ids || [])]).map(Number))];
      const metadata = await fetchMetadata([...new Set([...(sharedIds || []), ...ids])], controller.signal).catch(() => new Map<number, Movie>());
      if (!controller.signal.aborted) setSession({ pair, shared: sharedIds, profiles: members, metadata, watched: visibleWatched });
    };
    void load().catch(() => {
      if (!controller.signal.aborted) setSession({ pair, shared: null, profiles: [], metadata: new Map(), watched: null });
    });
    return () => controller.abort();
  }, [pair, currentUserId, selectedId]);

  const friendProfile = data?.profiles.find((item) => item.id === selectedId);
  const serviceNames = location === 'mine' ? myStreamingServices :
    location === 'friend' ? friendProfile?.streaming_services ?? [] : platforms.map((platform) => platform.name);
  const providerQuery = [...new Set(serviceNames)].sort().join(',');
  const query = pair && providerQuery ? pair + '|' + providerQuery + '|' + genre + '|' + page : '';
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ providers: providerQuery });
    if (genre) params.set('genre', genre);
    void Promise.all([page, page + 1].map((number) => {
      params.set('page', String(number));
      return fetchMovies('/api/movies?' + params.toString(), controller.signal);
    })).then((pages) => {
      if (!controller.signal.aborted) setResults({ query, movies: pages.flat() });
    }).catch(() => {
      if (!controller.signal.aborted) setResults({ query, movies: null });
    });
    return () => controller.abort();
  }, [query, providerQuery, genre, page]);

  const availableProviders = new Set(serviceNames);
  const options = results?.query === query ? results : null;
  const candidateById = new Map(myWatchlist.map((movie) => [movie.id, movie]));
  for (const movie of options?.movies || []) candidateById.set(movie.id, movie);
  for (const id of data?.shared || []) {
    const movie = data?.metadata.get(id);
    if (movie) candidateById.set(id, movie);
  }

  const metadata = data?.metadata ?? new Map<number, Movie>();
  const myTaste = preferences(data?.profiles.find((item) => item.id === currentUserId), metadata);
  const friendTaste = preferences(friendProfile, metadata);
  const sharedMovies: Movie[] = [];
  const suggestions: Movie[] = [];
  for (const source of candidateById.values()) {
    if (!data || data.watched?.has(source.id)) continue;
    const providers = (source.providers || []).filter((provider) => availableProviders.has(provider.provider_name));
    if (!providers.length || (genre && !source.genres?.includes(genre))) continue;
    const runtime = formatFilmRuntime(source.runtime_minutes ?? source.runtime, source.id);
    if (maxRuntime && (!runtime || Number.parseInt(runtime, 10) > Number(maxRuntime))) continue;
    const score = myTaste && friendTaste ? scoreTogether(source, myTaste, friendTaste) : undefined;
    const movie = { ...source, providers, match_percentage: score };
    if (data?.shared?.has(movie.id)) {
      if (myWatchlist.some((item) => item.id === movie.id)) sharedMovies.push(movie);
    } else {
      suggestions.push(movie);
    }
  }
  const byScore = (a: Movie, b: Movie) => (b.match_percentage ?? 0) - (a.match_percentage ?? 0);
  sharedMovies.sort(byScore);
  suggestions.sort(byScore);
  const shortlist = [...sharedMovies, ...suggestions].slice(0, 3);

  const openFilm = (movie: Movie, trigger: HTMLButtonElement) => {
    filmTriggerRef.current = trigger;
    if (selectedMovie?.id === movie.id) {
      spotlightRef.current?.focus({ preventScroll: true });
      spotlightRef.current?.scrollIntoView({ block: 'start' });
      return;
    }
    setTrailer(null);
    setFilmDetails(null);
    setSelectedMovie(movie);
  };

  const closeFilm = () => {
    setTrailer(null);
    setSelectedMovie(null);
    const trigger = filmTriggerRef.current;
    if (trigger?.isConnected) trigger.focus();
    else resultsHeadingRef.current?.focus();
  };

  const activeMovie = selectedMovie && !data?.watched?.has(selectedMovie.id) ? selectedMovie : null;
  const activeMovieId = activeMovie?.id;
  const details = filmDetails?.id === activeMovieId ? filmDetails : null;

  useEffect(() => {
    if (!activeMovieId) return;
    const spotlight = spotlightRef.current;
    spotlight?.focus({ preventScroll: true });
    spotlight?.scrollIntoView({ block: 'start' });
    const controller = new AbortController();
    void fetchMetadata([activeMovieId], controller.signal).then((movies) => {
      const movie = movies.get(activeMovieId);
      if (movie && !controller.signal.aborted) setFilmDetails(movie);
    }).catch(() => {});
    return () => controller.abort();
  }, [activeMovieId]);

  const closeTrailer = () => {
    setTrailer(null);
    trailerTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!cinemaTrailerKey || !activeMovieId) return;
    trailerCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTrailer(null);
        trailerTriggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [cinemaTrailerKey, activeMovieId]);

  const openCinemaTrailer = async (movieId: number) => {
    const request = { movieId };
    setTrailer(request);
    try {
      const response = await fetch('/api/movies?trailerMovieId=' + movieId);
      const result = response.ok ? await response.json() : {};
      setTrailer((current) => current === request ? { movieId, key: result.youtubeKey, failed: !result.youtubeKey } : current);
    } catch {
      setTrailer((current) => current === request ? { movieId, failed: true } : current);
    }
  };

  const visibleMovies = collection === 'top' ? shortlist : collection === 'shared' ? sharedMovies : [...sharedMovies, ...suggestions.slice(0, 18)];
  const backdrop = imageUrl(details?.backdrop_path || activeMovie?.backdrop_path, 'original');
  const poster = imageUrl(details?.poster_path || activeMovie?.poster_path, 'w500');
  const runtime = activeMovie && formatFilmRuntime(details?.runtime_minutes ?? details?.runtime ?? activeMovie.runtime_minutes ?? activeMovie.runtime, activeMovie.id);
  const credits = details?.cast?.length ? details.cast : activeMovie?.cast;
  const director = details?.director || activeMovie?.director;
  const overview = details?.overview || activeMovie?.overview;
  const rating = details?.rating || activeMovie?.rating;
  const ratingSource = (details?.rating ? details.rating_source : activeMovie?.rating_source) || 'TMDb';

  return (
    <div className="space-y-4 pb-8 text-sky-50">
      {activeMovie && (
        <section ref={spotlightRef} tabIndex={-1} aria-labelledby="samen-kijken-film-titel" className="relative isolate scroll-mt-24 overflow-hidden rounded-3xl border border-sky-200/25 bg-[#21445e] p-4 focus:outline-none sm:p-6">
          {backdrop && (
            <>
              <Image src={backdrop} alt="" fill unoptimized sizes="100vw" className="-z-20 object-cover object-center sm:object-right" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#173750] via-[#173750]/95 to-[#173750]/55 lg:to-[#173750]/15" />
            </>
          )}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-rose-200">🍿 Jullie filmavond</p>
            <button type="button" onClick={closeFilm} className={button}>Terug naar films</button>
          </div>
          <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,42rem)] sm:gap-x-6">
            <div className="relative row-span-1 aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/20 bg-[#10283e] sm:row-span-2">
              {poster && <Image src={poster} alt="" fill unoptimized sizes="(min-width: 640px) 176px, 76px" className="object-cover" />}
            </div>
            <div className="min-w-0 space-y-2">
              <h2 id="samen-kijken-film-titel" className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{activeMovie.title}</h2>
              <p className="text-xs font-medium text-sky-100/90 sm:text-sm">
                {[activeMovie.release_date?.slice(0, 4), (details?.genres?.length ? details.genres : activeMovie.genres)?.slice(0, 2).join(', '), runtime].filter(Boolean).join(' · ')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {activeMovie.match_percentage !== undefined && <span className={'rounded-full border px-2.5 py-1 text-xs font-bold ' + matchColors[getMatchColorBand(activeMovie.match_percentage)]}>{activeMovie.match_percentage}% samenmatch</span>}
                {rating && <span className="rounded-lg bg-[#10283e] px-2 py-1 text-xs font-bold"><span className={ratingSource === 'IMDb' ? 'rounded bg-[#f5c518] px-1 text-slate-950' : 'text-sky-100'}>{ratingSource}</span> {rating}</span>}
                {activeMovie.providers?.map((provider) => (
                  <StreamingLogo key={provider.provider_id} name={provider.provider_name} logoPath={provider.logo_path} className="h-6 w-6 rounded" />
                ))}
              </div>
            </div>
            <div className="col-span-2 space-y-3 sm:col-span-1 sm:col-start-2">
              {overview && <p className="text-sm leading-relaxed text-sky-50">{overview}</p>}
              {(director || credits?.length) && <p className="text-xs leading-relaxed text-sky-100/90">
                {director && <span className="mr-3"><strong>Regie</strong> {director}</span>}
                {!!credits?.length && <span><strong>Cast</strong> {credits.slice(0, 5).join(', ')}</span>}
              </p>}
              <div className="flex flex-wrap items-center gap-2">
                <button ref={trailerTriggerRef} type="button" onClick={() => openCinemaTrailer(activeMovie.id)} disabled={trailerLoading} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-45">{trailerLoading ? 'Trailer laden…' : '▶ Bekijk trailer'}</button>
                <button type="button" onClick={() => onToggleWatchlist(activeMovie)} className={button}>{myWatchlist.some((movie) => movie.id === activeMovie.id) ? '✓ In watchlist' : '+ Watchlist'}</button>
                <button type="button" onClick={() => onSelectMovieSpotlight(activeMovie.id)} className="px-2 py-2 text-sm font-semibold text-sky-100 hover:underline">Open in FilmMatch</button>
              </div>
              {trailer?.movieId === activeMovie.id && trailer.failed && <p role="status" className="text-sm text-rose-200">Er is geen trailer beschikbaar.</p>}
            </div>
          </div>
        </section>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-6">
        <aside aria-labelledby="samen-kijken-instellingen" className={'p-3.5 sm:p-4 ' + panel}>
          <h1 id="samen-kijken-instellingen" className="text-base font-black text-white">🍿 Samen Kijken</h1>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-1">
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-sky-100">
              Met wie?
              <select value={selectedId ?? ''} onChange={(event) => {
                setFriendId(event.target.value);
                setLocation('any');
                setPage(1);
                setCollection('all');
                setSelectedMovie(null);
                setTrailer(null);
              }} className={control + ' w-full'}>
                <option value="">Kies een vriend</option>
                {friends.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
              </select>
            </label>
            {friend && <>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-sky-100">
                Waar kijken jullie?
                <select value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} className={control + ' w-full'}>
                  <option value="any">Alle diensten</option>
                  <option value="mine">Bij {currentUserName === 'Jij' ? 'mij' : currentUserName}</option>
                  <option value="friend" disabled={!friendProfile?.streaming_services?.length}>Bij {friend.display_name}</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-sky-100">
                Speelduur
                <select aria-label="Maximale speelduur" value={maxRuntime} onChange={(event) => setMaxRuntime(event.target.value)} className={control + ' w-full'}>
                  <option value="">Elke speelduur</option><option value="90">Max. 90 min</option><option value="120">Max. 120 min</option><option value="150">Max. 150 min</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-semibold text-sky-100">
                Genre
                <select value={genre} onChange={(event) => { setGenre(event.target.value); setPage(1); }} className={control + ' w-full'}>
                  <option value="">Alle genres</option>
                  {['Actie', 'Animatie', 'Avontuur', 'Drama', 'Familie', 'Horror', 'Komedie', 'Misdaad', 'Sciencefiction', 'Thriller'].map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
            </>}
          </div>
        </aside>

        <section aria-labelledby="samen-kijken-resultaten" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={resultsHeadingRef} tabIndex={-1} id="samen-kijken-resultaten" className="min-w-0 text-xl font-black tracking-tight sm:text-2xl">{friend ? 'Filmavond met ' + friend.display_name : 'Wat kijken jullie vanavond?'}</h2>
            {friend && (
              <button type="button" onClick={(event) => openFilm(shortlist[Math.floor(Math.random() * shortlist.length)], event.currentTarget)} disabled={!shortlist.length} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-45">Verras ons</button>
            )}
          </div>

          {friend ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  ['all', 'Voor jullie'],
                  ['shared', 'Beide watchlists' + (sharedMovies.length ? ' · ' + sharedMovies.length : '')],
                  ['top', 'Onze top 3'],
                ] as const).map(([view, label]) => (
                  <button key={view} type="button" aria-pressed={collection === view} onClick={() => setCollection(view)} className={button + (collection === view ? ' bg-sky-200/20' : '')}>{label}</button>
                ))}
                {collection !== 'shared' && <button type="button" onClick={() => setPage((value) => value + 2)} disabled={!query || !options} className={button + ' sm:ml-auto'}>Andere films</button>}
              </div>
              {visibleMovies.length > 0 && (
                <div className={posterGrid}>
                  {visibleMovies.map((movie) => <MovieCard key={movie.id} movie={movie} badge={data?.shared?.has(movie.id) ? 'Beide watchlists' : undefined} selected={activeMovieId === movie.id} onOpen={(trigger) => openFilm(movie, trigger)} />)}
                </div>
              )}
              {(!visibleMovies.length || (collection !== 'shared' && options?.movies === null)) && (
                <p role="status" className={'p-3 text-sm text-sky-100/90 ' + panel}>
                  {collection === 'shared'
                    ? !data ? 'Jullie watchlists worden vergeleken…' : !data.shared ? 'De gezamenlijke watchlist is niet beschikbaar.' : data.shared.size ? 'Geen gedeelde films passen bij deze diensten of filters.' : 'Jullie hebben nog geen films op beide watchlists.'
                    : !query ? 'Kies een locatie met beschikbare streamingdiensten.' : !data || !options ? 'Filmtips laden…' : options.movies === null ? 'Nieuwe filmtips konden niet worden opgehaald.' : 'Geen films passen bij deze filters.'}
                </p>
              )}
            </>
          ) : (
            <p className={'p-4 text-sm text-sky-100/90 ' + panel}>{friends.length ? 'Kies een vriend om jullie gezamenlijke filmtips te zien.' : 'Voeg een vriend toe via Mijn vrienden om samen films te vinden.'}</p>
          )}
        </section>
      </div>

      {/* APARTE GROTE BIOSCOOP TRAILER OVERLAY (THEATER MODUS) */}
      {activeMovie && cinemaTrailerKey && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filmtrailer"
          onClick={closeTrailer}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-8 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl rounded-3xl overflow-hidden border border-white/20 bg-black shadow-2xl space-y-2"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Trailer Bioscoopmodus 🍿
              </span>
              <button
                type="button"
                ref={trailerCloseRef}
                aria-label="Sluit trailer"
                onClick={closeTrailer}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${cinemaTrailerKey}?autoplay=1`}
                title="Bioscoop Trailer"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
