'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { Movie, StreamingPlatform } from './types';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { calculateMatchScore, type MatchPreferences } from '../lib/recommendations/matchScore';

interface FriendProfile {
  id: string;
  display_name: string;
  streaming_services?: string[];
  preferred_genres?: string[];
  disliked_genres?: string[];
  favorite_movie_ids?: number[];
  favorite_directors?: string[];
  favorite_cast?: string[];
}

interface WatchTogetherPageProps {
  currentUserId: string | null;
  currentUserName: string;
  myWatchlist: Movie[];
  myStreamingServices: string[];
  friends: Array<{ id: string; display_name: string }>;
  platforms: StreamingPlatform[];
  onSelectMovieSpotlight: (id: number) => void;
  onToggleWatchlist: (movie: Movie) => void;
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
  // Begint leeg zodat de gebruiker zelf bewust een vriend kiest
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [myProfile, setMyProfile] = useState<FriendProfile | null>(null);
  const [friendWatchedIds, setFriendWatchedIds] = useState<number[]>([]);
  const [myWatchedIds, setMyWatchedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [candidateMovies, setCandidateMovies] = useState<Movie[]>([]);

  // Modal states voor opengeklikte film
  const [activeModalMovie, setActiveModalMovie] = useState<Movie | null>(null);
  const [modalDetails, setModalDetails] = useState<{ director?: string; cast?: string[] }>({});
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);

  // Filter vriendenlijst op basis van zoekbalk
  const filteredFriends = useMemo(() => {
    const q = friendSearchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.display_name.toLowerCase().includes(q));
  }, [friends, friendSearchQuery]);

  // Laad profielen en bekeken films zodra een vriend geselecteerd is
  useEffect(() => {
    if (!selectedFriendId || !currentUserId) return;

    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;

        const [
          { data: myProf },
          { data: friendProf },
          { data: myWatchedRows },
          { data: friendWatchedRows },
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', currentUserId).maybeSingle(),
          supabase.from('profiles').select('*').eq('id', selectedFriendId).maybeSingle(),
          supabase.from('user_watched').select('movie_id').eq('user_id', currentUserId),
          supabase.from('user_watched').select('movie_id').eq('user_id', selectedFriendId),
        ]);

        if (!active) return;

        setMyProfile(myProf || null);
        setFriendProfile(friendProf || null);
        setMyWatchedIds((myWatchedRows || []).map((r) => Number(r.movie_id)));
        setFriendWatchedIds((friendWatchedRows || []).map((r) => Number(r.movie_id)));
      } catch (err) {
        console.error('Fout bij ophalen samen-kijken data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [selectedFriendId, currentUserId]);

  // Gecombineerde platforms achter de schermen
  const combinedPlatforms = useMemo(() => {
    const friendServices = friendProfile?.streaming_services || [];
    const combined = Array.from(new Set([...myStreamingServices, ...friendServices]));
    return combined.length > 0 ? combined : ['Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Videoland'];
  }, [myStreamingServices, friendProfile]);

  // Haal films op voor de gezamenlijke smaak
  useEffect(() => {
    if (!selectedFriendId) return;

    let active = true;
    const fetchRecommendations = async () => {
      try {
        const myGenres = myProfile?.preferred_genres || [];
        const friendGenres = friendProfile?.preferred_genres || [];
        const topSharedGenres = Array.from(new Set([...myGenres, ...friendGenres])).slice(0, 3);

        const params = new URLSearchParams({
          page: '1',
          providers: combinedPlatforms.join(','),
        });

        if (topSharedGenres.length > 0) {
          params.set('genre', topSharedGenres[0]);
        }

        const res = await fetch(`/api/movies?${params.toString()}`);
        if (!res.ok) return;

        const data = await res.json();
        if (active && Array.isArray(data.movies)) {
          setCandidateMovies(data.movies as Movie[]);
        }
      } catch (err) {
        console.error('Fout bij ophalen aanbevelingen:', err);
      }
    };

    void fetchRecommendations();

    return () => {
      active = false;
    };
  }, [selectedFriendId, combinedPlatforms, myProfile, friendProfile]);

  // Bereken de Top 20
  const topSamenMatches = useMemo(() => {
    if (!candidateMovies.length) return [];

    const allExcludedIds = new Set([...myWatchedIds, ...friendWatchedIds]);
    const sharedDislikedGenres = new Set([
      ...(myProfile?.disliked_genres || []),
      ...(friendProfile?.disliked_genres || []),
    ]);

    const myPrefs: MatchPreferences = {
      favoriteMovies: [],
      ratedMovies: [],
      dislikedGenres: myProfile?.disliked_genres || [],
      favoriteDirectors: myProfile?.favorite_directors || [],
      favoriteCast: myProfile?.favorite_cast || [],
    };

    const friendPrefs: MatchPreferences = {
      favoriteMovies: [],
      ratedMovies: [],
      dislikedGenres: friendProfile?.disliked_genres || [],
      favoriteDirectors: friendProfile?.favorite_directors || [],
      favoriteCast: friendProfile?.favorite_cast || [],
    };

    const scored = candidateMovies
      .filter((movie) => {
        if (allExcludedIds.has(movie.id)) return false;
        if (movie.genres?.some((g) => sharedDislikedGenres.has(g))) return false;
        return true;
      })
      .map((movie) => {
        const tasteSignal = {
          id: movie.id,
          genres: movie.genres || [],
          director: movie.director,
          cast: movie.cast,
          rating: movie.rating,
        };

        const score1 = calculateMatchScore(tasteSignal, myPrefs);
        const score2 = calculateMatchScore(tasteSignal, friendPrefs);
        const combinedScore = Math.round((score1 + score2) / 2);

        return {
          ...movie,
          match_percentage: combinedScore,
        };
      })
      .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));

    return scored.slice(0, 20);
  }, [candidateMovies, myWatchedIds, friendWatchedIds, myProfile, friendProfile]);

  const selectedFriend = friends.find((f) => f.id === selectedFriendId);

  // Open modal en haal zo nodig extra metadata (regisseur & cast) op
  const handleOpenModal = async (movie: Movie) => {
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

  const openTrailer = async (movie: Movie) => {
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
            {selectedFriend ? `Samen Kijken met ${selectedFriend.display_name}` : 'Kies een vriend om mee te kijken'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {selectedFriend
              ? 'Jullie filmprofielen en streamingdiensten zijn gecombineerd tot een persoonlijke Top 20.'
              : 'Selecteer een vriend om direct een gedeelde Top 20 te genereren op basis van jullie beider smaak.'}
          </p>
        </div>

        {selectedFriend && (
          <button
            type="button"
            onClick={() => {
              setSelectedFriendId(null);
              setCandidateMovies([]);
            }}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition self-start md:self-auto"
          >
            ← Andere vriend kiezen
          </button>
        )}
      </div>

      {/* STAP 1: VRIEND SELECTEREN ALS ER NOG NIEMAND GEKOZEN IS */}
      {!selectedFriend ? (
        <div className="space-y-6 max-w-2xl mx-auto py-8">
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400">🔍</span>
            <input
              type="text"
              value={friendSearchQuery}
              onChange={(e) => setFriendSearchQuery(e.target.value)}
              placeholder="Zoek in je vrienden..."
              className="w-full pl-9 pr-4 py-3 rounded-2xl bg-neutral-900/90 border border-white/10 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Vrienden ({filteredFriends.length})
            </p>

            {filteredFriends.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-xs text-neutral-400">
                Geen vrienden gevonden. Voeg vrienden toe via het menu &lsquo;Mijn vrienden&rsquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => setSelectedFriendId(friend.id)}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-neutral-900/60 hover:bg-neutral-800/80 hover:border-rose-500/40 text-left transition group shadow-lg"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-sm font-black text-slate-950">
                      {friend.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white group-hover:text-rose-300 transition truncate">
                        {friend.display_name}
                      </p>
                      <p className="text-[11px] text-neutral-400">Klik om samen te matchen</p>
                    </div>
                    <span className="text-neutral-500 group-hover:text-rose-400 transition text-sm">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STAP 2: DE TOP 20 FILM GRID */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-rose-500">✨</span> Top 20 Aanbevelingen voor {currentUserName} &amp; {selectedFriend.display_name}
            </h2>
            <span className="text-xs text-neutral-400">Klik op een poster voor info, cast &amp; trailer</span>
          </div>

          {loading ? (
            <div className="py-28 text-center text-xs text-neutral-400">Profielen en films berekenen...</div>
          ) : topSamenMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center bg-white/[0.02]">
              <p className="text-sm font-bold text-white mb-1">Geen gezamenlijke matches gevonden</p>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Zorg dat er voldoende streamingdiensten aanstaan of probeer een andere vriend.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {topSamenMatches.map((movie, index) => (
                <div
                  key={movie.id}
                  onClick={() => handleOpenModal(movie)}
                  className="group relative cursor-pointer rounded-2xl border border-white/10 bg-neutral-900 overflow-hidden shadow-xl hover:border-rose-500/50 hover:shadow-2xl transition duration-300 flex flex-col justify-between"
                >
                  <div className="relative aspect-[2/3] w-full bg-neutral-950 overflow-hidden">
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

                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md text-[11px] font-black text-rose-400 border border-white/10">
                      #{index + 1}
                    </span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-emerald-500 text-[10px] font-black text-black shadow-md">
                      {movie.match_percentage}% MATCH
                    </span>
                  </div>

                  <div className="p-3 space-y-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-rose-300 transition">
                      {movie.title}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">
                      {movie.release_date?.slice(0, 4)} &bull; {movie.genres?.[0] || 'Film'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GROTE UITGEBREIDE FILM DETAIL MODAL */}
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
              <span className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-emerald-500 text-xs font-black text-black shadow-xl">
                {activeModalMovie.match_percentage}% Samen Match
              </span>
            </div>

            {/* Uitgebreide details rechts */}
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
                        <span className="text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md">
                          ★ {activeModalMovie.rating}
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

                {/* Regisseur & Acteurs / Cast */}
                <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                  {modalDetails.director && (
                    <p className="text-neutral-300">
                      <span className="text-neutral-500 font-bold">Regisseur: </span>
                      <span className="text-white font-medium">{modalDetails.director}</span>
                    </p>
                  )}
                  {modalDetails.cast && modalDetails.cast.length > 0 && (
                    <p className="text-neutral-300">
                      <span className="text-neutral-500 font-bold">Acteurs: </span>
                      <span className="text-white font-medium">{modalDetails.cast.slice(0, 5).join(', ')}</span>
                    </p>
                  )}
                </div>

                {/* Beschrijving */}
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed pt-2">
                  {activeModalMovie.overview || 'Geen beschrijving beschikbaar voor deze titel.'}
                </p>
              </div>

              {/* Knoppen & Trailer weergave */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                {trailerKey ? (
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-inner">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                      title="Trailer"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openTrailer(activeModalMovie)}
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
                      + Watchlist
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