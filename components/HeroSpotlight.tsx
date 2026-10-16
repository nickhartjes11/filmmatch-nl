'use client';

import Image from 'next/image';
import MovieRatingControl from './MovieRatingControl';
import StreamingLogo from './StreamingLogo';
import type { Movie } from './types';
import { getMatchColorBand } from '../lib/recommendations/matchScore';

interface HeroSpotlightProps {
  movie: Movie;
  featuredMovies: Movie[];
  activeFeaturedIndex: number;
  rotationPaused: boolean;
  isSearch: boolean;
  spotlightLabel: string;
  isWatchlisted: boolean;
  isWatched: boolean;
  userRating?: number;
  onSelectPerson: (name: string, department: 'Acting' | 'Directing') => void;
  onSelectFeatured: (index: number) => void;
  onToggleRotation: () => void;
  onEditRating: (movie: Movie) => void;
  onToggleWatchlist: (movie: Movie) => void;
  onToggleWatched: (movie: Movie) => void;
}

function RatingBadge({ rating, source }: { rating: string; source?: Movie['rating_source'] }) {
  const isImdb = source === 'IMDb';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/80 px-2 py-0.5 border border-white/10 backdrop-blur-md shadow-md">
      <span
        className={`rounded px-1 text-[9px] font-black leading-3 tracking-wider ${
          isImdb ? 'bg-[#f5c518] text-black font-extrabold' : 'bg-white/10 text-neutral-300'
        }`}
      >
        {isImdb ? 'IMDb' : source || 'Score'}
      </span>
      <span className="text-xs font-black text-amber-400 tabular-nums">{rating}</span>
    </span>
  );
}

export default function HeroSpotlight({
  movie,
  featuredMovies,
  activeFeaturedIndex,
  rotationPaused,
  isSearch,
  spotlightLabel,
  isWatchlisted,
  isWatched,
  userRating,
  onSelectPerson,
  onSelectFeatured,
  onToggleRotation,
  onEditRating,
  onToggleWatchlist,
  onToggleWatched,
}: HeroSpotlightProps) {
  const matchBand = getMatchColorBand(movie.match_percentage || 0);
  const matchColor =
    matchBand === 'strong'
      ? 'text-emerald-400'
      : matchBand === 'medium'
        ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <section
      key={movie.id}
      className="dashboard-feature relative overflow-hidden rounded-3xl border border-white/[0.08] bg-neutral-950 p-6 md:p-8 shadow-2xl transition duration-500"
    >
      {/* Backdrop met donkere overlays voor hoog contrast */}
      {movie.backdrop_path ? (
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
            alt=""
            fill
            unoptimized
            sizes="100vw"
            className="cinema-backdrop object-cover opacity-25 scale-105 transition duration-700 blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/40" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/90 to-neutral-950 pointer-events-none" />
      )}

      <div className="relative z-10 flex flex-col items-center gap-7 lg:flex-row lg:items-start">
        {/* Filmposter */}
        <div className="group relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-neutral-900 shadow-2xl md:w-52">
          {movie.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title}
              fill
              unoptimized
              className="object-cover transition duration-300 group-hover:scale-105"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600 font-bold">
              Geen poster
            </div>
          )}
        </div>

        {/* Filminformatie & acties */}
        <div className="flex-1 space-y-4 text-center lg:text-left min-w-0">
          {/* Label + Carrousel navigatie */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-300">
              {spotlightLabel}
            </span>

            {!isSearch && featuredMovies.length > 1 && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 backdrop-blur-md"
                role="group"
                aria-label="Uitgelichte films"
              >
                {featuredMovies.map((featuredMovie, index) => (
                  <button
                    key={featuredMovie.id}
                    onClick={() => onSelectFeatured(index)}
                    title={`Toon ${featuredMovie.title}`}
                    aria-label={`Toon aanbeveling ${index + 1}: ${featuredMovie.title}`}
                    aria-pressed={index === activeFeaturedIndex}
                    className={`h-1.5 rounded-full transition-all ${
                      index === activeFeaturedIndex
                        ? 'w-5 bg-rose-500'
                        : 'w-1.5 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
                <button
                  type="button"
                  onClick={onToggleRotation}
                  title={rotationPaused ? 'Hervat wisselen' : 'Pauzeer wisselen'}
                  className="ml-1 text-[11px] text-neutral-400 hover:text-white transition"
                >
                  {rotationPaused ? '▶' : '⏸'}
                </button>
              </div>
            )}
          </div>

          {/* Titel en metadata */}
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              {movie.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs text-neutral-300">
              <span>{movie.release_date?.split('-')[0] || 'Jaar onbekend'}</span>
              {movie.runtime && (
                <>
                  <span className="text-neutral-500">&bull;</span>
                  <span>{movie.runtime}</span>
                </>
              )}
              {movie.genres?.length ? (
                <>
                  <span className="text-neutral-500">&bull;</span>
                  <span>{movie.genres.join(', ')}</span>
                </>
              ) : null}
              {movie.rating && (
                <>
                  <span className="text-neutral-500">&bull;</span>
                  <RatingBadge rating={movie.rating} source={movie.rating_source} />
                </>
              )}
            </div>

            {/* Klikbare Regisseur */}
            {movie.director && (
              <p className="mt-2 text-xs text-neutral-300 flex items-center justify-center lg:justify-start gap-1.5 flex-wrap">
                <span className="text-neutral-400">Regisseur:</span>
                <button
                  type="button"
                  onClick={() => onSelectPerson(movie.director!, 'Directing')}
                  className="font-bold text-white underline decoration-white/40 underline-offset-2 hover:text-rose-300 hover:decoration-rose-300 transition"
                >
                  {movie.director}
                </button>
              </p>
            )}

            {/* Klikbare Acteurs */}
            {movie.cast && movie.cast.length > 0 && (
              <div className="mt-1 text-xs text-neutral-300 flex items-center justify-center lg:justify-start gap-1.5 flex-wrap">
                <span className="text-neutral-400">Acteurs:</span>
                <div className="flex flex-wrap gap-1">
                  {movie.cast.slice(0, 4).map((actor, idx) => (
                    <span key={actor} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => onSelectPerson(actor, 'Acting')}
                        className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:text-rose-300 hover:decoration-rose-300 transition"
                      >
                        {actor}
                      </button>
                      {idx < Math.min(movie.cast!.length, 4) - 1 && (
                        <span className="text-neutral-500 ml-1">,</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Synopsis */}
          <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-neutral-300 line-clamp-3 lg:line-clamp-4">
            {movie.overview || 'Geen omschrijving beschikbaar.'}
          </p>

          {/* Vriendenaanbeveling */}
          {movie.friend_recommendation && !isSearch && (
            <div className="flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs backdrop-blur-md">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-xs font-black text-amber-300">
                {movie.friend_recommendation.avatar}
              </span>
              <span className="text-neutral-200">
                <strong className="text-white">{movie.friend_recommendation.friend_name}</strong>: &ldquo;{movie.friend_recommendation.quote}&rdquo;
              </span>
            </div>
          )}

          {/* Actieknoppen & Streaminglogos */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-3 border-t border-white/[0.08]">
            <div className="mr-2 flex items-center gap-2">
              <span className={`text-2xl font-black ${matchColor}`}>
                {movie.match_percentage || 85}%
              </span>
              <span className="text-[10px] font-bold uppercase leading-tight text-neutral-400 text-left">
                Film
                <br />
                match
              </span>
            </div>

            {movie.providers && movie.providers.length > 0 && (
              <div className="flex items-center gap-1.5 mr-2">
                {movie.providers.slice(0, 4).map((provider) => (
                  <span
                    key={provider.provider_id}
                    title={`Beschikbaar op ${provider.provider_name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow"
                  >
                    <StreamingLogo
                      name={provider.provider_name}
                      logoPath={provider.logo_path}
                      className="h-7 w-7 rounded"
                    />
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => onToggleWatchlist(movie)}
              aria-pressed={isWatchlisted}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-lg ${
                isWatchlisted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              {isWatchlisted ? '✓ Op watchlist' : '+ Watchlist'}
            </button>

            <button
              type="button"
              onClick={() => onToggleWatched(movie)}
              aria-pressed={isWatched}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-lg ${
                isWatched
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              {isWatched ? '✓ Gezien' : 'Gezien'}
            </button>

            {(isWatched || userRating !== undefined) && (
              <MovieRatingControl rating={userRating} onEdit={() => onEditRating(movie)} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}