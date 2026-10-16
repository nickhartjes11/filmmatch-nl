'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { Movie, StreamingPlatform } from './types';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

interface FriendProfile {
  id: string;
  display_name: string;
  streaming_services?: string[];
  preferred_genres?: string[];
}

interface WatchTogetherPageProps {
  currentUserId: string | null;
  currentUserName: string;
  myWatchlist: Movie[];
  myStreamingServices: string[];
  friends: Array<{ id: string; display_name: string }>;
  onSelectMovieSpotlight: (id: number) => void;
  onToggleWatchlist: (movie: Movie) => void;
  platforms: StreamingPlatform[];
}

export default function WatchTogetherPage({
  currentUserId,
  currentUserName,
  myWatchlist,
  myStreamingServices,
  friends,
  onSelectMovieSpotlight,
  onToggleWatchlist,
}: WatchTogetherPageProps) {
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    friends.length > 0 ? friends[0].id : null
  );
  const [friendWatchlist, setFriendWatchlist] = useState<Movie[]>([]);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerMovieTitle, setTrailerMovieTitle] = useState<string>('');
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [trailerLoading, setTrailerLoading] = useState(false);

  useEffect(() => {
    if (!selectedFriendId) return;

    let active = true;
    setLoading(true);

    const loadFriendData = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;

        const [{ data: profileData }, { data: watchlistRows }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', selectedFriendId).maybeSingle(),
          supabase.from('user_watchlist').select('movie_data').eq('user_id', selectedFriendId),
        ]);

        if (!active) return;

        setFriendProfile(profileData || null);
        const list = (watchlistRows || []).map((row) => row.movie_data as Movie).filter(Boolean);
        setFriendWatchlist(list);
      } catch (err) {
        console.error('Fout bij laden van vriendgegevens:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadFriendData();

    return () => {
      active = false;
    };
  }, [selectedFriendId]);

  // Als 1 van beiden de dienst heeft, kunnen jullie het aanzetten!
  const combinedPlatforms = useMemo(() => {
    const friendServices = friendProfile?.streaming_services || [];
    return Array.from(new Set([...myStreamingServices, ...friendServices]));
  }, [myStreamingServices, friendProfile]);

  // Films die op BEIDE watchlists staan
  const mutualWatchlist = useMemo(() => {
    const friendMovieIds = new Set(friendWatchlist.map((m) => m.id));
    return myWatchlist.filter((movie) => friendMovieIds.has(movie.id));
  }, [myWatchlist, friendWatchlist]);

  // Films die de vriend wél heeft, maar jij nog niet
  const friendOnlyWatchlist = useMemo(() => {
    const myIds = new Set(myWatchlist.map((m) => m.id));
    return friendWatchlist.filter((movie) => !myIds.has(movie.id));
  }, [myWatchlist, friendWatchlist]);

  const selectedFriend = friends.find((f) => f.id === selectedFriendId);

  const openTrailer = async (movie: Movie) => {
    setTrailerMovieTitle(movie.title);
    setTrailerModalOpen(true);
    setTrailerLoading(true);
    setTrailerKey(null);

    try {
      const res = await fetch(`/api/movies?trailerMovieId=${movie.id}`);
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
    <div className="space-y-8 animate-fade-in">
      {/* Koptekst */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>🛋️</span> Samen Kijken
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Vind de perfecte film voor vanavond
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Kruis jullie watchlists en combineer al jullie streamingdiensten direct op één plek.
          </p>
        </div>

        {/* Vriendenselector */}
        {friends.length > 0 && (
          <div className="flex items-center gap-2 bg-neutral-900/90 border border-white/10 p-1.5 rounded-2xl shadow-xl">
            <span className="text-xs font-semibold text-neutral-400 pl-2">Kijk met:</span>
            <div className="flex gap-1 overflow-x-auto">
              {friends.map((friend) => {
                const isSelected = friend.id === selectedFriendId;
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => setSelectedFriendId(friend.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isSelected
                        ? 'bg-rose-600 text-white shadow-lg'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[10px]">
                      {friend.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{friend.display_name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {friends.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <p className="text-4xl">👥</p>
          <p className="text-base font-bold text-white">Nog geen vrienden gekoppeld</p>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Voeg eerst vrienden toe via het tabblad &lsquo;Mijn vrienden&rsquo; in het zijmenu om samen jullie watchlists te vergelijken.
          </p>
        </div>
      ) : (
        <>
          {/* Overzichtsbalk met gecombineerde details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-neutral-900/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Kijkpartners</p>
              <p className="text-lg font-black text-white mt-1 flex items-center gap-2 truncate">
                <span>{currentUserName}</span>
                <span className="text-rose-500">&amp;</span>
                <span>{selectedFriend?.display_name || 'Vriend'}</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {mutualWatchlist.length} gedeelde films op de watchlist
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-neutral-900/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Beschikbaar via jullie ({combinedPlatforms.length})
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {combinedPlatforms.length > 0 ? (
                  combinedPlatforms.map((name) => (
                    <span
                      key={name}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-[11px] font-bold text-emerald-300 border border-emerald-500/25"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">Geen diensten gekozen</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Film Avond Match</p>
                <p className="text-2xl font-black text-white mt-0.5">
                  {mutualWatchlist.length > 0 ? '98%' : '84%'} Match
                </p>
              </div>
              <span className="text-3xl">🛋️</span>
            </div>
          </div>

          {/* Sectie 1: Gedeelde Watchlist (BEIDE opgeslagen) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-rose-500 text-lg">⚡</span>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Staat op jullie BEIDE Watchlists ({mutualWatchlist.length})
                </h2>
              </div>
              {mutualWatchlist.length > 0 && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                  Directe match!
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-neutral-400">Watchlists vergelijken...</div>
            ) : mutualWatchlist.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center bg-white/[0.02]">
                <p className="text-sm font-bold text-white mb-1">Nog geen dubbele titels</p>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Jullie hebben op dit moment nog geen films die op beide watchlists tegelijk staan. Bekijk hieronder wat {selectedFriend?.display_name} heeft bewaard en voeg ze met één klik toe!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {mutualWatchlist.map((movie) => (
                  <div
                    key={movie.id}
                    className="group relative rounded-2xl border border-emerald-400/30 bg-neutral-900 overflow-hidden shadow-xl flex flex-col justify-between"
                  >
                    <div
                      onClick={() => onSelectMovieSpotlight(movie.id)}
                      className="cursor-pointer relative aspect-[2/3] w-full bg-neutral-950 overflow-hidden"
                    >
                      {movie.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                          fill
                          unoptimized
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600 font-bold">
                          Geen poster
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500 text-[10px] font-black text-black shadow-md">
                        BEIDEN KIEZEN
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      <p className="text-xs font-bold text-white truncate">{movie.title}</p>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => openTrailer(movie)}
                          className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                        >
                          <span>▶</span> Trailer
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectMovieSpotlight(movie.id)}
                          className="text-[11px] font-bold text-neutral-300 hover:text-white"
                        >
                          Details &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sectie 2: Op de Watchlist van je vriend */}
          {friendOnlyWatchlist.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-lg">💡</span>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Op de Watchlist van {selectedFriend?.display_name} (nog niet op die van jou)
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {friendOnlyWatchlist.slice(0, 10).map((movie) => (
                  <div
                    key={movie.id}
                    className="group relative rounded-2xl border border-white/10 bg-neutral-900 overflow-hidden shadow-xl flex flex-col justify-between"
                  >
                    <div
                      onClick={() => onSelectMovieSpotlight(movie.id)}
                      className="cursor-pointer relative aspect-[2/3] w-full bg-neutral-950 overflow-hidden"
                    >
                      {movie.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                          alt={movie.title}
                          fill
                          unoptimized
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600 font-bold">
                          Geen poster
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <p className="text-xs font-bold text-white truncate">{movie.title}</p>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => openTrailer(movie)}
                          className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                        >
                          <span>▶</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleWatchlist(movie)}
                          className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                        >
                          + Ook opslaan
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Trailer Modal */}
      {trailerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setTrailerModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900 px-4 py-3">
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {trailerMovieTitle} &bull; Trailer
              </span>
              <button
                type="button"
                onClick={() => setTrailerModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {trailerLoading ? (
                <div className="text-xs text-neutral-400">Trailer laden...</div>
              ) : trailerKey ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
                  title="Trailer"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="text-xs text-neutral-400">Geen trailer gevonden voor deze film.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}