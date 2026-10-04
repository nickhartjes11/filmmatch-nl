'use client';

interface MovieRatingControlProps {
  rating?: number;
  onEdit: () => void;
  prominent?: boolean;
}

export default function MovieRatingControl({ rating, onEdit, prominent = false }: MovieRatingControlProps) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={rating === undefined ? 'Film beoordelen' : `Beoordeling wijzigen, ${rating.toFixed(1)} van 10`}
      className={`flex w-full min-w-0 items-center justify-between gap-2 text-left transition hover:text-white ${prominent ? 'rounded-lg bg-amber-300/[0.08] px-2 py-1.5 text-neutral-100 hover:bg-amber-300/[0.12]' : 'text-[10px] font-medium text-neutral-300'}`}
    >
      {prominent ? (
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-300 text-sm text-neutral-950" aria-hidden="true">★</span>
          <span className="min-w-0">
            <span className="block text-[9px] font-semibold uppercase tracking-wide text-neutral-300">Jouw cijfer</span>
            <span className="block text-sm font-black tabular-nums text-amber-100">
              {rating === undefined ? '–' : rating.toFixed(1)}
              <span className="ml-1 text-[9px] font-medium text-neutral-300">/ 10</span>
            </span>
          </span>
        </span>
      ) : (
        <span>Jouw cijfer{rating === undefined ? '' : ` · ${rating.toFixed(1)}`}</span>
      )}
      <span className="shrink-0 text-[10px] font-bold text-rose-200">{rating === undefined ? 'Beoordeel' : 'Wijzig'}</span>
    </button>
  );
}