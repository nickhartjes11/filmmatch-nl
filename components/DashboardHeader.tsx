'use client';

import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import type { DiscoveryMode } from './types';

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
  movieMatches?: unknown[];
  peopleLoading?: boolean;
  personMatches?: PersonSearchResult[];
  selectPerson: (person: PersonSearchResult) => void;
  clearSearch: () => void;
  goBackToPreviousView: () => void;
  setDiscoveryMode: (mode: DiscoveryMode) => void;
  setFeaturedIndex: (index: number) => void;
  targetCount: number;
}

function isPerson(value: unknown): value is PersonSearchResult {
  if (!value || typeof value !== 'object') return false;
  const person = value as Record<string, unknown>;
  return typeof person.id === 'number' && typeof person.name === 'string' &&
    typeof person.known_for_department === 'string' &&
    (person.profile_path === null || typeof person.profile_path === 'string');
}

// Search only: TopNavigation owns the single sticky header and main menu.
export default function DashboardHeader({
  libraryView, searchQuery, setSearchQuery, selectedPerson, setSelectedPerson,
  selectPerson, clearSearch, setPersonSearchFocused,
}: DashboardHeaderProps) {
  const [result, setResult] = useState<{ query: string; people: PersonSearchResult[] }>({ query: '', people: [] });
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const query = searchQuery.trim();
  const suggestions = !selectedPerson && query.length >= 2 && result.query === query ? result.people : [];
  const open = focused && suggestions.length > 0;
  const activePerson = open ? suggestions[activeIndex] : undefined;

  useEffect(() => {
    if (!query || query.length < 2 || selectedPerson) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/movies?people=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data: { people?: unknown } = await response.json();
        if (!controller.signal.aborted) {
          setResult({ query, people: Array.isArray(data.people) ? data.people.filter(isPerson) : [] });
          setActiveIndex(-1);
        }
      } catch {
        // Searching films remains available if person suggestions fail.
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selectedPerson]);

  const close = () => { setFocused(false); setActiveIndex(-1); setPersonSearchFocused(false); };
  const choose = (person: PersonSearchResult) => { selectPerson(person); close(); };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length > 0) {
      event.preventDefault();
      setFocused(true); setPersonSearchFocused(true);
      setActiveIndex((index) => event.key === 'ArrowDown'
        ? (index + 1) % suggestions.length
        : (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activePerson) choose(activePerson); else close();
    } else if (event.key === 'Escape') {
      if (open) event.stopPropagation();
      close();
    }
  };
  const placeholder = libraryView === 'watched' ? 'Zoek in films die je hebt gezien...'
    : libraryView === 'watchlist' ? 'Zoek in je watchlist...' : 'Zoek film, acteur of regisseur...';

  return <div className="dashboard-header fm-search" role="search" aria-label="Films en personen zoeken">
    <div className="fm-search-field">
      <svg className="fm-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <input type="search" role="combobox" value={searchQuery} placeholder={placeholder}
        aria-label="Zoek een film, acteur of regisseur" aria-autocomplete="list" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-activedescendant={activePerson ? `${listId}-${activePerson.id}` : undefined}
        onFocus={() => { setFocused(true); setPersonSearchFocused(true); }} onBlur={close} onKeyDown={handleKeyDown}
        onChange={(event) => {
          setResult({ query: '', people: [] }); setActiveIndex(-1);
          setFocused(true); setPersonSearchFocused(true);
          setSearchQuery(event.target.value);
          if (selectedPerson) setSelectedPerson(null);
        }} />
      {(searchQuery || selectedPerson) && <button type="button" className="fm-clear-search" aria-label="Zoekopdracht wissen" onClick={() => { clearSearch(); close(); }}>×</button>}
    </div>
    {open && <div className="fm-suggestions">
      <p id={`${listId}-label`}>Acteurs &amp; regisseurs</p>
      <ul id={listId} role="listbox" aria-labelledby={`${listId}-label`}>
        {suggestions.map((person, index) => <li key={person.id} id={`${listId}-${person.id}`} role="option" aria-selected={activeIndex === index}
          onPointerDown={(event) => event.preventDefault()} onClick={() => choose(person)}>
          <span className="fm-person-avatar">
            {person.profile_path ? <Image src={`https://image.tmdb.org/t/p/w92${person.profile_path}`} alt="" width={34} height={34} unoptimized /> : person.name.slice(0, 1)}
          </span>
          <span><strong>{person.name}</strong><small>{person.known_for_department === 'Directing' ? 'Regisseur' : 'Acteur / Actrice'}</small></span>
        </li>)}
      </ul>
    </div>}
  </div>;
}
