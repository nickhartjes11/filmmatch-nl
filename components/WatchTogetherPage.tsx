'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import StreamingLogo from './StreamingLogo';
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
  // Meerdere vrienden selecteren (groep van 1 tot N vrienden)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  const [groupProfiles, setGroupProfiles] = useState<Record<string, FriendProfile>>({});
  const [myProfile, setMyProfile] = useState<FriendProfile | null>(null);
  const [allWatchedMovieIds, setAllWatchedMovieIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [candidateMovies, setCandidateMovies] = useState<Movie[]>([]);

  // Paginering voor de refresh knop
  const [refreshPageOffset, setRefreshPageOffset] = useState(0);

  // Modal states voor de film details
  const [activeModalMovie, setActiveModalMovie] = useState<Movie | null>(null);
  const [modalDetails, setModalDetails] = useState<{ director?: string; cast?: string[] }>({});
  
  // Dedicated grote bioscoop trailer modal
  const [cinemaTrailerKey, setCinemaTrailerKey] = useState<string | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);

  // Zoeken in vriendenlijst
  const filteredFriends = useMemo(() => {
    const q = friendSearchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.display_name.toLowerCase().includes(q));
  }, [friends, friendSearchQuery]);

  const toggleSelectFriend = (friendId: string) => {
    setSelectedFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  };

  // Laad profielen en geziene films van iedereen in de groep
  useEffect(() => {
    if (selectedFriendIds.length === 0 || !currentUserId) return;

    let active = true;
    setLoading(true);

    const loadGroupData = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;

        const allUserIds = [currentUserId, ...selectedFriendIds];

        const [{ data: profs }, { data: watchedRows }] = await Promise.all([
          supabase.from('profiles').select('*').in('id', allUserIds),
          supabase.from('user_watched').select('movie_id').in('user_id', allUserIds),
        ]);

        if (!active) return;

        const profMap: Record<string, FriendProfile> = {};
        (profs || []).forEach((p) => {
          profMap[p.id] = p;
        });

        setMyProfile(profMap[currentUserId] || null);
        setGroupProfiles(profMap);
        setAllWatchedMovieIds((watchedRows || []).map((r) => Number(r.movie_id)));
      } catch (err) {
        console.error('Fout bij ophalen groepsdata:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadGroupData();

    return () => {
      active = false;
    };
  }, [selectedFriendIds, currentUserId]);

  // Gecombineerde platforms van de hele groep
  const combinedPlatforms = useMemo(() => {
    const allServices = new Set<string>(myStreamingServices);
    selectedFriendIds.forEach((id) => {
      groupProfiles[id]?.streaming_services?.forEach((s) => allServices.add(s));
    });
    const result = Array.from(allServices);
    return result.length > 0 ? result : ['Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Videoland'];
  }, [myStreamingServices, selectedFriendIds, groupProfiles]);

  // Haal films op voor de gezamenlijke smaak
  useEffect(() => {
    if (selectedFriendIds.length === 0) return;

    let active = true;
    setLoading(true);

    const fetchRecommendations = async () => {
      try {
        // Verzamel topgenres van iedereen
        const allGenres = new Set<string>();
        myProfile?.preferred_genres?.forEach((g) => allGenres.add(g));
        selectedFriendIds.forEach((id) => {
          groupProfiles[id]?.preferred_genres?.forEach((g) => allGenres.add(g));
        });
        const genreList = Array.from(allGenres);

        const page1 = refreshPageOffset * 2 + 1;
        const page2 = refreshPageOffset * 2 + 2;

        const makeUrl = (pageNum: number) => {
          const p = new URLSearchParams({
            page: String(pageNum),
            providers: combinedPlatforms.join(','),
          });
          if (genreList.length > 0) {
            p.set('genre', genreList[refreshPageOffset % genreList.length]);
          }
          return `/api/movies?${p.toString()}`;
        };

        const [res1, res2] = await Promise.all([fetch(makeUrl(page1)), fetch(makeUrl(page2))]);
        const [data1, data2] = await Promise.all([
          res1.ok ? res1.json() : { movies: [] },
          res2.ok ? res2.json() : { movies: [] },
        ]);

        if (!active) return;

        const combinedList = [
          ...(Array.isArray(data1.movies) ? data1.movies : []),
          ...(Array.isArray(data2.movies) ? data2.movies : []),
        ];

        const uniqueMap = new Map<number, Movie>();
        combinedList.forEach((m: Movie) => {
          if (!uniqueMap.has(m.id)) uniqueMap.set(m.id, m);
        });

        setCandidateMovies(Array.from(uniqueMap.values()));
      } catch (err) {
        console.error('Fout bij ophalen groepsfilms:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchRecommendations();

    return () => {
      active = false;
    };
  }, [selectedFriendIds, combinedPlatforms, myProfile, groupProfiles, refreshPageOffset]);

  // Bereken de Top 20 voor de hele groep
  const topSamenMatches = useMemo(() => {
    if (!candidateMovies.length) return [];

    const excludedIds = new Set(allWatchedMovieIds);

    // Verzamel genres die wie dan ook verafschuwt
    const allDisliked = new Set<string>(myProfile?.disliked_genres || []);
    selectedFriendIds.forEach((id) => {
      groupProfiles[id]?.disliked_genres?.forEach((g) => allDisliked.add(g));
    });

    // Bouw match preferences voor elk groepslid
    const allMemberPrefs: MatchPreferences[] = [
      {
        favoriteMovies: [],
        ratedMovies: [],
        dislikedGenres: myProfile?.disliked_genres || [],
        favoriteDirectors: myProfile?.favorite_directors || [],
        favoriteCast: myProfile?.favorite_cast || [],
      },
      ...selectedFriendIds.map((id) => ({
        favoriteMovies: [],
        ratedMovies: [],
        dislikedGenres: groupProfiles[id]?.disliked_genres || [],
        favoriteDirectors: groupProfiles[id]?.favorite_directors || [],
        favoriteCast: groupProfiles[id]?.favorite_cast || [],
      })),
    ];

    const scored = candidateMovies
      .filter((movie) => {
        if (excludedIds.has(movie.id)) return false;
        if (movie.genres?.some((g) => allDisliked.has(g))) return false;
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

        // Bereken score per groepslid en neem het gemiddelde
        const scores = allMemberPrefs.map((pref) => calculateMatchScore(tasteSignal, pref));
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));

        return {
          ...movie,
          match_percentage: avgScore,
        };
      })
      .sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));

    return scored.slice(0, 20);
  }, [candidateMovies, allWatchedMovieIds, myProfile, selectedFriendIds, groupProfiles]);

  const selectedFriends = friends.filter((f) => selectedFriendIds.includes(f.id));
  const groupNamesLabel = selectedFriends.length > 0
    ? selectedFriends.map((f) => f.display_name).join(', ')
    : '';

  // Open modal en haal extra credits op indien nodig
  const handleOpenModal = async (movie: Movie) => {
    setActiveModalMovie(movie);
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

  const openCinemaTrailer = async (movieId: number) => {
    setTrailerLoading(true);
    setCinemaTrailerKey(null);
    try {
      const res = await fetch(`/api/movies?trailerMovieId=${movieId}`);
      if (res.ok) {
        const data = await res.json();
        setCinemaTrailerKey(data.youtubeKey || null);
      }
    } catch {
      setCinemaTrailerKey(null);
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
            {selectedFriendIds.length > 0
              ? `Filmavond met ${groupNamesLabel}`
              : 'Met wie ga je vanavond kijken?'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {selectedFriendIds.length > 0
              ? `Jullie ${selectedFriendIds.length + 1} filmprofielen en platforms zijn samengevoegd tot een ideale gezamenlijke Top 20.`
              : 'Kies één of meerdere vrienden om direct een groepsselectie te maken.'}
          </p>
        </div>

        {selectedFriendIds.length > 0 && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setRefreshPageOffset((prev) => prev + 1)}
              disabled={loading}
              title="Haal 20 nieuwe films op"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition disabled:opacity-50 shadow-md"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>Nieuwe films</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedFriendIds([]);
                setCandidateMovies([]);
                setRefreshPageOffset(0);
              }}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-bold text-neutral-300 hover:text-white transition"
            >
              ✏️ Groep aanpassen
            </button>
          </div>
        )}
      </div>

      {/* STAP 1: VRIENDEN KIEZEN (1 OF MEERDERE) */}
      {selectedFriendIds.length === 0 ? (
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Selecteer vrienden ({filteredFriends.length})
              </p>
              <span className="text-[11px] text-neutral-500">Klik op meerdere vrienden om een groep te maken</span>
            </div>

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
                    onClick={() => {
                      toggleSelectFriend(friend.id);
                      setRefreshPageOffset(0);
                    }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-neutral-900/60 hover:bg-neutral-800/80 hover:border-rose-500/40 text-left transition group shadow-lg"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-sm font-black text-slate-950">
                      {friend.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white group-hover:text-rose-300 transition truncate">
                        {friend.display_name}
                      </p>
                      <p className="text-[11px] text-neutral-400">Klik om te selecteren</p>
                    </div>
                    <span className="text-neutral-500 group-hover:text-rose-400 transition text-sm">＋</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STAP 2: DE TOP 20 FILM GRID */
        <div className="space-y-4">
          {/* Balk met geselecteerde vrienden tags */}
          <div className="flex items-center gap-2 flex-wrap bg-neutral-900/80 border border-white/10 p-2.5 rounded-2xl">
            <span className="text-xs font-bold text-neutral-400 pl-1">Actieve groep:</span>
            <span className="px-2.5 py-1 rounded-xl bg-white/15 text-xs font-bold text-white">
              {currentUserName} (jij)
            </span>
            {selectedFriends.map((f) => (
              <span
                key={f.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-200"
              >
                <span>{f.display_name}</span>
                <button
                  type="button"
                  onClick={() => toggleSelectFriend(f.id)}
                  title={`Verwijder ${f.display_name} uit deze sessie`}
                  className="hover:text-white"
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setSelectedFriendIds([])}
              className="text-xs font-semibold text-neutral-400 hover:text-white pl-2 transition"
            >
              + Iemand toevoegen
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-rose-500">✨</span> Top 20 Aanbevelingen voor de groep
            </h2>
            <span className="text-xs text-neutral-400">Klik op een poster voor info, cast &amp; trailer</span>
          </div>

          {loading ? (
            <div className="py-28 text-center text-xs text-neutral-400">
              <span className="inline-block animate-spin mr-2">🔄</span>
              20 groepsmatches berekenen...
            </div>
          ) : topSamenMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center bg-white/[0.02]">
              <p className="text-sm font-bold text-white mb-1">Geen matches gevonden voor deze selectie</p>
              <button
                type="button"
                onClick={() => setRefreshPageOffset((prev) => prev + 1)}
                className="mt-3 px-4 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white shadow-lg"
              >
                Probeer andere films 🔄
              </button>
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

                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      <span className="px-1.5 py-0.5 rounded-lg bg-emerald-500 text-[10px] font-black text-black shadow-md">
                        {movie.match_percentage}% MATCH
                      </span>
                      {movie.rating && (
                        <span className="inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 backdrop-blur-md border border-white/10">
                          <span className="rounded-sm bg-[#f5c518] px-1 text-[7px] font-black text-black leading-3">
                            IMDb
                          </span>
                          <span className="text-[10px] font-bold text-amber-200">
                            {movie.rating}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-white truncate group-hover:text-rose-300 transition">
                        {movie.title}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate">
                        {movie.release_date?.slice(0, 4)} &bull; {movie.genres?.[0] || 'Film'}
                      </p>
                    </div>

                    {movie.providers && movie.providers.length > 0 && (
                      <div className="flex items-center gap-1 pt-1.5 border-t border-white/[0.08]">
                        {movie.providers.slice(0, 3).map((provider) => (
                          <StreamingLogo
                            key={provider.provider_id}
                            name={provider.provider_name}
                            logoPath={provider.logo_path}
                            className="h-5 w-5 rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL VOOR DE FILM */}
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
                {activeModalMovie.match_percentage}% Groeps Match
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

                {/* Beschikbare streamingdiensten */}
                {activeModalMovie.providers && activeModalMovie.providers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 font-medium">Te zien op:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeModalMovie.providers.map((provider) => (
                        <span key={provider.provider_id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.08] border border-white/10 text-xs font-semibold text-white">
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

                {/* Regisseur & Acteurs */}
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

              {/* Actieknoppen */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => openCinemaTrailer(activeModalMovie.id)}
                  disabled={trailerLoading}
                  className="flex-1 py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 font-bold text-xs sm:text-sm text-white transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <span>▶</span> {trailerLoading ? 'Trailer starten...' : 'Bekijk Grote Trailer'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(activeModalMovie)}
                  className="py-3 px-5 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs sm:text-sm text-white transition flex items-center gap-1.5"
                >
                  + Watchlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APARTE GROTE BIOSCOOP TRAILER OVERLAY (THEATER MODUS) */}
      {cinemaTrailerKey && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setCinemaTrailerKey(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 sm:p-8 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl rounded-3xl overflow-hidden border border-white/20 bg-black shadow-2xl space-y-2"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Trailer Bioscoopmodus 🍿
              </span>
              <button
                type="button"
                onClick={() => setCinemaTrailerKey(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${cinemaTrailerKey}?autoplay=1`}
                title="Bioscoop Trailer"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}