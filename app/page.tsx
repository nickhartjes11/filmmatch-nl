'use client';

import { startTransition, useState, useEffect, useMemo, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import LandingView from '../components/LandingView';
import RegisterFlow from '../components/RegisterFlow';
import ProfileView from '../components/ProfileView';
import FriendActivityPage from '../components/FriendActivityPage';
import WatchTogetherPage from '../components/WatchTogetherPage';
import HeroSpotlight from '../components/HeroSpotlight';
import AuthPage from '../components/AuthPage';
import MovieRatingDialog from '../components/MovieRatingDialog';
import type { DiscoveryMode, FriendActivityItem, LibraryView, Movie, MovieRating, StreamingPlatform } from '../components/types';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { calculateMatchScore, type MatchPreferences, type MovieTasteSignals, type RatedMovieTasteSignals } from '@/lib/recommendations/matchScore';

interface MovieApiResult extends Partial<Movie> {
  id: number;
  title: string;
  vote_average?: number;
  imdb_rating?: string | number;
  imdbRating?: string | number;
}

interface PersonSearchResult {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  birthday?: string | null;
  biography?: string;
  place_of_birth?: string | null;
}

function calculateAge(birthday?: string | null): number | null {
  if (!birthday) return null;
  const date = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const passed = today.getMonth() > date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());
  if (!passed) age -= 1;
  return age >= 0 ? age : null;
}

interface MovieTasteMetadata extends MovieTasteSignals {
  release_date: string;
  runtime_minutes: number | null;
}

type AppView = 'landing' | 'register' | 'login' | 'dashboard' | 'profile' | 'activity' | 'friends' | 'watch-together';

function mapMovieResults(list: MovieApiResult[]): Movie[] {
  return (list || []).map((movie) => {
    const genres = Array.isArray(movie.genres) ? movie.genres : [];
    const imdbRating = movie.imdb_rating ?? movie.imdbRating;
    const hasImdbRating = imdbRating !== undefined && Number.isFinite(Number(imdbRating)) && Number(imdbRating) > 0;

    return {
      ...movie,
      ...(hasImdbRating ? { rating: String(imdbRating), rating_source: 'IMDb' } : {}),
      id: movie.id,
      title: movie.title || 'Onbekende titel',
      overview: movie.overview || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || '',
      runtime: movie.runtime || (movie.runtime_minutes ? `${movie.runtime_minutes}m` : undefined),
      genres,
      providers: Array.isArray(movie.providers) ? movie.providers : [],
      friend_recommendation: undefined,
    };
  });
}

const TARGET_DISCOVERY_COUNT = 25;

function matchesDiscoveryFilters(
  movie: Movie,
  selectedPlatforms: string[],
  minimumImdbRating: number,
  releaseYearBefore: number | null,
  maxRuntimeMinutes: number | null,
  isCinema = false
): boolean {
  const year = Number.parseInt(movie.release_date?.slice(0, 4) || '', 10);
  const matchesPlatform = isCinema || selectedPlatforms.length === 0 ||
    Boolean(movie.providers?.some((p) => selectedPlatforms.includes(p.provider_name)));
  const matchesImdb = minimumImdbRating === 0 || (
    movie.rating_source === 'IMDb' && Number.parseFloat(movie.rating || '0') >= minimumImdbRating
  );
  const matchesYear = releaseYearBefore === null || !Number.isFinite(year) || year <= releaseYearBefore;
  const matchesRuntime = maxRuntimeMinutes === null || !movie.runtime_minutes || movie.runtime_minutes <= maxRuntimeMinutes;

  return matchesPlatform && matchesImdb && matchesYear && matchesRuntime;
}

const FIVE_PLATFORMS: StreamingPlatform[] = [
  { name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg', id: 8, mark: 'N', color: '#e50914' },
  { name: 'Prime Video', logo_path: '/pvsKGltTBD6bJk1n5Q2p57T77o6.jpg', id: 119, mark: 'P', color: '#1769aa' },
  { name: 'Disney+', logo_path: '/97yvRBw1GzX7fXprcF80919jwCS.jpg', id: 337, mark: 'D+', color: '#172b73' },
  { name: 'HBO Max', logo_path: '/Ajqyt5Gh8fqGaSlXMj9310wI75x.jpg', id: 1899, mark: 'H', color: '#5428a8' },
  { name: 'Videoland', logo_path: '/9A1DaAYi4SYahE4a9fl0Z4qVwZ6.jpg', id: 72, mark: 'V', color: '#e30a64' },
];

const ONBOARDING_FAVORITES = [
  { id: 157336, title: 'Interstellar', poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', year: '2014', genres: ['Sciencefiction', 'Avontuur'] },
  { id: 155, title: 'The Dark Knight', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', year: '2008', genres: ['Misdaad', 'Actie', 'Drama'] },
  { id: 27205, title: 'Inception', poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg', year: '2010', genres: ['Sciencefiction', 'Actie', 'Mysterie'] },
  { id: 438631, title: 'Dune', poster_path: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg', year: '2021', genres: ['Sciencefiction', 'Avontuur'] },
  { id: 329865, title: 'Arrival', poster_path: '/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg', year: '2016', genres: ['Sciencefiction', 'Drama', 'Mysterie'] },
  { id: 872585, title: 'Oppenheimer', poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', year: '2023', genres: ['Drama', 'Historisch'] },
  { id: 278, title: 'The Shawshank Redemption', poster_path: '/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg', year: '1994', genres: ['Drama', 'Misdaad'] },
  { id: 680, title: 'Pulp Fiction', poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', year: '1994', genres: ['Misdaad', 'Drama'] },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [viewHistory, setViewHistory] = useState<AppView[]>([]);
  const navigateToView = (view: AppView) => {
    if (view !== currentView) setViewHistory((history) => [...history, currentView]);
    setCurrentView(view);
  };

  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [libraryView, setLibraryView] = useState<LibraryView>('discover');
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('recommended');
  const [librarySort, setLibrarySort] = useState<'default' | 'rating' | 'match'>('default');
  const [library, setLibrary] = useState<{ watchlist: Movie[]; watched: Movie[] }>({ watchlist: [], watched: [] });

  const [movies, setMovies] = useState<Movie[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivityItem[]>([]);
  const [friendsList, setFriendsList] = useState<Array<{ id: string; display_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [movieLoadError, setMovieLoadError] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(FIVE_PLATFORMS.map((p) => p.name));
  const [minimumImdbRating, setMinimumImdbRating] = useState(7.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null);

  const [spotlightMovieId, setSpotlightMovieId] = useState<number | null>(null);
  const [selectedSpotlightMovie, setSelectedSpotlightMovie] = useState<Movie | null>(null);
  const [chosenPlatforms, setChosenPlatforms] = useState<string[]>([]);
  const [selectedFavorites, setSelectedFavorites] = useState<number[]>([]);
  const [movieRatings, setMovieRatings] = useState<MovieRating[]>([]);
  const [ratingMovie, setRatingMovie] = useState<{ movie: Movie; alreadyWatched: boolean } | null>(null);
  const [draftMovieRating, setDraftMovieRating] = useState<number | null>(null);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [tasteMovieMetadata] = useState<Record<number, MovieTasteMetadata>>({});
  const [releaseYearBefore, setReleaseYearBefore] = useState<number | null>(null);
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState<number | null>(null);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [favoriteDirectors, setFavoriteDirectors] = useState<string[]>([]);
  const [favoriteCast, setFavoriteCast] = useState<string[]>([]);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Gebruiker');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  const passwordsMatch = accountPassword.length > 0 && accountPassword === confirmPassword;
  const canCreateAccount = Boolean(displayName.trim() && accountEmail.trim() && accountPassword.length >= 8 && passwordsMatch);

  const handleResetToHome = () => {
    setCurrentView('dashboard');
    setLibraryView('discover');
    setDiscoveryMode('recommended');
    setSearchQuery('');
    setSelectedPerson(null);
    setSpotlightMovieId(null);
    setSelectedSpotlightMovie(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectPerson = (name: string) => {
    setCurrentView('dashboard');
    setLibraryView('discover');
    setSpotlightMovieId(null);
    setSelectedSpotlightMovie(null);
    setSearchQuery(name);
  };

  const favoriteMovies = useMemo<MovieTasteSignals[]>(
    () => ONBOARDING_FAVORITES.filter((f) => selectedFavorites.includes(f.id)).map((film) => ({
      id: film.id,
      genres: tasteMovieMetadata[film.id]?.genres || film.genres,
      director: tasteMovieMetadata[film.id]?.director,
      cast: tasteMovieMetadata[film.id]?.cast,
    })),
    [selectedFavorites, tasteMovieMetadata]
  );

  const ratedMovies = useMemo<RatedMovieTasteSignals[]>(
    () => movieRatings.map((mr) => ({
      ...(tasteMovieMetadata[mr.movie_id] || { id: mr.movie_id, genres: [] }),
      rating: mr.rating,
    })),
    [movieRatings, tasteMovieMetadata]
  );

  const matchPreferences = useMemo<MatchPreferences>(
    () => ({ favoriteMovies, ratedMovies, dislikedGenres, favoriteDirectors, favoriteCast }),
    [favoriteMovies, ratedMovies, dislikedGenres, favoriteDirectors, favoriteCast]
  );

  const ratingsByMovieId = useMemo(
    () => Object.fromEntries(movieRatings.map((mr) => [mr.movie_id, mr.rating])),
    [movieRatings]
  );

  const preferredGenres = useMemo(() => {
    const genreWeights = new Map<string, { name: string; weight: number }>();
    const ratedById = new Map(ratedMovies.map((m) => [m.id, m.rating]));
    const favoriteIds = new Set(favoriteMovies.map((m) => m.id));

    const addGenres = (genres: readonly string[], weight: number) => {
      if (weight <= 0) return;
      Array.from(new Set(genres.map((g) => g.trim()).filter(Boolean))).forEach((name) => {
        const key = name.toLocaleLowerCase();
        const cur = genreWeights.get(key);
        genreWeights.set(key, { name: cur?.name || name, weight: (cur?.weight || 0) + weight });
      });
    };

    const ratingWeight = (r: number) => Math.max(0, (r - 5.5) / 4.5);
    favoriteMovies.forEach((m) => {
      const r = ratedById.get(m.id);
      addGenres(m.genres, r === undefined ? 1 : ratingWeight(r));
    });
    ratedMovies.forEach((m) => {
      if (!favoriteIds.has(m.id)) addGenres(m.genres, ratingWeight(m.rating));
    });

    return Array.from(genreWeights.values()).sort((a, b) => b.weight - a.weight).map((g) => g.name).slice(0, 2);
  }, [favoriteMovies, ratedMovies]);

  const loadFriendsActivity = async (userId: string) => {
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data: friendRows } = await supabase.from('friendships').select('friend_id').eq('user_id', userId);
      const friendIds = (friendRows || []).map((row) => row.friend_id);
      if (friendIds.length === 0) {
        setFriendsActivity([]);
        setFriendsList([]);
        return;
      }
      const [{ data: profiles }, { data: ratings }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', friendIds),
        supabase.from('movie_ratings').select('user_id, movie_id, rating, created_at').in('user_id', friendIds).order('created_at', { ascending: false }).limit(20),
      ]);
      setFriendsList(profiles || []);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.display_name || 'Vriend']));
      const movieIds = Array.from(new Set((ratings || []).map((r) => r.movie_id)));
      let movieMap: Record<number, { title: string; poster_path: string }> = {};

      if (movieIds.length > 0) {
        const res = await fetch(`/api/movies?metadataIds=${movieIds.join(',')}`);
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d.movies)) {
            movieMap = Object.fromEntries(d.movies.map((m: Movie) => [m.id, { title: m.title, poster_path: m.poster_path || '' }]));
          }
        }
      }

      setFriendsActivity((ratings || []).map((item, index) => {
        const friendName = profileMap.get(item.user_id) || 'Vriend';
        const movieInfo = movieMap[item.movie_id];
        const createdDate = item.created_at ? new Date(item.created_at) : new Date();
        return {
          id: index + 1,
          friendId: item.user_id,
          name: friendName,
          initial: friendName.slice(0, 1).toUpperCase(),
          avatarGradient: 'from-rose-500 to-amber-500',
          recentFilm: movieInfo?.title || 'Onbekende film',
          movieId: item.movie_id,
          poster_path: movieInfo?.poster_path || '',
          rating: Number(item.rating),
          minutesAgo: Math.max(1, Math.round((Date.now() - createdDate.getTime()) / 60000)),
        };
      }));
    } catch (e) {
      console.warn('Friends activity load error:', e);
    }
  };

  const loadAuthenticatedUser = async (user: User) => {
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const name = profile?.display_name || String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Gebruiker');
      const services = profile?.streaming_services || FIVE_PLATFORMS.map((p) => p.name);
      const favorites = profile?.favorite_movie_ids?.map(Number) || [];

      const { data: ratingRows } = await supabase.from('movie_ratings').select('movie_id, rating').eq('user_id', user.id);
      const [{ data: watchlistRows }, { data: watchedRows }] = await Promise.all([
        supabase.from('user_watchlist').select('movie_data').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_watched').select('movie_data').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      startTransition(() => {
        setAuthUserId(user.id);
        setAccountEmail(user.email || '');
        setDisplayName(name);
        setChosenPlatforms(services);
        setSelectedPlatforms(services);
        setSelectedFavorites(favorites);
        setLibrary({
          watchlist: (watchlistRows || []).map((r) => r.movie_data as Movie).filter(Boolean),
          watched: (watchedRows || []).map((r) => r.movie_data as Movie).filter(Boolean),
        });
        setMovieRatings((ratingRows || []).map((r) => ({ movie_id: Number(r.movie_id), rating: Number(r.rating) })));
        setDislikedGenres(profile?.disliked_genres || []);
        setFavoriteDirectors(profile?.favorite_directors || []);
        setFavoriteCast(profile?.favorite_cast || []);
        setReleaseYearBefore(profile?.release_year_before ?? null);
        setMaxRuntimeMinutes(profile?.max_runtime_minutes ?? null);
      });
      void loadFriendsActivity(user.id);
    } catch (err) {
      console.warn('Profile load error:', err);
    }
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: accountEmail.trim(),
      password: accountPassword,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setAuthLoading(false);
    if (error) return setAuthError(error.message);
    if (data.session && data.user) {
      await loadAuthenticatedUser(data.user);
      setCurrentView('dashboard');
    } else {
      setAuthNotice('Controleer je e-mail om je account te bevestigen.');
    }
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    setAuthLoading(false);
    if (error) return setAuthError(error.message);
    if (data.user) {
      await loadAuthenticatedUser(data.user);
      setCurrentView('dashboard');
    }
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setAuthUserId(null);
    setAccountEmail('');
    setDisplayName('Gebruiker');
    setCurrentView('login');
  };

  const saveProfile = async () => {
    if (!authUserId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setAuthLoading(true);
    await supabase.from('profiles').upsert({
      id: authUserId,
      display_name: displayName.trim(),
      streaming_services: selectedPlatforms,
      favorite_movie_ids: selectedFavorites,
      preferred_genres: preferredGenres,
      disliked_genres: dislikedGenres,
      favorite_directors: favoriteDirectors,
      favorite_cast: favoriteCast,
      release_year_before: releaseYearBefore,
      max_runtime_minutes: maxRuntimeMinutes,
      onboarding_completed: true,
    });
    setAuthLoading(false);
    setAuthNotice('Je profiel is opgeslagen.');
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user) void loadAuthenticatedUser(data.user);
    });
  }, []);

  // TMDB ophalen
  useEffect(() => {
    const query = searchQuery.trim();
    if (libraryView !== 'discover' && libraryView !== 'cinema') return;

    let isActive = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      const candidateMovies: Movie[] = [];
      setMovieLoadError('');
      try {
        const isCinema = libraryView === 'cinema';
        const pages = query || selectedPerson || isCinema ? [1] : [1, 2];
        const requests = pages.map(async (p) => {
          const params = new URLSearchParams({ page: String(p) });
          if (isCinema) {
            params.set('nowPlaying', 'true');
          } else {
            params.set(
              'providers',
              selectedPlatforms.length > 0
                ? selectedPlatforms.join(',')
                : FIVE_PLATFORMS.map((x) => x.name).join(',')
            );

            if (!query && !selectedPerson && (librarySort === 'rating' || discoveryMode === 'recommended')) {
              params.set('sortBy', 'imdbCandidates');
              params.set('topRated', 'true');
            }

            if (selectedPerson) {
              params.set('personId', String(selectedPerson.id));
            } else if (query) {
              params.set('query', query);
            } else if (preferredGenres.length > 0) {
              params.set('genre', preferredGenres[0]);
            }
          }
          const res = await fetch(`/api/movies?${params.toString()}`);
          return res.ok ? res.json() : null;
        });

        const results = await Promise.all(requests);
        if (!isActive) return;

        results.forEach((data) => {
          if (!data) return;
          const mapped = mapMovieResults(data.movies || []);
          const existingIds = new Set(candidateMovies.map((m) => m.id));
          candidateMovies.push(...mapped.filter((m) => !existingIds.has(m.id)));
        });

        setMovies(
          candidateMovies.map((m) => ({
            ...m,
            match_percentage: calculateMatchScore(
              { id: m.id, genres: m.genres || [], director: m.director, cast: m.cast, rating: m.rating },
              matchPreferences
            ),
          }))
        );
      } catch (e) {
        if (isActive) setMovieLoadError('Films konden niet worden geladen.');
      } finally {
        if (isActive) setLoading(false);
      }
    }, 200);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [
    searchQuery,
    libraryView,
    selectedPerson,
    selectedPlatforms,
    preferredGenres,
    matchPreferences,
    librarySort,
    discoveryMode,
  ]);

  const togglePlatform = (name: string) => {
    setSelectedPlatforms((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  };

  const toggleWatchlist = async (movie: Movie) => {
    const isSaved = library.watchlist.some((m) => m.id === movie.id);
    setLibrary((prev) => ({
      ...prev,
      watchlist: isSaved ? prev.watchlist.filter((m) => m.id !== movie.id) : [movie, ...prev.watchlist],
      watched: prev.watched.filter((m) => m.id !== movie.id),
    }));

    if (!authUserId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    if (isSaved) {
      await supabase.from('user_watchlist').delete().match({ user_id: authUserId, movie_id: movie.id });
    } else {
      await supabase.from('user_watched').delete().match({ user_id: authUserId, movie_id: movie.id });
      await supabase.from('user_watchlist').upsert({ user_id: authUserId, movie_id: movie.id, movie_data: movie, created_at: new Date().toISOString() });
    }
  };

  const openMovieRating = (movie: Movie) => {
    setRatingMovie({ movie, alreadyWatched: library.watched.some((m) => m.id === movie.id) });
    setDraftMovieRating(ratingsByMovieId[movie.id] ?? null);
  };

  const removeWatched = async (movie: Movie) => {
    setLibrary((prev) => ({ ...prev, watched: prev.watched.filter((m) => m.id !== movie.id) }));
    if (spotlightMovieId === movie.id) {
      setSpotlightMovieId(null);
      setSelectedSpotlightMovie(null);
    }
    if (!authUserId) return;
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.from('user_watched').delete().match({ user_id: authUserId, movie_id: movie.id });
  };

  const confirmMovieRating = async () => {
    if (!ratingMovie || draftMovieRating === null) return;
    setRatingSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase && authUserId) {
        await supabase.from('movie_ratings').upsert({ user_id: authUserId, movie_id: ratingMovie.movie.id, rating: draftMovieRating }, { onConflict: 'user_id,movie_id' });
        await supabase.from('user_watched').upsert({ user_id: authUserId, movie_id: ratingMovie.movie.id, movie_data: ratingMovie.movie, created_at: new Date().toISOString() });
        await supabase.from('user_watchlist').delete().match({ user_id: authUserId, movie_id: ratingMovie.movie.id });
      }
      setMovieRatings((cur) => [...cur.filter((r) => r.movie_id !== ratingMovie.movie.id), { movie_id: ratingMovie.movie.id, rating: draftMovieRating }]);
      setLibrary((prev) => ({
        watchlist: prev.watchlist.filter((m) => m.id !== ratingMovie.movie.id),
        watched: [ratingMovie.movie, ...prev.watched.filter((m) => m.id !== ratingMovie.movie.id)],
      }));
      setRatingMovie(null);
    } finally {
      setRatingSaving(false);
    }
  };

  const selectSpotlightMovie = (movie: Movie) => {
    setSpotlightMovieId(movie.id);
    setSelectedSpotlightMovie(movie);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filteredMovies = useMemo(() => {
    const watchedIds = new Set(library.watched.map((m) => m.id));
    let catalog = libraryView === 'watchlist' ? [...library.watchlist] : libraryView === 'watched' ? [...library.watched] : [...movies];

    if (librarySort === 'rating') {
      catalog.sort((a, b) => (ratingsByMovieId[b.id] ?? Number.parseFloat(b.rating || '0')) - (ratingsByMovieId[a.id] ?? Number.parseFloat(a.rating || '0')));
    } else if (librarySort === 'match') {
      catalog.sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));
    }

    const isCinema = libraryView === 'cinema';
    return catalog.filter((m) => {
      const matchQuery = selectedPerson || !searchQuery.trim() || `${m.title} ${m.overview}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesFilters = (libraryView !== 'discover' && !isCinema) || matchesDiscoveryFilters(m, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes, isCinema);
      const isUnwatched = (libraryView !== 'discover' && !isCinema) || (libraryView === 'discover' && Boolean(searchQuery.trim())) || !watchedIds.has(m.id);
      return matchQuery && matchesFilters && isUnwatched;
    });
  }, [movies, library, libraryView, searchQuery, selectedPerson, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes, librarySort, ratingsByMovieId]);

  const spotlightMovie = spotlightMovieId ? (selectedSpotlightMovie || filteredMovies.find((m) => m.id === spotlightMovieId) || null) : null;

  if (currentView === 'landing') {
    return <LandingView platforms={FIVE_PLATFORMS} onOpenDashboard={() => setCurrentView('dashboard')} onOpenRegister={() => { setRegisterStep(1); setCurrentView('register'); }} onOpenLogin={() => setCurrentView('login')} />;
  }

  if (currentView === 'register') {
    return (
      <RegisterFlow
        registerStep={registerStep}
        setRegisterStep={setRegisterStep}
        displayName={displayName}
        setDisplayName={setDisplayName}
        accountEmail={accountEmail}
        setAccountEmail={setAccountEmail}
        accountPassword={accountPassword}
        setAccountPassword={setAccountPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passwordsMatch={passwordsMatch}
        canCreateAccount={canCreateAccount}
        authError={authError}
        authNotice={authNotice}
        authLoading={authLoading}
        supabaseConfigured={supabaseConfigured}
        platforms={FIVE_PLATFORMS}
        chosenPlatforms={chosenPlatforms}
        toggleRegisterPlatform={(p) => setChosenPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
        onboardingFavorites={ONBOARDING_FAVORITES}
        selectedFavorites={selectedFavorites}
        toggleFavorite={(id) => setSelectedFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
        onSignUp={handleSignUp}
        onCompleteOnboarding={async () => { await saveProfile(); setCurrentView('dashboard'); }}
        onOpenDashboard={() => setCurrentView('dashboard')}
        onCancel={() => setCurrentView('login')}
      />
    );
  }

  if (currentView === 'login') {
    return (
      <AuthPage
        mode="login"
        registerStep={registerStep}
        displayName={displayName}
        accountEmail={accountEmail}
        accountPassword={accountPassword}
        confirmPassword={confirmPassword}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        authError={authError}
        authNotice={authNotice}
        authLoading={authLoading}
        supabaseConfigured={supabaseConfigured}
        passwordsMatch={passwordsMatch}
        canCreateAccount={canCreateAccount}
        chosenPlatforms={chosenPlatforms}
        selectedFavorites={selectedFavorites}
        platforms={FIVE_PLATFORMS}
        favoriteFilms={ONBOARDING_FAVORITES}
        onSignUp={handleSignUp}
        onSignIn={handleSignIn}
        onDisplayNameChange={setDisplayName}
        onAccountEmailChange={setAccountEmail}
        onAccountPasswordChange={setAccountPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
        onTogglePlatform={(p) => setChosenPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
        onToggleFavorite={(id) => setSelectedFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
        onPreviousStep={() => setRegisterStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)}
        onNextStep={() => setRegisterStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5)}
        onCompleteOnboarding={async () => { await saveProfile(); setCurrentView('dashboard'); }}
        onOpenDashboard={() => setCurrentView('dashboard')}
        onCancelRegistration={() => setCurrentView('login')}
        onOpenLogin={() => setCurrentView('login')}
        onOpenRegister={() => { setRegisterStep(1); setCurrentView('register'); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080d1a] text-neutral-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* 1. HORIZONTALE TOPNAVIGATIE (NIEUW DESIGN) */}
      <header className="sticky top-0 z-40 w-full bg-[#080d1a]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={handleResetToHome}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-lg">
              🎬
            </div>
            <span className="text-xl font-black tracking-tight text-white group-hover:text-cyan-400 transition">
              FilmMatch<span className="text-cyan-400">.nl</span>
            </span>
          </button>

          {/* Menutabs bovenaan */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold">
            <button
              type="button"
              onClick={handleResetToHome}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'dashboard' && libraryView === 'discover'
                  ? 'bg-cyan-500 text-neutral-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-neutral-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentView('dashboard');
                setLibraryView('discover');
                setDiscoveryMode('recommended');
              }}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'dashboard' && libraryView === 'discover' && discoveryMode === 'recommended'
                  ? 'text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Aanbevelingen
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentView('dashboard');
                setLibraryView('watchlist');
              }}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'dashboard' && libraryView === 'watchlist'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Watchlist
              {library.watchlist.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300">
                  {library.watchlist.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentView('dashboard');
                setLibraryView('watched');
              }}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'dashboard' && libraryView === 'watched'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Gezien
            </button>
            {/* BIOSCOOP IS NU EEN APARTE TAB BOVENAAN */}
            <button
              type="button"
              onClick={() => {
                setCurrentView('dashboard');
                setLibraryView('cinema');
              }}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'dashboard' && libraryView === 'cinema'
                  ? 'bg-cyan-500 text-neutral-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Bioscoop
            </button>
            <button
              type="button"
              onClick={() => navigateToView('friends')}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'friends'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Vrienden
            </button>
            <button
              type="button"
              onClick={() => navigateToView('watch-together')}
              className={`px-4 py-2 rounded-xl transition ${
                currentView === 'watch-together'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Samen kijken
            </button>
          </nav>
        </div>

        {/* Rechter acties: Zoekbalk & Profiel */}
        <div className="flex items-center gap-3">
          {showSearchInput ? (
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek film of acteur..."
                autoFocus
                className="w-48 sm:w-64 px-3.5 py-1.5 pr-8 rounded-xl bg-neutral-900 border border-cyan-400/40 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchInput(false);
                }}
                className="absolute right-2.5 text-neutral-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearchInput(true)}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-300 transition"
              title="Zoeken"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}

          {/* Profiel dropdown button */}
          <button
            type="button"
            onClick={() => navigateToView('profile')}
            className="flex items-center gap-2 p-1 pl-2 pr-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center font-bold text-xs text-white uppercase">
              {displayName.charAt(0)}
            </div>
            <span className="text-xs font-semibold text-neutral-200 hidden sm:inline">
              {displayName}
            </span>
          </button>
        </div>
      </header>

      {/* 2. HOOFD INHOUD */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {currentView === 'watch-together' ? (
          <WatchTogetherPage
            currentUserId={authUserId}
            currentUserName={displayName || 'Jij'}
            myWatchlist={library.watchlist}
            myStreamingServices={selectedPlatforms}
            friends={friendsList}
            platforms={FIVE_PLATFORMS}
            onSelectMovieSpotlight={(id) => {
              setCurrentView('dashboard');
              setLibraryView('discover');
              setSpotlightMovieId(id);
            }}
            onToggleWatchlist={toggleWatchlist}
          />
        ) : currentView === 'friends' || currentView === 'activity' ? (
          <FriendActivityPage
            currentUserId={authUserId}
            currentUserName={displayName || 'Jij'}
            myStreamingServices={selectedPlatforms}
            allMovies={movies}
            myWatchedIds={library.watched.map((m) => m.id)}
            myWatchlistIds={library.watchlist.map((m) => m.id)}
            activities={friendsActivity}
            friends={friendsList}
            onFriendshipChanged={() => { if (authUserId) void loadFriendsActivity(authUserId); }}
            onToggleWatchlist={toggleWatchlist}
            onToggleWatched={openMovieRating}
            onSelectPerson={handleSelectPerson}
          />
        ) : (
          <>
            {/* Grote Widescreen Hero (alleen tonen bij discover en cinema) */}
            <HeroSpotlight
              movie={spotlightMovie}
              allMovies={filteredMovies}
              watchlistIds={library.watchlist.map((m) => m.id)}
              watchedIds={library.watched.map((m) => m.id)}
              matchPreferences={matchPreferences}
              onToggleWatchlist={toggleWatchlist}
              onToggleWatched={openMovieRating}
              onSelectPerson={handleSelectPerson}
              onSelectMovie={selectSpotlightMovie}
              onFindMovie={() => {
                const el = document.getElementById('film-catalog');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            {/* Subnavigatie Pillenbalk (Onder de Hero) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLibraryView('discover');
                  setDiscoveryMode('recommended');
                }}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  libraryView === 'discover' && discoveryMode === 'recommended'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-neutral-900/80 border-white/10 text-neutral-300 hover:bg-white/5'
                }`}
              >
                ★ Aanbevelingen
              </button>
              <button
                type="button"
                onClick={() => setLibraryView('watchlist')}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  libraryView === 'watchlist'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-neutral-900/80 border-white/10 text-neutral-300 hover:bg-white/5'
                }`}
              >
                🔖 Watchlist
              </button>
              <button
                type="button"
                onClick={() => setLibraryView('watched')}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  libraryView === 'watched'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-neutral-900/80 border-white/10 text-neutral-300 hover:bg-white/5'
                }`}
              >
                ✓ Gezien
              </button>
              <button
                type="button"
                onClick={() => setLibraryView('cinema')}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  libraryView === 'cinema'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'bg-neutral-900/80 border-white/10 text-neutral-300 hover:bg-white/5'
                }`}
              >
                🍿 Bioscoop
              </button>
              <button
                type="button"
                onClick={() => navigateToView('friends')}
                className="py-3 px-4 rounded-2xl border bg-neutral-900/80 border-white/10 text-neutral-300 hover:bg-white/5 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                👥 Vriendenactiviteit
              </button>
              <button
                type="button"
                onClick={() => navigateToView('watch-together')}
                className="py-3 px-4 rounded-2xl border bg-neutral-900/80 border-white/10 text-neutral-300 hover:bg-white/5 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                📺 Samen kijken
              </button>
            </div>

            {/* Horizontale Filterbalk (Beschikbaar op & IMDb-minimum) */}
            {libraryView !== 'cinema' && (
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/80 border border-white/10 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Beschikbaar op
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {FIVE_PLATFORMS.map((platform) => {
                      const isSelected = selectedPlatforms.includes(platform.name);
                      return (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => togglePlatform(platform.name)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                            isSelected
                              ? 'bg-white/15 border-white/30 text-white shadow-sm'
                              : 'bg-black/30 border-white/5 text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-cyan-500 focus:ring-0 cursor-pointer pointer-events-none w-3.5 h-3.5"
                          />
                          <span>{platform.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-400">
                    <span>IMDb-minimum:</span>
                    <select
                      value={minimumImdbRating}
                      onChange={(e) => setMinimumImdbRating(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-white/15 text-amber-300 font-black text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      <option value={0}>Alles tonen</option>
                      <option value={7.0}>★ 7.0+</option>
                      <option value={7.5}>★ 7.5+</option>
                      <option value={8.0}>★ 8.0+ (Topfilms)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setLibrarySort('default')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        librarySort === 'default' ? 'bg-white/20 text-white font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Standaard
                    </button>
                    <button
                      type="button"
                      onClick={() => setLibrarySort('rating')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        librarySort === 'rating' ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      ★ Cijfer
                    </button>
                    <button
                      type="button"
                      onClick={() => setLibrarySort('match')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        librarySort === 'match' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      ⚡ Match
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Catalogus Rijen: 16:9 Landschapskaarten */}
            <div id="film-catalog" className="space-y-6 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {libraryView === 'cinema'
                    ? 'Nu in de bioscoop'
                    : libraryView === 'watchlist'
                    ? 'Jouw Watchlist'
                    : libraryView === 'watched'
                    ? 'Gezien door jou'
                    : 'Aanbevolen voor jou'}
                </h3>
                <span className="text-xs font-semibold text-neutral-400">
                  {filteredMovies.length} films
                </span>
              </div>

              {loading ? (
                <div className="py-24 text-center text-sm text-neutral-400">
                  Films inladen...
                </div>
              ) : filteredMovies.length === 0 ? (
                <div className="py-20 text-center text-sm text-neutral-400">
                  Geen films gevonden die aan de filters voldoen.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {filteredMovies.map((film) => {
                    const backdrop = film.backdrop_path
                      ? `https://image.tmdb.org/t/p/w780${film.backdrop_path}`
                      : film.poster_path
                      ? `https://image.tmdb.org/t/p/w780${film.poster_path}`
                      : '/fallback-backdrop.jpg';

                    const score = film.rating || (film as any).imdb_rating || '7.5';

                    return (
                      <div
                        key={film.id}
                        onClick={() => selectSpotlightMovie(film)}
                        className="group relative aspect-[16/9] rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-cyan-400/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xl"
                      >
                        {/* 16:9 Afbeelding */}
                        <img
                          src={backdrop}
                          alt={film.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* Badges linksboven */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          {film.match_percentage && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/90 text-white shadow-sm">
                              {film.match_percentage}%
                            </span>
                          )}
                        </div>

                        {/* Info onderaan de kaart */}
                        <div className="absolute bottom-3 left-3 right-3 space-y-1">
                          <h4 className="text-sm font-black text-white truncate group-hover:text-cyan-300 transition">
                            {film.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-300">
                            <span className="text-amber-400 font-bold">★ {score}</span>
                            {film.genres?.slice(0, 2).map((g) => (
                              <span key={g} className="text-neutral-400 truncate">
                                · {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Beoordelingsdialog */}
      {ratingMovie && (
        <MovieRatingDialog
          movie={ratingMovie.movie}
          rating={draftMovieRating}
          alreadyWatched={ratingMovie.alreadyWatched}
          saving={ratingSaving}
          error=""
          onRatingChange={setDraftMovieRating}
          onCancel={() => setRatingMovie(null)}
          onConfirm={confirmMovieRating}
          onRemoveWatched={() => { void removeWatched(ratingMovie.movie); setRatingMovie(null); }}
        />
      )}
    </div>
  );
}