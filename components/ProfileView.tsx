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
}

export default function ProfileView({
  displayName,
  setDisplayName,
  accountEmail,
  selectedPlatforms,
  togglePlatform,
  platforms,
  libraryWatched,
  movieRatings,
  ratingsByMovieId,
  authLoading,
  authError,
  authNotice,
  saveProfile,
  goBackToPreviousView,
  onOpenFriends,
  onOpenWatched,
  onOpenFavoritesOnboarding,
  onSelectMovieSpotlight,
  tasteCount,
  profileTopGenres,
  dislikedGenres,
  toggleDislikedGenre,
  genreOptions,
  favoriteDirectors,
  removeFavoriteDirector,
  favoriteCast,
  removeFavoriteCast,
  favoritePersonQuery,
  setFavoritePersonQuery,
  favoritePersonMatches,
  favoritePersonLoading,
  addFavoritePerson,
  profileHeaderPosters,
  profileFriendCount,
}: ProfileViewProps) {
  const profileAverageRating = movieRatings.length
    ? (movieRatings.reduce((total, r) => total + r.rating, 0) / movieRatings.length).toFixed(1)
    : '–';

  const profileSeenHighlights = libraryWatched.slice(0, 4);

  const profileRatingBands = [
    { label: '1–5,5', count: movieRatings.filter((item) => item.rating <= 5.5).length, color: 'bg-rose-300' },
    { label: '6–7,5', count: movieRatings.filter((item) => item.rating > 5.5 && item.rating < 8).length, color: 'bg-amber-300' },
    { label: '8–10', count: movieRatings.filter((item) => item.rating >= 8).length, color: 'bg-emerald-300' },
  ];
  const maxRatingBandCount = Math.max(1, ...profileRatingBands.map((band) => band.count));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="dashboard-header sticky top-0 z-20 flex min-h-16 items-center justify-end border-b border-white/[0.1] px-4 backdrop-blur-md md:px-8">
        <button
          onClick={goBackToPreviousView}
          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white"
        >
          &larr; Terug
        </button>
      </header>

      <main className="dashboard-content flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-7 py-2 md:py-4">
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-b border-white/[0.12] pb-6 sm:flex sm:flex-wrap sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-xl font-black text-slate-950">
              {displayName.trim().slice(0, 1).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 sm:flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Jouw account</p>
              <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">{displayName || 'Profiel en voorkeuren'}</h1>
              <p className="mt-1 truncate text-xs text-neutral-300">{accountEmail || 'FilmMatch-profiel'}</p>
            </div>
            {profileHeaderPosters.length > 0 && (
              <div className="col-span-2 flex w-full items-end gap-1.5 overflow-hidden sm:order-none sm:w-auto" role="group" aria-label="Filmstrip op jouw profiel">
                {profileHeaderPosters.map((film) => (
                  <div key={film.id} className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded border border-white/15 bg-neutral-900 sm:w-11">
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${film.poster_path}`}
                      alt={film.title}
                      fill
                      unoptimized
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="hidden items-center gap-1.5 sm:flex" role="group" aria-label="Jouw streamingdiensten">
              {platforms.filter((p) => selectedPlatforms.includes(p.name)).map((p) => (
                <StreamingLogo
                  key={p.id}
                  name={p.name}
                  logoPath={p.logo_path}
                  mark={p.mark}
                  color={p.color}
                  className="h-8 w-8"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={authLoading}
              className="col-span-2 w-full rounded-lg bg-rose-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {authLoading ? 'Opslaan…' : 'Wijzigingen opslaan'}
            </button>
          </div>

          {authError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
          {authNotice && <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{authNotice}</p>}

          <section aria-label="Profiel in cijfers" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/[0.12] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-300/15 text-sm font-black text-emerald-200" aria-hidden="true">✓</span>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Films gezien</p>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums text-white">{libraryWatched.length}</p>
              <p className="mt-1 text-[10px] text-neutral-400">In jouw lijst Gezien</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/[0.12] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-300/15 text-sm text-amber-200" aria-hidden="true">★</span>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Gemiddeld cijfer</p>
              </div>
              <p className="mt-2 text-2xl font-black tabular-nums text-amber-200">{profileAverageRating}<span className="ml-1 text-xs font-medium text-neutral-400">/ 10</span></p>
              <p className="mt-1 text-[10px] text-neutral-400">{movieRatings.length} beoordelingen</p>
            </div>
            <button
              type="button"
              onClick={onOpenFriends}
              className="rounded-lg border border-white/10 bg-black/[0.12] p-4 text-left transition hover:border-rose-200/30 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-300/15 text-sm text-rose-200" aria-hidden="true">👥</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Vrienden</span>
              </span>
              <span className="mt-2 block text-2xl font-black tabular-nums text-white">{profileFriendCount}</span>
              <span className="mt-1 block text-[10px] text-neutral-400">Actieve vrienden · bekijken <span aria-hidden="true">&rarr;</span></span>
            </button>
          </section>

          <section className="flex flex-col justify-between gap-5 border-y border-rose-200/15 bg-rose-300/[0.06] px-4 py-5 sm:flex-row sm:items-center sm:px-5">
            <div className="max-w-xl">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">Persoonlijke aanbevelingen</p>
              <h2 className="mt-1 text-base font-bold text-white">Verfijn je FilmMatch</h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">Hoe meer films je beoordeelt en als favoriet kiest, hoe beter je aanbevelingen aansluiten op jouw smaak.</p>
              <p className="mt-2 text-[10px] text-neutral-400">{tasteCount} films meegerekend · {movieRatings.length} beoordelingen</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenFavoritesOnboarding}
                className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-400"
              >
                Favorieten aanpassen
              </button>
              <button
                type="button"
                onClick={onOpenWatched}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-100 transition hover:bg-white/10"
              >
                Films beoordelen
              </button>
            </div>
          </section>

          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="border-t border-white/[0.12] pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">Jouw filmsmaak</h2>
                  <p className="mt-1 text-[10px] text-neutral-400">Gebaseerd op favorieten en beoordelingen</p>
                </div>
                <span className="text-[10px] text-neutral-400">{tasteCount} films</span>
              </div>

              <div className="mt-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Genres die bij je passen</h3>
                {profileTopGenres.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profileTopGenres.map(([genre, count]) => (
                      <span key={genre} className="rounded-md border border-rose-200/15 bg-rose-200/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-rose-50">
                        {genre}<span className="ml-1.5 text-rose-200/70">{count}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">Kies favorieten of beoordeel films om je genres te ontdekken.</p>
                )}
              </div>

              <div className="mt-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Genres die je liever niet ziet</h3>
                <p className="mt-1 text-[10px] text-neutral-400">Optioneel. Deze genres wegen we mee als min-punt in je FilmMatch-score.</p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Genres die je liever niet ziet">
                  {genreOptions.map((genre) => {
                    const isDisliked = dislikedGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        aria-pressed={isDisliked}
                        onClick={() => toggleDislikedGenre(genre)}
                        className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition ${
                          isDisliked
                            ? 'border-rose-400/60 bg-rose-500/20 text-rose-100'
                            : 'border-white/10 bg-black/[0.12] text-neutral-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {isDisliked && <span className="mr-1" aria-hidden="true">−</span>}
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Jouw cijferverdeling</h3>
                  <span className="text-[10px] text-neutral-400">{movieRatings.length} films</span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {profileRatingBands.map((band) => (
                    <div key={band.label} className="grid grid-cols-[3.5rem_minmax(0,1fr)_1.5rem] items-center gap-3 text-[10px]">
                      <span className="tabular-nums text-neutral-300">{band.label}</span>
                      <div
                        role="meter"
                        aria-label={`${band.count} films met cijfer ${band.label}`}
                        aria-valuemin={0}
                        aria-valuemax={maxRatingBandCount}
                        aria-valuenow={band.count}
                        className="h-2 overflow-hidden rounded-full bg-white/[0.08]"
                      >
                        <div className={`h-full rounded-full ${band.color}`} style={{ width: `${(band.count / maxRatingBandCount) * 100}%` }} />
                      </div>
                      <span className="text-right tabular-nums text-neutral-300">{band.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="border-t border-white/[0.12] pt-5">
              <div>
                <h2 className="text-sm font-bold text-white">Favoriete acteurs &amp; regisseurs</h2>
                <p className="mt-1 text-[10px] text-neutral-400">Optioneel. Geeft een extra boost aan films met deze mensen erin.</p>
              </div>

              <div className="relative mt-4">
                <input
                  type="text"
                  value={favoritePersonQuery}
                  onChange={(e) => setFavoritePersonQuery(e.target.value)}
                  placeholder="Zoek een acteur of regisseur…"
                  className="w-full rounded-lg border border-white/10 bg-black/[0.12] px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 transition focus:border-rose-400 focus:outline-none"
                />
                {favoritePersonQuery.trim().length >= 2 && (
                  <div className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-neutral-950 shadow-2xl">
                    {favoritePersonLoading ? (
                      <p role="status" className="px-3 py-2.5 text-xs text-neutral-300">Zoeken…</p>
                    ) : favoritePersonMatches.length > 0 ? (
                      favoritePersonMatches.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addFavoritePerson(person)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/[0.08]"
                        >
                          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[10px] font-bold text-white">
                            {person.profile_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                                alt=""
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              person.name.slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-white">{person.name}</span>
                            <span className="block text-[10px] text-neutral-400">
                              {person.known_for_department === 'Directing' ? 'Regisseur' : 'Acteur'}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p role="status" className="px-3 py-2.5 text-xs text-neutral-300">Geen acteurs of regisseurs gevonden.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Regisseurs</h3>
                {favoriteDirectors.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {favoriteDirectors.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 bg-rose-200/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-rose-50">
                        {name}
                        <button
                          type="button"
                          onClick={() => removeFavoriteDirector(name)}
                          className="text-rose-200/70 transition hover:text-white"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">Nog geen favoriete regisseurs toegevoegd.</p>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Acteurs</h3>
                {favoriteCast.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {favoriteCast.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 bg-rose-200/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-rose-50">
                        {name}
                        <button
                          type="button"
                          onClick={() => removeFavoriteCast(name)}
                          className="text-rose-200/70 transition hover:text-white"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">Nog geen favoriete acteurs toegevoegd.</p>
                )}
              </div>
            </section>
          </div>

          <section className="border-t border-white/[0.12] pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Uit je kijkgeschiedenis</h2>
                <p className="mt-1 text-[10px] text-neutral-400">Je meest recent geziene films</p>
              </div>
              <button
                type="button"
                onClick={onOpenWatched}
                className="text-[10px] font-semibold text-rose-200 transition hover:text-white"
              >
                Bekijk alles <span aria-hidden="true">&rarr;</span>
              </button>
            </div>
            {profileSeenHighlights.length > 0 ? (
              <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
                {profileSeenHighlights.map((movie) => {
                  const rating = ratingsByMovieId[movie.id];
                  return (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => onSelectMovieSpotlight(movie.id)}
                      className="group w-28 shrink-0 snap-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 sm:w-32"
                    >
                      <span className="relative block aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
                        {movie.poster_path && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                            alt={movie.title}
                            fill
                            unoptimized
                            sizes="128px"
                            className="object-cover transition duration-300 group-hover:scale-105"
                          />
                        )}
                        {rating !== undefined && (
                          <span className="absolute bottom-2 left-2 rounded bg-amber-300 px-2 py-1 text-[10px] font-black tabular-nums text-neutral-950">
                            ★ {rating.toFixed(1)}
                          </span>
                        )}
                      </span>
                      <span className="mt-2 block truncate text-xs font-semibold text-white">{movie.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-neutral-400">{movie.release_date?.slice(0, 4) || 'Film'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 py-5">
                <p className="text-xs text-neutral-300">Je kijkgeschiedenis is nog leeg.</p>
                <button
                  type="button"
                  onClick={goBackToPreviousView}
                  className="text-xs font-semibold text-rose-200 transition hover:text-white"
                >
                  Ontdek films <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            )}
          </section>

          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="border-t border-white/[0.12] pt-5">
              <h2 className="text-sm font-bold text-white">Accountgegevens</h2>
              <p className="mt-1 text-xs text-neutral-400">{accountEmail || 'Geen e-mailadres beschikbaar'}</p>
              <label className="mt-5 block space-y-2 text-xs font-semibold text-neutral-200">
                Gebruikersnaam
                <input
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none transition focus:border-rose-300/60"
                />
              </label>
            </section>

            <section className="border-t border-white/[0.12] pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-bold text-white">Streamingdiensten</h2>
                <span className="text-[10px] text-neutral-400">{selectedPlatforms.length} geselecteerd</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {platforms.map((platform) => {
                  const active = selectedPlatforms.includes(platform.name);
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.name)}
                      aria-pressed={active}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? 'border-emerald-300/35 bg-emerald-300/[0.08]'
                          : 'border-white/[0.08] bg-black/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded" style={{ backgroundColor: platform.color }}>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{platform.mark}</span>
                          <Image
                            src={`https://image.tmdb.org/t/p/original${platform.logo_path}`}
                            alt=""
                            fill
                            unoptimized
                            className="relative z-10 object-cover"
                          />
                        </span>
                        <span className="truncate text-xs font-medium text-neutral-100">{platform.name}</span>
                      </span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${active ? 'border-emerald-300 bg-emerald-300 text-[#07110d]' : 'border-white/20 text-transparent'}`} aria-hidden="true">
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}