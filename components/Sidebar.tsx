'use client';

import { useState } from 'react';
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

const STREAMING_BRAND_ASSETS: Record<string, { logo: string; fallbackBg: string; textMark: string }> = {
  Netflix: {
    logo: 'https://image.tmdb.org/t/p/w92/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
    fallbackBg: '#E50914',
    textMark: 'N',
  },
  'Prime Video': {
    logo: 'https://image.tmdb.org/t/p/w92/pvsKGltTBD6bJk1n5Q2p57T77o6.jpg',
    fallbackBg: '#00A8E1',
    textMark: 'P',
  },
  'Disney+': {
    logo: 'https://image.tmdb.org/t/p/w92/97yvRBw1GzX7fXprcF80919jwCS.jpg',
    fallbackBg: '#113CCF',
    textMark: 'D+',
  },
  'HBO Max': {
    logo: 'https://image.tmdb.org/t/p/w92/Ajqyt5Gh8fqGaSlXMj9310wI75x.jpg',
    fallbackBg: '#5822B4',
    textMark: 'MAX',
  },
  Videoland: {
    logo: 'https://image.tmdb.org/t/p/w92/9A1DaAYi4SYahE4a9fl0Z4qVwZ6.jpg',
    fallbackBg: '#E50043',
    textMark: 'V',
  },
};

function resolveLogo(platformName: string, rawLogoPath?: string): string {
  const branded = STREAMING_BRAND_ASSETS[platformName];
  if (branded?.logo) return branded.logo;
  if (!rawLogoPath) return '';
  if (/^https?:\/\//i.test(rawLogoPath)) return rawLogoPath;
  const clean = rawLogoPath.startsWith('/') ? rawLogoPath : `/${rawLogoPath}`;
  return `https://image.tmdb.org/t/p/w92${clean}`;
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
  minimumImdbRating,
  platforms,
  onNavigate,
  onSelectDiscoveryMode,
  onOpenFriends,
  onOpenWatchTogether,
  onOpenProfile,
  onLogout,
  onTogglePlatform,
  onMinimumImdbRatingChange,
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
    <aside className="dashboard-sidebar sticky top-0 z-30 flex h-screen w-44 shrink-0 flex-col items-stretch justify-between border-r border-white/[0.1] bg-[#070a12]/95 px-3 py-4 backdrop-blur-xl sm:w-52 xl:w-60">
      <div className="flex w-full flex-col items-stretch gap-5">
        {/* Logo / Home knop zonder oranje achtergrond */}
        <button
          type="button"
          onClick={handleLogoClick}
          title="Herstel alle filters en ga naar startpagina"
          aria-label="FilmMatchNL startpagina en filters resetten"
          className="flex h-11 w-full items-center justify-start gap-2.5 rounded-xl px-1.5 text-left transition hover:bg-white/[0.06]"
        >
          <span className="shrink-0 text-2xl leading-none">
            🍿
          </span>
          <div className="min-w-0">
            <span className="block whitespace-nowrap text-sm font-black leading-4 tracking-tight text-white">
              FILM<span className="text-rose-500">MATCH</span>NL
            </span>
            <span className="block whitespace-nowrap text-[9px] font-medium leading-3 text-neutral-400">
              De juiste film voor vanavond
            </span>
          </div>
        </button>

        {/* Navigatiemenu */}
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
                type="button"
                onClick={() => onSelectDiscoveryMode(item.mode)}
                title={item.label}
                aria-label={item.label}
                aria-pressed={active}
                className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
                  active
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-neutral-300 hover:bg-white/10 hover:text-white'
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
            type="button"
            onClick={() => onNavigate('watchlist')}
            title="Watchlist"
            aria-label={`Watchlist, ${watchlistCount} films`}
            aria-pressed={!friendsActive && !watchTogetherActive && libraryView === 'watchlist'}
            className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
              !friendsActive && !watchTogetherActive && libraryView === 'watchlist'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">🔖</span>
            <span className="truncate">Watchlist</span>
            {watchlistCount > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {watchlistCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('watched')}
            title="Gezien"
            aria-label="Gezien"
            aria-pressed={!friendsActive && !watchTogetherActive && libraryView === 'watched'}
            className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
              !friendsActive && !watchTogetherActive && libraryView === 'watched'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">✓</span>
            <span>Gezien</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('cinema')}
            title="In de bioscoop"
            aria-label="In de bioscoop"
            aria-pressed={!friendsActive && !watchTogetherActive && libraryView === 'cinema'}
            className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
              !friendsActive && !watchTogetherActive && libraryView === 'cinema'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">🍿</span>
            <span className="truncate">In de bioscoop</span>
          </button>

          <button
            type="button"
            onClick={onOpenFriends}
            title="Vriendenactiviteit"
            aria-label="Vriendenactiviteit"
            aria-pressed={friendsActive}
            className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
              friendsActive
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
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
            className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-xl px-3 text-xs font-semibold transition ${
              watchTogetherActive
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-4 shrink-0 text-center text-sm" aria-hidden="true">🛋️</span>
            <span>Samen Kijken</span>
          </button>
        </nav>

        {/* Streamingdiensten */}
        <div className="w-full border-t border-white/[0.08] pt-3">
          <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
            Mijn diensten
          </p>

          <div className="flex flex-col items-stretch gap-1.5">
            {platforms.map((platform) => {
              const active = selectedPlatforms.includes(platform.name);
              const logoUrl = resolveLogo(platform.name, platform.logo_path);
              const isFailed = failedLogos[platform.name] || !logoUrl;
              const brandInfo = STREAMING_BRAND_ASSETS[platform.name];

              return (
                <button
                  key={platform.id || platform.name}
                  type="button"
                  onClick={() => onTogglePlatform(platform.name)}
                  title={`${platform.name}: ${active ? 'ingeschakeld' : 'uitgeschakeld'}`}
                  aria-label={`${platform.name} ${active ? 'uitschakelen' : 'inschakelen'}`}
                  aria-pressed={active}
                  className={`group relative flex h-9 w-full items-center justify-between rounded-xl border px-2.5 transition-all ${
                    active
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-white shadow-sm'
                      : 'border-white/5 bg-white/[0.02] text-neutral-400 opacity-60 hover:bg-white/5 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow">
                      {!isFailed ? (
                        <img
                          src={logoUrl}
                          alt={`${platform.name} logo`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={() =>
                            setFailedLogos((current) => ({
                              ...current,
                              [platform.name]: true,
                            }))
                          }
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center text-[9px] font-black tracking-tighter text-white"
                          style={{ backgroundColor: brandInfo?.fallbackBg || platform.color || '#262626' }}
                        >
                          {brandInfo?.textMark || platform.mark || platform.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-xs font-semibold">{platform.name}</span>
                  </div>

                  <span
                    className={`h-2 w-2 shrink-0 rounded-full transition-all ${
                      active
                        ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 ring-2 ring-emerald-400/20'
                        : 'bg-neutral-600'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Min. IMDb Slider */}
        <div className="border-t border-white/[0.08] pt-3">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
              Min. IMDb
            </span>
            <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              {minimumImdbRating > 0 ? `${minimumImdbRating.toFixed(1)}+` : 'Alles'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="9"
            step="0.5"
            value={minimumImdbRating}
            onChange={(e) => onMinimumImdbRatingChange(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer rounded-lg bg-neutral-800 accent-rose-500"
          />
        </div>
      </div>

      {/* Profiel & Uitloggen onderin */}
      <div className="flex w-full flex-col items-stretch gap-2 border-t border-white/[0.1] pt-3">
        <button
          type="button"
          onClick={onOpenProfile}
          title="Jouw profiel en voorkeuren"
          aria-label="Jouw profiel en voorkeuren"
          aria-pressed={profileActive}
          className={`flex h-10 w-full items-center justify-start gap-2.5 rounded-xl px-2 text-xs font-semibold transition ${
            profileActive
              ? 'bg-rose-600 text-white'
              : 'text-neutral-200 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-xs font-black text-white shadow-md">
            {displayName.trim().slice(0, 1).toUpperCase() || 'U'}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-xs font-bold leading-tight">
              {displayName || 'Jouw profiel'}
            </span>
            <span className="block text-[9px] text-neutral-400">Mijn profiel</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          title="Uitloggen"
          aria-label="Uitloggen"
          className="flex h-8 w-full items-center justify-start gap-2 rounded-xl bg-white/[0.04] px-2 text-neutral-300 transition hover:bg-rose-600 hover:text-white"
        >
          <span aria-hidden="true" className="w-7 shrink-0 text-center text-sm leading-none">
            ↪
          </span>
          <span className="text-xs font-medium">Uitloggen</span>
        </button>
      </div>
    </aside>
  );
}