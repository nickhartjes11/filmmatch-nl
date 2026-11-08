'use client';

import { startTransition, useState, useEffect, useMemo, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import LandingView from '../components/LandingView';
import RegisterFlow from '../components/RegisterFlow';
import ProfileView from '../components/ProfileView';
import DashboardHeader from '../components/DashboardHeader';
import FriendActivityPage from '../components/FriendActivityPage';
import WatchTogetherPage from '../components/WatchTogetherPage';
import HeroSpotlight from '../components/HeroSpotlight';
import AuthPage from '../components/AuthPage';
import MovieGrid from '../components/MovieGrid';
import MovieRatingDialog from '../components/MovieRatingDialog';
import TopNavigation from '../components/Topnavigation';
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
  { id: 98, title: 'Gladiator', poster_path: '/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg', year: '2000', genres: ['Actie', 'Avontuur', 'Drama'] },
  { id: 807, title: 'Se7en', poster_path: '/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg', year: '1995', genres: ['Misdaad', 'Mysterie', 'Thriller'] },
  { id: 122, title: 'The Lord of the Rings', poster_path: '/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg', year: '2003', genres: ['Avontuur', 'Fantasy'] },
  { id: 597, title: 'Titanic', poster_path: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg', year: '1997', genres: ['Drama', 'Romantiek'] },
  { id: 603, title: 'The Matrix', poster_path: '/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg', year: '1999', genres: ['Sciencefiction', 'Actie'] },
  { id: 496243, title: 'Parasite', poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', year: '2019', genres: ['Misdaad', 'Drama', 'Thriller'] },
  { id: 244786, title: 'Whiplash', poster_path: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', year: '2014', genres: ['Drama', 'Muziek', 'Thriller'] },
  { id: 120467, title: 'The Grand Budapest Hotel', poster_path: '/eWdyYreja6JGCzqHWXpWHDrrPo.jpg', year: '2014', genres: ['Komedie', 'Drama'] },
  { id: 354912, title: 'Coco', poster_path: '/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg', year: '2017', genres: ['Animatie', 'Avontuur', 'Familie', 'Muziek'] },
  { id: 324857, title: 'Spider-Man: Into the Spider-Verse', poster_path: '/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg', year: '2018', genres: ['Animatie', 'Actie', 'Avontuur', 'Sciencefiction'] },
  { id: 313369, title: 'La La Land', poster_path: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', year: '2016', genres: ['Komedie', 'Drama', 'Romantiek'] },
  { id: 11631, title: 'Mamma Mia!', poster_path: '/xYLiCWmAMHJubx5jNZ7HuXKjAbV.jpg', year: '2008', genres: ['Komedie', 'Romantiek', 'Muziek'] },
  { id: 419430, title: 'Get Out', poster_path: '/5Axrbsz7ps5RzYB7a1L8IxBSfsD.jpg', year: '2017', genres: ['Horror', 'Mysterie', 'Thriller'] },
  { id: 68718, title: 'Django Unchained', poster_path: '/7oWY8VDWW7thTzWh3OKYRkWUlD5.jpg', year: '2012', genres: ['Western', 'Drama'] },
  { id: 530915, title: '1917', poster_path: '/iZf0KyrE25z1sage4SYFLCCrMi9.jpg', year: '2019', genres: ['Oorlog', 'Drama', 'Historisch'] },
  { id: 515042, title: 'Free Solo', poster_path: '/v4QfYZMACODlWul9doN9RxE99ag.jpg', year: '2018', genres: ['Documentaire', 'Avontuur'] },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [viewHistory, setViewHistory] = useState<AppView[]>([]);
  const navigateToView = (view: AppView) => {
    if (view !== currentView) setViewHistory((history) => [...history, currentView]);
    setCurrentView(view);
  };
  const goBackToPreviousView = () => {
    const prev = viewHistory[viewHistory.length - 1] || 'dashboard';
    setViewHistory((h) => h.slice(0, -1));
    setCurrentView(prev);
  };

  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [libraryView, setLibraryView] = useState<LibraryView>('discover');
  const [previousLibraryView, setPreviousLibraryView] = useState<LibraryView>('discover');
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('recommended');
  const [librarySort, setLibrarySort] = useState<'default' | 'rating' | 'match'>('default');
  const [library, setLibrary] = useState<{ watchlist: Movie[]; watched: Movie[] }>({ watchlist: [], watched: [] });

  const [movies, setMovies] = useState<Movie[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivityItem[]>([]);
  const [friendsList, setFriendsList] = useState<Array<{ id: string; display_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [movieLoadError, setMovieLoadError] = useState('');
  const [visibleMovieLimit, setVisibleMovieLimit] = useState(TARGET_DISCOVERY_COUNT);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(FIVE_PLATFORMS.map((p) => p.name));
  const [minimumImdbRating, setMinimumImdbRating] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null);

  const handleSearchQueryChange = (val: string) => {
    if (val.trim() !== '') {
      if (currentView !== 'dashboard') setCurrentView('dashboard');
      if (libraryView !== 'discover') {
        setPreviousLibraryView(libraryView);
        setLibraryView('discover');
      }
    } else if (previousLibraryView !== libraryView) {
      setLibraryView(previousLibraryView);
    }
    setSearchQuery(val);
  };

  useEffect(() => {
    if (!selectedPerson) return;
    const controller = new AbortController();
    fetch(`/api/movies?personDetails=${selectedPerson.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.person) return;
        setSelectedPerson((cur) => (cur?.id === selectedPerson.id ? { ...cur, ...data.person } : cur));
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Persoonsgegevens konden niet worden geladen:', err);
      });
    return () => controller.abort();
  }, [selectedPerson?.id]);

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
  const [favoritePersonQuery, setFavoritePersonQuery] = useState('');
  const [favoritePersonMatches, setFavoritePersonMatches] = useState<PersonSearchResult[]>([]);
  const [favoritePersonLoading, setFavoritePersonLoading] = useState(false);

  useEffect(() => {
    const query = favoritePersonQuery.trim();
    if (query.length < 2 || currentView !== 'profile') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFavoritePersonLoading(true);
      try {
        const response = await fetch('/api/movies?people=' + encodeURIComponent(query), { signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setFavoritePersonMatches(Array.isArray(data?.people) ? data.people : []);
      } catch {
        if (!controller.signal.aborted) setFavoritePersonMatches([]);
      } finally {
        if (!controller.signal.aborted) setFavoritePersonLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [favoritePersonQuery, currentView]);

  const updateFavoritePersonQuery = (query: string) => {
    setFavoritePersonQuery(query);
    setFavoritePersonMatches([]);
    setFavoritePersonLoading(query.trim().length >= 2);
  };
  const addFavoritePerson = (person: PersonSearchResult) => {
    const update = (names: string[]) => names.includes(person.name) ? names : [...names, person.name];
    if (person.known_for_department === 'Directing') setFavoriteDirectors(update);
    else setFavoriteCast(update);
    updateFavoritePersonQuery('');
  };
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
    setPreviousLibraryView('discover');
    setDiscoveryMode('recommended');
    setSearchQuery('');
    setSelectedPerson(null);
    setSpotlightMovieId(null);
    setSelectedSpotlightMovie(null);
    setMinimumImdbRating(0);
    setReleaseYearBefore(null);
    setMaxRuntimeMinutes(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.dashboard-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectPerson = async (name: string) => {
    setCurrentView('dashboard');
    if (libraryView !== 'discover') {
      setPreviousLibraryView(libraryView);
      setLibraryView('discover');
    }
    setSpotlightMovieId(null);
    setSelectedSpotlightMovie(null);

    try {
      const res = await fetch(`/api/movies?people=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        const match = data.people?.[0];
        if (match) {
          selectPerson(match);
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }
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

  const profileTasteMovies = useMemo(() => {
    const byId = new Map<number, string[]>();
    [...favoriteMovies, ...ratedMovies].forEach((movie) => {
      const watched = library.watched.find((item) => item.id === movie.id);
      byId.set(movie.id, Array.from(new Set([
        ...(byId.get(movie.id) || []), ...(movie.genres || []), ...(watched?.genres || []),
      ])));
    });
    return byId;
  }, [favoriteMovies, ratedMovies, library.watched]);
  const profileTopGenres = useMemo(() => {
    const counts = new Map<string, number>();
    profileTasteMovies.forEach((genres) => genres.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [profileTasteMovies]);
  const genreOptions = useMemo(() => Array.from(new Set([
    'Actie', 'Avontuur', 'Animatie', 'Komedie', 'Misdaad', 'Documentaire', 'Drama',
    'Familie', 'Fantasy', 'Historisch', 'Horror', 'Muziek', 'Mysterie', 'Romantiek',
    'Sciencefiction', 'Thriller', 'Oorlog', 'Western', ...dislikedGenres,
    ...ONBOARDING_FAVORITES.flatMap((movie) => movie.genres),
  ])).sort((a, b) => a.localeCompare(b, 'nl')), [dislikedGenres]);
  const profileHeaderPosters = useMemo(() => {
    const posters = new Map<number, { id: number; title: string; poster_path: string }>();
    [...library.watched, ...ONBOARDING_FAVORITES.filter((movie) => selectedFavorites.includes(movie.id))]
      .forEach((movie) => { if (movie.poster_path && !posters.has(movie.id)) posters.set(movie.id, { id: movie.id, title: movie.title, poster_path: movie.poster_path }); });
    return Array.from(posters.values()).slice(0, 5);
  }, [library.watched, selectedFavorites]);

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
            params.set('providers', selectedPlatforms.length > 0 ? selectedPlatforms.join(',') : FIVE_PLATFORMS.map((x) => x.name).join(','));
            if (selectedPerson) params.set('personId', String(selectedPerson.id));
            else if (query) params.set('query', query);
            else if (preferredGenres.length > 0) params.set('genre', preferredGenres[0]);
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

        setMovies(candidateMovies.map((m) => ({
          ...m,
          match_percentage: calculateMatchScore({ id: m.id, genres: m.genres || [], director: m.director, cast: m.cast, rating: m.rating }, matchPreferences),
        })));
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
  }, [searchQuery, libraryView, selectedPerson, selectedPlatforms, preferredGenres, matchPreferences]);

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

  const selectSpotlightMovie = (movie?: Movie | null) => {
    if (!movie) {
      setSpotlightMovieId(null);
      setSelectedSpotlightMovie(null);
      return;
    }
    setSpotlightMovieId(movie.id);
    setSelectedSpotlightMovie(movie);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.dashboard-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedPerson(null);
    setSpotlightMovieId(null);
    setSelectedSpotlightMovie(null);
    if (previousLibraryView !== libraryView) setLibraryView(previousLibraryView);
  };

  const selectPerson = (person: PersonSearchResult) => {
    if (libraryView !== 'discover') {
      setPreviousLibraryView(libraryView);
      setLibraryView('discover');
    }
    setSelectedPerson(person);
    setSearchQuery(person.name);
  };

  const filteredMovies = useMemo(() => {
    const watchedIds = new Set(library.watched.map((m) => m.id));
    let catalog = libraryView === 'watchlist' ? [...library.watchlist] : libraryView === 'watched' ? [...library.watched] : movies;

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

  const visibleMovies = filteredMovies.slice(0, visibleMovieLimit);
  const spotlightMovie = spotlightMovieId ? (selectedSpotlightMovie || visibleMovies.find((m) => m.id === spotlightMovieId) || null) : null;
  const topMatch = spotlightMovie || (libraryView === 'cinema' ? visibleMovies[0] : null);
  const gridMatches = libraryView === 'watched' ? visibleMovies : topMatch ? visibleMovies.filter((m) => m.id !== topMatch.id) : visibleMovies;

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

  // Prefer the same provider artwork used by the movie cards and hero.
  const providerLogos = new Map<number, string>();
  for (const movie of [...library.watched, ...library.watchlist, ...movies]) {
    for (const provider of movie.providers || []) {
      if (provider.logo_path?.trim()) {
        providerLogos.set(provider.provider_id, provider.logo_path);
      }
    }
  }
  const navigationPlatforms = FIVE_PLATFORMS.map((platform) => {
    // TMDB can list Prime Video and HBO under different regional IDs.
    const idsByName: Record<string, number[]> = {
      'Prime Video': [119, 9],
      'HBO Max': [1899, 384],
    };
    const ids = idsByName[platform.name] || (typeof platform.id === 'number' ? [platform.id] : []);
    const logo = ids.map((id) => providerLogos.get(id)).find(Boolean);
    return { ...platform, logo_path: logo || platform.logo_path };
  });

  return (
    <div className="dashboard-shell min-h-screen text-neutral-100 flex flex-col selection:bg-sky-700 selection:text-white">
      <TopNavigation
        libraryView={libraryView}
        discoveryMode={discoveryMode}
        friendsActive={currentView === 'friends' || currentView === 'activity'}
        watchTogetherActive={currentView === 'watch-together'}
        profileActive={currentView === 'profile'}
        displayName={displayName}
        watchlistCount={library.watchlist.length}
        selectedPlatforms={selectedPlatforms}
        minimumImdbRating={minimumImdbRating}
        platforms={navigationPlatforms}
        onResetToHome={handleResetToHome}
        onNavigate={(view) => {
          setCurrentView('dashboard');
          setLibraryView(view);
          setSelectedPerson(null);
          setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
          setPreviousLibraryView(view);
          setSpotlightMovieId(null);
          setSelectedSpotlightMovie(null);
          setSearchQuery('');
        }}
        onSelectDiscoveryMode={(mode) => {
          setCurrentView('dashboard');
          setLibraryView('discover');
          setPreviousLibraryView('discover');
          setDiscoveryMode(mode);
          setSelectedPerson(null);
          setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
          setSpotlightMovieId(null);
          setSelectedSpotlightMovie(null);
          setSearchQuery('');
        }}
        onOpenFriends={() => navigateToView('friends')}
        onOpenWatchTogether={() => navigateToView('watch-together')}
        onOpenProfile={() => navigateToView('profile')}
        onLogout={handleSignOut}
        onTogglePlatform={togglePlatform}
        onMinimumImdbRatingChange={(rating) => setMinimumImdbRating(rating)}
      >
        <DashboardHeader
          currentView={currentView}
          libraryView={libraryView}
          searchQuery={searchQuery}
          setSearchQuery={handleSearchQueryChange}
          selectedPerson={selectedPerson}
          setSelectedPerson={setSelectedPerson}
          setSpotlightMovieId={setSpotlightMovieId}
          setVisibleMovieLimit={setVisibleMovieLimit}
          personSearchFocused={false}
          setPersonSearchFocused={() => {}}
          loading={loading}
          movieMatches={[]}
          peopleLoading={false}
          personMatches={[]}
          selectPerson={selectPerson}
          clearSearch={clearSearch}
          goBackToPreviousView={goBackToPreviousView}
          setDiscoveryMode={setDiscoveryMode}
          setFeaturedIndex={() => {}}
          targetCount={TARGET_DISCOVERY_COUNT}
        />
      </TopNavigation>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="dashboard-content flex-1 p-4 md:p-8 space-y-6 overflow-y-auto">
          {currentView === 'profile' ? (
            <ProfileView
              displayName={displayName}
              setDisplayName={setDisplayName}
              accountEmail={accountEmail}
              selectedPlatforms={selectedPlatforms}
              togglePlatform={togglePlatform}
              platforms={FIVE_PLATFORMS}
              libraryWatched={library.watched}
              movieRatings={movieRatings}
              ratingsByMovieId={ratingsByMovieId}
              authLoading={authLoading}
              authError={authError}
              authNotice={authNotice}
              saveProfile={saveProfile}
              goBackToPreviousView={goBackToPreviousView}
              onOpenFriends={() => navigateToView('friends')}
              onOpenWatched={() => {
                setCurrentView('dashboard'); setLibraryView('watched'); setPreviousLibraryView('watched');
                setSearchQuery(''); setSelectedPerson(null); setSpotlightMovieId(null); setSelectedSpotlightMovie(null);
                setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
              }}
              onOpenFavoritesOnboarding={() => { setRegisterStep(3); setCurrentView('register'); }}
              onSelectMovieSpotlight={(id) => {
                const movie = library.watched.find((item) => item.id === id);
                setCurrentView('dashboard'); setLibraryView('watched'); setPreviousLibraryView('watched');
                setSearchQuery(''); setSelectedPerson(null);
                if (movie) selectSpotlightMovie(movie);
              }}
              tasteCount={profileTasteMovies.size}
              profileTopGenres={profileTopGenres}
              dislikedGenres={dislikedGenres}
              toggleDislikedGenre={(genre) => setDislikedGenres((genres) => genres.includes(genre) ? genres.filter((item) => item !== genre) : [...genres, genre])}
              genreOptions={genreOptions}
              favoriteDirectors={favoriteDirectors}
              removeFavoriteDirector={(name) => setFavoriteDirectors((names) => names.filter((item) => item !== name))}
              favoriteCast={favoriteCast}
              removeFavoriteCast={(name) => setFavoriteCast((names) => names.filter((item) => item !== name))}
              favoritePersonQuery={favoritePersonQuery}
              setFavoritePersonQuery={updateFavoritePersonQuery}
              favoritePersonMatches={favoritePersonMatches}
              favoritePersonLoading={favoritePersonLoading}
              addFavoritePerson={addFavoritePerson}
              profileHeaderPosters={profileHeaderPosters}
              profileFriendCount={friendsList.length}
            />
          ) : currentView === 'watch-together' ? (
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
              {authError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
              {movieLoadError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{movieLoadError}</p>}

              {selectedPerson && (
                <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:flex-row sm:items-center">
                  {selectedPerson.profile_path ? (
                    <div className="h-32 w-28 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:h-40 sm:w-32">
                      <img src={`https://image.tmdb.org/t/p/w342${selectedPerson.profile_path}`} alt={selectedPerson.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-32 w-28 shrink-0 items-center justify-center rounded-xl bg-white/5 text-4xl text-neutral-500 sm:h-40 sm:w-32">
                      {selectedPerson.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                      {selectedPerson.known_for_department === 'Directing' ? 'Regisseur' : 'Acteur / actrice'}
                    </p>
                    <h2 className="text-2xl font-black text-white sm:text-3xl">{selectedPerson.name}</h2>
                    <div className="flex flex-wrap gap-x-3 text-sm text-neutral-300">
                      {selectedPerson.birthday && (
                        <span>Geboren {new Date(`${selectedPerson.birthday}T00:00:00`).toLocaleDateString('nl-NL')} {calculateAge(selectedPerson.birthday) !== null && `· ${calculateAge(selectedPerson.birthday)} jaar`}</span>
                      )}
                      {selectedPerson.place_of_birth && <span>{selectedPerson.place_of_birth}</span>}
                    </div>
                    {selectedPerson.biography && <p className="max-w-4xl text-sm text-neutral-300">{selectedPerson.biography.slice(0, 420)}…</p>}
                  </div>
                </section>
              )}

              {loading ? (
                <div className="py-32 text-center text-xs text-neutral-400">Films inladen...</div>
              ) : visibleMovies.length === 0 ? (
                <div className="py-24 text-center space-y-2">
                  <p className="text-sm font-bold text-white">
                    {libraryView === 'watched' ? 'Je hebt nog geen films als gezien gemarkeerd' : libraryView === 'watchlist' ? 'Je watchlist is leeg' : 'Geen films gevonden'}
                  </p>
                </div>
              ) : (
                <>
                  {(selectedSpotlightMovie || (libraryView === 'discover' && discoveryMode === 'recommended' && !searchQuery.trim())) && (
                    <HeroSpotlight
                      movie={selectedSpotlightMovie}
                      allMovies={visibleMovies}
                      watchlistIds={library.watchlist.map((m) => m.id)}
                      watchedIds={library.watched.map((m) => m.id)}
                      matchPreferences={matchPreferences}
                      onToggleWatchlist={toggleWatchlist}
                      onToggleWatched={openMovieRating}
                      onSelectPerson={handleSelectPerson}
                      onSelectMovie={(movie) => {
                        selectSpotlightMovie(movie ?? null);
                      }}
                    />
                  )}

                  <div className="min-w-0 space-y-4">
                  {(libraryView === 'watchlist' || libraryView === 'watched' || libraryView === 'cinema') && (
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="flex items-baseline gap-2.5">
                        <h2 className="text-lg font-bold tracking-tight text-slate-100">
                          {libraryView === 'watchlist' ? 'Watchlist' : libraryView === 'watched' ? 'Gezien' : 'In de bioscoop'}
                        </h2>
                        <span className="text-xs text-slate-400">
                          {libraryView === 'watchlist' ? library.watchlist.length : libraryView === 'watched' ? library.watched.length : visibleMovies.length} films
                        </span>
                      </div>
                      <div className="flex max-w-full flex-wrap items-center gap-1" role="group" aria-label="Films sorteren">
                        <button type="button" onClick={() => setLibrarySort('default')} aria-pressed={librarySort === 'default'} className={`rounded-full px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${librarySort === 'default' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                          {libraryView === 'cinema' ? 'Populair' : 'Recent'}
                        </button>
                        <button type="button" onClick={() => setLibrarySort('rating')} aria-pressed={librarySort === 'rating'} className={`rounded-full px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${librarySort === 'rating' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                          Hoogste cijfer
                        </button>
                        <button type="button" onClick={() => setLibrarySort('match')} aria-pressed={librarySort === 'match'} className={`rounded-full px-3 py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${librarySort === 'match' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                          Beste match
                        </button>
                      </div>
                    </div>
                  )}

                  <MovieGrid
                    movies={gridMatches}
                    libraryView={libraryView}
                    discoveryMode={discoveryMode}
                    searchQuery={searchQuery}
                    recentlyWatchedMovies={library.watched.slice(0, 3)}
                    preferredGenres={preferredGenres}
                    selectedPlatforms={selectedPlatforms}
                    minimumImdbRating={minimumImdbRating}
                    releaseYearBefore={releaseYearBefore}
                    maxRuntimeMinutes={maxRuntimeMinutes}
                    matchPreferences={matchPreferences}
                    watchlistIds={library.watchlist.map((m) => m.id)}
                    watchedIds={library.watched.map((m) => m.id)}
                    hasMoreMovies={visibleMovies.length < filteredMovies.length}
                    loadingMore={loadingMore}
                    onLoadMore={async () => {
                      setLoadingMore(true);
                      setVisibleMovieLimit((c) => c + TARGET_DISCOVERY_COUNT);
                      setLoadingMore(false);
                    }}
                    onSelectMovie={selectSpotlightMovie}
                    ratings={ratingsByMovieId}
                    onEditRating={openMovieRating}
                    onToggleWatchlist={toggleWatchlist}
                    onToggleWatched={openMovieRating}
                    onSelectPerson={handleSelectPerson}
                  />
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>

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


