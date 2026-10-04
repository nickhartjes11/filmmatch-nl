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

function RatingBadge({ rating, source }: { rating: string; source?: 'IMDb' | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 backdrop-blur-md">
      <span className={`rounded-sm px-1 text-[9px] font-black leading-3 ${source === 'IMDb' ? 'bg-[#f5c518] text-black' : 'text-neutral-400'}`}>
        {source || 'Score'}
      </span>
      <span className="text-xs font-bold text-amber-400">{rating}</span>
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
  const matchColor = matchBand === 'strong' ? 'text-emerald-300' : matchBand === 'medium' ? 'text-amber-300' : 'text-rose-300';

  return (
    <section key={movie.id} className="dashboard-feature relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-neutral-900/90 to-neutral-950 p-6 shadow-2xl md:p-8">
      {movie.backdrop_path && (
        <Image
          src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
          alt=""
          fill
          unoptimized
          sizes="100vw"
          className="cinema-backdrop object-cover"
        />
      )}
      <div className="feature-wash absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center gap-7 lg:flex-row">
        <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl md:w-48">
          {movie.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title}
              fill
              unoptimized
              className="object-cover"
              priority
            />
          ) : (
            <div className="h-full w-full bg-neutral-900" />
          )}
        </div>

        <div className="flex-1 space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-rose-300">{spotlightLabel}</span>
            {!isSearch && featuredMovies.length > 1 && (
              <div className="ml-auto flex items-center gap-1.5" role="group" aria-label="Uitgelichte films">
                {featuredMovies.map((featuredMovie, index) => (
                  <button
                    key={featuredMovie.id}
                    onClick={() => onSelectFeatured(index)}
                    title={`Toon ${featuredMovie.title}`}
                    aria-label={`Toon aanbeveling ${index + 1}: ${featuredMovie.title}`}
                    aria-pressed={index === activeFeaturedIndex}
                    className={`h-1.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400 ${index === activeFeaturedIndex ? 'w-5 bg-rose-300' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                  />
                ))}
                <button
                  onClick={onToggleRotation}
                  title={rotationPaused ? 'Hervat wisselen' : 'Pauzeer wisselen'}
                  aria-label={rotationPaused ? 'Hervat wisselen' : 'Pauzeer wisselen'}
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded text-[10px] text-neutral-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                >
                  {rotationPaused ? '▶' : 'Ⅱ'}
                </button>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-black text-white md:text-3xl">{movie.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-neutral-200">
              <span>{movie.release_date?.split('-')[0] || 'Jaar onbekend'}</span>
              {movie.runtime && <><span>&bull;</span><span>{movie.runtime}</span></>}
              {movie.genres?.length ? <><span>&bull;</span><span>{movie.genres.join(', ')}</span></> : null}
              {movie.rating && movie.rating_source === 'IMDb' && <><span>&bull;</span><RatingBadge rating={movie.rating} source="IMDb" /></>}
            </div>
            {movie.director && (
              <p className="mt-1 text-xs text-neutral-200">
                Regisseur:{' '}
                <button
                  type="button"
                  onClick={() => onSelectPerson(movie.director!, 'Directing')}
                  aria-label={`Zoek films van ${movie.director}`}
                  className="text-white underline decoration-white/30 underline-offset-2 transition hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                >
                  {movie.director}
                </button>
              </p>
            )}
            {movie.cast?.length ? (
              <p className="mt-1 text-xs text-neutral-200">
                Acteurs:{' '}
                {movie.cast.slice(0, 3).map((actor, index) => (
                  <span key={`${actor}-${index}`}>
                    {index > 0 ? ', ' : ''}
                    <button
                      type="button"
                      onClick={() => onSelectPerson(actor, 'Acting')}
                      aria-label={`Zoek films met ${actor}`}
                      className="text-white underline decoration-white/30 underline-offset-2 transition hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                    >
                      {actor}
                    </button>
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          <p className="max-w-2xl text-xs leading-relaxed text-neutral-100">{movie.overview}</p>

          {movie.friend_recommendation && !isSearch && (
            <div className="flex max-w-xl items-center gap-2.5 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300/20 text-[10px] font-bold text-amber-200">
                {movie.friend_recommendation.avatar}
              </span>
              <span className="text-neutral-100">
                <strong className="text-white">{movie.friend_recommendation.friend_name}</strong>: &ldquo;{movie.friend_recommendation.quote}&rdquo;
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <div className="mr-2 flex items-center gap-2">
              <span className={`text-xl font-black ${matchColor}`}>{movie.match_percentage}%</span>
              <span className="text-[10px] font-bold uppercase leading-tight text-neutral-100">Film<br />match</span>
            </div>
            {movie.providers.length > 0 && (
              <span
                title={`Beschikbaar op ${movie.providers[0].provider_name}`}
                role="img"
                aria-label={`Beschikbaar op ${movie.providers[0].provider_name}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-slate-950/35"
              >
                <StreamingLogo
                  name={movie.providers[0].provider_name}
                  logoPath={movie.providers[0].logo_path}
                  className="h-8 w-8"
                />
              </span>
            )}
            <button
              onClick={() => onToggleWatchlist(movie)}
              aria-pressed={isWatchlisted}
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${isWatchlisted ? 'border-amber-300/40 bg-amber-300 text-slate-950' : 'border-amber-200/40 bg-amber-300/15 text-amber-100 hover:bg-amber-300/25'}`}
            >
              {isWatchlisted ? '✓ Op watchlist' : '+ Watchlist'}
            </button>
            <button
              onClick={() => onToggleWatched(movie)}
              aria-pressed={isWatched}
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${isWatched ? 'border-emerald-300/40 bg-emerald-300 text-slate-950' : 'border-emerald-200/40 bg-emerald-300/15 text-emerald-100 hover:bg-emerald-300/25'}`}
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
