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
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    friends.length > 0 ? friends[0].id : null
  );

  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [myProfile, setMyProfile] = useState<FriendProfile | null>(null);
  const [friendWatchedIds, setFriendWatchedIds] = useState<number[]>([]);
  const [myWatchedIds, setMyWatchedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [candidateMovies, setCandidateMovies] = useState<Movie[]>([]);

  // Modal voor het openklikken van een filmposter
  const [activeModalMovie, setActiveModalMovie] = useState<Movie | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);

  // 1. Laad profielen en bekeken films van zowel jezelf als de gekozen vriend
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

  // Gecombineerde platforms: als 1 van beiden het heeft, telt het mee!
  const combinedPlatforms = useMemo(() => {
    const friendServices = friendProfile?.streaming_services || [];
    const combined = Array.from(new Set([...myStreamingServices, ...friendServices]));
    return combined.length > 0 ? combined : ['Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Videoland'];
  }, [myStreamingServices, friendProfile]);

  // 2. Haal geschikte films op via de API op basis van gecombineerde platforms en genres
  useEffect(() => {
    if (!selectedFriendId) return;

    let active = true;
    const fetchRecommendations = async () => {
      try {
        // Gezamenlijke voorkeursgenres
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

  // 3. Bereken de ultieme Top 20 Samen Kijken Match
  const topSamenMatches = useMemo(() => {
    if (!candidateMovies.length) return [];

    const allExcludedIds = new Set([...myWatchedIds, ...friendWatchedIds]);
    const sharedDislikedGenres = new Set([
      ...(myProfile?.disliked_genres || []),
      ...(friendProfile?.disliked_genres || []),
    ]);

    // Maak een MatchPreferences aan voor beide personen
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
        // Sluit uit als iemand hem al gezien heeft
        if (allExcludedIds.has(movie.id)) return false;
        // Sluit uit als film een genre heeft dat een van beiden haat
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
        
        // De gezamenlijke score is het harmonische/gebalanceerde gemiddelde
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

  // Trailer openen binnen de modal
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

  const handleOpenModal = (movie: Movie) => {
    setActiveModalMovie(movie);
    setTrailerKey(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Vriendenkiezer */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>🛋️</span> Samen Kijken Matcher
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Top 20 Films voor Jou &amp; {selectedFriend?.display_name || 'je vriend'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            We hebben jullie beider filmprofielen, favoriete genres en streamingdiensten gecombineerd tot één gezamenlijke topselectie.
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
            Voeg vrienden toe via het menu &lsquo;Mijn vrienden&rsquo; om elkaars smaak automatisch te matchen!
          </p>
        </div>
      ) : (
        <>
          {/* Statusbalk met gedeelde diensten */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-neutral-900/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Gezamenlijk Filmprofiel</p>
              <p className="text-base font-black text-white mt-1 truncate">
                {currentUserName} &amp; {selectedFriend?.display_name}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Al bekeken films door jullie beiden zijn automatisch weggefilterd.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-neutral-900/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Beschikbare diensten ({combinedPlatforms.length})
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {combinedPlatforms.map((name) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-[11px] font-bold text-emerald-300 border border-emerald-500/25"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Samen Match Score</p>
                <p className="text-2xl font-black text-white mt-0.5">
                  Top 20 Matches
                </p>
              </div>
              <span className="text-3xl">🍿</span>
            </div>
          </div>

          {/* Film Grid: Top 20 Aanbevelingen */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span className="text-rose-500">✨</span> Aanbevolen voor jullie tweetjes ({topSamenMatches.length})
              </h2>
              <span className="text-xs text-neutral-400">Klik op een poster voor info &amp; trailer</span>
            </div>

            {loading ? (
              <div className="py-24 text-center text-xs text-neutral-400">Profielen en films berekenen...</div>
            ) : topSamenMatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center bg-white/[0.02]">
                <p className="text-sm font-bold text-white mb-1">Geen gezamenlijke matches gevonden</p>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Probeer meer streamingdiensten in te schakelen of jullie voorkeuren aan te vullen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {topSamenMatches.map((movie, index) => (
                  <div
                    key={movie.id}
                    onClick={() => handleOpenModal(movie)}
                    className="group relative cursor-pointer rounded-2xl border border-white/10 bg-neutral-900 overflow-hidden shadow-xl hover:border-rose-500/40 transition duration-300 flex flex-col justify-between"
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

                      {/* Rank badge + Match score */}
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
        </>
      )}

      {/* Klikbare Film Detail Modal */}
      {activeModalMovie && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModalMovie(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-neutral-950 shadow-2xl flex flex-col md:flex-row"
          >
            {/* Poster aan de linkerkant */}
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
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-emerald-500 text-xs font-black text-black shadow-lg">
                {activeModalMovie.match_percentage}% Samen Match
              </span>
            </div>

            {/* Details aan de rechterkant */}
            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-black text-white leading-tight">
                    {activeModalMovie.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveModalMovie(null)}
                    className="text-neutral-400 hover:text-white text-lg p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400 font-medium">
                  <span>{activeModalMovie.release_date?.slice(0, 4)}</span>
                  {activeModalMovie.runtime && <span>&bull; {activeModalMovie.runtime}</span>}
                  {activeModalMovie.rating && (
                    <span className="text-amber-300 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded">
                      ★ {activeModalMovie.rating}
                    </span>
                  )}
                </div>

                {activeModalMovie.genres && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {activeModalMovie.genres.map((g) => (
                      <span key={g} className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-neutral-200">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-neutral-300 leading-relaxed mt-4 line-clamp-5">
                  {activeModalMovie.overview || 'Geen beschrijving beschikbaar.'}
                </p>
              </div>

              {/* Actieknoppen */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                {trailerKey ? (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
                      title="Trailer"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openTrailer(activeModalMovie)}
                      disabled={trailerLoading}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white transition flex items-center justify-center gap-1.5 shadow-lg"
                    >
                      <span>▶</span> {trailerLoading ? 'Trailer laden...' : 'Bekijk Trailer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleWatchlist(activeModalMovie);
                      }}
                      className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs text-white transition flex items-center gap-1"
                    >
                      + Bewaren
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