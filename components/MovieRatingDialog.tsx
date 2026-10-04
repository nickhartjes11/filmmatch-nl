'use client';

import Image from 'next/image';
import type { Movie } from './types';

interface MovieRatingDialogProps {
  movie: Movie;
  rating: number | null;
  alreadyWatched: boolean;
  saving: boolean;
  error: string;
  onRatingChange: (rating: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onRemoveWatched?: () => void;
}

export default function MovieRatingDialog({
  movie,
  rating,
  alreadyWatched,
  saving,
  error,
  onRatingChange,
  onCancel,
  onConfirm,
  onRemoveWatched,
}: MovieRatingDialogProps) {
  const sliderValue = rating ?? 5.5;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-rating-title"
        className="w-full max-w-xl space-y-6 rounded-xl border border-white/15 bg-[#1d292c] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
              {alreadyWatched ? 'Beoordeling aanpassen' : 'Gezien'}
            </p>
            <h2 id="movie-rating-title" className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">{movie.title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Sluiten"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            &times;
          </button>
        </div>

        <div className="flex items-center gap-5 rounded-lg border border-white/10 bg-black/15 p-4">
          <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-md bg-white/10 sm:w-32">
            {movie.poster_path && (
              <Image
                src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                alt={movie.title}
                fill
                unoptimized
                className="object-cover"
              />
            )}
          </div>
          <p className="text-sm leading-relaxed text-neutral-200 sm:text-base">
            {alreadyWatched ? 'Pas je cijfer voor deze film aan.' : 'Welk cijfer geef je deze film?'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <label htmlFor="movie-rating-slider" className="text-xs font-semibold text-neutral-200">Jouw beoordeling</label>
            <output htmlFor="movie-rating-slider" className="text-2xl font-black tabular-nums text-amber-200">
              {rating === null ? '–' : rating.toFixed(1)}<span className="ml-1 text-xs font-medium text-neutral-400">/ 10</span>
            </output>
          </div>
          <input
            id="movie-rating-slider"
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={sliderValue}
            onChange={(event) => onRatingChange(Number(event.target.value))}
            aria-label="Beoordeling van 1 tot 10 sterren"
            className="h-2 w-full cursor-pointer accent-amber-300"
          />
          <div className="flex justify-between text-[10px] text-neutral-400">
            <span>1 ster</span>
            <span>10 sterren</span>
          </div>
          {rating === null && <p className="text-[10px] text-neutral-400">Sleep de balk om een cijfer te kiezen.</p>}
        </div>

        {error && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
          {alreadyWatched && onRemoveWatched ? (
            <button
              type="button"
              onClick={onRemoveWatched}
              disabled={saving}
              className="text-xs font-semibold text-neutral-300 transition hover:text-rose-200 disabled:opacity-50"
            >
              Verwijder uit gezien
            </button>
          ) : <span />}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving || rating === null}
              className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Opslaan…' : alreadyWatched ? 'Cijfer opslaan' : 'Cijfer opslaan & gezien'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}