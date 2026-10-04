'use client';

import { useState } from 'react';
import StreamingLogo from './StreamingLogo';
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
                  className={`group relative flex h-8 w-10 xl:w-full items-center justify-center xl:justify-start gap-2.5 rounded-lg border px-1 xl:px-2 transition ${active ? 'border-emerald-300/30 bg-emerald-300/[0.08]' : 'border-transparent opacity-60 grayscale hover:opacity-100'}`}
                >
                  <span className="relative h-6 w-6 shrink-0">
                    <StreamingLogo
                      name={platform.name}
                      logoPath={platform.logo_path}
                      mark={platform.mark}
                      color={platform.color}
                      className="h-6 w-6"
                    />
                    <span className={`absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-[#25383d] text-[8px] font-black ${active ? 'bg-emerald-300 text-[#07110d]' : 'bg-neutral-700 text-neutral-400'}`}>
                      {active ? '✓' : ''}
                    </span>
                  </span>
                  <span className="hidden min-w-0 flex-1 truncate text-left text-[11px] font-medium text-neutral-100 xl:block">{platform.name}</span>
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
