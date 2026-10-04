'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { FriendActivityItem } from './types';

interface FriendActivityPageProps {
  activities: FriendActivityItem[];
  mode: 'activity' | 'friends';
}

interface ActivityMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  release_date: string;
  runtime_minutes: number | null;
  genres: string[];
  director?: string;
  cast: string[];
}

function formatElapsedTime(minutesAgo: number): string {
  if (minutesAgo < 60) return `${minutesAgo} minuten geleden`;
  if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)} uur geleden`;
  const days = Math.floor(minutesAgo / (24 * 60));
  return `${days} ${days === 1 ? 'dag' : 'dagen'} geleden`;
}

export default function FriendActivityPage({ activities, mode }: FriendActivityPageProps) {
  const recentActivities = useMemo(
    () => activities
      .filter((activity) => activity.minutesAgo >= 0 && activity.minutesAgo < 7 * 24 * 60)
      .sort((first, second) => first.minutesAgo - second.minutesAgo),
    [activities]
  );
  const friendProfiles = useMemo(() => {
    const profiles = new Map<number, FriendActivityItem>();
    activities.forEach((activity) => {
      if (!profiles.has(activity.friendId)) profiles.set(activity.friendId, activity);
    });
    return Array.from(profiles.values());
  }, [activities]);
  const [selectedFriend, setSelectedFriend] = useState('all');
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [minimumRating, setMinimumRating] = useState(0);
  const [friendSearch, setFriendSearch] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [movieDetails, setMovieDetails] = useState<Record<number, ActivityMovieDetails>>({});
  const activityMovieIds = recentActivities.map((activity) => activity.movieId).join(',');
  const friendNames = friendProfiles.map((friend) => friend.name);
  const averageRating = recentActivities.length
    ? (recentActivities.reduce((total, activity) => total + activity.rating, 0) / recentActivities.length).toFixed(1)
    : '–';
  const filteredActivities = recentActivities.filter((activity) =>
    (selectedFriend === 'all' || String(activity.friendId) === selectedFriend) && activity.rating >= minimumRating
  );
  const selectedFriendProfile = friendProfiles.find((friend) => friend.friendId === selectedFriendId);
  const displayedActivities = mode === 'friends' && selectedFriendId !== null
    ? activities.filter((activity) => activity.friendId === selectedFriendId).sort((first, second) => first.minutesAgo - second.minutesAgo)
    : filteredActivities;
  const visibleFriendProfiles = friendProfiles.filter((friend) =>
    friend.name.toLocaleLowerCase().includes(friendSearch.trim().toLocaleLowerCase())
  );
  const activityGroups = [
    { title: 'Vandaag', activities: displayedActivities.filter((activity) => activity.minutesAgo < 24 * 60) },
    { title: 'Gisteren', activities: displayedActivities.filter((activity) => activity.minutesAgo >= 24 * 60 && activity.minutesAgo < 2 * 24 * 60) },
    { title: 'Deze week', activities: displayedActivities.filter((activity) => activity.minutesAgo >= 2 * 24 * 60 && activity.minutesAgo < 7 * 24 * 60) },
    { title: 'Eerder', activities: displayedActivities.filter((activity) => activity.minutesAgo >= 7 * 24 * 60) },
  ].filter((group) => group.activities.length > 0);

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setInviteNotice('Link gekopieerd.');
    } catch {
      setInviteNotice('Link kopiëren is niet gelukt.');
    }
  };

  const shareInviteOnWhatsApp = () => {
    const message = encodeURIComponent(`Ik nodig je uit om FilmMatchNL te bekijken: ${window.location.origin}`);
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!activityMovieIds) return;

    let isActive = true;
    void fetch(`/api/movies?metadataIds=${activityMovieIds}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!isActive || !Array.isArray(data?.movies)) return;
        setMovieDetails(Object.fromEntries(data.movies.map((movie: ActivityMovieDetails) => [movie.id, movie])));
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [activityMovieIds]);

  if (mode === 'friends' && selectedFriendId === null) {
    return (
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-100/80">Voorbeeldprofielen</p>
            <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">Mijn vrienden</h1>
            <p className="mt-1 text-xs text-neutral-300">Open een profiel om alle bekeken en beoordeelde films te zien.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyInviteLink}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-100 transition hover:bg-white/10"
            >
              Link kopiëren
            </button>
            <button
              type="button"
              onClick={shareInviteOnWhatsApp}
              className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-bold text-[#10221b] transition hover:bg-emerald-200"
            >
              Deel via WhatsApp
            </button>
          </div>
        </div>

        {inviteNotice && <p role="status" className="text-xs text-emerald-200">{inviteNotice}</p>}
        <p className="text-[10px] text-neutral-400">Demo-uitnodiging: de link deelt de site, maar koppelt nog geen accounts.</p>

        <label className="block max-w-sm space-y-1.5 text-xs font-semibold text-neutral-200">
          Zoek vrienden
          <input
            type="search"
            value={friendSearch}
            onChange={(event) => setFriendSearch(event.target.value)}
            placeholder="Zoek op naam"
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
          />
        </label>

        {visibleFriendProfiles.length === 0 ? (
          <p className="py-10 text-sm text-neutral-300">Geen vrienden gevonden.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFriendProfiles.map((friend) => {
            const history = activities.filter((activity) => activity.friendId === friend.friendId);
            const latest = [...history].sort((first, second) => first.minutesAgo - second.minutesAgo)[0];
            const average = (history.reduce((total, activity) => total + activity.rating, 0) / history.length).toFixed(1);
            return (
              <button
                key={friend.friendId}
                type="button"
                onClick={() => setSelectedFriendId(friend.friendId)}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-left transition hover:border-rose-200/30 hover:bg-white/[0.08]"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${friend.avatarGradient} text-sm font-bold text-white`}>
                  {friend.initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{friend.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-neutral-300">{history.length} films gezien/beoordeeld</span>
                  <span className="block truncate text-[10px] text-neutral-400">Gemiddelde score {average}</span>
                  {latest && <span className="mt-1 block truncate text-[10px] text-neutral-400">Laatst: {latest.recentFilm}</span>}
                </span>
                <span className="shrink-0 text-neutral-300" aria-hidden="true">&rarr;</span>
              </button>
            );
          })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-100/80">
            {mode === 'activity' ? 'Afgelopen 7 dagen' : 'Volledige geschiedenis'}
          </p>
          <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
            {mode === 'activity' ? 'Vriendenactiviteit' : selectedFriendProfile?.name || 'Mijn vrienden'}
          </h1>
          <p className="mt-1 text-xs text-neutral-300">
            {mode === 'activity' ? 'Films die je vrienden hebben gekeken en beoordeeld.' : 'Alle bekeken en beoordeelde films.'}
          </p>
        </div>
        {mode === 'friends' && selectedFriendId !== null && (
          <button
            type="button"
            onClick={() => setSelectedFriendId(null)}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/10"
          >
            &larr; Mijn vrienden
          </button>
        )}
      </div>

      {mode === 'activity' && (
        <div className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-3">
          <div className="px-3 first:pl-0">
            <p className="text-lg font-black text-white">{recentActivities.length}</p>
            <p className="text-[10px] text-neutral-300">activiteiten</p>
          </div>
          <div className="px-3">
            <p className="text-lg font-black text-white">{friendProfiles.length}</p>
            <p className="text-[10px] text-neutral-300">vrienden</p>
          </div>
          <div className="px-3">
            <p className="text-lg font-black text-amber-200">{averageRating}</p>
            <p className="text-[10px] text-neutral-300">gem. score</p>
          </div>
        </div>
      )}

      {mode === 'activity' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-[10px] font-semibold text-neutral-300">
            Vriend
            <select
              value={selectedFriend}
              onChange={(event) => setSelectedFriend(event.target.value)}
              className="min-w-36 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-white outline-none focus:border-rose-300/60"
            >
              <option value="all">Alle vrienden</option>
              {friendNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-semibold text-neutral-300">
            Beoordeling
            <select
              value={minimumRating}
              onChange={(event) => setMinimumRating(Number(event.target.value))}
              className="min-w-36 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-white outline-none focus:border-rose-300/60"
            >
              <option value={0}>Alle scores</option>
              <option value={8}>8,0 en hoger</option>
              <option value={9}>9,0 en hoger</option>
            </select>
          </label>
          <span className="ml-auto text-[10px] text-neutral-400">{filteredActivities.length} resultaten</span>
        </div>
      )}

      {displayedActivities.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-300">Geen activiteit gevonden met deze filters.</p>
      ) : (
        <div className="space-y-6">
          {activityGroups.map((group) => (
            <section key={group.title} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-rose-200">{group.title}</h2>
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] text-neutral-400">{group.activities.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.activities.map((activity) => (
                  <article key={activity.id} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-lg border border-white/[0.1] bg-white/[0.04] p-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4 sm:p-4">
                    <div className="relative aspect-[2/3] w-[76px] overflow-hidden rounded-md bg-white/[0.06] sm:w-[88px]">
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${movieDetails[activity.movieId]?.poster_path || activity.poster_path}`}
                        alt={activity.recentFilm}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col justify-center gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${activity.avatarGradient} text-[10px] font-bold text-white`}>{activity.initial}</span>
                          <span className="break-words text-xs font-bold text-white">{activity.name}</span>
                        </div>
                        <span className="shrink-0 rounded-md border border-amber-200/20 bg-amber-200/[0.08] px-2 py-1 text-xs font-black tabular-nums text-amber-100">★ {activity.rating.toFixed(1)}</span>
                      </div>
                      <div>
                        <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">{movieDetails[activity.movieId]?.title || activity.recentFilm}</h3>
                        <p className="mt-1 line-clamp-1 text-[10px] text-neutral-300">
                          {[movieDetails[activity.movieId]?.release_date?.slice(0, 4), movieDetails[activity.movieId]?.runtime_minutes ? `${movieDetails[activity.movieId].runtime_minutes} min` : null, movieDetails[activity.movieId]?.genres?.join(', ')].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {movieDetails[activity.movieId]?.director && <p className="truncate text-[10px] text-neutral-300">Regie: {movieDetails[activity.movieId].director}</p>}
                      {movieDetails[activity.movieId]?.overview && <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-200">{movieDetails[activity.movieId].overview}</p>}
                      <span className="text-[10px] text-neutral-400">{formatElapsedTime(activity.minutesAgo)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}