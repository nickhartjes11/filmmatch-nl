'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import StreamingLogo from './StreamingLogo';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
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
  watchedCredits?: Record<number, { director?: string | null; cast?: readonly string[]; genres?: readonly string[] }>;
}

const field = 'w-full rounded-xl border border-sky-200/20 bg-[#102d46] px-3 py-2.5 text-sm text-white placeholder:text-sky-100/55 focus-visible:outline-2 focus-visible:outline-sky-300';
const card = 'min-w-0 space-y-5 rounded-2xl border border-sky-200/20 bg-[#1b3b56] p-4 sm:p-5';
const secondary = 'rounded-full border border-sky-200/25 px-3.5 py-2 text-xs font-bold text-sky-50 transition hover:bg-sky-200/15 focus-visible:outline-2 focus-visible:outline-sky-300';
const avatarBucket = 'profile-avatars';
const avatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

function personKey(name: string) {
  return name.trim().normalize('NFC').toLowerCase();
}

function mostWatchedPerson(films: Movie[], credits: (film: Movie) => readonly string[]) {
  const people = new Map<string, { name: string; films: Movie[] }>();
  for (const film of films) {
    const names = new Map(credits(film).filter((name) => name.trim()).map((name) => [personKey(name), name.trim()]));
    for (const [key, name] of names) {
      const person = people.get(key);
      if (person) person.films.push(film);
      else people.set(key, { name, films: [film] });
    }
  }
  return [...people.values()].sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name, 'nl'))[0];
}

function ProfilePosters({ films, onSelect }: { films: Movie[]; onSelect: (id: number) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto p-1">
      {films.map((film) => (
        <button key={film.id} type="button" onClick={() => onSelect(film.id)} title={film.title} className="group w-24 shrink-0 text-left focus-visible:outline-2 focus-visible:outline-sky-300 sm:w-28">
          <span className="relative block aspect-[2/3] overflow-hidden rounded-xl border border-sky-200/20 bg-[#102d46]">
            {film.poster_path && <Image src={film.poster_path.startsWith('/') ? `https://image.tmdb.org/t/p/w342${film.poster_path}` : film.poster_path} alt="" fill unoptimized sizes="112px" className="object-cover transition motion-safe:group-hover:scale-105" />}
          </span>
          <span className="mt-1.5 block line-clamp-2 text-xs font-semibold">{film.title}</span>
        </button>
      ))}
    </div>
  );
}

function ProfilePerson({ label, person, onSelect }: { label: string; person: ReturnType<typeof mostWatchedPerson> | undefined; onSelect: (id: number) => void }) {
  const name = person?.name;
  const [portrait, setPortrait] = useState<{ name: string; path: string } | null>(null);
  useEffect(() => {
    if (!name) return;
    const controller = new AbortController();
    void fetch('/api/movies?people=' + encodeURIComponent(name), { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const match = Array.isArray(data?.people) && data.people.find((item: PersonSearchResult) => personKey(item.name) === personKey(name) && item.profile_path);
        if (match?.profile_path && !controller.signal.aborted) setPortrait({ name, path: match.profile_path });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [name]);

  if (!person) return null;
  return (
    <details className="group rounded-2xl border border-sky-200/20 bg-[#1b3b56]">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 focus-visible:outline-2 focus-visible:outline-sky-300 [&::-webkit-details-marker]:hidden">
        <span className="relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sky-200/15 font-black" aria-hidden="true">
          {portrait && portrait.name === name ? <Image src={`https://image.tmdb.org/t/p/w185${portrait.path}`} alt="" fill unoptimized sizes="48px" className="object-cover" /> : name?.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-sky-100/75">{label}</span>
          <strong className="block break-words">{name}</strong>
          <span className="text-xs text-sky-100/75">{person.films.length} {person.films.length === 1 ? 'film' : 'films'}</span>
        </span>
        <span aria-hidden="true" className="group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-sky-200/15 p-2"><ProfilePosters films={person.films} onSelect={onSelect} /></div>
    </details>
  );
}

export default function ProfileView({
  displayName, setDisplayName, accountEmail, selectedPlatforms, togglePlatform, platforms,
  authLoading, authError, authNotice, saveProfile, goBackToPreviousView,
  onOpenWatched, onOpenFavoritesOnboarding, profileTopGenres, dislikedGenres, toggleDislikedGenre,
  genreOptions, onSelectMovieSpotlight,
  libraryWatched, movieRatings, profileFriendCount, onOpenFriends, watchedCredits,
}: ProfileViewProps) {
  const [tab, setTab] = useState<'overview' | 'settings'>('overview');
  const [avatarPath, setAvatarPath] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const path = `${user.id}/avatar`;
      const { data } = await supabase.storage.from(avatarBucket).createSignedUrl(path, 3600);
      if (active) {
        setAvatarPath(path);
        setAvatarUrl(data?.signedUrl ?? '');
      }
    })().catch(() => {});
    return () => { active = false; };
  }, []);

  const uploadAvatar = async (file: File) => {
    setAvatarError('');
    if (!avatarTypes.includes(file.type) || file.size > 3 * 1024 * 1024) {
      setAvatarError('Kies een JPG-, PNG- of WebP-bestand van maximaal 3 MB.');
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !avatarPath || avatarSaving) return;
    setAvatarSaving(true);
    try {
      const bucket = supabase.storage.from(avatarBucket);
      const { error } = await bucket.upload(avatarPath, file, { upsert: true, contentType: file.type, cacheControl: '0' });
      if (error) throw error;
      const { data } = await bucket.createSignedUrl(avatarPath, 3600);
      if (data?.signedUrl) setAvatarUrl(data.signedUrl);
      else setAvatarError('Foto opgeslagen. Open je profiel opnieuw om hem te zien.');
    } catch {
      setAvatarError('De profielfoto kon niet worden opgeslagen. Probeer het opnieuw.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const watched = [...new Map(libraryWatched.map((movie) => [movie.id, movie])).values()];
  const scores = new Map(movieRatings.map(({ movie_id, rating }) => [movie_id, rating]));
  const rated = watched.flatMap((film) => {
    const rating = scores.get(film.id);
    return rating !== undefined && Number.isFinite(rating) && rating >= 1 && rating <= 10 ? [{ film, rating }] : [];
  });
  const ranked = [...rated].sort((a, b) => b.rating - a.rating);
  const banner = ranked.find(({ film }) => film.backdrop_path?.trim());
  const bannerFilm = banner?.film ?? (ranked.length === 0 ? watched.find((film) => film.backdrop_path?.trim()) : undefined);
  const backdrop = bannerFilm?.backdrop_path;
  const genreRatings = new Map<string, { name: string; total: number; count: number }>();
  for (const { film, rating } of rated) {
    const filmGenres = watchedCredits?.[film.id]?.genres;
    const uniqueGenres = new Map((filmGenres?.length ? filmGenres : film.genres ?? []).filter((genre) => genre.trim()).map((genre) => [personKey(genre), genre.trim()]));
    for (const [key, name] of uniqueGenres) {
      const entry = genreRatings.get(key) ?? { name, total: 0, count: 0 };
      entry.total += rating;
      entry.count += 1;
      genreRatings.set(key, entry);
    }
  }
  const topGenres = [...genreRatings.values()].filter(({ count }) => count >= 3)
    .sort((a, b) => b.total / b.count - a.total / a.count || b.count - a.count || a.name.localeCompare(b.name, 'nl')).slice(0, 3);
  const formatRating = (rating: number) => rating.toFixed(1).replace('.', ',');
  const average = movieRatings.length
    ? new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(movieRatings.reduce((sum, movie) => sum + movie.rating, 0) / movieRatings.length)
    : '—';
  const actor = mostWatchedPerson(watched, (movie) => {
    const cast = watchedCredits?.[movie.id]?.cast;
    return cast?.length ? cast : movie.cast ?? [];
  });
  const director = mostWatchedPerson(watched, (movie) => {
    const name = watchedCredits?.[movie.id]?.director || movie.director;
    return name ? [name] : [];
  });
  const genres = [...new Set([...genreOptions, ...dislikedGenres])];

  return (
    <main className="dashboard-content min-w-0 flex-1 overflow-y-auto px-4 py-5 text-sky-50 md:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="relative isolate flex min-h-44 flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-sky-200/20 bg-gradient-to-br from-[#28536f] to-[#183853] p-4 sm:min-h-56 sm:gap-4 sm:p-7">
          {backdrop && (
            <>
              <Image src={backdrop.startsWith('/') ? `https://image.tmdb.org/t/p/w1280${backdrop}` : backdrop} alt="" fill unoptimized sizes="(min-width: 1152px) 1152px, 100vw" className="-z-20 object-cover object-[65%_50%]" />
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#10283e] via-[#10283e]/85 to-[#10283e]/25" />
            </>
          )}
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sky-200/30 bg-sky-200/15 text-2xl font-black">
            {avatarUrl ? <Image src={avatarUrl} alt="" fill unoptimized sizes="64px" className="object-cover" /> : displayName.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-black tracking-tight sm:text-2xl">{displayName.trim() || 'Mijn profiel'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-100/85 sm:text-sm">
              <button type="button" onClick={onOpenWatched} className="hover:underline">{watched.length} films gezien</button>
              <span>{average === '—' ? 'Nog geen cijfers' : `${average} gemiddeld`}</span>
              <button type="button" onClick={onOpenFriends} className="hover:underline">{profileFriendCount} {profileFriendCount === 1 ? 'vriend' : 'vrienden'}</button>
            </div>
          </div>
          <button type="button" onClick={goBackToPreviousView} className={secondary + ' shrink-0'}>← Terug</button>
          {bannerFilm && (
            <div className="flex w-full justify-end">
              <button type="button" onClick={() => onSelectMovieSpotlight(bannerFilm.id)} className={secondary + ' bg-[#10283e]/90 text-left'}>
                {bannerFilm.title}{banner && ` · ${formatRating(banner.rating)}`} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </header>

        <nav aria-label="Profiel" className="flex gap-5 border-b border-sky-200/20">
          {(['overview', 'settings'] as const).map((item) => (
            <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)} className="border-b-2 border-transparent px-1 pb-2.5 text-sm font-bold text-sky-100/80 hover:text-white aria-pressed:border-rose-500 aria-pressed:text-white">
              {item === 'overview' ? 'Overzicht' : 'Instellingen'}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section aria-labelledby="profile-best-genres" className={card}>
              <h2 id="profile-best-genres" className="text-lg font-black tracking-tight">Jouw filmsmaak</h2>
              {topGenres.length ? (
                <ul className="space-y-3">
                  {topGenres.map(({ name, count, total }) => (
                    <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-[#102d46] px-4 py-3">
                      <div><strong className="block">{name}</strong><span className="text-xs text-sky-100/75">{count} beoordeelde films</span></div>
                      <span className="text-xl font-black tabular-nums text-amber-200">{formatRating(total / count)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-sky-100/80">Beoordeel minstens drie films binnen een genre om het hier terug te zien.</p>}
            </section>
            {(actor || director) && (
              <div className="space-y-3">
                <ProfilePerson label="Meest bekeken acteur" person={actor} onSelect={onSelectMovieSpotlight} />
                <ProfilePerson label="Meest bekeken regisseur" person={director} onSelect={onSelectMovieSpotlight} />
              </div>
            )}
          </div>
        ) : (
          <>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section aria-labelledby="profile-account" className={card}>
            <h2 id="profile-account" className="text-lg font-black tracking-tight">Mijn account</h2>

            <div className="flex items-center">
              <label className={secondary + ' cursor-pointer focus-within:outline-2 focus-within:outline-sky-300'}>
                {avatarSaving ? 'Foto opslaan…' : 'Profielfoto wijzigen'}
                <input className="sr-only" type="file" accept={avatarTypes.join(',')} disabled={!avatarPath || avatarSaving} onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void uploadAvatar(file);
                }} />
              </label>
            </div>
            {avatarError && <p role="alert" className="text-sm text-rose-200">{avatarError}</p>}

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

            <button type="button" onClick={onOpenFavoritesOnboarding} className={secondary}>Filmsmaak aanpassen</button>

            <details className="rounded-xl border border-sky-200/20 px-3 py-2.5">
              <summary className="cursor-pointer text-sm font-semibold">Genrevoorkeuren{dislikedGenres.length > 0 && <span className="ml-2 text-xs font-normal text-sky-100/75">{dislikedGenres.length} overgeslagen</span>}</summary>
            {profileTopGenres.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-semibold">Genres die bij je passen</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {profileTopGenres.map(([genre]) => (
                    <li key={genre} className="rounded-full bg-sky-200/15 px-3 py-1.5 text-xs text-sky-50">{genre}</li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="mt-3 min-w-0">
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
            </details>

          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-sky-200/20 pt-4">
          {authError && <p role="alert" className="mr-auto text-sm text-rose-200">{authError}</p>}
          {authNotice && <p role="status" className="mr-auto text-sm text-emerald-200">{authNotice}</p>}
          <button type="button" onClick={saveProfile} disabled={authLoading} className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-sky-300 disabled:cursor-wait disabled:opacity-60">
            {authLoading ? 'Opslaan…' : 'Wijzigingen opslaan'}
          </button>
        </div>
          </>
        )}
      </div>
    </main>
  );
}
