'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { Movie, StreamingPlatform } from './types';
import { formatFilmRuntime } from './filmRuntime';
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
const posterGrid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
const matchColors = {
  strong: 'border-emerald-300/40 bg-emerald-950 text-emerald-100',
  medium: 'border-amber-300/40 bg-amber-950 text-amber-100',
  low: 'border-rose-300/40 bg-rose-950 text-rose-100',
};

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

function MovieCard({ movie, badge, onOpen }: { movie: Movie; badge?: string; onOpen: () => void }) {
  const score = movie.match_percentage;
  const runtime = formatFilmRuntime(movie.runtime_minutes ?? movie.runtime, movie.id);
  return (
    <button type="button" onClick={onOpen} className="group relative isolate flex aspect-[2/3] w-full flex-col justify-end overflow-hidden rounded-2xl border border-sky-200/20 bg-[#18374f] p-3 text-left transition hover:border-sky-200/60 focus-visible:outline-2 focus-visible:outline-sky-300">
      {movie.poster_path && (
        <Image src={movie.poster_path.startsWith('/') ? 'https://image.tmdb.org/t/p/w500' + movie.poster_path : movie.poster_path} alt="" fill unoptimized sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw" className="-z-20 object-cover transition duration-300 motion-safe:group-hover:scale-105" />
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
  const [hideWatched, setHideWatched] = useState(true);
  const [page, setPage] = useState(1);
  const [showTopThree, setShowTopThree] = useState(false);
  const [activeModalMovie, setActiveModalMovie] = useState<Movie | null>(null);
  const [modalDetails, setModalDetails] = useState<{ director?: string; cast?: string[] }>({});
  const [trailer, setTrailer] = useState<{ movieId: number; key?: string; failed?: boolean } | null>(null);
  const cinemaTrailerKey = trailer?.movieId === activeModalMovie?.id ? trailer?.key : undefined;
  const trailerLoading = !!trailer && trailer.movieId === activeModalMovie?.id && !trailer.key && !trailer.failed;
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
      // Read optional onboarding fields separately so older profiles still work.
      const extra = await supabase.from('profiles').select('id, disliked_movie_ids').in('id', people);
      const dislikes = new Map((extra.data || []).map((item) => [item.id, item.disliked_movie_ids]));
      const members = profiles.map((item) => ({ ...item, disliked_movie_ids: dislikes.get(item.id) }));
      const ids = [...new Set(members.flatMap((item) => [...(item.favorite_movie_ids || []), ...(item.disliked_movie_ids || [])]).map(Number))];
      const sharedIds = shared.error ? null : new Set<number>((shared.data || []).map((item: { movie_id: number }) => Number(item.movie_id)));
      const visibleWatched = watched.error ? null : new Set<number>((watched.data || []).map((item) => Number(item.movie_id)));
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
  const canScore = !!myTaste && !!friendTaste;
  const sharedMovies: Movie[] = [];
  const suggestions: Movie[] = [];
  for (const source of candidateById.values()) {
    const providers = (source.providers || []).filter((provider) => availableProviders.has(provider.provider_name));
    if (!providers.length || (genre && !source.genres?.includes(genre))) continue;
    const runtime = formatFilmRuntime(source.runtime_minutes ?? source.runtime, source.id);
    if (maxRuntime && (!runtime || Number.parseInt(runtime, 10) > Number(maxRuntime))) continue;
    if (hideWatched && data?.watched?.has(source.id)) continue;
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

  const handleOpenModal = (movie: Movie) => {
    setTrailer(null);
    setActiveModalMovie(movie);
    setModalDetails({ director: movie.director, cast: movie.cast });
  };

  const modalMovieId = activeModalMovie?.id;
  useEffect(() => {
    if (!modalMovieId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (cinemaTrailerKey) setTrailer(null);
      else setActiveModalMovie(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modalMovieId, cinemaTrailerKey]);

  useEffect(() => {
    if (!modalMovieId) return;
    const controller = new AbortController();
    void fetchMetadata([modalMovieId], controller.signal).then((movies) => {
      const movie = movies.get(modalMovieId);
      if (movie && !controller.signal.aborted) {
        setModalDetails((previous) => ({ director: movie.director || previous.director, cast: movie.cast?.length ? movie.cast : previous.cast }));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [modalMovieId]);

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

  return (
    <div className="space-y-6 pb-8 text-sky-50">
      <section className="rounded-3xl border border-sky-200/20 bg-gradient-to-br from-[#275573] to-[#17334e] p-5 sm:p-8">
        <p className="mb-2 text-xs font-bold text-rose-200">🍿 Samen Kijken</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{friend ? 'Filmavond met ' + friend.display_name : 'Wat kijken jullie vanavond?'}</h1>
        <p className="mt-2 max-w-2xl text-sm text-sky-100/85">Bekijk welke films jullie allebei willen zien en ontdek wat past bij jullie smaak en streamingdiensten.</p>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-sky-100">
            Met wie kijk je?
            <select value={selectedId ?? ''} onChange={(event) => {
              setFriendId(event.target.value);
              setLocation('any');
              setPage(1);
              setShowTopThree(false);
            }} className={control}>
              <option value="">Kies een vriend</option>
              {friends.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
            </select>
          </label>
          {friend && (
            <label className="grid gap-1.5 text-xs font-semibold text-sky-100">
              Waar kijken jullie?
              <select value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} className={control}>
                <option value="any">Alle ondersteunde diensten</option>
                <option value="mine">Bij {currentUserName === 'Jij' ? 'mij' : currentUserName}</option>
                <option value="friend" disabled={!friendProfile?.streaming_services?.length}>Bij {friend.display_name}</option>
              </select>
            </label>
          )}
        </div>
        {!friends.length && <p className="mt-3 text-sm text-sky-100/85">Voeg een vriend toe via Mijn vrienden om samen films te vinden.</p>}
      </section>

      {friend && (
        <>
          <div className={'flex flex-wrap items-center gap-3 p-3 ' + panel}>
            <select aria-label="Maximale speelduur" value={maxRuntime} onChange={(event) => setMaxRuntime(event.target.value)} className={control}>
              <option value="">Elke speelduur</option><option value="90">Max. 90 min</option><option value="120">Max. 120 min</option><option value="150">Max. 150 min</option>
            </select>
            <select aria-label="Genre" value={genre} onChange={(event) => { setGenre(event.target.value); setPage(1); }} className={control}>
              <option value="">Alle genres</option>
              {['Actie', 'Animatie', 'Avontuur', 'Drama', 'Familie', 'Horror', 'Komedie', 'Misdaad', 'Sciencefiction', 'Thriller'].map((name) => <option key={name}>{name}</option>)}
            </select>
            <label className="flex items-center gap-2 px-1 text-sm text-sky-100">
              <input type="checkbox" className="accent-rose-500" checked={hideWatched} onChange={(event) => setHideWatched(event.target.checked)} />
              Verberg bekende geziene films
            </label>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <button type="button" aria-pressed={showTopThree} onClick={() => setShowTopThree((value) => !value)} disabled={!shortlist.length && !showTopThree} className={button}>{showTopThree ? 'Sluit onze top 3' : 'Kies onze top 3'}</button>
              <button type="button" onClick={() => handleOpenModal(shortlist[Math.floor(Math.random() * shortlist.length)])} disabled={!shortlist.length} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-45">Verras ons</button>
            </div>
          </div>

          {showTopThree && (
            <section className={'space-y-3 p-4 ' + panel}>
              <h2 className="text-lg font-extrabold">Jullie top 3</h2>
              {shortlist.length ? <div className={posterGrid}>{shortlist.map((movie) => <MovieCard key={movie.id} movie={movie} onOpen={() => handleOpenModal(movie)} />)}</div> : <p className="text-sm text-sky-100/80">Pas de filters aan om weer films te zien.</p>}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xl font-extrabold">Deze willen jullie allebei zien</h2>
            {sharedMovies.length ? (
              <div className={posterGrid}>{sharedMovies.map((movie) => <MovieCard key={movie.id} movie={movie} badge="Beide watchlists" onOpen={() => handleOpenModal(movie)} />)}</div>
            ) : <p role="status" className={'p-4 text-sm text-sky-100/85 ' + panel}>
              {!data ? 'Jullie watchlists worden vergeleken…' :
                !data.shared ? 'De gezamenlijke watchlist is niet beschikbaar.' :
                data.shared.size ? 'Geen gedeelde films passen bij deze diensten of filters.' :
                'Jullie hebben nog geen films op beide watchlists.'}
            </p>}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold">{canScore ? 'Past bij jullie allebei' : 'Meer films voor vanavond'}</h2>
                <p className="mt-1 text-sm text-sky-100/80">{canScore ? 'De laagste van jullie twee scores telt het zwaarst.' : 'Samenmatches verschijnen zodra beide smaakprofielen beschikbaar zijn.'}</p>
              </div>
              <button type="button" onClick={() => setPage((value) => value + 2)} disabled={!query || !options} className={button}>Andere films</button>
            </div>
            {suggestions.length > 0 && <div className={posterGrid}>{suggestions.slice(0, 18).map((movie) => <MovieCard key={movie.id} movie={movie} onOpen={() => handleOpenModal(movie)} />)}</div>}
            {(!suggestions.length || options?.movies === null) && (
              <p role="status" className={'p-4 text-sm text-sky-100/85 ' + panel}>
                {!query ? 'Kies een locatie met beschikbare streamingdiensten.' : !options ? 'Filmtips laden…' : options.movies === null ? 'Nieuwe filmtips konden niet worden opgehaald.' : 'Geen films passen bij deze filters.'}
              </p>
            )}
          </section>
        </>
      )}
      {/* DETAIL MODAL VOOR DE FILM */}
      {activeModalMovie && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="samen-kijken-film-titel"
          onClick={() => setActiveModalMovie(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#16354f] shadow-2xl flex flex-col md:flex-row"
          >
            {/* Grote poster links */}
            <div className="relative w-full md:w-5/12 aspect-[2/3] md:aspect-auto bg-[#10283e] shrink-0">
              {activeModalMovie.poster_path && (
                <Image
                  src={activeModalMovie.poster_path.startsWith('/') ? 'https://image.tmdb.org/t/p/w500' + activeModalMovie.poster_path : activeModalMovie.poster_path}
                  alt={activeModalMovie.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              )}
              {activeModalMovie.match_percentage !== undefined && <span className={'absolute top-4 left-4 rounded-full border px-3 py-1.5 text-xs font-black ' + matchColors[getMatchColorBand(activeModalMovie.match_percentage)]}>
                {activeModalMovie.match_percentage}% samenmatch
              </span>}
            </div>

            {/* Uitgebreide details rechts */}
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 id="samen-kijken-film-titel" className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {activeModalMovie.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-neutral-400 font-medium">
                      <span>{activeModalMovie.release_date?.slice(0, 4)}</span>
                      {formatFilmRuntime(activeModalMovie.runtime_minutes ?? activeModalMovie.runtime, activeModalMovie.id) && <span>&bull; {formatFilmRuntime(activeModalMovie.runtime_minutes ?? activeModalMovie.runtime, activeModalMovie.id)}</span>}
                      {activeModalMovie.rating && (
                        <span className="text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="bg-[#f5c518] text-black px-1 rounded text-[9px] font-black">{activeModalMovie.rating_source || 'TMDb'}</span>
                          {activeModalMovie.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Sluit filmdetails"
                    onClick={() => setActiveModalMovie(null)}
                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Beschikbare streamingdiensten */}
                {activeModalMovie.providers && activeModalMovie.providers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 font-medium">Te zien op:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeModalMovie.providers.map((provider) => (
                        <span key={provider.provider_id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.08] border border-white/10 text-xs font-semibold text-white">
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

                {/* Genres */}
                {activeModalMovie.genres && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeModalMovie.genres.map((g) => (
                      <span key={g} className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold text-neutral-200">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Regisseur & Acteurs */}
                <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                  {modalDetails.director && (
                    <p className="text-neutral-300">
                      <span className="text-neutral-500 font-bold">Regisseur: </span>
                      <span className="text-white font-medium">{modalDetails.director}</span>
                    </p>
                  )}
                  {modalDetails.cast && modalDetails.cast.length > 0 && (
                    <p className="text-neutral-300">
                      <span className="text-neutral-500 font-bold">Acteurs: </span>
                      <span className="text-white font-medium">{modalDetails.cast.slice(0, 5).join(', ')}</span>
                    </p>
                  )}
                </div>

                {/* Beschrijving */}
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed pt-2">
                  {activeModalMovie.overview || 'Geen beschrijving beschikbaar voor deze titel.'}
                </p>
              </div>

              {trailer?.movieId === activeModalMovie.id && trailer.failed && <p role="status" className="text-sm text-rose-200">Er is geen trailer beschikbaar.</p>}
              <button type="button" onClick={() => onSelectMovieSpotlight(activeModalMovie.id)} className="self-start text-sm font-semibold text-sky-200 hover:underline">Open film in FilmMatch</button>
              {/* Actieknoppen */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => openCinemaTrailer(activeModalMovie.id)}
                  disabled={trailerLoading}
                  className="flex-1 py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 font-bold text-xs sm:text-sm text-white transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>▶</span> {trailerLoading ? 'Trailer starten...' : 'Bekijk trailer'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(activeModalMovie)}
                  className="py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs sm:text-sm text-white transition flex items-center gap-1.5"
                >
                  {myWatchlist.some((movie) => movie.id === activeModalMovie.id) ? '✓ In watchlist' : '+ Watchlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APARTE GROTE BIOSCOOP TRAILER OVERLAY (THEATER MODUS) */}
      {cinemaTrailerKey && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filmtrailer"
          onClick={() => setTrailer(null)}
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
                aria-label="Sluit trailer"
                onClick={() => setTrailer(null)}
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
