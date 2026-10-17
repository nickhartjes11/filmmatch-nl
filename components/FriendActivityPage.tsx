'use client';

import { useState } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
import type { FriendActivityItem, Movie } from './types';

export interface FriendProfile {
  id: string;
  display_name: string;
  streaming_services?: string[];
  favorite_movie_ids?: number[];
  preferred_genres?: string[];
  disliked_genres?: string[];
}

interface FriendActivityPageProps {
  currentUserId: string | null;
  currentUserName: string;
  myStreamingServices: string[];
  allMovies: Movie[];
  myWatchedIds: number[];
  myWatchlistIds: number[];
  activities: FriendActivityItem[];
  friends: FriendProfile[];
  onFriendshipChanged: () => void;
  onSelectMovieSpotlight?: (movieId: number) => void;
  onToggleWatchlist: (movie: Movie) => void;
}

export default function FriendActivityPage({
  allMovies,
  myWatchlistIds,
  activities,
  onToggleWatchlist,
}: FriendActivityPageProps) {
  const [activeModalMovie, setActiveModalMovie] = useState<Movie | null>(null);
  const [modalDetails, setModalDetails] = useState<{ director?: string; cast?: string[] }>({});
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);

  const formatElapsedTime = (minutesAgo: number) => {
    if (minutesAgo < 60) return `${minutesAgo}m`;
    if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)}u`;
    return `${Math.floor(minutesAgo / (24 * 60))}d`;
  };

  const handleOpenMovie = async (movie: Movie) => {
    setActiveModalMovie(movie);
    setTrailerKey(null);
    setModalDetails({
      director: movie.director,
      cast: movie.cast,
    });

    if (!movie.director || !movie.cast || movie.cast.length === 0) {
      try {
        const res = await fetch(`/api/movies?metadataIds=${movie.id}`);
        if (res.ok) {
          const data = await res.json();
          const detail = data.movies?.[0];
          if (detail) {
            setModalDetails({
              director: detail.director || movie.director,
              cast: detail.cast || movie.cast,
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const openTrailer = async (movieId: number) => {
    setTrailerLoading(true);
    setTrailerKey(null);
    try {
      const res = await fetch(`/api/movies?trailerMovieId=${movieId}`);
      if (res.ok) {
        const data = await res.json();
        setTrailerKey(data.youtubeKey || null);
      }
    } catch {
      setTrailerKey(null);
    } finally {
      setTrailerLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Subtiele koptekst in de stijl van het dashboard */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>🎬</span> Vriendenactiviteit
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Films die onlangs zijn gekeken en beoordeeld door je vrienden
          </p>
        </div>
        <span className="text-xs text-neutral-400 font-semibold">
          {activities.length} {activities.length === 1 ? 'film' : 'films'}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="py-28 text-center space-y-2">
          <p className="text-sm font-bold text-white">Nog geen activiteit van vrienden</p>
          <p className="text-xs text-neutral-400">
            Zodra vrienden films markeren als gezien of beoordelen, zie je ze direct in dit overzicht.
          </p>
        </div>
      ) : (
        /* Het vertrouwde MovieCard-raster */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {activities.map((item) => {
            const matchedMovie = allMovies.find((m) => m.id === item.movieId) || {
              id: item.movieId,
              title: item.recentFilm,
              poster_path: item.poster_path,
              overview: '',
              release_date: '',
              genres: [],
              providers: [],
              rating: undefined,
            };

            const isWatchlisted = myWatchlistIds.includes(item.movieId);

            return (
              <article
                key={item.id}
                className="movie-card-reveal group flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 hover:border-white/25 transition duration-300"
              >
                {/* Poster container */}
                <div
                  onClick={() => handleOpenMovie(matchedMovie)}
                  className="relative aspect-[2/3] w-full cursor-pointer overflow-hidden bg-slate-900/60"
                >
                  {item.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={item.recentFilm}
                      fill
                      unoptimized
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-slate-900/80 flex items-center justify-center text-[10px] text-neutral-600 font-bold">
                      Geen poster
                    </div>
                  )}

                  {/* Vriend Avatar + Score Badge bovenaan de poster */}
                  <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 rounded-full bg-black/80 pl-1 pr-2 py-0.5 backdrop-blur-md border border-white/10 shadow-md">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr ${item.avatarGradient} text-[8px] font-black text-white`}>
                        {item.initial}
                      </span>
                      <span className="text-[10px] font-bold text-white truncate max-w-[65px]">
                        {item.name.split(' ')[0]}
                      </span>
                    </div>

                    <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-black bg-amber-300 text-slate-950 shadow-md">
                      ★ {item.rating ? item.rating.toFixed(1) : '✓'}
                    </span>
                  </div>

                  {/* IMDb Badge onderaan de poster */}
                  {matchedMovie.rating && (
                    <div className="absolute bottom-2 left-2">
                      <span className="inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 backdrop-blur-md border border-white/10 text-[9px] font-bold text-amber-200">
                        <span className="rounded-sm bg-[#f5c518] px-1 text-[7px] font-black text-black leading-3">IMDb</span>
                        {matchedMovie.rating}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-2 right-2 text-[9px] font-semibold text-neutral-300 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-md">
                    {formatElapsedTime(item.minutesAgo)}
                  </div>
                </div>

                {/* Info & Watchlist Actie */}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <h3 className="truncate text-xs font-bold text-white transition group-hover:text-rose-200" title={item.recentFilm}>
                      <button
                        type="button"
                        onClick={() => handleOpenMovie(matchedMovie)}
                        className="truncate text-left focus:outline-none"
                      >
                        {item.recentFilm}
                      </button>
                    </h3>
                    <p className="mt-0.5 text-[10px] text-neutral-400 truncate">
                      {matchedMovie.release_date?.slice(0, 4)} &bull; {matchedMovie.genres?.[0] || 'Film'}
                    </p>
                  </div>

                  {/* Streamingdiensten + Watchlist knop */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {matchedMovie.providers?.slice(0, 2).map((provider) => (
                        <StreamingLogo
                          key={provider.provider_id}
                          name={provider.provider_name}
                          logoPath={provider.logo_path}
                          className="h-5 w-5 rounded"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(matchedMovie)}
                      title={isWatchlisted ? 'Verwijder uit watchlist' : 'Voeg toe aan watchlist'}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition ${
                        isWatchlisted
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-amber-300/15 text-amber-100 hover:bg-amber-300/30'
                      }`}
                    >
                      {isWatchlisted ? '✓' : '+'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Uitgebreide Film Modal bij het openklikken van een kaartje */}
      {activeModalMovie && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModalMovie(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-neutral-950 shadow-2xl flex flex-col md:flex-row"
          >
            {/* Grote poster links */}
            <div className="relative w-full md:w-5/12 aspect-[2/3] md:aspect-auto bg-neutral-900 shrink-0">
              {activeModalMovie.poster_path && (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${activeModalMovie.poster_path}`}
                  alt={activeModalMovie.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              )}
            </div>

            {/* Alle film details rechts */}
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {activeModalMovie.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-neutral-400 font-medium">
                      <span>{activeModalMovie.release_date?.slice(0, 4)}</span>
                      {activeModalMovie.runtime && <span>&bull; {activeModalMovie.runtime}</span>}
                      {activeModalMovie.rating && (
                        <span className="text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="bg-[#f5c518] text-black px-1 rounded text-[9px] font-black">IMDb</span>
                          {activeModalMovie.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModalMovie(null)}
                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Streamingdiensten */}
                {activeModalMovie.providers && activeModalMovie.providers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 font-medium">Te zien op:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeModalMovie.providers.map((provider) => (
                        <span key={provider.provider_id} className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.08] border border-white/10 text-xs font-semibold text-white">
                          <StreamingLogo
                            name={provider.provider_name}
                            logoPath={provider.logo_path}
                            className="h-4 w-4 rounded"
                          />
                          <span>{provider.provider_name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Genres */}
                {activeModalMovie.genres && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeModalMovie.genres.map((g) => (
                      <span key={g} className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold text-neutral-200">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Regisseur & Cast */}
                <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                  {modalDetails.director && (
                    <p className="text-neutral-300">
                      <span className="text-neutral-500 font-bold">Regie: </span>
                      <span className="text-white font-medium">{modalDetails.director}</span>
                    </p>
                  )}
                  {modalDetails.cast && modalDetails.cast.length > 0 && (
                    <p className="text-neutral-300">
                      <span className="text-neutral-500 font-bold">Cast: </span>
                      <span className="text-white font-medium">{modalDetails.cast.slice(0, 5).join(', ')}</span>
                    </p>
                  )}
                </div>

                {/* Samenvatting */}
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed pt-2">
                  {activeModalMovie.overview || 'Geen beschrijving beschikbaar voor deze titel.'}
                </p>
              </div>

              {/* Trailer of Trailerknop + Watchlist */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                {trailerKey ? (
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-inner">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                      title="Trailer"
                      allow="autoplay; encrypted-media; fullscreen"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openTrailer(activeModalMovie.id)}
                      disabled={trailerLoading}
                      className="flex-1 py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 font-bold text-xs sm:text-sm text-white transition flex items-center justify-center gap-2 shadow-lg"
                    >
                      <span>▶</span> {trailerLoading ? 'Trailer laden...' : 'Bekijk Trailer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(activeModalMovie)}
                      className="py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs sm:text-sm text-white transition flex items-center gap-1.5"
                    >
                      {myWatchlistIds.includes(activeModalMovie.id) ? '✓ Op watchlist' : '+ Watchlist'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}