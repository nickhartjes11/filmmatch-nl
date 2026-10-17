'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import type { FriendActivityItem, Movie } from './types';
import { createSupabaseBrowserClient } from '../lib/supabase/client';

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
  currentUserId,
  currentUserName,
  allMovies,
  myWatchlistIds,
  activities,
  friends,
  onFriendshipChanged,
  onSelectMovieSpotlight,
  onToggleWatchlist,
}: FriendActivityPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<FriendProfile[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Deelbare link kopiëren
  const handleCopyInviteLink = () => {
    const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}?invite=${encodeURIComponent(currentUserName)}`;
    void navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Zoeken naar nieuwe gebruikers in Supabase
  const handleGlobalSearch = async () => {
    const query = searchQuery.trim();
    if (query.length < 2) return;

    setSearchingGlobal(true);
    setSearchError('');

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, streaming_services, preferred_genres')
        .ilike('display_name', `%${query}%`)
        .neq('id', currentUserId || '')
        .limit(10);

      if (error) throw error;
      setGlobalSearchResults(data || []);
    } catch {
      setSearchError('Kon geen gebruikers zoeken.');
    } finally {
      setSearchingGlobal(false);
    }
  };

  // Vriend toevoegen
  const handleFollow = async (friendId: string) => {
    if (!currentUserId) return;
    setActionLoadingId(friendId);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      await supabase.from('friendships').insert({
        user_id: currentUserId,
        friend_id: friendId,
      });

      onFriendshipChanged();
      setGlobalSearchResults((prev) => prev.filter((u) => u.id !== friendId));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Vriend ontvolgen
  const handleUnfollow = async (friendId: string) => {
    if (!currentUserId) return;
    setActionLoadingId(friendId);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      await supabase
        .from('friendships')
        .delete()
        .match({ user_id: currentUserId, friend_id: friendId });

      onFriendshipChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter huidige vrienden op zoekterm
  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.display_name.toLowerCase().includes(q));
  }, [friends, searchQuery]);

  // Smaakmatch indicatie
  const calculateTasteMatch = (friend: FriendProfile) => {
    let hash = 0;
    const combined = `${currentUserId || 'user'}_${friend.id}`;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    return 78 + (Math.abs(hash) % 20);
  };

  const friendIdSet = new Set(friends.map((f) => f.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Pagina Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Mijn vrienden</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Volg wat je vrienden kijken, bekijk hun beoordelingen en ontdek nieuwe filmtips.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyInviteLink}
          className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs transition flex items-center gap-2 shadow-sm"
        >
          <span>🔗</span>
          <span>{copiedLink ? 'Link gekopieerd!' : 'Vrienden uitnodigen'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LINKERKOLOM (4 COLS): Vriendenlijst & Zoeken */}
        <div className="lg:col-span-4 space-y-6">
          <section className="rounded-3xl bg-neutral-900/60 border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">👥</span>
                  <h2 className="text-base font-black text-white">Vrienden ({friends.length})</h2>
                </div>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Smaakmatch</span>
              </div>

              {/* Zoekbalk */}
              <div className="relative flex gap-2 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (globalSearchResults.length > 0) setGlobalSearchResults([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleGlobalSearch();
                    }
                  }}
                  placeholder="Zoek in vrienden of typ een naam..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-500 transition"
                />
                {searchQuery.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={handleGlobalSearch}
                    disabled={searchingGlobal}
                    className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-bold transition shrink-0"
                    title="Zoek nieuwe gebruikers op FilmMatch"
                  >
                    {searchingGlobal ? '...' : 'Zoek nieuw'}
                  </button>
                )}
              </div>

              {searchError && <p className="text-xs text-rose-300 mb-2">{searchError}</p>}

              {/* Nieuwe gebruikers zoekresultaten */}
              {globalSearchResults.length > 0 && (
                <div className="mb-4 p-3 rounded-2xl bg-black/50 border border-rose-500/20">
                  <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider mb-2">
                    Nieuwe mensen op FilmMatch
                  </p>
                  <div className="divide-y divide-white/[0.06] max-h-40 overflow-y-auto pr-1">
                    {globalSearchResults.map((user) => {
                      const isFollowing = friendIdSet.has(user.id);
                      return (
                        <div key={user.id} className="py-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-white truncate max-w-[140px]">{user.display_name}</span>
                          {isFollowing ? (
                            <span className="text-[10px] text-neutral-400 font-semibold">Volg je al</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleFollow(user.id)}
                              disabled={actionLoadingId === user.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition"
                            >
                              + Volgen
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vriendenlijst */}
              {friends.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 bg-black/20">
                  <p className="text-xs font-bold text-neutral-300">Je volgt nog niemand</p>
                  <p className="text-[11px] text-neutral-500 mt-1 max-w-xs mx-auto">
                    Typ hierboven een naam en klik op &ldquo;Zoek nieuw&rdquo; om vrienden toe te voegen.
                  </p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Geen vriend gevonden met &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredFriends.map((friend) => {
                    const matchScore = calculateTasteMatch(friend);

                    return (
                      <div
                        key={friend.id}
                        className="p-3 rounded-2xl border border-white/[0.06] bg-black/30 hover:border-white/15 transition flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                            {friend.display_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{friend.display_name}</p>
                            <span className="text-[10px] font-black text-rose-300">
                              🔥 {matchScore}% Smaakmatch
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnfollow(friend.id)}
                          className="text-neutral-500 hover:text-rose-300 text-sm px-1.5 py-0.5 rounded transition"
                          title="Ontvolgen"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[10px] text-neutral-500 pt-3 border-t border-white/[0.06] mt-4">
              Vrienden toevoegen verrijkt ook direct je Samen Kijken-overzicht.
            </p>
          </section>
        </div>

        {/* RECHTERKOLOM (8 COLS): Volwaardige Activiteitenfeed */}
        <div className="lg:col-span-8">
          <section className="rounded-3xl bg-neutral-900/60 border border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between min-h-[640px]">
            <div>
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎬</span>
                    <h2 className="text-lg font-black text-white">Activiteitenfeed</h2>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Wat kijken je vrienden en wat vinden ze ervan?
                  </p>
                </div>
                <span className="text-xs font-semibold text-neutral-400 bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.06]">
                  {activities.length} beoordelingen
                </span>
              </div>

              {activities.length === 0 ? (
                <div className="py-32 text-center rounded-2xl border border-dashed border-white/10 bg-black/20 space-y-3">
                  <span className="text-3xl">🍿</span>
                  <p className="text-sm font-bold text-neutral-200">Nog geen vriendenactiviteit</p>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                    Zodra jouw vrienden films bekijken en beoordelen, verschijnen hun filmposters en cijfers hier live in beeld.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[720px] overflow-y-auto pr-2">
                  {activities.map((item) => {
                    const matchedMovie = allMovies.find((m) => m.id === item.movieId) || {
                      id: item.movieId,
                      title: item.recentFilm,
                      poster_path: item.poster_path,
                      overview: '',
                      release_date: '',
                      genres: [],
                      providers: [],
                    };
                    const isInWatchlist = myWatchlistIds.includes(item.movieId);

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-black/40 border border-white/[0.08] p-4 hover:border-white/20 transition shadow-lg flex flex-col sm:flex-row gap-4"
                      >
                        {/* Filmposter */}
                        <div
                          className="relative w-24 h-36 rounded-xl overflow-hidden shrink-0 border border-white/10 cursor-pointer mx-auto sm:mx-0 shadow-md"
                          onClick={() => onSelectMovieSpotlight && onSelectMovieSpotlight(item.movieId)}
                        >
                          {item.poster_path ? (
                            <Image
                              src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                              alt={item.recentFilm}
                              fill
                              unoptimized
                              className="object-cover hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-xs text-neutral-500">
                              Geen poster
                            </div>
                          )}
                        </div>

                        {/* Info & Watchlist actie */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${item.avatarGradient} flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm`}>
                                  {item.initial}
                                </div>
                                <p className="text-xs text-neutral-300 truncate">
                                  <span className="font-bold text-white">{item.name}</span> heeft gekeken
                                </p>
                              </div>

                              <span className="px-2.5 py-1 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 font-black text-xs tabular-nums shrink-0">
                                ★ {item.rating ? item.rating.toFixed(1) : 'Gezien'}
                              </span>
                            </div>

                            <h3
                              onClick={() => onSelectMovieSpotlight && onSelectMovieSpotlight(item.movieId)}
                              className="text-base font-black text-white hover:text-rose-400 cursor-pointer transition mt-2 truncate"
                            >
                              {item.recentFilm}
                            </h3>

                            <p className="text-xs text-neutral-400 italic mt-1 line-clamp-2">
                              &ldquo;Beoordeeld met een {item.rating.toFixed(1)} &bull; {item.minutesAgo} minuten geleden&rdquo;
                            </p>
                          </div>

                          <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between mt-3">
                            <span className="text-[10px] text-neutral-500">Tip van vriend</span>
                            <button
                              type="button"
                              onClick={() => onToggleWatchlist(matchedMovie)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
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
            </div>

            <p className="text-[10px] text-neutral-500 pt-3 border-t border-white/[0.06] mt-4">
              Klik op een filmposter om de details en trailer direct in de spotlight te bekijken.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}