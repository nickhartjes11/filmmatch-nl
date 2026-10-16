'use client';

import { useState } from 'react';
import type { DiscoveryMode, LibraryView, StreamingPlatform } from './types';

interface SidebarProps {
  libraryView: LibraryView;
  discoveryMode: DiscoveryMode;
  friendsActive: boolean;
  profileActive: boolean;
  displayName: string;
  watchlistCount: number;
  selectedPlatforms: string[];
  minimumImdbRating: number;
  platforms: StreamingPlatform[];
  onNavigate: (view: LibraryView) => void;
  onSelectDiscoveryMode: (mode: DiscoveryMode) => void;
  onOpenFriends: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onTogglePlatform: (name: string) => void;
  onMinimumImdbRatingChange: (rating: number) => void;
}

// Officiële, haarscherpe vector badges voor alle platforms
function OfficialPlatformIcon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const normalized = name.toLowerCase().trim();

  if (normalized.includes('netflix')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Netflix">
        <rect width="24" height="24" rx="5" fill="#000000" />
        <path d="M6 3.5h3.1v17H6z" fill="#E50914" />
        <path d="M14.9 3.5H18v17h-3.1z" fill="#E50914" />
        <path d="M6 3.5l9 17h2.9L8.9 3.5H6z" fill="#B81D24" />
      </svg>
    );
  }

  if (normalized.includes('prime')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Prime Video">
        <rect width="24" height="24" rx="5" fill="#00A8E1" />
        <path
          d="M5.5 14.5c3.2 2 7.8 2 11.2-.5.3-.2.8.2.5.5-3.8 2.8-8.9 2.8-12.2.5-.3-.2 0-.7.5-.5z"
          fill="#FFFFFF"
        />
        <path
          d="M17.8 13.7c.4-.2.8.2.6.6l-.8 1.5c-.1.2-.4.3-.6.1l-1.3-.8c-.3-.2-.2-.7.2-.7l1.9-.7z"
          fill="#FFFFFF"
        />
        <path
          d="M8.5 7.5h2.2c1.8 0 2.8.8 2.8 2.1 0 1.5-1.1 2.2-2.7 2.2H9.8v2.7H8.5V7.5zm1.3 3.2h.9c1 0 1.5-.4 1.5-1.1 0-.8-.6-1-1.5-1h-.9v2.1z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (normalized.includes('disney')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Disney+">
        <rect width="24" height="24" rx="5" fill="#04092B" />
        <path
          d="M5.5 13.8c1.6-1.5 5.5-3.3 9.8-1.5.4.2.6-.3.3-.5-4.6-2.5-9.3-.5-10.6 1.2-.2.3.2.7.5.8z"
          fill="#00B6F0"
        />
        <path
          d="M8.2 8.5C8 9.8 7.3 11 6.2 11.7c-.3.2-.1.6.2.6 1.4 0 2.7-.9 3.2-2.3.5-1.4.1-2.8-.7-3.7-.3-.3-.7 0-.6.3.3.6.4 1.3.1 1.9z"
          fill="#FFFFFF"
        />
        <path
          d="M11 9.8c0-.8.6-1.3 1.4-1.3s1.4.5 1.4 1.3v3.7c0 .8-.6 1.3-1.4 1.3s-1.4-.5-1.4-1.3V9.8z"
          fill="#FFFFFF"
        />
        <path
          d="M17.5 10.5v1.2H19v1.1h-1.5V14h-1.1v-1.2h-1.5v-1.1h1.5v-1.2h1.1z"
          fill="#00B6F0"
        />
      </svg>
    );
  }

  if (normalized.includes('hbo') || normalized.includes('max')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="HBO Max">
        <rect width="24" height="24" rx="5" fill="#002BE7" />
        <text
          x="12"
          y="15.5"
          fill="#FFFFFF"
          fontSize="8.5"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          textAnchor="middle"
          letterSpacing="-0.5"
        >
          MAX
        </text>
      </svg>
    );
  }

  if (normalized.includes('videoland')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Videoland">
        <rect width="24" height="24" rx="5" fill="#E4002B" />
        <path
          d="M8 7.5L12 16.5L16 7.5H13.6L12 11.8L10.4 7.5H8Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  return (
    <div className={`flex items-center justify-center rounded bg-neutral-800 text-[10px] font-black text-white ${className}`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Sidebar({
  libraryView,
  discoveryMode,
  friendsActive,
  profileActive,
  displayName,
  watchlistCount,
  selectedPlatforms,
  minimumImdbRating,
  platforms,
  onNavigate,
  onSelectDiscoveryMode,
  onOpenFriends,
  onOpenProfile,
  onLogout,
  onTogglePlatform,
  onMinimumImdbRatingChange,
}: SidebarProps) {
  const [mobileRatingOpen, setMobileRatingOpen] = useState(false);
  const discoveryItems: { mode: DiscoveryMode; label: string; icon: string }[] = [
    { mode: 'recommended', label: 'Aanbevolen voor jou', icon: '★' },
  ];

  const renderRatingSlider = (id: string) => (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-neutral-200">IMDb vanaf</label>
        <output htmlFor={id} className="text-xs font-bold tabular-nums text-amber-200">
          {minimumImdbRating === 0 ? 'Alles' : minimumImdbRating.toFixed(1)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={minimumImdbRating}
        onChange={(event) => onMinimumImdbRatingChange(Number(event.target.value))}
        aria-label="Minimum IMDb-score"
        className="h-2 w-full cursor-pointer accent-amber-300"
      />
      <div className="mt-1 flex justify-between text-[9px] tabular-nums text-neutral-400">
        <span>Geen filter</span>
        <span>10</span>
      </div>
    </div>
  );

  return (
    <aside className="dashboard-sidebar w-[68px] md:w-20 xl:w-60 border-r border-white/[0.1] flex flex-col justify-between items-center xl:items-stretch px-2 xl:px-3 py-4 shrink-0 sticky top-0 h-screen z-30">
      <div className="flex flex-col items-center xl:items-stretch gap-6">
        <button
          onClick={() => onNavigate('discover')}
          aria-label="FilmMatchNL startpagina"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-left transition hover:bg-white/[0.06] xl:justify-start xl:px-1"
        >
          <span className="text-[25px] leading-none" aria-hidden="true">🍿</span>
          <span className="hidden min-w-0 xl:block">
            <span className="block whitespace-nowrap text-[13px] font-black leading-4 text-white">
              FILM<span className="text-rose-500">MATCH</span>NL
            </span>
            <span className="block whitespace-nowrap text-[9px] font-medium leading-3 text-neutral-300">De juiste film voor vanavond</span>
          </span>
        </button>

        <nav className="flex flex-col items-center xl:items-stretch gap-1">
          {discoveryItems.map((item) => {
            const active = libraryView === 'discover' && discoveryMode === item.mode;
            return (
              <button
                key={item.mode}
                onClick={() => onSelectDiscoveryMode(item.mode)}
                title={item.label}
                aria-label={item.label}
                aria-pressed={active}
                className={`flex h-9 w-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition xl:h-9 xl:w-full xl:justify-start xl:px-3 ${active ? 'bg-rose-400/20 text-rose-50' : 'text-neutral-200 hover:bg-white/10 hover:text-white'}`}
              >
                <span className="w-4 text-center text-sm" aria-hidden="true">{item.icon}</span>
                <span className="hidden xl:inline">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => onNavigate('watchlist')}
            title="Watchlist"
            aria-label={`Watchlist, ${watchlistCount} films`}
            aria-pressed={libraryView === 'watchlist'}
            className={`flex h-9 w-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition xl:w-full xl:justify-start xl:px-3 ${libraryView === 'watchlist' ? 'bg-amber-300/20 text-amber-50' : 'text-neutral-200 hover:bg-white/10 hover:text-white'}`}
          >
            <span className="w-4 text-center text-sm" aria-hidden="true">🔖</span>
            <span className="hidden xl:inline">Watchlist</span>
            {watchlistCount > 0 && <span className="hidden xl:inline text-[10px]">{watchlistCount}</span>}
          </button>
          <button
            onClick={() => onNavigate('watched')}
            title="Gezien"
            aria-label="Gezien"
            aria-pressed={libraryView === 'watched'}
            className={`flex h-9 w-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition xl:w-full xl:justify-start xl:px-3 ${libraryView === 'watched' ? 'bg-emerald-300/20 text-emerald-50' : 'text-neutral-200 hover:bg-white/10 hover:text-white'}`}
          >
            <span className="w-4 text-center text-sm" aria-hidden="true">✓</span>
            <span className="hidden xl:inline">Gezien</span>
          </button>
          <button
            type="button"
            onClick={onOpenFriends}
            title="Mijn vrienden"
            aria-label="Mijn vrienden"
            aria-pressed={friendsActive}
            className={`flex h-9 w-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition xl:w-full xl:justify-start xl:px-3 ${friendsActive ? 'bg-rose-400/20 text-rose-50' : 'text-neutral-200 hover:bg-white/10 hover:text-white'}`}
          >
            <span className="w-4 text-center text-sm" aria-hidden="true">👥</span>
            <span className="hidden xl:inline">Mijn vrienden</span>
          </button>
        </nav>

        <div className="w-full border-t border-white/[0.1] pt-4">
          <p className="mb-2 hidden px-2 text-[9px] font-bold uppercase tracking-wider text-neutral-200 xl:block">Mijn diensten</p>
          <div className="flex flex-col items-center xl:items-stretch gap-1.5">
            {platforms.map((platform) => {
              const active = selectedPlatforms.includes(platform.name);
              return (
                <button
                  key={platform.id}
                  onClick={() => onTogglePlatform(platform.name)}
                  title={`${platform.name}: ${active ? 'ingeschakeld' : 'uitgeschakeld'}`}
                  aria-label={`${platform.name} ${active ? 'uitschakelen' : 'inschakelen'}`}
                  aria-pressed={active}
                  className={`group relative flex h-8 w-10 xl:w-full items-center justify-center xl:justify-start gap-2.5 rounded-lg border px-1 xl:px-2 transition ${
                    active
                      ? 'border-white/15 bg-white/[0.08] shadow-sm'
                      : 'border-transparent opacity-40 grayscale hover:opacity-80'
                  }`}
                >
                  <span className="relative h-5 w-5 shrink-0 flex items-center justify-center">
                    <OfficialPlatformIcon name={platform.name} className="h-5 w-5 rounded shadow" />
                    {active && (
                      <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-neutral-950" />
                    )}
                  </span>
                  <span className="hidden min-w-0 flex-1 truncate text-left text-[11px] font-medium text-neutral-100 xl:block">
                    {platform.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 hidden border-t border-white/[0.1] pt-4 xl:block">
            {renderRatingSlider('minimum-imdb-score')}
          </div>
        </div>

      </div>

      <div className="flex w-full flex-col items-center gap-2 xl:items-stretch">
        <button
          type="button"
          onClick={onOpenProfile}
          title="Jouw profiel en voorkeuren"
          aria-label="Jouw profiel en voorkeuren"
          aria-pressed={profileActive}
          className={`flex h-10 w-10 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition xl:h-10 xl:w-full xl:justify-start xl:px-2 ${profileActive ? 'bg-rose-400/20 text-rose-50' : 'text-neutral-200 hover:bg-white/10 hover:text-white'}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-[10px] font-black text-slate-950">
            {displayName.trim().slice(0, 1).toUpperCase() || '?'}
          </span>
          <span className="hidden min-w-0 flex-1 text-left xl:block">
            <span className="block truncate text-[11px] font-semibold">{displayName || 'Jouw profiel'}</span>
            <span className="block text-[9px] text-neutral-300">Mijn profiel</span>
          </span>
        </button>

        <div className="flex w-full flex-col items-center gap-3 xl:flex-row xl:justify-between">
        <div className="relative xl:hidden">
          <button
            type="button"
            onClick={() => setMobileRatingOpen((open) => !open)}
            aria-label={`Minimum IMDb-score ${minimumImdbRating === 0 ? 'geen filter' : minimumImdbRating.toFixed(1)}`}
            aria-expanded={mobileRatingOpen}
            title="IMDb-filter"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-sm font-black text-amber-200 transition hover:bg-white/10"
          >
            ★
          </button>
          {mobileRatingOpen && (
            <div className="absolute bottom-0 left-full z-50 ml-3 w-60 rounded-lg border border-white/10 bg-neutral-950 p-3 shadow-2xl">
              {renderRatingSlider('minimum-imdb-score-mobile')}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Uitloggen"
          aria-label="Uitloggen"
          className="flex h-9 w-9 items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-neutral-300 transition hover:bg-rose-600 hover:text-white xl:w-full xl:justify-start xl:px-2"
        >
          <span aria-hidden="true" className="text-base leading-none">↪</span>
          <span className="hidden text-xs font-semibold xl:inline">Uitloggen</span>
        </button>
        </div>
      </div>
    </aside>
  );
}