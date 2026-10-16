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
  currentView,
  libraryView,
  searchQuery,
  setSearchQuery,
  selectedPerson,
  setSelectedPerson,
  setSpotlightMovieId,
  setVisibleMovieLimit,
  personSearchFocused,
  setPersonSearchFocused,
  loading,
  selectPerson,
  clearSearch,
  targetCount,
}: DashboardHeaderProps) {
  const [personSuggestions, setPersonSuggestions] = useState<PersonSearchResult[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  // Zoeken naar acteurs en regisseurs zodra je typt
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || selectedPerson || q.length < 2) {
      setPersonSuggestions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setPeopleLoading(true);
      try {
        const res = await fetch(`/api/movies?people=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.people)) {
          setPersonSuggestions(data.people);
        }
      } catch {
        // negeer fout
      } finally {
        if (active) setPeopleLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedPerson]);

  const handleSelectPerson = (person: PersonSearchResult) => {
    selectPerson(person);
    setPersonSuggestions([]);
    setPersonSearchFocused(false);
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
            onFocus={() => setPersonSearchFocused(true)}
            onBlur={() => setTimeout(() => setPersonSearchFocused(false), 200)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (selectedPerson) setSelectedPerson(null);
            }}
            placeholder={placeholderText}
            className="w-full bg-neutral-900/90 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-500 transition"
          />

          {(searchQuery || selectedPerson) && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 text-neutral-400 hover:text-white text-sm"
              title="Wissen"
            >
              &times;
            </button>
          )}
        </div>

        {/* Suggesties dropdown voor Acteurs & Regisseurs */}
        {personSearchFocused && personSuggestions.length > 0 && !selectedPerson && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="px-3 py-2 bg-neutral-950/60 border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Acteurs &amp; Regisseurs
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
              {personSuggestions.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onMouseDown={() => handleSelectPerson(person)}
                  className="w-full p-2.5 flex items-center gap-3 hover:bg-white/[0.06] transition text-left"
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
                    <p className="text-xs font-bold text-white truncate">{person.name}</p>
                    <p className="text-[10px] text-neutral-400">
                      {person.known_for_department === 'Directing' ? 'Regisseur' : 'Acteur / Actrice'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actieve filter badge (indien een acteur/regisseur geselecteerd is) */}
      {selectedPerson && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold shrink-0">
          <span>{selectedPerson.known_for_department === 'Directing' ? '🎬' : '🎭'}</span>
          <span>{selectedPerson.name}</span>
          <button
            type="button"
            onClick={clearSearch}
            className="ml-1 text-rose-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}
    </header>
  );
}