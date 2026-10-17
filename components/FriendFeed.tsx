'use client';

import Image from 'next/image';
import type { FriendActivityItem } from './types';

interface FriendFeedProps {
  friends: FriendActivityItem[];
  displayName: string;
  onOpenProfile: () => void;
  onViewAllActivity: () => void;
  onSelectMovie?: (movieId: number) => void;
}

export default function FriendFeed({
  friends,
  displayName,
  onOpenProfile,
  onViewAllActivity,
  onSelectMovie,
}: FriendFeedProps) {
  const recentFriends = friends
    .filter((friend) => friend.minutesAgo >= 0 && friend.minutesAgo < 14 * 24 * 60)
    .sort((first, second) => first.minutesAgo - second.minutesAgo)
    .slice(0, 6);

  const formatElapsedTime = (minutesAgo: number) => {
    if (minutesAgo < 60) return `${minutesAgo} min geleden`;
    if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)}u geleden`;
    return `${Math.floor(minutesAgo / (24 * 60))}d geleden`;
  };

  return (
    <aside className="dashboard-feed w-72 shrink-0 flex-col space-y-6 overflow-y-auto border-l border-white/[0.1] p-5 sticky top-0 h-screen hidden xl:flex">
      {/* Profielheader */}
      <button
        type="button"
        onClick={onOpenProfile}
        className="group flex w-full items-center gap-3 border-b border-white/[0.12] pb-5 text-left transition"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-sm font-bold text-slate-950 shadow-md">
          {displayName.trim().slice(0, 1).toUpperCase() || '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-white group-hover:text-rose-200">
            {displayName || 'Mijn profiel'}
          </span>
          <span className="mt-0.5 block text-[10px] text-neutral-400">Jouw profiel &amp; voorkeuren</span>
        </span>
        <span className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-white">&rarr;</span>
      </button>

      {/* Vriendenactiviteit Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.12] pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Recent gekeken</h2>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <button
            type="button"
            onClick={onViewAllActivity}
            aria-label="Alle vriendenactiviteit bekijken"
            className="rounded-md px-2 py-0.5 text-[10px] font-bold text-rose-300 transition hover:bg-white/10 hover:text-white"
          >
            Alles bekijken &rarr;
          </button>
        </div>

        {recentFriends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-xs font-semibold text-neutral-300">Geen recente activiteit</p>
            <p className="mt-1 text-[10px] text-neutral-500">Zodra vrienden een film kijken en beoordelen, zie je het hier!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentFriends.map((friend) => (
              <article
                key={friend.id}
                onClick={() => {
                  if (onSelectMovie && friend.movieId) {
                    onSelectMovie(friend.movieId);
                  }
                }}
                className="activity-card group flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 transition duration-200 hover:border-white/20 hover:bg-white/[0.08] cursor-pointer"
              >
                {/* Filmposter */}
                <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg bg-black/40 shadow-md">
                  {friend.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${friend.poster_path}`}
                      alt={friend.recentFilm}
                      fill
                      unoptimized
                      className="object-cover transition duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[8px] text-neutral-600">Geen poster</div>
                  )}
                </div>

                {/* Activiteitsdetails */}
                <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${friend.avatarGradient} text-[9px] font-bold text-white shadow-sm`}>
                        {friend.initial}
                      </span>
                      <span className="truncate text-[11px] font-bold text-neutral-300 group-hover:text-white">
                        {friend.name}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-1 text-xs font-bold text-white group-hover:text-rose-200 transition">
                      {friend.recentFilm}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-bold text-amber-300 border border-white/10">
                      ★ {friend.rating ? friend.rating.toFixed(1) : 'Gezien'}
                    </span>
                    <span className="text-[9px] text-neutral-400">{formatElapsedTime(friend.minutesAgo)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}