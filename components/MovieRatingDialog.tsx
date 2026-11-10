'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
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
  const sliderValue = rating ?? 1;
  const sliderStyle = { '--rating-fill': rating === null ? '0%' : `${((rating - 1) / 9) * 100}%` } as CSSProperties;
  const posterSrc = movie.poster_path?.startsWith('/') ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` : movie.poster_path;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071b2f]/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-rating-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-sky-200/25 bg-[#21445e] p-5 text-sky-50 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          {posterSrc && (
            <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg border border-sky-200/20 bg-[#15354f] sm:w-20">
              <Image src={posterSrc} alt="" fill unoptimized sizes="80px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">
              {alreadyWatched ? 'Beoordeling aanpassen' : 'Gezien'}
            </p>
            <h2 id="movie-rating-title" className="mt-1 text-xl font-black leading-tight text-white sm:text-2xl">{movie.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-sky-100/85">
              {alreadyWatched ? 'Pas je cijfer voor deze film aan.' : 'Welk cijfer geef jij deze film?'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Sluiten"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-sky-100/80 transition hover:bg-sky-200/15 hover:text-white disabled:opacity-50"
          >
            &times;
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <label htmlFor="movie-rating-slider" className="text-sm font-semibold text-sky-100">Jouw beoordeling</label>
            <output htmlFor="movie-rating-slider" aria-live="polite" className="rounded-xl bg-sky-200/15 px-3 py-1 text-3xl font-black tabular-nums text-white">
              {rating === null ? '–' : rating.toFixed(1).replace('.', ',')}<span className="ml-1 text-xs font-medium text-sky-100/75">/ 10</span>
            </output>
          </div>
          <input
            id="movie-rating-slider"
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={sliderValue}
            disabled={saving}
            onChange={(event) => onRatingChange(Number(event.target.value))}
            onPointerUp={(event) => { if (!saving && rating === null) onRatingChange(Number(event.currentTarget.value)); }}
            aria-valuetext={rating === null ? 'Nog geen cijfer gekozen' : `${rating.toFixed(1).replace('.', ',')} van de 10`}
            style={sliderStyle}
            className="fm-rating-slider block h-7 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-rose-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 disabled:cursor-wait"
          />
          <div className="flex justify-between text-xs text-sky-100/75">
            <span>1</span>
            <span>10</span>
          </div>
          {rating === null && <p className="text-xs text-sky-100/75">Kies je cijfer met de schuifbalk.</p>}
        </div>

        {error && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-200/20 pt-4">
          {alreadyWatched && onRemoveWatched ? (
            <button
              type="button"
              onClick={onRemoveWatched}
              disabled={saving}
              className="text-xs font-semibold text-sky-100/80 transition hover:text-rose-200 disabled:opacity-50"
            >
              Verwijder uit gezien
            </button>
          ) : <span />}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-full border border-sky-200/25 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-200/15 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving || rating === null}
              className="rounded-full bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? 'Opslaan…' : alreadyWatched ? 'Cijfer opslaan' : 'Opslaan als gezien'}
            </button>
          </div>
        </div>
      </section>
      <style jsx>{`
        .fm-rating-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(to right, #f43f5e var(--rating-fill), #42647e var(--rating-fill));
        }
        .fm-rating-slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          margin-top: -7px;
          border: 2px solid #e0f2fe;
          border-radius: 50%;
          background: #f43f5e;
        }
        .fm-rating-slider::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(to right, #f43f5e var(--rating-fill), #42647e var(--rating-fill));
        }
        .fm-rating-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border: 2px solid #e0f2fe;
          border-radius: 50%;
          background: #f43f5e;
        }
      `}</style>
    </div>
  );
}
