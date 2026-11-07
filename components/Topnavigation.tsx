'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  DiscoveryMode,
  LibraryView,
  StreamingPlatform,
} from './types';

export interface TopNavigationProps {
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

  children?: ReactNode;
}

interface NavigationItem {
  label: string;
  active: boolean;
  action: () => void;
  count?: number;
}

function PlatformLogo({
  platform,
}: {
  platform: StreamingPlatform;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const path = platform.logo_path;

  const src = path
    ? /^https?:\/\//i.test(path)
      ? path
      : `https://image.tmdb.org/t/p/w92/${path.replace(/^\//, '')}`
    : '';

  return (
    <span
      className="fm-platform-logo"
      style={{
        backgroundColor: platform.color || '#183149',
      }}
      aria-hidden="true"
    >
      {src && failedSrc !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        platform.mark || platform.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export default function TopNavigation({
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
  children,
}: TopNavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuId = useId();
  const ratingId = useId();

  const menuButton = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);

  const libraryActive =
    !friendsActive && !watchTogetherActive && !profileActive;

  const navigate = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1380px)');

    const closeOnDesktop = () => {
      if (desktop.matches) {
        setMenuOpen(false);
      }
    };

    desktop.addEventListener('change', closeOnDesktop);

    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOutside);

    return () => {
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [menuOpen]);

  const items: NavigationItem[] = [
    {
      label: 'Aanbevolen',
      active:
        libraryActive &&
        libraryView === 'discover' &&
        discoveryMode === 'recommended',
      action: () => onSelectDiscoveryMode('recommended'),
    },
    {
      label: 'Watchlist',
      active: libraryActive && libraryView === 'watchlist',
      action: () => onNavigate('watchlist'),
      count: watchlistCount,
    },
    {
      label: 'Gezien',
      active: libraryActive && libraryView === 'watched',
      action: () => onNavigate('watched'),
    },
    {
      label: 'In de bioscoop',
      active: libraryActive && libraryView === 'cinema',
      action: () => onNavigate('cinema'),
    },
    {
      label: 'Vriendenactiviteit',
      active: friendsActive,
      action: onOpenFriends,
    },
    {
      label: 'Samen Kijken',
      active: watchTogetherActive,
      action: onOpenWatchTogether,
    },
  ];

  return (
    <header
      ref={root}
      className="dashboard-top-navigation"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) {
          event.preventDefault();
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="fm-navigation-row">
        <button
          type="button"
          className="fm-brand"
          aria-label="FilmMatch.nl startpagina en filters resetten"
          onClick={() =>
            navigate(
              onResetToHome || (() => onNavigate('discover'))
            )
          }
        >
          <span className="fm-brand-symbol" aria-hidden="true">
            🍿
          </span>

          <span>
            FILM
            <span className="fm-brand-accent">MATCH</span>
            <span className="fm-brand-domain">NL</span>
            <small>De juiste film voor vanavond</small>
          </span>
        </button>

        <button
          ref={menuButton}
          type="button"
          className="fm-menu-toggle"
          aria-controls={menuId}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
          {menuOpen ? 'Sluiten' : 'Menu'}
        </button>

        <div
          id={menuId}
          className={`fm-menu${menuOpen ? ' fm-menu-open' : ''}`}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;

            if (
              nextTarget instanceof Node &&
              !event.currentTarget.contains(nextTarget) &&
              nextTarget !== menuButton.current
            ) {
              setMenuOpen(false);
            }
          }}
        >
          <nav
            className="fm-primary-nav"
            aria-label="Hoofdnavigatie"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className="fm-nav-button"
                aria-current={item.active ? 'page' : undefined}
                onClick={() => navigate(item.action)}
              >
                {item.label}

                {item.count !== undefined && (
                  <span
                    className="fm-count"
                    aria-label={`${item.count} films`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="fm-search-slot">{children}</div>

          <div className="fm-account">
            <button
              type="button"
              className="fm-profile"
              aria-pressed={profileActive}
              title="Jouw profiel en voorkeuren"
              onClick={() => navigate(onOpenProfile)}
            >
              <span className="fm-avatar" aria-hidden="true">
                {displayName.trim().slice(0, 1).toUpperCase() ||
                  'U'}
              </span>

              <span className="fm-profile-name">
                {displayName || 'Jouw profiel'}
              </span>
            </button>

            <button
              type="button"
              className="fm-logout"
              onClick={() => navigate(onLogout)}
            >
              Uitloggen
            </button>
          </div>
        </div>
      </div>

      <div className="fm-tools-row">
        <div
          className="fm-platforms"
          role="group"
          aria-label="Mijn streamingdiensten"
        >
          {platforms.map((platform) => {
            const active = selectedPlatforms.includes(
              platform.name
            );

            return (
              <button
                key={platform.name}
                type="button"
                className="fm-platform"
                aria-pressed={active}
                title={`${platform.name}: ${
                  active ? 'ingeschakeld' : 'uitgeschakeld'
                }`}
                onClick={() => onTogglePlatform(platform.name)}
              >
                <PlatformLogo platform={platform} />

                <span>{platform.name}</span>

                <span
                  className="fm-platform-state"
                  aria-hidden="true"
                >
                  {active ? '✓' : '+'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="fm-rating">
          <label htmlFor={ratingId}>
            Min. IMDb
            <span>
              {minimumImdbRating > 0
                ? `${minimumImdbRating.toFixed(1)}+`
                : 'Alles'}
            </span>
          </label>

          <input
            id={ratingId}
            type="range"
            min={0}
            max={9}
            step={0.5}
            value={minimumImdbRating}
            aria-valuetext={
              minimumImdbRating > 0
                ? `${minimumImdbRating.toFixed(1)} of hoger`
                : 'Alle beoordelingen'
            }
            onChange={(event) =>
              onMinimumImdbRatingChange(
                Number(event.target.value)
              )
            }
          />
        </div>
      </div>
    </header>
  );
}
