'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ALTERNATIVE_MOVIES, canFinishTasteSelection, toOnboardingMovie, type MovieReaction, type OnboardingMovie } from '@/lib/recommendations/onboardingCatalog';

interface Props {
  movies: readonly OnboardingMovie[];
  savedMovies?: readonly OnboardingMovie[];
  likedIds: readonly number[];
  dislikedIds: readonly number[];
  unseenIds: readonly number[];
  onReact: (movie: OnboardingMovie, reaction: MovieReaction | null) => void;
  onMetadata?: (movies: OnboardingMovie[]) => void;
}

export default function OnboardingFilmPicker({ movies, savedMovies = [], likedIds, dislikedIds, unseenIds, onReact, onMetadata }: Props) {
  const [view, setView] = useState<'start' | 'alternative' | 'responses'>('start');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [metadata, setMetadata] = useState<Record<number, OnboardingMovie>>({});
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError] = useState('');
  const metadataCallback = useRef(onMetadata);
  metadataCallback.current = onMetadata;
  const responseIds = Array.from(new Set([...likedIds, ...dislikedIds, ...unseenIds]));
  const allKnown = useMemo(() => new Map([...movies, ...ALTERNATIVE_MOVIES, ...savedMovies, ...Object.values(metadata)].map((movie) => [movie.id, movie])), [movies, savedMovies, metadata]);
  const baseMovies = view === 'alternative' ? ALTERNATIVE_MOVIES : view === 'responses'
    ? responseIds.map((id) => allKnown.get(id)).filter((movie): movie is OnboardingMovie => Boolean(movie)) : movies;
  const idsKey = baseMovies.map((movie) => movie.id).join(',');

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 639px)');
    const resize = () => { setPageSize(narrow.matches ? 4 : 5); setPage(0); };
    resize();
    narrow.addEventListener('change', resize);
    return () => narrow.removeEventListener('change', resize);
  }, []);

  useEffect(() => {
    if (!idsKey) { setMetadataLoading(false); return; }
    const controller = new AbortController();
    setMetadataLoading(true);
    setError('');
    const ids = idsKey.split(',');
    void (async () => {
      try {
        for (let offset = 0; offset < ids.length; offset += 25) {
          const response = await fetch(`/api/movies?metadataIds=${ids.slice(offset, offset + 25).join(',')}`, { signal: controller.signal });
          if (!response.ok) {
            const detail = await response.json().catch(() => null);
            console.warn('Filmbeelden konden niet worden opgehaald:', response.status, detail?.error || 'Onbekende fout');
            throw new Error('metadata');
          }
          const data = await response.json();
          const details = (Array.isArray(data.movies) ? data.movies : []).map(toOnboardingMovie).filter((movie: OnboardingMovie | null): movie is OnboardingMovie => movie !== null);
          if (controller.signal.aborted) return;
          setMetadata((current) => ({ ...current, ...Object.fromEntries(details.map((movie: OnboardingMovie) => [movie.id, movie])) }));
          metadataCallback.current?.(details);
        }
      } catch {
        if (!controller.signal.aborted) setError('De filmbeelden konden niet worden geladen. Probeer het opnieuw. Je reacties blijven bewaard.');
      } finally {
        if (!controller.signal.aborted) setMetadataLoading(false);
      }
    })();
    return () => controller.abort();
  }, [idsKey, refreshAttempt]);

  const pageCount = Math.max(1, Math.ceil(baseMovies.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const displayed = baseMovies.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((movie) => allKnown.get(movie.id) || movie);
  const likes = new Set(likedIds).size;
  const judged = new Set([...likedIds, ...dislikedIds]).size;
  const ready = canFinishTasteSelection(likedIds, dislikedIds);
  const switchView = (next: typeof view) => { setView(next); setPage(0); setError(''); };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm leading-relaxed text-sky-100">Geef aan wat je goed vindt en wat minder bij je past. Niet gezien of overgeslagen? Dat telt niet als afwijzing.</p>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filmselectie">
          {([['start', 'Startselectie'], ['alternative', 'Toon andere films'], ['responses', 'Jouw reacties']] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => switchView(key)} className={`min-h-10 rounded-full border px-3 py-2 text-xs font-semibold ${view === key ? 'border-sky-200 bg-sky-200/15 text-white' : 'border-sky-200/25 text-sky-100 hover:bg-white/10'}`}>{label}{key === 'responses' ? ` (${responseIds.length})` : ''}</button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-sky-200/20 bg-[#173b57]/70 px-4 py-3 text-sm text-sky-100" role="status" aria-live="polite">
        <p><strong className="text-white">{judged} beoordeeld</strong> · {likes} leuk · {new Set(dislikedIds).size} niet mijn smaak</p>
        <p className="mt-1 text-xs leading-relaxed">{ready ? 'Je kunt verder. Met 8–10 beoordelingen leren we je smaak nog beter kennen.' : `Nog ${Math.max(0, 5 - judged)} beoordeling${Math.max(0, 5 - judged) === 1 ? '' : 'en'} nodig, waarvan ${Math.max(0, 3 - likes)} positief. Niet gezien telt niet mee.`}</p>
      </div>
      {error && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/20 bg-amber-200/5 px-4 py-3">
        <p className="text-sm text-amber-100">{error}</p>
        <button type="button" onClick={() => { setBrokenImages(new Set()); setRefreshAttempt((attempt) => attempt + 1); }} className="min-h-10 rounded-full border border-sky-200/40 px-4 py-2 text-xs font-semibold text-white">Opnieuw laden</button>
      </div>}
      {metadataLoading && <p role="status" className="text-xs text-sky-100/75">Posters laden…</p>}
      {baseMovies.length === 0 && <p className="py-6 text-center text-sm text-sky-100">Je hebt nog geen reacties gegeven.</p>}
      {baseMovies.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagina met films">
        <p className="text-xs text-sky-100/80" aria-live="polite">Films {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, baseMovies.length)} van {baseMovies.length}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-full border border-sky-200/30 px-4 py-2 text-xs font-semibold text-sky-100 transition hover:bg-white/10 disabled:opacity-35">← Vorige films</button>
          <button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-full border border-sky-200/30 px-4 py-2 text-xs font-semibold text-sky-100 transition hover:bg-white/10 disabled:opacity-35">Volgende films →</button>
        </div>
      </div>}
      <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 md:grid-cols-5 lg:gap-4">
        {displayed.map((movie) => {
          const reaction: MovieReaction | null = likedIds.includes(movie.id) ? 'like' : dislikedIds.includes(movie.id) ? 'dislike' : unseenIds.includes(movie.id) ? 'unseen' : null;
          return (
            <article key={movie.id} className={`overflow-hidden rounded-xl border bg-[#173b57]/80 ${reaction === 'like' ? 'border-sky-200' : reaction === 'dislike' ? 'border-rose-300' : 'border-sky-200/20'}`}>
              <div className="relative aspect-[2/3] overflow-hidden bg-[#133650]">
                {movie.poster_path && !brokenImages.has(movie.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} alt={movie.title} loading="lazy" className="h-full w-full object-cover" onError={() => setBrokenImages((current) => new Set([...current, movie.id]))} />
                ) : <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-sky-100">{movie.title}</div>}
                {reaction && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#102f49]/95 px-2 py-1 text-[10px] font-semibold text-white">{reaction === 'like' ? 'Leuk' : reaction === 'dislike' ? 'Niet mijn smaak' : 'Niet gezien'}</span>}
              </div>
              <div className="space-y-2 p-2">
                <h3 className="line-clamp-2 min-h-8 text-xs font-semibold leading-4 text-white">{movie.title}</h3>
                <p className="text-[10px] text-sky-100/80">{movie.year}</p>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" aria-pressed={reaction === 'like'} aria-label={`Vind ${movie.title} goed`} title="Vind ik goed" onClick={() => onReact(movie, reaction === 'like' ? null : 'like')} className={`min-h-11 rounded-lg text-lg ${reaction === 'like' ? 'bg-sky-200 text-[#173553]' : 'bg-sky-100/10 text-white hover:bg-sky-100/20'}`}><span aria-hidden="true">👍</span></button>
                  <button type="button" aria-pressed={reaction === 'dislike'} aria-label={`${movie.title} is niet mijn smaak`} title="Niet mijn smaak" onClick={() => onReact(movie, reaction === 'dislike' ? null : 'dislike')} className={`min-h-11 rounded-lg text-lg ${reaction === 'dislike' ? 'bg-rose-400 text-[#173553]' : 'bg-sky-100/10 text-white hover:bg-sky-100/20'}`}><span aria-hidden="true">👎</span></button>
                </div>
                <button type="button" aria-pressed={reaction === 'unseen'} aria-label={`${movie.title} niet gezien`} onClick={() => onReact(movie, reaction === 'unseen' ? null : 'unseen')} className={`min-h-10 w-full rounded-lg text-[11px] ${reaction === 'unseen' ? 'bg-sky-200/20 text-white' : 'text-sky-100/80 hover:bg-white/10'}`}>Niet gezien</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}


