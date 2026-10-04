'use client';

import Image from 'next/image';
import type { FriendActivityItem } from './types';

interface FriendFeedProps {
  friends: FriendActivityItem[];
  displayName: string;
  onOpenProfile: () => void;
  onViewAllActivity: () => void;
}

export default function FriendFeed({
  friends,
  displayName,
  onOpenProfile,
  onViewAllActivity,
}: FriendFeedProps) {
  const recentFriends = friends
    .filter((friend) => friend.minutesAgo >= 0 && friend.minutesAgo < 7 * 24 * 60)
    .sort((first, second) => first.minutesAgo - second.minutesAgo)
    .slice(0, 4);
  const formatElapsedTime = (minutesAgo: number) => {
    if (minutesAgo < 60) return `${minutesAgo} min geleden`;
    if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)}u geleden`;
    return `${Math.floor(minutesAgo / (24 * 60))}d geleden`;
  };

  return (
    <aside className="dashboard-feed w-64 shrink-0 flex-col space-y-6 overflow-y-auto border-l border-white/[0.1] p-5 sticky top-0 h-screen hidden xl:flex">
      <button
        onClick={onOpenProfile}
        className="group flex w-full items-center gap-3 border-b border-white/[0.12] pb-5 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-sm font-bold text-slate-950">{displayName.trim().slice(0, 1).toUpperCase() || '?'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-white group-hover:text-rose-100">{displayName || 'Mijn profiel'}</span>
          <span className="mt-0.5 block text-[10px] text-neutral-200">Jouw profiel en voorkeuren</span>
        </span>
        <span className="text-neutral-200 transition group-hover:translate-x-0.5">&rarr;</span>
      </button>

      <section>
        <div className="mb-4 space-y-2 border-b border-white/[0.12] pb-2">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xs font-bold uppercase tracking-wider text-white">Vriendenactiviteit</h2>
            <span className="activity-live h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
          </div>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={onViewAllActivity}
              aria-label="Alle vriendenactiviteit bekijken"
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white"
            >
              Activiteit
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {recentFriends.map((friend) => (
            <article key={friend.id} className="activity-card flex gap-3 rounded-xl border border-white/[0.1] bg-white/[0.05] p-3 transition hover:bg-white/[0.09]">
              <span className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden rounded bg-black/30">
                <Image
                  src={`https://image.tmdb.org/t/p/w185${friend.poster_path}`}
                  alt={friend.recentFilm}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </span>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${friend.avatarGradient} text-[10px] font-bold text-white`}>
                    {friend.initial}
                  </span>
                  <span className="min-w-0 whitespace-nowrap text-xs font-bold text-white">{friend.name}</span>
                </div>
                <p className="line-clamp-2 text-[11px] font-medium leading-snug text-neutral-100">{friend.recentFilm}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-xs font-bold tabular-nums text-amber-200">★ {friend.rating.toFixed(1)}</span>
                  <span className="text-[9px] text-neutral-300">{formatElapsedTime(friend.minutesAgo)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

    </aside>
  );
}
