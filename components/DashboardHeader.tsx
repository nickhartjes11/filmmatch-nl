'use client';

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
  clearSearch,
}: DashboardHeaderProps) {
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
      </div>
    </header>
  );
}