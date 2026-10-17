'use client';

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
  onSelectMovieSpotlight,
  onToggleWatchlist,
}: FriendActivityPageProps) {
  const formatElapsedTime = (minutesAgo: number) => {
    if (minutesAgo < 60) return `${minutesAgo}m geleden`;
    if (minutesAgo < 24 * 60) return `${Math.floor(minutesAgo / 60)}u geleden`;
    return `${Math.floor(minutesAgo / (24 * 60))}d geleden`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* Pagina Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>🎬</span> Feed
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Vriendenactiviteit</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Bekijk wat je vrienden recent hebben gekeken, hoe ze films beoordelen en waar je ze direct streamt.
          </p>
        </div>
        <span className="text-xs font-bold text-neutral-300 bg-white/[0.06] px-3.5 py-1.5 rounded-full border border-white/10">
          {activities.length} {activities.length === 1 ? 'beoordeling' : 'beoordelingen'}
        </span>
      </div>

      {/* Volledige paginabrede Activiteitenfeed */}
      <section className="rounded-3xl bg-neutral-900/60 border border-white/[0.08] p-5 sm:p-7 shadow-xl">
        {activities.length === 0 ? (
          <div className="py-32 text-center rounded-2xl border border-dashed border-white/10 bg-black/20 space-y-3">
            <span className="text-4xl">🍿</span>
            <p className="text-sm font-bold text-neutral-200">Nog geen vriendenactiviteit</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              Zodra jouw vrienden films bekijken en een beoordeling geven, verschijnen hun films en cijfers hier live in beeld.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
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
              const isInWatchlist = myWatchlistIds.includes(item.movieId);
              const imdbScore = matchedMovie.rating;

              return (
                <div
                  key={item.id}
                  className="rounded-3xl bg-neutral-950/70 border border-white/[0.08] p-4 sm:p-6 hover:border-white/20 transition duration-300 shadow-xl flex flex-col sm:flex-row gap-5 items-stretch"
                >
                  {/* Grote Filmposter */}
                  <div
                    className="relative w-32 h-48 sm:w-40 sm:h-56 rounded-2xl overflow-hidden shrink-0 border border-white/10 cursor-pointer mx-auto sm:mx-0 shadow-2xl group"
                    onClick={() => onSelectMovieSpotlight && onSelectMovieSpotlight(item.movieId)}
                    title={`Bekijk ${item.recentFilm} in spotlight`}
                  >
                    {item.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                        alt={item.recentFilm}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-500 font-bold">
                        Geen poster
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-2.5">
                      <span className="text-[10px] font-bold text-white bg-black/70 px-2 py-1 rounded-lg backdrop-blur-md">
                        Bekijk details ↗
                      </span>
                    </div>
                  </div>

                  {/* Details, Vriendenscore & Badges */}
                  <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                    <div className="space-y-3.5">
                      {/* Wie keek & prominente vriendenscore */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${item.avatarGradient} flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md`}>
                            {item.initial}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-200 truncate">
                              <span className="font-bold text-white text-sm">{item.name}</span> heeft gekeken
                            </p>
                            <span className="text-[10px] text-neutral-400">
                              {formatElapsedTime(item.minutesAgo)}
                            </span>
                          </div>
                        </div>

                        {/* HÉT CIJFER VAN DE PERSOON: Groot & Uitgelicht */}
                        <div className="flex flex-col items-end shrink-0">
                          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-amber-400/20 to-rose-500/20 border border-amber-400/30 shadow-lg">
                            <span className="text-amber-300 text-sm">★</span>
                            <span className="text-white text-base sm:text-lg font-black tracking-tight">
                              {item.rating ? item.rating.toFixed(1) : 'Gezien'}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 mt-1">
                            Score van {item.name.split(' ')[0]}
                          </span>
                        </div>
                      </div>

                      {/* Filmtitel */}
                      <div>
                        <h3
                          onClick={() => onSelectMovieSpotlight && onSelectMovieSpotlight(item.movieId)}
                          className="text-lg sm:text-2xl font-black text-white hover:text-rose-400 cursor-pointer transition leading-snug line-clamp-1"
                        >
                          {item.recentFilm}
                        </h3>

                        {/* IMDb badge & Jaar/Genre */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {imdbScore && (
                            <span className="inline-flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 backdrop-blur-md border border-white/10 shadow-sm">
                              <span className="rounded bg-[#f5c518] px-1 text-[8px] font-black text-black leading-3">
                                IMDb
                              </span>
                              <span className="text-xs font-bold text-amber-200">
                                {imdbScore}
                              </span>
                            </span>
                          )}
                          {matchedMovie.release_date && (
                            <span className="text-xs text-neutral-400">
                              {matchedMovie.release_date.slice(0, 4)}
                            </span>
                          )}
                          {matchedMovie.genres && matchedMovie.genres[0] && (
                            <span className="text-xs text-neutral-400">
                              &bull; {matchedMovie.genres[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Streamingdiensten direct in beeld */}
                      {matchedMovie.providers && matchedMovie.providers.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                            Te zien op:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {matchedMovie.providers.slice(0, 4).map((provider) => (
                              <span
                                key={provider.provider_id}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.08] border border-white/10 text-xs font-medium text-white shadow-sm"
                              >
                                <StreamingLogo
                                  name={provider.provider_name}
                                  logoPath={provider.logo_path}
                                  className="h-4 w-4 rounded"
                                />
                                <span className="hidden sm:inline">{provider.provider_name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actiebalk onderaan */}
                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between mt-4">
                      <span className="text-[11px] font-medium text-neutral-400">
                        Aanbevolen door je vriendenkring
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleWatchlist(matchedMovie)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                          isInWatchlist
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {isInWatchlist ? '✓ Op watchlist' : '+ Zet op watchlist'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}