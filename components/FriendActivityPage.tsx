'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import HeroSpotlight from './HeroSpotlight';
import { MovieCard } from './MovieGrid';
import type { FriendActivityItem, Movie } from './types';
import { calculateMatchScore, type MatchPreferences } from '../lib/recommendations/matchScore';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

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
const requestButton = 'rounded-full border border-sky-200/25 px-3 py-2 text-xs font-bold hover:bg-sky-200/15 disabled:opacity-50';

type FriendRequest = { person_id: string; display_name: string; incoming: boolean };

function FriendRequests({ friends, onChanged }: { friends: FriendProfile[]; onChanged?: () => void }) {
  const [panel, setPanel] = useState<'add' | 'requests' | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<FriendProfile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const requestRevision = useRef(0);

  const loadRequests = async () => {
    const revision = ++requestRevision.current;
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error();
      const { data, error } = await supabase.rpc('fm_friend_requests');
      if (error) throw error;
      if (revision === requestRevision.current) setRequests(data ?? []);
    } catch {
      if (revision === requestRevision.current) setError('Verzoeken konden niet worden opgehaald.');
    }
  };

  useEffect(() => {
    void loadRequests();
    const refresh = () => { void loadRequests(); };
    window.addEventListener('focus', refresh);
    return () => {
      requestRevision.current++;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setStatus('');
    setError('');
    try { await action(); }
    catch { setError('Dit is niet gelukt. Probeer het opnieuw.'); }
    finally { setBusy(false); }
  };

  const search = () => run(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error();
    const { data, error } = await supabase.rpc('fm_find_friend', { p_name: query.trim() });
    if (error) throw error;
    setMatches(data ?? []);
  });

  const send = (id: string) => run(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error();
    const { data, error } = await supabase.rpc('fm_send_friend_request', { p_recipient: id });
    if (error) throw error;
    setStatus(data === 'friends' ? 'Jullie zijn al vrienden.' : data === 'incoming' ? 'Deze persoon heeft jou al een verzoek gestuurd.' : 'Vriendschapsverzoek verstuurd.');
    if (data === 'incoming') setPanel('requests');
    await loadRequests();
  });

  const answer = (id: string, accept: boolean) => run(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error();
    const { data, error } = await supabase.rpc('fm_answer_friend_request', { p_sender: id, p_accept: accept });
    if (error) throw error;
    if (accept) onChanged?.();
    setStatus(!data ? 'Dit verzoek is niet meer open.' : accept ? 'Vriendschap geaccepteerd.' : 'Verzoek geweigerd.');
    await loadRequests();
  });

  const incoming = requests.filter((request) => request.incoming);
  const outgoing = requests.filter((request) => !request.incoming);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={requestButton} aria-expanded={panel === 'add'} onClick={() => { setPanel(panel === 'add' ? null : 'add'); setError(''); setStatus(''); }}>+ Vriend toevoegen</button>
        <button type="button" className={requestButton} aria-expanded={panel === 'requests'} onClick={() => { setPanel(panel === 'requests' ? null : 'requests'); setError(''); setStatus(''); if (panel !== 'requests') void loadRequests(); }}>
          Verzoeken{incoming.length > 0 ? ` (${incoming.length})` : ''}
        </button>
      </div>
      {panel && (
        <section aria-label={panel === 'add' ? 'Vriend toevoegen' : 'Vriendschapsverzoeken'} className="max-w-xl space-y-3 rounded-xl border border-sky-200/20 bg-[#17354f] p-3">
          {panel === 'add' ? (
            <>
              <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
                <input type="search" aria-label="Gebruikersnaam" placeholder="Exacte gebruikersnaam" value={query} maxLength={100} disabled={busy} onChange={(event) => { setQuery(event.target.value); setMatches(null); }} className="min-w-36 flex-1 rounded-lg border border-sky-200/25 bg-[#10283e] px-3 py-2 text-sm" />
                <button type="submit" className={requestButton} disabled={busy || query.trim().length < 2}>Zoeken</button>
              </form>
              {matches?.length === 0 && <p role="status" className="text-sm text-sky-100/80">Geen gebruiker met die naam gevonden.</p>}
              {matches?.map((person) => {
                const request = requests.find((item) => item.person_id === person.id);
                return (
                  <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>{person.display_name}</span>
                    {friends.some((friend) => friend.id === person.id) ? <span>Al vrienden</span> :
                      request ? <span>{request.incoming ? 'Verzoek ontvangen' : 'In afwachting'}</span> :
                      <button type="button" className={requestButton} disabled={busy} onClick={() => void send(person.id)}>Verzoek sturen</button>}
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold">Ontvangen</h2>
              {!incoming.length && <p className="text-sm text-sky-100/80">Geen openstaande verzoeken.</p>}
              {incoming.map((request) => (
                <div key={request.person_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{request.display_name}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} className={requestButton + ' bg-rose-600 hover:bg-rose-500'} onClick={() => void answer(request.person_id, true)}>Accepteren</button>
                    <button type="button" disabled={busy} className={requestButton} onClick={() => void answer(request.person_id, false)}>Weigeren</button>
                  </div>
                </div>
              ))}
              <h2 className="text-sm font-bold">Verstuurd</h2>
              {!outgoing.length && <p className="text-sm text-sky-100/80">Geen verstuurde verzoeken in afwachting.</p>}
              {outgoing.map((request) => <p key={request.person_id} className="text-sm">{request.display_name} · In afwachting</p>)}
            </>
          )}
          {status && <p role="status" className="text-sm text-sky-100">{status}</p>}
          {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
        </section>
      )}
    </div>
  );
}

function getFriendKey(item: FriendActivityItem) {
  return String(item.friendId ?? item.name);
}

function normalizeFriendName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('nl');
}

function formatElapsedTime(minutesAgo: number) {
  if (minutesAgo < 1) return 'Zojuist';
  if (minutesAgo < 60) return `${minutesAgo} min geleden`;
  if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)} uur geleden`;
  const days = Math.floor(minutesAgo / (24 * 60));
  return days === 1 ? 'Gisteren' : `${days} dagen geleden`;
}

export default function FriendActivityPage({
  currentUserId,
  onFriendshipChanged,
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
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const friendPickerButtonRef = useRef<HTMLButtonElement>(null);
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
    }).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }, [activities, friends]);
  const activeFriend = friendList.find((friend) => friend.id === selectedFriendFilter);
  const activeFriendId = activeFriend?.id;
  const searchName = normalizeFriendName(friendQuery);
  const visibleFriends = friendPickerOpen ? friendList.filter((friend) => normalizeFriendName(friend.name).includes(searchName)) : [];

  const selectFriend = (id: string) => {
    setSelectedFriendFilter(id);
    if (id !== 'all' && spotlightActivity && getFriendKey(spotlightActivity) !== id) setSpotlightActivity(null);
    setFriendPickerOpen(false);
    friendPickerButtonRef.current?.focus();
  };

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
      <section aria-labelledby="mijn-vrienden-titel" className="relative flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 id="mijn-vrienden-titel" className="text-lg font-black tracking-tight sm:text-xl">Mijn vrienden</h1>

        {friendList.length > 0 && (
          <div
            className="min-w-0 sm:relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFriendPickerOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || !friendPickerOpen) return;
              event.stopPropagation();
              setFriendPickerOpen(false);
              friendPickerButtonRef.current?.focus();
            }}
          >
            <button
              ref={friendPickerButtonRef}
              type="button"
              aria-expanded={friendPickerOpen}
              aria-controls={friendPickerOpen ? 'mijn-vrienden-filter' : undefined}
              onClick={() => {
                setFriendQuery('');
                setFriendPickerOpen(!friendPickerOpen);
              }}
              className={'flex max-w-48 items-center gap-2 rounded-full border border-sky-200/25 px-3 py-2 text-xs font-bold transition hover:bg-sky-200/15 ' + (activeFriend ? 'bg-sky-200/15' : '')}
            >
              <span className="truncate">{activeFriend?.name ?? 'Alle vrienden'}</span>
              <span aria-hidden="true" className="text-sky-200">⌄</span>
            </button>
            {friendPickerOpen && (
              <div id="mijn-vrienden-filter" role="group" aria-label="Filter op vriend" className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border border-sky-200/25 bg-[#17354f] p-2 shadow-xl shadow-black/30 sm:inset-x-auto sm:left-0 sm:w-64">
                <label>
                  <span className="sr-only">Zoek een vriend</span>
                  <input
                    type="search"
                    autoFocus
                    value={friendQuery}
                    onChange={(event) => setFriendQuery(event.target.value)}
                    placeholder="Zoek een vriend…"
                    className="w-full rounded-lg border border-sky-200/25 bg-[#10283e] px-3 py-2 text-base placeholder:text-sky-100/55 focus-visible:outline-2 focus-visible:outline-sky-300 sm:text-sm"
                  />
                </label>
                <button type="button" aria-pressed={!activeFriend} onClick={() => selectFriend('all')} className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold hover:bg-sky-200/10 aria-pressed:bg-sky-200/15">
                  Alle vrienden
                </button>
                {visibleFriends.length ? (
                  <ul className="max-h-56 space-y-0.5 overflow-y-auto overscroll-contain">
                    {visibleFriends.map((friend) => (
                      <li key={friend.id}>
                        <button
                          type="button"
                          aria-pressed={friend.id === activeFriendId}
                          onClick={() => selectFriend(friend.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold hover:bg-sky-200/10 aria-pressed:bg-sky-200/15"
                        >
                          <span aria-hidden="true" className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr text-[10px] font-black text-white ' + friend.colors}>{friend.initial}</span>
                          <span className="truncate">{friend.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p role="status" className="px-2.5 py-2 text-xs text-sky-100/75">Geen vrienden gevonden.</p>}
              </div>
            )}
          </div>
        )}

        {displayedActivities.length > 1 && (
          <div role="group" aria-label="Sorteer activiteiten" className="flex flex-wrap gap-0.5 rounded-full sm:ml-auto border border-sky-200/20 bg-[#15354f] p-0.5">
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
      </section>

      {currentUserId && <FriendRequests key={currentUserId} friends={friends} onChanged={onFriendshipChanged} />}

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

      <section aria-label="Beoordelingen van vrienden">
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
