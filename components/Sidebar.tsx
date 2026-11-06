'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { DiscoveryMode, LibraryView, StreamingPlatform } from './types';

interface SidebarProps {
  libraryView: LibraryView;
  discoveryMode: DiscoveryMode;
  friendsActive: boolean;
  watchTogetherActive: boolean;
  profileActive: boolean;
  displayName: string;
  watchlistCount: number;
  selectedPlatforms: string[];
  minimumImdbRating: number;
  platforms: StreamingPlatform[];
  onNavigate: (view: LibraryView) => void;
  onSelectDiscoveryMode: (mode: DiscoveryMode) => void;
  onOpenFriends: () => void;
  onOpenWatchTogether: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onTogglePlatform: (name: string) => void;
  onMinimumImdbRatingChange: (rating: number) => void;
  onResetToHome?: () => void;
}

const OFFICIAL_LOGOS: Record<string, string> = {
  Netflix: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
  'Prime Video': '/pvsKGltTBD6bJk1n5Q2p57T77o6.jpg',
  'Disney+': '/97yvRBw1GzX7fXprcF80919jwCS.jpg',
  'HBO Max': '/Ajqyt5Gh8fqGaSlXMj9310wI75x.jpg',
  Videoland: '/9A1DaAYi4SYahE4a9fl0Z4qVwZ6.jpg',
};

function getLogoSource(logoPath: string | undefined): string | undefined {
  if (!logoPath) return undefined;

  if (/^https?:\/\//i.test(logoPath)) {
    return logoPath;
  }

  if (logoPath.startsWith('/t/p/')) {
    return `https://image.tmdb.org${logoPath}`;
  }

  return `https://image.tmdb.org/t/p/w185${logoPath.startsWith('/') ? '' : '/'}${logoPath}`;
}

export default function Sidebar({
  libraryView,
  discoveryMode,
  friendsActive,
  watchTogetherActive,
  profileActive,
  displayName,
  watchlistCount,
  selectedPlatforms,
  platforms,
  onNavigate,
  onSelectDiscoveryMode,
  onOpenFriends,
  onOpenWatchTogether,
  onOpenProfile,
  onLogout,
  onTogglePlatform,
  onResetToHome,
}: SidebarProps) {
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  const discoveryItems: { mode: DiscoveryMode; label: string; icon: string }[] = [
    { mode: 'recommended', label: 'Aanbevolen', icon: '★' },
  ];

  const handleLogoClick = () => {
    if (onResetToHome) {
      onResetToHome();
    } else {
      onNavigate('discover');
    }
  };

  return (
    <aside className="dashboard-sidebar sticky top-0 z-30 flex h-screen w-40 shrink-0 flex-col items-stretch justify-between border-r border-white/[0.1] px-2 py-4 sm:w-48 xl:w-60 xl:px-3">
      <div className="flex w-full flex-col items-stretch gap-6">
        <button
          onClick={handleLogoClick}
          title="Herstel alle filters en ga naar startpagina"
          aria-label="FilmMatchNL startpagina en filters resetten"
          className="flex h-11 w-full items-center justify-start gap-2 rounded-lg px-1 text-left transition hover:bg-white/[0.06]"
        >
          <span className="shrink-0 text-[25px] leading-none" aria-hidden="true">🍿</span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-[13px] font-black leading-4 text-white">
              FILM<span className="text-rose-500">MATCH</span>NL
            </span>
            <span className="block whitespace-nowrap text-[9px] font-medium leading-3 text-neutral-300">
              De juiste film voor vanavond
            </span>
          </span>
        </button>

        <nav className="flex flex-col items-stretch gap-1">
          {discoveryItems.map((item) => {
            const active =
              !friendsActive &&
              !watchTogetherActive &&
              !profileActive &&
              libraryView === 'discover' &&
              discoveryMode === item.mode;

            return (
              <button
                key={item.mode}
                onClick={() => onSelectDiscoveryMode(item.mode)}
                title={item.label}
                aria-label={item.label}
                aria-pressed={active}
                className={`flex h-9 w-full items-center justify-start gap-2 rounded-lg px-3 text-xs font-semibold transition ${
                  active
                    ? 'bg-rose-400/20 text-rose-50'
                    : 'text-neutral-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => onNavigate('watchlist')}
            title="Watchlist"
            aria-label={`Watchlist, ${watchlistCount} films`}
            aria-pressed={!friendsActive && !watchTogetherActive && libraryView === 'watchlist'}
            className={`flex h-9 w-full items-center justify-start gap-2 rounded-lg px-3 text-xs font-semibold transition ${
              !friendsActive && !watchTogetherActive && libraryView === 'watchlist'
                ? 'bg-amber-300/20 text-amber-50'
                : 'text-neutral-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">🔖</span>
            <span className="truncate">Watchlist</span>
            {watchlistCount > 0 && (
              <span className="ml-auto shrink-0 text-[10px]">{watchlistCount}</span>
            )}
          </button>

          <button
            onClick={() => onNavigate('watched')}
            title="Gezien"
            aria-label="Gezien"
            aria-pressed={!friendsActive && !watchTogetherActive && libraryView === 'watched'}
            className={`flex h-9 w-full items-center justify-start gap-2 rounded-lg px-3 text-xs font-semibold transition ${
              !friendsActive && !watchTogetherActive && libraryView === 'watched'
                ? 'bg-emerald-300/20 text-emerald-50'
                : 'text-neutral-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">✓</span>
            <span>Gezien</span>
          </button>

          <button
            onClick={() => onNavigate('cinema')}
            title="In de bioscoop"
            aria-label="In de bioscoop"
            aria-pressed={!friendsActive && !watchTogetherActive && libraryView === 'cinema'}
            className={`flex h-9 w-full items-center justify-start gap-2 rounded-lg px-3 text-xs font-semibold transition ${
              !friendsActive && !watchTogetherActive && libraryView === 'cinema'
                ? 'border border-rose-500/30 bg-rose-500/20 text-rose-100'
                : 'text-neutral-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">🎟️</span>
            <span className="truncate">In de bioscoop</span>
          </button>

          <button
            type="button"
            onClick={onOpenFriends}
            title="Vriendenactiviteit"
            aria-label="Vriendenactiviteit"
            aria-pressed={friendsActive}
            className={`flex h-9 w-full items-center justify-start gap-2 rounded-lg px-3 text-xs font-semibold transition ${
              friendsActive
                ? 'bg-rose-400/20 text-rose-50'
                : 'text-neutral-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">👥</span>
            <span className="truncate">Vriendenactiviteit</span>
          </button>

          <button
            type="button"
            onClick={onOpenWatchTogether}
            title="Samen Kijken"
            aria-label="Samen Kijken"
            aria-pressed={watchTogetherActive}
            className={`flex h-9 w-full items-center justify-start gap-2 rounded-lg px-3 text-xs font-semibold transition ${
              watchTogetherActive
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-neutral-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">🛋️</span>
            <span>Samen Kijken</span>
          </button>
        </nav>

        <div className="w-full border-t border-white/[0.1] pt-4">
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-wider text-neutral-200">
            Mijn diensten
          </p>

          <div className="flex flex-col items-stretch gap-1.5">
            {platforms.map((platform) => {
              const active = selectedPlatforms.includes(platform.name);
              const logoPath = OFFICIAL_LOGOS[platform.name] || platform.logo_path;
              const logoSource = getLogoSource(logoPath);
              const logoFailed = failedLogos[platform.name];

              return (
                <button
                  key={platform.id}
                  onClick={() => onTogglePlatform(platform.name)}
                  title={`${platform.name}: ${active ? 'ingeschakeld' : 'uitgeschakeld'}`}
                  aria-label={`${platform.name} ${active ? 'uitschakelen' : 'inschakelen'}`}
                  aria-pressed={active}
                  className={`group relative flex h-8 w-full items-center justify-start gap-2.5 rounded-lg border px-2 transition ${
                    active
                      ? 'border-white/15 bg-white/[0.08] shadow-sm'
                      : 'border-transparent opacity-50 grayscale hover:opacity-80'
                  }`}
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-900/70 shadow">
                    {logoSource && !logoFailed ? (
                      <Image
                        src={logoSource}
                        alt={`${platform.name} logo`}
                        fill
                        unoptimized
                        sizes="28px"
                        onError={() =>
                          setFailedLogos((current) => ({
                            ...current,
                            [platform.name]: true,
                          }))
                        }
                        className="object-contain p-0.5"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-neutral-800 text-[9px] font-bold text-white">
                        {platform.mark || platform.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}

                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute right-0 top-0 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-neutral-950"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-neutral-100">
                    {platform.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={onOpenProfile}
          title="Jouw profiel en voorkeuren"
          aria-label="Jouw profiel en voorkeuren"
          aria-pressed={profileActive}
          className={`flex h-10 w-full items-center justify-start gap-2 rounded-lg px-2 text-xs font-semibold transition ${
            profileActive
              ? 'bg-rose-400/20 text-rose-50'
              : 'text-neutral-200 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-[10px] font-black text-slate-950">
            {displayName.trim().slice(0, 1).toUpperCase() || '?'}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[11px] font-semibold">
              {displayName || 'Jouw profiel'}
            </span>
            <span className="block text-[9px] text-neutral-300">Mijn profiel</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          title="Uitloggen"
          aria-label="Uitloggen"
          className="flex h-9 w-full items-center justify-start gap-2 rounded-lg bg-white/[0.04] px-2 text-neutral-300 transition hover:bg-rose-600 hover:text-white"
        >
          <span aria-hidden="true" className="w-7 shrink-0 text-center text-base leading-none">
            ↪
          </span>
          <span className="text-xs font-semibold">Uitloggen</span>
        </button>
      </div>
    </aside>
  );
}