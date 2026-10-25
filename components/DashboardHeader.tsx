'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface PersonSearchResult {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
}

interface DashboardHeaderProps {
  currentView: string;
  libraryView: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedPerson: PersonSearchResult | null;
  setSelectedPerson: (person: PersonSearchResult | null) => void;
  setSpotlightMovieId: (id: number | null) => void;
  setVisibleMovieLimit: (limit: number) => void;
  personSearchFocused: boolean;
  setPersonSearchFocused: (focused: boolean) => void;
  loading: boolean;
  movieMatches?: any[];
  peopleLoading?: boolean;
  personMatches?: PersonSearchResult[];
  selectPerson: (person: PersonSearchResult) => void;
  clearSearch: () => void;
  goBackToPreviousView: () => void;
  setDiscoveryMode: (mode: any) => void;
  setFeaturedIndex: (index: number) => void;
  targetCount: number;
}

export default function DashboardHeader({
  libraryView,
  searchQuery,
  setSearchQuery,
  selectedPerson,
  setSelectedPerson,
  selectPerson,
  clearSearch,
}: DashboardHeaderProps) {
  const [personSuggestions, setPersonSuggestions] = useState<PersonSearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  // Zoeken naar acteurs en regisseurs zodra je typt
  useEffect(() => {
    const q = searchQuery.trim();

    if (!q || selectedPerson || q.length < 2) {
      setPersonSuggestions([]);
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/movies?people=${encodeURIComponent(q)}`);
        if (!res.ok) return;

        const data = await res.json();

        if (active && Array.isArray(data.people)) {
          setPersonSuggestions(data.people);
        }
      } catch {
        // Negeer fouten bij het ophalen van suggesties.
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedPerson]);

  const closeSuggestions = () => {
    setPersonSuggestions([]);
    setIsFocused(false);
  };

  const handleSelectPerson = (person: PersonSearchResult) => {
    selectPerson(person);
    closeSuggestions();
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      closeSuggestions();
    }
  };

  const placeholderText =
    libraryView === 'watched'
      ? 'Zoek in films die je hebt gezien...'
      : libraryView === 'watchlist'
        ? 'Zoek in je watchlist...'
        : 'Zoek film, acteur of regisseur...';

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-white/[0.08] px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Zoekbalk container */}
      <div className="relative flex-1 max-w-xl">
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-neutral-400 text-sm">🔍</span>

          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={closeSuggestions}
            onKeyDown={handleSearchKeyDown}
            onChange={(event) => {
              setSearchQuery(event.target.value);

              if (selectedPerson) {
                setSelectedPerson(null);
              }
            }}
            placeholder={placeholderText}
            aria-label="Zoek een film, acteur of regisseur"
            aria-expanded={isFocused && personSuggestions.length > 0}
            className="w-full bg-neutral-900/90 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-500 transition"
          />

          {(searchQuery || selectedPerson) && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 text-neutral-400 hover:text-white text-sm"
              title="Wissen"
              aria-label="Zoekopdracht wissen"
            >
              &times;
            </button>
          )}
        </div>

        {/* Suggesties dropdown direct onder de zoekbalk */}
        {isFocused && personSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="px-3 py-2 bg-neutral-950/60 border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Acteurs &amp; Regisseurs
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
              {personSuggestions.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelectPerson(person);
                  }}
                  className="w-full p-2.5 flex items-center gap-3 hover:bg-white/[0.08] transition text-left"
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-neutral-800 shrink-0 border border-white/10">
                    {person.profile_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                        alt={person.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400 font-bold">
                        {person.name.slice(0, 1)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {person.name}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      {person.known_for_department === 'Directing'
                        ? 'Regisseur'
                        : 'Acteur / Actrice'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}