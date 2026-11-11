'use client';

import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { Movie, MovieRating, StreamingPlatform } from './types';

interface PersonSearchResult {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
}

interface ProfileViewProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  accountEmail: string;
  selectedPlatforms: string[];
  togglePlatform: (name: string) => void;
  platforms: StreamingPlatform[];
  libraryWatched: Movie[];
  movieRatings: MovieRating[];
  ratingsByMovieId: Record<number, number>;
  authLoading: boolean;
  authError: string;
  authNotice: string;
  saveProfile: () => void;
  goBackToPreviousView: () => void;
  onOpenFriends: () => void;
  onOpenWatched: () => void;
  onOpenFavoritesOnboarding: () => void;
  onSelectMovieSpotlight: (movieId: number) => void;
  // Smaakprofiel props
  tasteCount: number;
  profileTopGenres: [string, number][];
  dislikedGenres: string[];
  toggleDislikedGenre: (genre: string) => void;
  genreOptions: string[];
  favoriteDirectors: string[];
  removeFavoriteDirector: (name: string) => void;
  favoriteCast: string[];
  removeFavoriteCast: (name: string) => void;
  favoritePersonQuery: string;
  setFavoritePersonQuery: (val: string) => void;
  favoritePersonMatches: PersonSearchResult[];
  favoritePersonLoading: boolean;
  addFavoritePerson: (person: PersonSearchResult) => void;
  profileHeaderPosters: Array<{ id: number; title: string; poster_path: string }>;
  profileFriendCount: number;
  favoriteFilmTitles?: string[];
}

const field = 'w-full rounded-xl border border-sky-200/20 bg-[#102d46] px-3 py-2.5 text-sm text-white placeholder:text-sky-100/55 focus-visible:outline-2 focus-visible:outline-sky-300';
const card = 'min-w-0 space-y-5 rounded-2xl border border-sky-200/20 bg-[#1b3b56] p-4 sm:p-5';
const secondary = 'rounded-full border border-sky-200/25 px-3.5 py-2 text-xs font-bold text-sky-50 transition hover:bg-sky-200/15 focus-visible:outline-2 focus-visible:outline-sky-300';

export default function ProfileView({
  displayName, setDisplayName, accountEmail, selectedPlatforms, togglePlatform, platforms,
  authLoading, authError, authNotice, saveProfile, goBackToPreviousView,
  onOpenWatched, onOpenFavoritesOnboarding, profileTopGenres, dislikedGenres, toggleDislikedGenre,
  genreOptions, favoriteDirectors, removeFavoriteDirector, favoriteCast, removeFavoriteCast,
  favoritePersonQuery, setFavoritePersonQuery, favoritePersonMatches, favoritePersonLoading, addFavoritePerson,
  favoriteFilmTitles = [],
}: ProfileViewProps) {
  const peopleGroups = [
    { label: 'Acteurs', names: favoriteCast, remove: removeFavoriteCast },
    { label: 'Regisseurs', names: favoriteDirectors, remove: removeFavoriteDirector },
  ];
  const genres = [...new Set([...genreOptions, ...dislikedGenres])];

  return (
    <main className="dashboard-content min-w-0 flex-1 overflow-y-auto px-4 py-5 text-sky-50 md:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">Profiel</h1>
          <button type="button" onClick={goBackToPreviousView} className={secondary}>← Terug</button>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section aria-labelledby="profile-account" className={card}>
            <h2 id="profile-account" className="text-lg font-black tracking-tight">Mijn account</h2>

            <label className="block space-y-1.5 text-sm font-semibold">
              <span>Gebruikersnaam</span>
              <input autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={field} />
            </label>

            <div>
              <p className="text-sm font-semibold">E-mailadres</p>
              <p className="mt-1 break-words text-sm text-sky-100/80">{accountEmail || 'Geen e-mailadres beschikbaar'}</p>
            </div>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">Streamingdiensten</legend>
              <div className="flex flex-wrap gap-2">
                {platforms.map((platform) => {
                  const active = selectedPlatforms.includes(platform.name);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.name)}
                      aria-pressed={active}
                      className={'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-sky-300 ' + (active ? 'border-sky-300/60 bg-sky-200/15 text-white' : 'border-sky-200/20 bg-[#15354f] text-sky-100/75 hover:bg-sky-200/10')}
                    >
                      <StreamingLogo name={platform.name} logoPath={platform.logo_path} mark={platform.mark} color={platform.color} className="h-6 w-6 rounded" />
                      {platform.name}
                      {active && <span aria-hidden="true" className="text-sky-200">✓</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="profile-taste" className={card}>
            <h2 id="profile-taste" className="text-lg font-black tracking-tight">Jouw filmsmaak</h2>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Favoriete films</h3>
                <button type="button" onClick={onOpenFavoritesOnboarding} className={secondary}>Favorieten aanpassen</button>
              </div>
              {favoriteFilmTitles.length > 0 && <p className="mt-1.5 text-sm leading-relaxed text-sky-100/80">{favoriteFilmTitles.join(' · ')}</p>}
            </div>

            {profileTopGenres.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Genres die bij je passen</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {profileTopGenres.map(([genre]) => (
                    <li key={genre} className="rounded-full bg-sky-200/15 px-3 py-1.5 text-xs text-sky-50">{genre}</li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold">Genres die je liever overslaat</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {genres.map((genre) => {
                  const active = dislikedGenres.includes(genre);
                  return (
                    <button key={genre} type="button" aria-pressed={active} onClick={() => toggleDislikedGenre(genre)} className={'rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-2 focus-visible:outline-sky-300 ' + (active ? 'border-rose-300/55 bg-rose-500/20 text-rose-50' : 'border-sky-200/20 text-sky-100/80 hover:bg-sky-200/10')}>
                      {active && <span aria-hidden="true" className="mr-1">−</span>}{genre}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="profile-person-search" className="text-sm font-semibold">Favoriete acteurs en regisseurs</label>
              <div className="relative mt-2">
                <input id="profile-person-search" type="search" value={favoritePersonQuery} onChange={(event) => setFavoritePersonQuery(event.target.value)} placeholder="Zoek een acteur of regisseur…" className={field} />
                {favoritePersonQuery.trim().length >= 2 && (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-sky-200/25 bg-[#102d46] shadow-xl">
                    {favoritePersonLoading ? (
                      <p role="status" className="px-3 py-2.5 text-xs">Zoeken…</p>
                    ) : favoritePersonMatches.length ? (
                      favoritePersonMatches.map((person) => (
                        <button key={person.id} type="button" onClick={() => addFavoritePerson(person)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-sky-200/15 focus-visible:bg-sky-200/15">
                          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-200/15 text-xs font-bold">
                            {person.profile_path ? <Image src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt="" fill unoptimized sizes="28px" className="object-cover" /> : person.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
                          <span className="text-xs text-sky-100/75">{person.known_for_department === 'Directing' ? 'Regisseur' : 'Acteur'}</span>
                        </button>
                      ))
                    ) : <p role="status" className="px-3 py-2.5 text-xs">Geen acteurs of regisseurs gevonden.</p>}
                  </div>
                )}
              </div>
              {peopleGroups.map(({ label, names, remove }) => names.length > 0 && (
                <div key={label} className="mt-3">
                  <h3 className="text-xs font-semibold text-sky-100/80">{label}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {names.map((name) => (
                      <button key={name} type="button" aria-label={name + ' verwijderen'} onClick={() => remove(name)} className={secondary}>{name} <span aria-hidden="true">×</span></button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={onOpenWatched} className="text-sm font-semibold text-sky-200 underline underline-offset-4 hover:text-white">Beoordelingen bekijken in Gezien</button>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-sky-200/20 pt-4">
          {authError && <p role="alert" className="mr-auto text-sm text-rose-200">{authError}</p>}
          {authNotice && <p role="status" className="mr-auto text-sm text-emerald-200">{authNotice}</p>}
          <button type="button" onClick={saveProfile} disabled={authLoading} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-60">
            {authLoading ? 'Opslaan…' : 'Wijzigingen opslaan'}
          </button>
        </div>
      </div>
    </main>
  );
}
