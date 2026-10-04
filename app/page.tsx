'use client';

import { startTransition, useState, useEffect, useMemo, type FormEvent } from 'react';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import FriendActivityPage from '../components/FriendActivityPage';
import HeroSpotlight from '../components/HeroSpotlight';
import AuthPage from '../components/AuthPage';
import MovieGrid from '../components/MovieGrid';
import MovieRatingDialog from '../components/MovieRatingDialog';
import Sidebar from '../components/Sidebar';
import StreamingLogo from '../components/StreamingLogo';
import type { DiscoveryMode, FriendActivityItem, LibraryView, Movie, MovieRating, StreamingPlatform, UserProfile } from '../components/types';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { calculateMatchScore, type MatchPreferences, type MovieTasteSignals, type RatedMovieTasteSignals } from '@/lib/recommendations/matchScore';

interface MovieApiResult extends Partial<Movie> {
  id: number;
  title: string;
  vote_average?: number;
}

interface PersonSearchResult {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
}

interface MovieTasteMetadata extends MovieTasteSignals {
  release_date: string;
  runtime_minutes: number | null;
}

type AppView = 'landing' | 'register' | 'login' | 'dashboard' | 'profile' | 'activity' | 'friends';

function mapMovieResults(list: MovieApiResult[], query: string, offset = 0): Movie[] {
  return list.map((movie, index) => {
    const itemIndex = offset + index;
    const genres = Array.isArray(movie.genres) ? movie.genres : [];

    return {
      ...movie,
      id: movie.id,
      title: movie.title,
      overview: movie.overview || '',
      poster_path: movie.poster_path || '',
      release_date: movie.release_date || '',
      runtime: movie.runtime || (movie.runtime_minutes ? `${movie.runtime_minutes}m` : undefined),
      genres,
      providers: Array.isArray(movie.providers) ? movie.providers : [],
      friend_recommendation:
        itemIndex === 0 && !query
          ? {
              friend_name: 'Thomas',
              friend_match: 92,
              quote: 'Dit is echt exact jouw smaak voor vanavond.',
              rating: 9.5,
              avatar: 'T',
            }
          : undefined,
    };
  });
}

const TARGET_DISCOVERY_COUNT = 25;

function matchesStreamingAvailability(movie: Movie, selectedPlatforms: string[]): boolean {
  const matchesPlatform = selectedPlatforms.length === 0 ||
    movie.providers?.some((provider) => selectedPlatforms.includes(provider.provider_name));
  return Boolean(matchesPlatform);
}

function matchesDiscoveryFilters(
  movie: Movie,
  selectedPlatforms: string[],
  minimumImdbRating: number,
  releaseYearBefore: number | null,
  maxRuntimeMinutes: number | null
): boolean {
  const year = Number.parseInt(movie.release_date?.slice(0, 4) || '', 10);
  const matchesPlatform = selectedPlatforms.length > 0 &&
    movie.providers?.some((provider) => selectedPlatforms.includes(provider.provider_name));
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
  { id: 278, title: 'The Shawshank Redemption', poster_path: '/9cqNxx0GxF0bflZmeSMl5tnGzr.jpg', year: '1994', genres: ['Drama', 'Misdaad'] },
  { id: 680, title: 'Pulp Fiction', poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', year: '1994', genres: ['Misdaad', 'Drama'] },
  { id: 98, title: 'Gladiator', poster_path: '/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg', year: '2000', genres: ['Actie', 'Avontuur', 'Drama'] },
  { id: 807, title: 'Se7en', poster_path: '/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg', year: '1995', genres: ['Misdaad', 'Mysterie', 'Thriller'] },
  { id: 122, title: 'The Lord of the Rings', poster_path: '/6oom5QYQ2yQTMJIbnvbkBL9cHo5.jpg', year: '2003', genres: ['Avontuur', 'Fantasy'] },
  { id: 597, title: 'Titanic', poster_path: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg', year: '1997', genres: ['Drama', 'Romantiek'] },
  { id: 603, title: 'The Matrix', poster_path: '/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg', year: '1999', genres: ['Sciencefiction', 'Actie'] },
  { id: 496243, title: 'Parasite', poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', year: '2019', genres: ['Misdaad', 'Drama', 'Thriller'] },
  { id: 244786, title: 'Whiplash', poster_path: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', year: '2014', genres: ['Drama', 'Muziek', 'Thriller'] },
  { id: 120467, title: 'The Grand Budapest Hotel', poster_path: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', year: '2014', genres: ['Komedie', 'Drama'] },
  { id: 354912, title: 'Coco', poster_path: '/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg', year: '2017', genres: ['Animatie', 'Avontuur', 'Familie', 'Muziek'] },
  { id: 324857, title: 'Spider-Man: Into the Spider-Verse', poster_path: '/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg', year: '2018', genres: ['Animatie', 'Actie', 'Avontuur', 'Sciencefiction'] },
  { id: 313369, title: 'La La Land', poster_path: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', year: '2016', genres: ['Komedie', 'Drama', 'Romantiek'] },
  { id: 11631, title: 'Mamma Mia!', poster_path: '/xYLiCWmAMHJubx5jNZ7HuXKjAbV.jpg', year: '2008', genres: ['Komedie', 'Romantiek', 'Muziek'] },
];

const FRIENDS_LIST: FriendActivityItem[] = [
  {
    id: 1,
    friendId: 1,
    name: 'Thomas',
    initial: 'T',
    avatarGradient: 'from-amber-500 to-orange-600',
    recentFilm: 'Dune: Part Two',
    movieId: 693134,
    poster_path: '/y4ml848KTz0zccQxfWlE8CMMC13.jpg',
    rating: 9.5,
    minutesAgo: 15,
  },
  {
    id: 2,
    friendId: 2,
    name: 'Marieke',
    initial: 'M',
    avatarGradient: 'from-purple-500 to-indigo-600',
    recentFilm: 'Prisoners',
    movieId: 146233,
    poster_path: '/uhviyknTT5cEQXbn6vWIqfM4vGm.jpg',
    rating: 9.0,
    minutesAgo: 120,
  },
  {
    id: 3,
    friendId: 3,
    name: 'Joris',
    initial: 'J',
    avatarGradient: 'from-emerald-500 to-teal-600',
    recentFilm: 'The Prestige',
    movieId: 1124,
    poster_path: '/Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg',
    rating: 8.5,
    minutesAgo: 24 * 60,
  },
  {
    id: 4,
    friendId: 4,
    name: 'Sanne',
    initial: 'S',
    avatarGradient: 'from-rose-500 to-pink-600',
    recentFilm: 'Arrival',
    movieId: 329865,
    poster_path: '/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg',
    rating: 9.0,
    minutesAgo: 2 * 24 * 60,
  },
  {
    id: 5,
    friendId: 1,
    name: 'Thomas',
    initial: 'T',
    avatarGradient: 'from-amber-500 to-orange-600',
    recentFilm: 'Interstellar',
    movieId: 157336,
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    rating: 9.5,
    minutesAgo: 24 * 60,
  },
  {
    id: 6,
    friendId: 1,
    name: 'Thomas',
    initial: 'T',
    avatarGradient: 'from-amber-500 to-orange-600',
    recentFilm: 'Inception',
    movieId: 27205,
    poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
    rating: 9.0,
    minutesAgo: 3 * 24 * 60,
  },
  {
    id: 7,
    friendId: 1,
    name: 'Thomas',
    initial: 'T',
    avatarGradient: 'from-amber-500 to-orange-600',
    recentFilm: 'The Prestige',
    movieId: 1124,
    poster_path: '/Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg',
    rating: 8.5,
    minutesAgo: 14 * 24 * 60,
  },
  {
    id: 8,
    friendId: 2,
    name: 'Marieke',
    initial: 'M',
    avatarGradient: 'from-purple-500 to-indigo-600',
    recentFilm: 'Arrival',
    movieId: 329865,
    poster_path: '/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg',
    rating: 9.0,
    minutesAgo: 2 * 24 * 60,
  },
  {
    id: 9,
    friendId: 2,
    name: 'Marieke',
    initial: 'M',
    avatarGradient: 'from-purple-500 to-indigo-600',
    recentFilm: 'Se7en',
    movieId: 807,
    poster_path: '/191nKfP0ehp3uIvWqgPbFmI4lv9.jpg',
    rating: 9.0,
    minutesAgo: 5 * 24 * 60,
  },
  {
    id: 10,
    friendId: 2,
    name: 'Marieke',
    initial: 'M',
    avatarGradient: 'from-purple-500 to-indigo-600',
    recentFilm: 'Parasite',
    movieId: 496243,
    poster_path: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    rating: 8.5,
    minutesAgo: 18 * 24 * 60,
  },
  {
    id: 11,
    friendId: 3,
    name: 'Joris',
    initial: 'J',
    avatarGradient: 'from-emerald-500 to-teal-600',
    recentFilm: 'The Dark Knight',
    movieId: 155,
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    rating: 9.5,
    minutesAgo: 3 * 24 * 60,
  },
  {
    id: 12,
    friendId: 3,
    name: 'Joris',
    initial: 'J',
    avatarGradient: 'from-emerald-500 to-teal-600',
    recentFilm: 'Oppenheimer',
    movieId: 872585,
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    rating: 8.5,
    minutesAgo: 6 * 24 * 60,
  },
  {
    id: 13,
    friendId: 3,
    name: 'Joris',
    initial: 'J',
    avatarGradient: 'from-emerald-500 to-teal-600',
    recentFilm: 'The Matrix',
    movieId: 603,
    poster_path: '/dXNAPwY7VrqMAo51EKhhCJfaGb5.jpg',
    rating: 9.0,
    minutesAgo: 25 * 24 * 60,
  },
  {
    id: 14,
    friendId: 4,
    name: 'Sanne',
    initial: 'S',
    avatarGradient: 'from-rose-500 to-pink-600',
    recentFilm: 'La La Land',
    movieId: 313369,
    poster_path: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg',
    rating: 9.5,
    minutesAgo: 5 * 24 * 60,
  },
  {
    id: 15,
    friendId: 4,
    name: 'Sanne',
    initial: 'S',
    avatarGradient: 'from-rose-500 to-pink-600',
    recentFilm: 'Coco',
    movieId: 354912,
    poster_path: '/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg',
    rating: 9.0,
    minutesAgo: 6 * 24 * 60,
  },
  {
    id: 16,
    friendId: 4,
    name: 'Sanne',
    initial: 'S',
    avatarGradient: 'from-rose-500 to-pink-600',
    recentFilm: 'Titanic',
    movieId: 597,
    poster_path: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg',
    rating: 9.0,
    minutesAgo: 30 * 24 * 60,
  },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [loginShowcaseIndex, setLoginShowcaseIndex] = useState(0);
  const [viewHistory, setViewHistory] = useState<AppView[]>([]);
  const navigateToView = (view: AppView) => {
    if (view !== currentView) setViewHistory((history) => [...history, currentView]);
    setCurrentView(view);
  };
  const goBackToPreviousView = () => {
    const previousView = viewHistory[viewHistory.length - 1] || 'dashboard';
    setViewHistory((history) => history.slice(0, -1));
    setCurrentView(previousView);
  };
  useEffect(() => {
    if (currentView !== 'login' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setLoginShowcaseIndex((current) => (current + 1) % Math.min(5, ONBOARDING_FAVORITES.length));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [currentView]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'register'>('dashboard');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [libraryView, setLibraryView] = useState<LibraryView>('discover');
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('recommended');
  const [library, setLibrary] = useState<{ watchlist: Movie[]; watched: Movie[] }>({ watchlist: [], watched: [] });
  const [libraryReady, setLibraryReady] = useState(false);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFillingTopMatches, setIsFillingTopMatches] = useState(false);
  const [movieLoadError, setMovieLoadError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleMovieLimit, setVisibleMovieLimit] = useState(TARGET_DISCOVERY_COUNT);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(FIVE_PLATFORMS.map((p) => p.name));
  const [minimumImdbRating, setMinimumImdbRating] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvedSearchQuery, setResolvedSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null);
  const [spotlightMovieId, setSpotlightMovieId] = useState<number | null>(null);
  const [personMatches, setPersonMatches] = useState<PersonSearchResult[]>([]);
  const [personSearchFocused, setPersonSearchFocused] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);

  const [chosenPlatforms, setChosenPlatforms] = useState<string[]>([]);
  const [selectedFavorites, setSelectedFavorites] = useState<number[]>([]);
  const [movieRatings, setMovieRatings] = useState<MovieRating[]>([]);
  const [ratingMovie, setRatingMovie] = useState<{ movie: Movie; alreadyWatched: boolean } | null>(null);
  const [draftMovieRating, setDraftMovieRating] = useState<number | null>(null);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [tasteMovieMetadata, setTasteMovieMetadata] = useState<Record<number, MovieTasteMetadata>>({});
  const [releaseYearBefore, setReleaseYearBefore] = useState<number | null>(null);
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState<number | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
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
  const canCreateAccount = Boolean(
    displayName.trim() && accountEmail.trim() && accountPassword.length >= 8 && passwordsMatch
  );
  const favoriteMovies = useMemo<MovieTasteSignals[]>(
    () => ONBOARDING_FAVORITES
      .filter((film) => selectedFavorites.includes(film.id))
      .map((film) => ({
        id: film.id,
        genres: tasteMovieMetadata[film.id]?.genres || film.genres,
        director: tasteMovieMetadata[film.id]?.director,
        cast: tasteMovieMetadata[film.id]?.cast,
      })),
    [selectedFavorites, tasteMovieMetadata]
  );
  const ratedMovies = useMemo<RatedMovieTasteSignals[]>(
    () => movieRatings.map((movieRating) => ({
      ...(tasteMovieMetadata[movieRating.movie_id] || { id: movieRating.movie_id, genres: [] }),
      rating: movieRating.rating,
    })),
    [movieRatings, tasteMovieMetadata]
  );
  const matchPreferences = useMemo<MatchPreferences>(
    () => ({ favoriteMovies, ratedMovies }),
    [favoriteMovies, ratedMovies]
  );
  const scoredMovies = useMemo(
    () => movies
      .map((movie) => ({
        ...movie,
        match_percentage: calculateMatchScore({ ...movie, genres: movie.genres || [] }, matchPreferences),
      }))
      .sort((first, second) => (second.match_percentage || 0) - (first.match_percentage || 0)),
    [movies, matchPreferences]
  );
  const ratingsByMovieId = useMemo(
    () => Object.fromEntries(movieRatings.map((movieRating) => [movieRating.movie_id, movieRating.rating])),
    [movieRatings]
  );
  const preferredGenres = useMemo(() => {
    const genreWeights = new Map<string, { name: string; weight: number }>();
    const ratedById = new Map(ratedMovies.map((movie) => [movie.id, movie.rating]));
    const favoriteIds = new Set(favoriteMovies.map((movie) => movie.id));
    const addGenres = (genres: readonly string[], weight: number) => {
      if (weight <= 0) return;
      Array.from(new Set(genres.map((genre) => genre.trim()).filter(Boolean))).forEach((name) => {
        const key = name.toLocaleLowerCase();
        const current = genreWeights.get(key);
        genreWeights.set(key, { name: current?.name || name, weight: (current?.weight || 0) + weight });
      });
    };
    const ratingWeight = (rating: number) => Math.max(0, (rating - 5.5) / 4.5);

    favoriteMovies.forEach((movie) => {
      const rating = ratedById.get(movie.id);
      addGenres(movie.genres, rating === undefined ? 1 : ratingWeight(rating));
    });
    ratedMovies.forEach((movie) => {
      if (!favoriteIds.has(movie.id)) addGenres(movie.genres, ratingWeight(movie.rating));
    });

    const rankedPreferences = Array.from(genreWeights.values())
      .sort((first, second) => second.weight - first.weight)
      .map((genre) => genre.name);
    const fallbackGenres = new Map<string, { name: string; count: number }>();
    scoredMovies.slice(0, TARGET_DISCOVERY_COUNT).forEach((movie) => {
      Array.from(new Set((movie.genres || []).map((genre) => genre.trim()).filter(Boolean))).forEach((name) => {
        const key = name.toLocaleLowerCase();
        const current = fallbackGenres.get(key);
        fallbackGenres.set(key, { name: current?.name || name, count: (current?.count || 0) + 1 });
      });
    });

    const genres = [...rankedPreferences];
    Array.from(fallbackGenres.values())
      .sort((first, second) => second.count - first.count)
      .forEach(({ name }) => {
        if (genres.length < 2 && !genres.some((genre) => genre.toLocaleLowerCase() === name.toLocaleLowerCase())) {
          genres.push(name);
        }
      });
    return genres.slice(0, 2);
  }, [favoriteMovies, ratedMovies, scoredMovies]);

  const loadAuthenticatedUser = async (user: User) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, streaming_services, favorite_movie_ids, preferred_genres, release_year_before, max_runtime_minutes, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setAuthError('Je bent ingelogd, maar je profiel kon niet worden geladen. Controleer of het Supabase-schema is toegepast.');
      return;
    }

    const profile = data as UserProfile | null;
    const name = profile?.display_name || String(user.user_metadata?.display_name || '');
    const services = profile?.streaming_services || [];
    const favorites = profile?.favorite_movie_ids?.map(Number) || [];
    const { data: ratingRows, error: ratingsError } = await supabase
      .from('movie_ratings')
      .select('movie_id, rating')
      .eq('user_id', user.id);

    if (ratingsError) {
      setAuthError('Beoordelingen zijn nog niet ingesteld. Voer de nieuwste supabase/schema.sql opnieuw uit.');
    }

    startTransition(() => {
      setAuthUserId(user.id);
      setAccountEmail(user.email || '');
      setDisplayName(name);
      setChosenPlatforms(services);
      setSelectedPlatforms(services);
      setSelectedFavorites(favorites);
      setMovieRatings((ratingRows || []).map((row) => ({ movie_id: Number(row.movie_id), rating: Number(row.rating) })));
      setReleaseYearBefore(profile?.release_year_before ?? null);
      setMaxRuntimeMinutes(profile?.max_runtime_minutes ?? null);
      setMinimumImdbRating(0);
      setLibraryView('discover');
      setActiveTab('dashboard');
      if (profile?.onboarding_completed) {
        setCurrentView('dashboard');
      } else {
        setRegisterStep(2);
        setCurrentView('register');
      }
    });
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthError('Supabase is nog niet geconfigureerd. Vul eerst de project-URL en publishable key in.');
      return;
    }
    if (!displayName.trim()) {
      setAuthError('Vul je gebruikersnaam in om je profiel aan te maken.');
      return;
    }
    if (accountPassword !== confirmPassword) {
      setAuthError('De wachtwoorden komen niet overeen.');
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: accountEmail.trim(),
      password: accountPassword,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setAuthLoading(false);
    setAccountPassword('');
    setConfirmPassword('');

    if (error) {
      setAuthError(error.message);
      return;
    }
    if (data.session && data.user) {
      await loadAuthenticatedUser(data.user);
      return;
    }

    setAuthNotice('Controleer je e-mail om je account te bevestigen. Daarna kun je verder met je filmvoorkeuren.');
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthError('Supabase is nog niet geconfigureerd. Vul eerst de project-URL en publishable key in.');
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setAuthLoading(false);
    setLoginPassword('');

    if (error) {
      setAuthError(error.message);
      return;
    }
    if (data.user) await loadAuthenticatedUser(data.user);
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(error.message);
        return;
      }
    }
    setAuthUserId(null);
    setAccountEmail('');
    setDisplayName('');
    setChosenPlatforms([]);
    setSelectedFavorites([]);
    setMovieRatings([]);
    setTasteMovieMetadata({});
    setReleaseYearBefore(null);
    setMaxRuntimeMinutes(null);
    setAuthError('');
    setAuthNotice('');
    setCurrentView('login');
  };

  const saveProfile = async () => {
    if (!authUserId) {
      setAuthError('Log opnieuw in om je profiel op te slaan.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setAuthError('Supabase is nog niet geconfigureerd.');
      return;
    }
    if (!displayName.trim()) {
      setAuthError('Vul je gebruikersnaam in om je profiel op te slaan.');
      return;
    }

    setAuthError('');
    setAuthNotice('');
    setAuthLoading(true);
    const preferredGenres = Array.from(new Set(
      ONBOARDING_FAVORITES
        .filter((film) => selectedFavorites.includes(film.id))
        .flatMap((film) => film.genres)
    ));
    const { error } = await supabase.from('profiles').upsert({
      id: authUserId,
      display_name: displayName.trim(),
      streaming_services: selectedPlatforms,
      favorite_movie_ids: selectedFavorites,
      preferred_genres: preferredGenres,
      release_year_before: releaseYearBefore,
      max_runtime_minutes: maxRuntimeMinutes,
      onboarding_completed: true,
    });
    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setChosenPlatforms(selectedPlatforms);
    setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
    setAuthNotice('Je profiel is opgeslagen.');
  };

  const completeOnboarding = async () => {
    if (!authUserId) {
      setAuthError('Log eerst in om je voorkeuren aan je account te koppelen.');
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setAuthError('');
    setAuthLoading(true);
    const preferredGenres = Array.from(new Set(
      ONBOARDING_FAVORITES
        .filter((film) => selectedFavorites.includes(film.id))
        .flatMap((film) => film.genres)
    ));
    const { error } = await supabase.from('profiles').upsert({
      id: authUserId,
      display_name: displayName.trim(),
      streaming_services: chosenPlatforms,
      favorite_movie_ids: selectedFavorites,
      preferred_genres: preferredGenres,
      release_year_before: releaseYearBefore,
      max_runtime_minutes: maxRuntimeMinutes,
      onboarding_completed: true,
    });
    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setSelectedPlatforms(chosenPlatforms);
    setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
    setActiveTab('dashboard');
    setRegisterStep(5);
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let isActive = true;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!isActive) return;
      if (error) {
        if (error.name !== 'AuthSessionMissingError') setAuthError(error.message);
        return;
      }
      if (data.user) await loadAuthenticatedUser(data.user);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const authResult = new URLSearchParams(window.location.search).get('auth');
    if (authResult === 'confirmed') {
      setAuthNotice('Je e-mailadres is bevestigd. Je account is klaar.');
    } else if (authResult === 'confirmation-failed') {
      setAuthError('Je e-mailadres kon niet worden bevestigd. Probeer de bevestigingslink opnieuw.');
      setCurrentView('login');
    } else if (authResult === 'not-configured') {
      setAuthError('Supabase is nog niet geconfigureerd.');
      setCurrentView('register');
    }

    if (authResult) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  useEffect(() => {
    try {
      const storedLibrary = localStorage.getItem('filmmatch-library');
      if (storedLibrary) {
        const parsed = JSON.parse(storedLibrary);
        const validMovies = (value: unknown): Movie[] =>
          Array.isArray(value)
            ? value.filter((movie) => movie && typeof movie.id === 'number' && typeof movie.title === 'string')
            : [];

        startTransition(() => {
          setLibrary({
            watchlist: validMovies(parsed.watchlist),
            watched: validMovies(parsed.watched),
          });
        });
      }
    } catch {
      startTransition(() => setLibrary({ watchlist: [], watched: [] }));
    } finally {
      startTransition(() => setLibraryReady(true));
    }
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    try {
      localStorage.setItem('filmmatch-library', JSON.stringify(library));
    } catch {
      // Keep the dashboard usable if browser storage is unavailable.
    }
  }, [library, libraryReady]);

  useEffect(() => {
    const movieIds = Array.from(new Set([
      ...selectedFavorites,
      ...movieRatings.map((movieRating) => movieRating.movie_id),
    ]));
    const missingIds = movieIds.filter((movieId) => !tasteMovieMetadata[movieId]);
    if (missingIds.length === 0) return;

    let isActive = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/movies?metadataIds=${missingIds.join(',')}`);
        if (!response.ok) return;
        const data = await response.json();
        const metadata = Array.isArray(data.movies)
          ? Object.fromEntries(data.movies.map((movie: MovieTasteMetadata) => [movie.id, movie]))
          : {};
        if (isActive) setTasteMovieMetadata((current) => ({ ...current, ...metadata }));
      } catch {
        // Keep genre-only matching if TMDB metadata is unavailable.
      }
    }, 120);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [selectedFavorites, movieRatings, tasteMovieMetadata]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (
      libraryView !== 'discover' ||
      selectedPerson ||
      query.length < 2 ||
      resolvedSearchQuery !== query
    ) {
      setPersonMatches([]);
      setPeopleLoading(false);
      return;
    }

    let isActive = true;
    setPeopleLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/movies?people=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (isActive) setPersonMatches(Array.isArray(data.people) ? data.people : []);
      } catch {
        if (isActive) setPersonMatches([]);
      } finally {
        if (isActive) setPeopleLoading(false);
      }
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, libraryView, selectedPerson, resolvedSearchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    setResolvedSearchQuery('');
    if (libraryView !== 'discover') {
      setIsFillingTopMatches(false);
      return;
    }

    let isActive = true;
    const shouldPrefill = !query && !selectedPerson;
    setIsFillingTopMatches(shouldPrefill);
    setLoading(true);
    const timer = setTimeout(async () => {
      const candidateMovies: Movie[] = [];
      let page = 1;
      let totalPageCount = 1;
      setMovieLoadError('');
      try {
        while (shouldPrefill || page === 1) {
          const endpoint = selectedPerson
            ? `/api/movies?personId=${selectedPerson.id}&page=${page}`
            : query
              ? `/api/movies?query=${encodeURIComponent(query)}&page=${page}`
              : `/api/movies?page=${page}&providers=${encodeURIComponent(selectedPlatforms.join(','))}`;
          const response = await fetch(endpoint);
          const data = await response.json();
          if (!response.ok) {
            if (isActive) {
              setMovies([]);
              setMovieLoadError(data.error || 'Films konden niet worden geladen.');
            }
            break;
          }
          if (!isActive) return;

          const list: MovieApiResult[] = Array.isArray(data.movies) ? data.movies : [];
          const mapped = mapMovieResults(list, selectedPerson?.name || query, candidateMovies.length);
          const existingIds = new Set(candidateMovies.map((movie) => movie.id));
          candidateMovies.push(...mapped.filter((movie) => !existingIds.has(movie.id)));
          totalPageCount = Number(data.totalPages) || 1;
          setMovies([...candidateMovies]);
          setCurrentPage(Number(data.page) || page);
          setTotalPages(totalPageCount);

          const eligibleCount = candidateMovies.length;
          if (!shouldPrefill || eligibleCount >= TARGET_DISCOVERY_COUNT || page >= totalPageCount) break;
          page += 1;
        }
      } catch (e) {
        if (isActive) {
          console.error(e);
          setMovieLoadError('Films konden niet worden geladen.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
          setIsFillingTopMatches(false);
          setResolvedSearchQuery(query);
        }
      }
    }, 280);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [searchQuery, libraryView, selectedPerson, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes]);

  const loadMoreMovies = async () => {
    setVisibleMovieLimit((current) => current + TARGET_DISCOVERY_COUNT);
    if (loadingMore || currentPage >= totalPages) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const query = searchQuery.trim();
      const endpoint = selectedPerson
        ? `/api/movies?personId=${selectedPerson.id}&page=${nextPage}`
        : query
          ? `/api/movies?query=${encodeURIComponent(query)}&page=${nextPage}`
          : `/api/movies?page=${nextPage}&providers=${encodeURIComponent(selectedPlatforms.join(','))}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      const list: MovieApiResult[] = Array.isArray(data.movies) ? data.movies : [];
      const additionalMovies = mapMovieResults(
        list,
        selectedPerson?.name || query,
        movies.length
      );
      const existingIds = new Set(movies.map((movie) => movie.id));

      setMovies((previous) => [
        ...previous,
        ...additionalMovies.filter((movie) => !existingIds.has(movie.id)),
      ]);
      setCurrentPage(Number(data.page) || nextPage);
      setTotalPages(Number(data.totalPages) || totalPages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const togglePlatform = (name: string) => {
    setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
    setSelectedPlatforms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const toggleRegisterPlatform = (name: string) => {
    setChosenPlatforms((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const toggleFavorite = (id: number) => {
    setSelectedFavorites((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleWatchlist = (movie: Movie) => {
    setLibrary((previous) => {
      if (previous.watchlist.some((savedMovie) => savedMovie.id === movie.id)) {
        return { ...previous, watchlist: previous.watchlist.filter((savedMovie) => savedMovie.id !== movie.id) };
      }

      return {
        watchlist: [movie, ...previous.watchlist],
        watched: previous.watched.filter((watchedMovie) => watchedMovie.id !== movie.id),
      };
    });
  };

  const openMovieRating = (movie: Movie) => {
    const alreadyWatched = library.watched.some((watchedMovie) => watchedMovie.id === movie.id);
    setRatingMovie({ movie, alreadyWatched });
    setDraftMovieRating(ratingsByMovieId[movie.id] ?? null);
    setRatingError('');
  };

  const removeWatched = (movie: Movie) => {
    setLibrary((previous) => {
      return { ...previous, watched: previous.watched.filter((watchedMovie) => watchedMovie.id !== movie.id) };
    });
  };

  const saveMovieRating = async (movie: Movie, rating: number): Promise<string | null> => {
    if (!authUserId) {
      return 'Log in om je filmbeoordelingen op te slaan.';
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return 'Supabase is nog niet geconfigureerd.';
    }

    const result = await supabase.from('movie_ratings').upsert(
      { user_id: authUserId, movie_id: movie.id, rating },
      { onConflict: 'user_id,movie_id' }
    );

    if (result.error) {
      return result.error.message;
    }

    setMovieRatings((current) => [
      ...current.filter((movieRating) => movieRating.movie_id !== movie.id),
      { movie_id: movie.id, rating },
    ]);
    return null;
  };

  const confirmMovieRating = async () => {
    if (!ratingMovie || draftMovieRating === null || ratingSaving) return;
    setRatingSaving(true);
    setRatingError('');
    try {
      const error = await saveMovieRating(ratingMovie.movie, draftMovieRating);
      if (error) {
        setRatingError(error);
        return;
      }

      if (!ratingMovie.alreadyWatched) {
        setLibrary((previous) => ({
          watchlist: previous.watchlist.filter((savedMovie) => savedMovie.id !== ratingMovie.movie.id),
          watched: [ratingMovie.movie, ...previous.watched],
        }));
      }
      setRatingMovie(null);
    } catch {
      setRatingError('Je beoordeling kon niet worden opgeslagen. Probeer het opnieuw.');
    } finally {
      setRatingSaving(false);
    }
  };

  const selectSpotlightMovie = (movie: Movie) => {
    if (libraryView === 'discover') {
      setMovies((current) => current.some((candidate) => candidate.id === movie.id) ? current : [...current, movie]);
      setVisibleMovieLimit((current) => Math.max(current, movies.length + 1));
    }
    setSpotlightMovieId(movie.id);
    if (!movie.director && !movie.cast?.length) {
      void fetch(`/api/movies?metadataIds=${movie.id}`)
        .then(async (response) => response.ok ? response.json() : null)
        .then((data) => {
          const details = Array.isArray(data?.movies) ? data.movies[0] as Partial<Movie> | undefined : undefined;
          if (!details) return;
          setMovies((current) => current.map((candidate) => candidate.id === movie.id
            ? {
                ...candidate,
                ...details,
                runtime: details.runtime_minutes ? `${details.runtime_minutes}m` : candidate.runtime,
                providers: candidate.providers,
                rating: candidate.rating,
                rating_source: candidate.rating_source,
                match_percentage: candidate.match_percentage,
              }
            : candidate));
        })
        .catch(() => undefined);
    }
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 0);
  };

  const clearSearch = () => {
    setCurrentView('dashboard');
    setLibraryView('discover');
    setDiscoveryMode('recommended');
    setSearchQuery('');
    setResolvedSearchQuery('');
    setSelectedPerson(null);
    setPersonMatches([]);
    setPersonSearchFocused(false);
    setSpotlightMovieId(null);
    setFeaturedIndex(0);
    setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
    window.setTimeout(() => {
      document.querySelector('.dashboard-content')?.scrollTo({ top: 0, behavior: 'instant' });
    }, 0);
  };

  const selectPerson = (person: PersonSearchResult) => {
    setCurrentView('dashboard');
    setLibraryView('discover');
    setSelectedPerson(person);
    setSpotlightMovieId(null);
    setSearchQuery(person.name);
    setPersonMatches([]);
    setPersonSearchFocused(false);
    setDiscoveryMode('recommended');
    setFeaturedIndex(0);
  };

  const selectSpotlightPerson = async (name: string, department: 'Acting' | 'Directing') => {
    const normalizedName = name.trim().toLocaleLowerCase();
    let person = personMatches.find((candidate) =>
      candidate.known_for_department === department && candidate.name.trim().toLocaleLowerCase() === normalizedName
    );

    if (!person) {
      try {
        const response = await fetch(`/api/movies?people=${encodeURIComponent(name)}`);
        if (response.ok) {
          const data = await response.json();
          const people: PersonSearchResult[] = Array.isArray(data.people) ? data.people : [];
          person = people.find((candidate) =>
            candidate.known_for_department === department && candidate.name.trim().toLocaleLowerCase() === normalizedName
          ) || people.find((candidate) => candidate.name.trim().toLocaleLowerCase() === normalizedName);
        }
      } catch {
        person = undefined;
      }
    }

    if (person) {
      selectPerson(person);
      return;
    }

    setCurrentView('dashboard');
    setLibraryView('discover');
    setSelectedPerson(null);
    setSpotlightMovieId(null);
    setSearchQuery(name);
    setResolvedSearchQuery('');
    setPersonSearchFocused(true);
    setDiscoveryMode('recommended');
    setFeaturedIndex(0);
  };

  const filteredMovies = useMemo(() => {
    const watchedMovieIds = new Set(library.watched.map((movie) => movie.id));
    const catalog = libraryView === 'watchlist'
      ? library.watchlist
      : libraryView === 'watched'
        ? library.watched
        : scoredMovies;
    const orderedCatalog = libraryView === 'discover' && discoveryMode === 'new_releases'
      ? [...catalog].sort((first, second) => (second.release_date || '').localeCompare(first.release_date || ''))
      : catalog;
    const query = searchQuery.trim().toLowerCase();

    const eligibleMovies = orderedCatalog.filter((m) => {
      const matchQuery = selectedPerson || !query || `${m.title} ${m.overview}`.toLowerCase().includes(query);
      const matchesPreferences = libraryView !== 'discover' ||
        matchesDiscoveryFilters(m, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes);
      const isUnwatchedRecommendation = libraryView !== 'discover' || discoveryMode !== 'recommended' ||
        Boolean(query) || !watchedMovieIds.has(m.id);
      return matchesPreferences && matchQuery && isUnwatchedRecommendation;
    });

    if (libraryView === 'discover' && discoveryMode === 'recommended') {
      eligibleMovies.sort((first, second) => (second.match_percentage || 0) - (first.match_percentage || 0));

      if (!query && !selectedPerson && eligibleMovies.length < TARGET_DISCOVERY_COUNT) {
        const strictIds = new Set(eligibleMovies.map((movie) => movie.id));
        const fallbackMovies = orderedCatalog
          .filter((movie) => !strictIds.has(movie.id) && !watchedMovieIds.has(movie.id) && matchesStreamingAvailability(movie, selectedPlatforms))
          .sort((first, second) => (second.match_percentage || 0) - (first.match_percentage || 0));
        eligibleMovies.push(...fallbackMovies.slice(0, TARGET_DISCOVERY_COUNT - eligibleMovies.length));
      }
    }

    return eligibleMovies;
  }, [scoredMovies, library, libraryView, discoveryMode, selectedPlatforms, searchQuery, selectedPerson, releaseYearBefore, maxRuntimeMinutes, minimumImdbRating]);

  const shouldLimitRecommendations = libraryView === 'discover' && !searchQuery.trim() && !selectedPerson;
  const visibleMovies = shouldLimitRecommendations ? filteredMovies.slice(0, visibleMovieLimit) : filteredMovies;
  const spotlightMovie = visibleMovies.find((movie) => movie.id === spotlightMovieId);
  const defaultFeaturedMovies = libraryView === 'discover' ? visibleMovies.slice(0, searchQuery.trim() ? 1 : 5) : [];
  const featuredMovies = spotlightMovie
    ? [spotlightMovie, ...defaultFeaturedMovies.filter((movie) => movie.id !== spotlightMovie.id).slice(0, 4)]
    : defaultFeaturedMovies;
  const activeFeaturedIndex = spotlightMovie ? 0 : featuredMovies.length ? featuredIndex % featuredMovies.length : 0;
  const topMatch = spotlightMovie || featuredMovies[activeFeaturedIndex];
  const gridMatches = topMatch ? visibleMovies.filter((movie) => movie.id !== topMatch.id) : visibleMovies;
  useEffect(() => {
    if (!spotlightMovieId) return;
    const shouldResumeRotation = currentView === 'dashboard' && libraryView === 'discover' &&
      discoveryMode === 'recommended' && !searchQuery.trim() && !rotationPaused;
    const timer = window.setTimeout(() => {
      setSpotlightMovieId(null);
      if (shouldResumeRotation) setFeaturedIndex((current) => current + 1);
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [spotlightMovieId, currentView, libraryView, discoveryMode, searchQuery, rotationPaused]);

  useEffect(() => {
    const rotationLength = Math.min(filteredMovies.length, 5);
    if (
      currentView !== 'dashboard' ||
      libraryView !== 'discover' ||
      spotlightMovie ||
      discoveryMode !== 'recommended' ||
      searchQuery.trim() ||
      rotationLength < 2 ||
      rotationPaused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % rotationLength);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [currentView, libraryView, discoveryMode, filteredMovies.length, searchQuery, selectedPlatforms, rotationPaused, spotlightMovie]);

  // =========================================================================
  // VIEW 1: CINEMATISCHE LANDINGSPAGINA (EERSTE INDRUK)
  // =========================================================================
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-[#07080a] text-neutral-100 flex flex-col justify-between selection:bg-rose-600 selection:text-white relative overflow-hidden">
        
        {/* Achtergrond: Subtiel vignette-effect & filmlicht */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900/60 via-[#07080a] to-[#050608] pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-rose-600/[0.07] rounded-full blur-[160px] pointer-events-none" />

        {/* Bovenbalk */}
        <header className="relative z-20 px-6 md:px-14 py-6 flex items-center justify-between border-b border-white/[0.06] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-black text-sm tracking-tighter text-white shadow-lg shadow-rose-600/20">
              FM
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white">
                FILMMATCH<span className="text-rose-500">.NL</span>
              </span>
              <p className="text-[10px] text-neutral-400 tracking-wide uppercase font-semibold">Nederlandse streaminggids</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setCurrentView('dashboard');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'dashboard' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setActiveTab('register');
                  setRegisterStep(1);
                  setCurrentView('register');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'register' ? 'bg-rose-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                Registratie
              </button>
            </div>
            <button
              onClick={() => setCurrentView('login')}
              className="text-xs font-semibold text-neutral-300 hover:text-white px-4 py-2 rounded-lg transition"
            >
              Inloggen
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setRegisterStep(1);
                setCurrentView('register');
              }}
              className="text-xs font-bold px-5 py-2.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition shadow-lg"
            >
              Registreren
            </button>
          </div>
        </header>

        {/* Hero Sectie */}
        <main className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-14 py-12 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Linker pitch */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-neutral-300 text-xs font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Nooit meer doelloos scrollen op de bank
              </div>

              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.05]">
                De juiste film. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300">
                  Nu op jouw scherm.
                </span> <br />
                Meteen te kijken.
              </h1>

              <p className="text-sm md:text-base text-neutral-300 max-w-lg leading-relaxed font-normal">
                FilmMatch NL combineert jouw persoonlijke filmsmaak met betrouwbare scores van vrienden. Je ziet uitsluitend titels die nú inbegrepen zijn bij jouw Nederlandse streamingdiensten.
              </p>

              {/* 2 Hoofdkeuzes */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <button
                  onClick={() => {
                    setActiveTab('register');
                    setRegisterStep(1);
                    setCurrentView('register');
                  }}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xl shadow-rose-600/30 transition flex items-center justify-center gap-2"
                >
                  <span>Start gratis registratie</span>
                  <span>&rarr;</span>
                </button>

                <button
                  onClick={() => setCurrentView('login')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.08] font-semibold text-xs transition"
                >
                  Direct inloggen
                </button>
              </div>

              {/* Provider Row */}
              <div className="pt-4 border-t border-white/[0.06]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  Gekoppeld met het actuele aanbod van:
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                  {FIVE_PLATFORMS.map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-neutral-300"
                    >
                      <div className="relative w-4 h-4 rounded overflow-hidden">
                        <Image
                          src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                          alt={p.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <span className="font-medium text-[11px]">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rechter cinematische preview card (Geen nep-tv, maar echte filmartiestiek) */}
            <div className="lg:col-span-6 relative flex justify-center">
              <div className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-neutral-900 border border-white/[0.1] shadow-2xl">
                
                {/* Film still met dramatisch licht */}
                <div className="relative aspect-[16/10] w-full bg-neutral-950 overflow-hidden">
                  <Image
                    src="https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
                    alt="Interstellar"
                    fill
                    unoptimized
                    className="object-cover scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
                  
                  {/* Top badges */}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="bg-rose-600 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-md shadow">
                      98% Match
                    </span>
                    <span className="bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 font-semibold text-[11px] px-2.5 py-1 rounded-md">
                      Nu op Prime Video
                    </span>
                  </div>

                  <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-white/10 flex items-center gap-1.5">
                    <span className="bg-[#f5c518] text-black font-black text-[9px] px-1 rounded-sm">IMDb</span>
                    <span className="text-xs font-bold text-white">8.7</span>
                  </div>

                  {/* Titel & Kerngegevens */}
                  <div className="absolute bottom-4 inset-x-5">
                    <p className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-1">Uitgelichte Aanbeveling</p>
                    <h2 className="text-2xl font-black text-white">Interstellar</h2>
                    <p className="text-xs text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
                      Wanneer het voortbestaan van de mensheid op het spel staat, vertrekt een team astronauten op een adembenemende reis door een wormgat.
                    </p>
                  </div>
                </div>

                {/* Vrienden aanbeveling strip (Sociaal element) */}
                <div className="p-4 bg-neutral-950/90 border-t border-white/[0.06] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      T
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        Thomas <span className="text-[10px] text-neutral-400 font-normal">&bull; 92% smaakmatch</span>
                      </p>
                      <p className="text-[11px] text-neutral-300 italic truncate">
                        &ldquo;Dit is echt exact jouw smaak voor vanavond.&rdquo;
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRegisterStep(1);
                      setCurrentView('register');
                    }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs shrink-0 transition"
                  >
                    Kijk nu &rarr;
                  </button>
                </div>

              </div>
            </div>

          </div>
        </main>

        <footer className="relative z-10 px-6 py-5 border-t border-white/[0.06] text-center text-xs text-neutral-400">
          FilmMatch NL &bull; Alleen films die je daadwerkelijk kunt streamen in Nederland
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: REGISTRATIE FLOW (5 STAPPEN)
  // =========================================================================
  if (currentView === 'register') {
    const welcomeMovies = ONBOARDING_FAVORITES
      .filter((film) => selectedFavorites.includes(film.id))
      .slice(0, 5);

    return (
      <div className="min-h-screen bg-[#07080a] text-neutral-100 flex items-center justify-center p-4 relative">
        <div className="w-full max-w-xl bg-neutral-900/90 border border-white/[0.08] rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-500">Stap {registerStep} van 5</p>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {registerStep === 1 && 'Maak je account aan'}
                {registerStep === 2 && 'Jouw streamingdiensten'}
                {registerStep === 3 && 'Kies je favorieten'}
                {registerStep === 4 && 'Controleer je profiel'}
                {registerStep === 5 && 'Welkom bij FilmMatchNL'}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    registerStep >= s ? 'w-5 bg-rose-500' : 'w-2 bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto py-6">
            {authError && <p role="alert" className="mb-5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
            {authNotice && <p role="status" className="mb-5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{authNotice}</p>}

            {/* STAP 1 */}
            {registerStep === 1 && (
              <form onSubmit={handleSignUp} className="mx-auto max-w-md space-y-4 py-2">
                <p className="text-center text-xs leading-relaxed text-neutral-300">
                  Maak je account aan. Je voorkeuren en persoonlijke filmoverzicht worden aan dit account gekoppeld.
                </p>
                        <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                          Gebruikersnaam
                  <input
                            autoComplete="nickname"
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-rose-300/60"
                  />
                </label>
                <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                  E-mailadres
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={accountEmail}
                    onChange={(event) => setAccountEmail(event.target.value)}
                    placeholder="jij@voorbeeld.nl"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                  />
                </label>
                <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                  Wachtwoord
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                    placeholder="Minimaal 8 tekens"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                  />
                </label>
                <label className="block space-y-1.5 text-left text-xs font-semibold text-neutral-200">
                  Herhaal wachtwoord
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Herhaal je wachtwoord"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/60"
                  />
                </label>
                {confirmPassword && !passwordsMatch && (
                  <p role="status" className="text-xs text-rose-200">Wachtwoorden komen niet overeen.</p>
                )}
                <button
                  type="submit"
                  disabled={authLoading || !canCreateAccount}
                  className="w-full rounded-lg bg-rose-500 py-3 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60"
                >
                  {authLoading ? 'Account aanmaken…' : 'Account aanmaken'}
                </button>
                {!supabaseConfigured && (
                  <p className="text-center text-[10px] leading-relaxed text-amber-100/80">
                    Supabase-configuratie ontbreekt nog. Vul de project-URL en publishable key in om accounts te activeren.
                  </p>
                )}
              </form>
            )}

            {/* STAP 2 */}
            {registerStep === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-neutral-300 text-center">
                  Vink aan welke diensten je thuis hebt. We verbergen films die daarbuiten vallen.
                </p>

                <div className="space-y-2 pt-2">
                  {FIVE_PLATFORMS.map((p) => {
                    const active = chosenPlatforms.includes(p.name);
                    return (
                      <button
                        type="button"
                        key={p.name}
                        onClick={() => toggleRegisterPlatform(p.name)}
                        aria-pressed={active}
                        className={`w-full p-3 rounded-xl border transition flex items-center justify-between text-left ${
                          active
                            ? 'bg-rose-500/[0.08] border-rose-500/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <StreamingLogo name={p.name} logoPath={p.logo_path} mark={p.mark} color={p.color} className="h-7 w-7" />
                          <span className="font-semibold text-xs">{p.name}</span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                            active ? 'bg-rose-600 text-white' : 'border border-white/10'
                          }`}
                        >
                          {active && '✓'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STAP 3 */}
            {registerStep === 3 && (
              <div className="space-y-4">
                <p className="text-xs text-neutral-300 text-center">
                  Selecteer minimaal 5 titels die je goed vindt om je startprofiel op jouw smaak af te stemmen.
                </p>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-[46vh] overflow-y-auto pr-1">
                  {ONBOARDING_FAVORITES.map((film) => {
                    const isSelected = selectedFavorites.includes(film.id);
                    return (
                      <button
                        type="button"
                        key={film.id}
                        onClick={() => toggleFavorite(film.id)}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? 'Verwijder' : 'Kies'} ${film.title} als favoriet`}
                        className={`group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border transition select-none ${
                          isSelected
                            ? 'border-rose-500 ring-2 ring-rose-500/50 scale-[0.98]'
                            : 'border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <Image
                          src={`https://image.tmdb.org/t/p/w500${film.poster_path}`}
                          alt={film.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        <div className={`absolute inset-0 ${isSelected ? 'bg-rose-950/40' : 'bg-black/30'}`} />
                        <div className="absolute top-2 right-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-rose-600 text-white' : 'bg-black/60 text-white/50'}`}>
                            {isSelected ? '✓' : '+'}
                          </span>
                        </div>
                        <div className="absolute bottom-1 inset-x-1 text-center">
                          <p className="text-[10px] font-bold text-white truncate drop-shadow">{film.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-center text-xs font-semibold text-neutral-400">
                  Gekozen: <span className="text-white">{selectedFavorites.length}</span> van minimaal 5
                </p>
              </div>
            )}

            {/* STAP 4 */}
            {registerStep === 4 && (
              <div className="text-center space-y-5 max-w-md mx-auto py-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Je voorkeuren zijn gekozen</h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Je startprofiel bevat {chosenPlatforms.length} streamingdiensten en {selectedFavorites.length} favoriete films. Sla je profiel op om je dashboard klaar te zetten.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {Array.from(new Set(ONBOARDING_FAVORITES.filter((film) => selectedFavorites.includes(film.id)).flatMap((film) => film.genres))).slice(0, 5).map((genre) => (
                      <span key={genre} className="rounded-full border border-rose-200/20 bg-rose-300/10 px-3 py-1 text-[10px] font-semibold text-rose-100">{genre}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {registerStep === 5 && (
              <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-3 text-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-sm font-black text-white shadow-lg shadow-rose-600/20">
                    FM
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-white">FILMMATCH<span className="text-rose-500">.NL</span></p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Nederlandse streaminggids</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-rose-300">Welkom, {displayName.trim() || 'filmliefhebber'}</p>
                  <h3 className="mt-1 text-xl font-black text-white">Jouw dashboard staat klaar</h3>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                    Je voorkeuren zijn opgeslagen. Je persoonlijke filmtips zijn afgestemd op {chosenPlatforms.length} streamingdiensten.
                  </p>
                </div>
                <div className="grid w-full grid-cols-5 gap-2" aria-label="Jouw gekozen films">
                  {welcomeMovies.map((film) => (
                    <div key={film.id} className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-neutral-800">
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${film.poster_path}`}
                        alt={film.title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
            {registerStep > 1 && registerStep < 5 ? (
              <button
                onClick={() => setRegisterStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)}
                className="text-xs font-semibold text-neutral-400 hover:text-white"
              >
                &larr; Vorige
              </button>
            ) : registerStep === 1 ? (
              <button
                onClick={() => setCurrentView('login')}
                className="text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Annuleren
              </button>
            ) : null}

            {registerStep > 1 && registerStep < 4 ? (
              <button
                disabled={
                  (registerStep === 2 && chosenPlatforms.length === 0) ||
                  (registerStep === 3 && selectedFavorites.length < 5)
                }
                onClick={() => setRegisterStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5)}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition ${
                  (registerStep === 2 && chosenPlatforms.length === 0) ||
                  (registerStep === 3 && selectedFavorites.length < 5)
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-neutral-200'
                }`}
              >
                Verder &rarr;
              </button>
            ) : registerStep === 4 ? (
              <button
                disabled={authLoading}
                onClick={completeOnboarding}
                className="px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30 disabled:cursor-wait disabled:opacity-60"
              >
                {authLoading ? 'Profiel opslaan…' : 'Profiel opslaan'}
              </button>
            ) : registerStep === 5 ? (
              <button
                onClick={() => setCurrentView('dashboard')}
                className="px-6 py-2.5 rounded-lg bg-rose-600 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-500"
              >
                Naar mijn dashboard &rarr;
              </button>
            ) : null}
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: INLOGGEN
  // =========================================================================
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
        onTogglePlatform={toggleRegisterPlatform}
        onToggleFavorite={toggleFavorite}
        onPreviousStep={() => setRegisterStep((step) => (step - 1) as 1 | 2 | 3 | 4 | 5)}
        onNextStep={() => setRegisterStep((step) => (step + 1) as 1 | 2 | 3 | 4 | 5)}
        onCompleteOnboarding={completeOnboarding}
        onOpenDashboard={() => setCurrentView('dashboard')}
        onCancelRegistration={() => setCurrentView('login')}
        onOpenLogin={() => setCurrentView('login')}
        onOpenRegister={() => { setRegisterStep(1); setCurrentView('register'); }}
      />
    );
  }

  if (currentView === 'profile') {
    const profileAverageRating = movieRatings.length
      ? (movieRatings.reduce((total, movieRating) => total + movieRating.rating, 0) / movieRatings.length).toFixed(1)
      : '–';
    const profileFriendCount = new Set(FRIENDS_LIST.map((activity) => activity.friendId)).size;
    const profileFavoritePosters = ONBOARDING_FAVORITES.filter((film) => selectedFavorites.includes(film.id));
    const profileHeaderPosters = (
      profileFavoritePosters.length > 0
        ? profileFavoritePosters
        : library.watched.length > 0
          ? library.watched
          : scoredMovies
    ).slice(0, 4);
    const profileSeenHighlights = library.watched.slice(0, 4);
    const tasteGenresByMovie = new Map<number, string[]>();
    [...favoriteMovies, ...ratedMovies].forEach((movie) => {
      tasteGenresByMovie.set(movie.id, Array.from(new Set([
        ...(tasteGenresByMovie.get(movie.id) || []),
        ...(movie.genres || []),
      ])));
    });
    const profileGenreCounts = new Map<string, number>();
    tasteGenresByMovie.forEach((genres) => genres.forEach((genre) => {
      profileGenreCounts.set(genre, (profileGenreCounts.get(genre) || 0) + 1);
    }));
    const profileTopGenres = Array.from(profileGenreCounts.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 4);
    const profileRatingBands = [
      { label: '1–5,5', count: movieRatings.filter((item) => item.rating <= 5.5).length, color: 'bg-rose-300' },
      { label: '6–7,5', count: movieRatings.filter((item) => item.rating > 5.5 && item.rating < 8).length, color: 'bg-amber-300' },
      { label: '8–10', count: movieRatings.filter((item) => item.rating >= 8).length, color: 'bg-emerald-300' },
    ];
    const maxRatingBandCount = Math.max(1, ...profileRatingBands.map((band) => band.count));

    return (
      <div className="dashboard-shell min-h-screen text-neutral-100 flex selection:bg-rose-600 selection:text-white">
        <Sidebar
          libraryView={libraryView}
          discoveryMode={discoveryMode}
          friendsActive={false}
          profileActive
          displayName={displayName}
          watchlistCount={library.watchlist.length}
          selectedPlatforms={selectedPlatforms}
          minimumImdbRating={minimumImdbRating}
          platforms={FIVE_PLATFORMS}
          onNavigate={(view) => {
            setCurrentView('dashboard');
            setLibraryView(view);
            setSpotlightMovieId(null);
            setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
            if (view === 'discover') setDiscoveryMode('recommended');
            setSearchQuery('');
          }}
          onSelectDiscoveryMode={(mode) => {
            setCurrentView('dashboard');
            setLibraryView('discover');
            setDiscoveryMode(mode);
            setSpotlightMovieId(null);
            setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
            setSearchQuery('');
          }}
          onOpenFriends={() => navigateToView('friends')}
          onOpenProfile={() => navigateToView('profile')}
          onLogout={handleSignOut}
          onTogglePlatform={togglePlatform}
          onMinimumImdbRatingChange={(rating) => {
            setMinimumImdbRating(rating);
            setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="dashboard-header sticky top-0 z-20 flex min-h-16 items-center justify-end border-b border-white/[0.1] px-4 backdrop-blur-md md:px-8">
            <button
              onClick={goBackToPreviousView}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white"
            >
              &larr; Terug
            </button>
          </header>

          <main className="dashboard-content flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-6xl space-y-7 py-2 md:py-4">
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-b border-white/[0.12] pb-6 sm:flex sm:flex-wrap sm:gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-xl font-black text-slate-950">
                  {displayName.trim().slice(0, 1).toUpperCase() || '?'}
                </div>
                <div className="min-w-0 sm:flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Jouw account</p>
                  <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">{displayName || 'Profiel en voorkeuren'}</h1>
                  <p className="mt-1 truncate text-xs text-neutral-300">{accountEmail || 'FilmMatch-profiel'}</p>
                </div>
                {profileHeaderPosters.length > 0 && (
                  <div className="col-span-2 flex w-full items-end gap-1.5 overflow-hidden sm:order-none sm:w-auto" role="group" aria-label="Filmstrip op jouw profiel">
                    {profileHeaderPosters.map((film) => (
                      <div key={film.id} className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded border border-white/15 bg-neutral-900 sm:w-11">
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${film.poster_path}`}
                          alt={film.title}
                          fill
                          unoptimized
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="hidden items-center gap-1.5 sm:flex" role="group" aria-label="Jouw streamingdiensten">
                  {FIVE_PLATFORMS.filter((platform) => selectedPlatforms.includes(platform.name)).map((platform) => (
                    <StreamingLogo
                      key={platform.id}
                      name={platform.name}
                      logoPath={platform.logo_path}
                      mark={platform.mark}
                      color={platform.color}
                      className="h-8 w-8"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={authLoading}
                  className="col-span-2 w-full rounded-lg bg-rose-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  {authLoading ? 'Opslaan…' : 'Wijzigingen opslaan'}
                </button>
              </div>

              {authError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
              {authNotice && <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{authNotice}</p>}

              <section aria-label="Profiel in cijfers" className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/[0.12] p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-300/15 text-sm font-black text-emerald-200" aria-hidden="true">✓</span>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Films gezien</p>
                  </div>
                  <p className="mt-2 text-2xl font-black tabular-nums text-white">{library.watched.length}</p>
                  <p className="mt-1 text-[10px] text-neutral-400">In jouw lijst Gezien</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/[0.12] p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-300/15 text-sm text-amber-200" aria-hidden="true">★</span>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Gemiddeld cijfer</p>
                  </div>
                  <p className="mt-2 text-2xl font-black tabular-nums text-amber-200">{profileAverageRating}<span className="ml-1 text-xs font-medium text-neutral-400">/ 10</span></p>
                  <p className="mt-1 text-[10px] text-neutral-400">{movieRatings.length} beoordelingen</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToView('friends')}
                  className="rounded-lg border border-white/10 bg-black/[0.12] p-4 text-left transition hover:border-rose-200/30 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-300/15 text-sm text-rose-200" aria-hidden="true">👥</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Vrienden</span>
                  </span>
                  <span className="mt-2 block text-2xl font-black tabular-nums text-white">{profileFriendCount}</span>
                  <span className="mt-1 block text-[10px] text-neutral-400">Voorbeeldprofielen · bekijken <span aria-hidden="true">&rarr;</span></span>
                </button>
              </section>

              <section className="flex flex-col justify-between gap-5 border-y border-rose-200/15 bg-rose-300/[0.06] px-4 py-5 sm:flex-row sm:items-center sm:px-5">
                <div className="max-w-xl">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">Persoonlijke aanbevelingen</p>
                  <h2 className="mt-1 text-base font-bold text-white">Verfijn je FilmMatch</h2>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-300">Hoe meer films je beoordeelt en als favoriet kiest, hoe beter je aanbevelingen aansluiten op jouw smaak.</p>
                  <p className="mt-2 text-[10px] text-neutral-400">{selectedFavorites.length} favorieten · {movieRatings.length} beoordelingen</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterStep(3);
                      setCurrentView('register');
                    }}
                    className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-400"
                  >
                    Favorieten aanpassen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('dashboard');
                      setLibraryView('watched');
                      setSearchQuery('');
                    }}
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-100 transition hover:bg-white/10"
                  >
                    Films beoordelen
                  </button>
                </div>
              </section>

              <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <section className="border-t border-white/[0.12] pt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-white">Jouw filmsmaak</h2>
                      <p className="mt-1 text-[10px] text-neutral-400">Gebaseerd op favorieten en beoordelingen</p>
                    </div>
                    <span className="text-[10px] text-neutral-400">{tasteGenresByMovie.size} films</span>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Genres die bij je passen</h3>
                    {profileTopGenres.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profileTopGenres.map(([genre, count]) => (
                          <span key={genre} className="rounded-md border border-rose-200/15 bg-rose-200/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-rose-50">
                            {genre}<span className="ml-1.5 text-rose-200/70">{count}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-400">Kies favorieten of beoordeel films om je genres te ontdekken.</p>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Jouw cijferverdeling</h3>
                      <span className="text-[10px] text-neutral-400">{movieRatings.length} films</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {profileRatingBands.map((band) => (
                        <div key={band.label} className="grid grid-cols-[3.5rem_minmax(0,1fr)_1.5rem] items-center gap-3 text-[10px]">
                          <span className="tabular-nums text-neutral-300">{band.label}</span>
                          <div
                            role="meter"
                            aria-label={`${band.count} films met cijfer ${band.label}`}
                            aria-valuemin={0}
                            aria-valuemax={maxRatingBandCount}
                            aria-valuenow={band.count}
                            className="h-2 overflow-hidden rounded-full bg-white/[0.08]"
                          >
                            <div className={`h-full rounded-full ${band.color}`} style={{ width: `${(band.count / maxRatingBandCount) * 100}%` }} />
                          </div>
                          <span className="text-right tabular-nums text-neutral-300">{band.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

              </div>

              <section className="border-t border-white/[0.12] pt-5">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">Uit je kijkgeschiedenis</h2>
                    <p className="mt-1 text-[10px] text-neutral-400">Je meest recent geziene films</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('dashboard');
                      setLibraryView('watched');
                      setSearchQuery('');
                    }}
                    className="text-[10px] font-semibold text-rose-200 transition hover:text-white"
                  >
                    Bekijk alles <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
                {profileSeenHighlights.length > 0 ? (
                  <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
                    {profileSeenHighlights.map((movie) => {
                      const rating = ratingsByMovieId[movie.id];
                      return (
                        <button
                          key={movie.id}
                          type="button"
                          onClick={() => {
                            setCurrentView('dashboard');
                            setLibraryView('watched');
                            setSpotlightMovieId(movie.id);
                            setSearchQuery('');
                          }}
                          aria-label={`Bekijk ${movie.title} in je kijkgeschiedenis${rating === undefined ? '' : `, jouw cijfer ${rating.toFixed(1)}`}`}
                          className="group w-28 shrink-0 snap-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300 sm:w-32"
                        >
                          <span className="relative block aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
                            {movie.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                                alt={movie.title}
                                fill
                                unoptimized
                                sizes="128px"
                                className="object-cover transition duration-300 group-hover:scale-105"
                              />
                            ) : null}
                            {rating !== undefined && (
                              <span className="absolute bottom-2 left-2 rounded bg-amber-300 px-2 py-1 text-[10px] font-black tabular-nums text-neutral-950">
                                ★ {rating.toFixed(1)}
                              </span>
                            )}
                          </span>
                          <span className="mt-2 block truncate text-xs font-semibold text-white">{movie.title}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-neutral-400">{movie.release_date?.slice(0, 4) || 'Film'}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 py-5">
                    <p className="text-xs text-neutral-300">Je kijkgeschiedenis is nog leeg.</p>
                    <button
                      type="button"
                      onClick={() => setCurrentView('dashboard')}
                      className="text-xs font-semibold text-rose-200 transition hover:text-white"
                    >
                      Ontdek films <span aria-hidden="true">&rarr;</span>
                    </button>
                  </div>
                )}
              </section>

              <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <section className="border-t border-white/[0.12] pt-5">
                  <h2 className="text-sm font-bold text-white">Accountgegevens</h2>
                  <p className="mt-1 text-xs text-neutral-400">{accountEmail || 'Geen e-mailadres beschikbaar'}</p>
                  <label className="mt-5 block space-y-2 text-xs font-semibold text-neutral-200">
                    Gebruikersnaam
                    <input
                      autoComplete="name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none transition focus:border-rose-300/60"
                    />
                  </label>
                </section>

                <section className="border-t border-white/[0.12] pt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-bold text-white">Streamingdiensten</h2>
                    <span className="text-[10px] text-neutral-400">{selectedPlatforms.length} geselecteerd</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {FIVE_PLATFORMS.map((platform) => {
                      const active = selectedPlatforms.includes(platform.name);
                      return (
                        <button
                          key={platform.id}
                          type="button"
                          onClick={() => togglePlatform(platform.name)}
                          aria-pressed={active}
                          className={`flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${active ? 'border-emerald-300/35 bg-emerald-300/[0.08]' : 'border-white/[0.08] bg-black/[0.08] hover:border-white/20 hover:bg-white/[0.04]'}`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded" style={{ backgroundColor: platform.color }}>
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{platform.mark}</span>
                              <Image
                                src={`https://image.tmdb.org/t/p/original${platform.logo_path}`}
                                alt=""
                                fill
                                unoptimized
                                className="relative z-10 object-cover"
                              />
                            </span>
                            <span className="truncate text-xs font-medium text-neutral-100">{platform.name}</span>
                          </span>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${active ? 'border-emerald-300 bg-emerald-300 text-[#07110d]' : 'border-white/20 text-transparent'}`} aria-hidden="true">
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: HET VOLLEDIGE DASHBOARD (FILMS + VRIENDEN FEED)
  // =========================================================================
  const movieMatches = loading
    ? []
    : scoredMovies
        .filter((movie) =>
          movie.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
          matchesDiscoveryFilters(movie, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes)
        )
        .slice(0, 5);

  return (
    <div className="dashboard-shell min-h-screen text-neutral-100 flex selection:bg-rose-600 selection:text-white">
      
      {/* ================= 1. LINKER NAVIGATIE ================= */}
      <Sidebar
        libraryView={libraryView}
        discoveryMode={discoveryMode}
        friendsActive={currentView === 'friends'}
        profileActive={false}
        displayName={displayName}
        watchlistCount={library.watchlist.length}
        selectedPlatforms={selectedPlatforms}
        minimumImdbRating={minimumImdbRating}
        platforms={FIVE_PLATFORMS}
        onNavigate={(view) => {
          setCurrentView('dashboard');
          setLibraryView(view);
          setSpotlightMovieId(null);
          setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
          if (view === 'discover') setDiscoveryMode('recommended');
          setSearchQuery('');
        }}
        onSelectDiscoveryMode={(mode) => {
          setCurrentView('dashboard');
          setLibraryView('discover');
          setDiscoveryMode(mode);
          setSpotlightMovieId(null);
          setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
          setSearchQuery('');
        }}
        onOpenFriends={() => navigateToView('friends')}
        onOpenProfile={() => navigateToView('profile')}
        onLogout={handleSignOut}
        onTogglePlatform={togglePlatform}
        onMinimumImdbRatingChange={(rating) => {
          setMinimumImdbRating(rating);
          setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
        }}
      />

      {/* ================= 2. MIDDEN COMPONENT: DE FILM CATALOGUS ================= */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Zoekbalk & Platform Bar */}
        <header className="dashboard-header min-h-16 border-b border-white/[0.1] backdrop-blur-md px-4 md:px-8 flex items-center gap-3 sticky top-0 z-20">
          {currentView === 'activity' || currentView === 'friends' ? (
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={goBackToPreviousView}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/10"
              >
                &larr; Terug
              </button>
            </div>
          ) : (
          <div className="flex min-w-0 w-full max-w-2xl items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
              type="text"
              placeholder={libraryView === 'watchlist' ? 'Zoek in je watchlist...' : libraryView === 'watched' ? 'Zoek in films die je hebt gezien...' : 'Zoek film, acteur of regisseur...'}
              value={searchQuery}
              onChange={(event) => {
                setSelectedPerson(null);
                setSpotlightMovieId(null);
                setVisibleMovieLimit(TARGET_DISCOVERY_COUNT);
                setPersonSearchFocused(true);
                setSearchQuery(event.target.value);
              }}
              onFocus={() => setPersonSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setPersonSearchFocused(false), 120)}
              aria-autocomplete="list"
              aria-expanded={personSearchFocused && libraryView === 'discover' && !selectedPerson && searchQuery.trim().length >= 2}
              aria-controls="person-search-results"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-rose-500 transition"
              />
            {personSearchFocused && libraryView === 'discover' && !selectedPerson && searchQuery.trim().length >= 2 && (
              <div
                id="person-search-results"
                role="listbox"
                aria-label="Films, acteurs en regisseurs"
                className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 shadow-2xl"
              >
                {loading && <p role="status" className="px-4 py-3 text-xs text-neutral-300">Films zoeken…</p>}
                {!loading && movieMatches.length > 0 && (
                  <div role="group" aria-label="Films">
                    <p className="border-b border-white/[0.08] px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Films</p>
                    {movieMatches.map((movie) => (
                      <button
                        key={movie.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSelectedPerson(null);
                          setSpotlightMovieId(null);
                          setSearchQuery(movie.title);
                          setPersonSearchFocused(false);
                          setDiscoveryMode('recommended');
                          setFeaturedIndex(0);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/[0.08]"
                      >
                        <span className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-white/10">
                          {movie.poster_path && (
                            <Image
                              src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                              alt=""
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-white">{movie.title}</span>
                          <span className="block text-[10px] text-neutral-400">Film{movie.release_date ? ` · ${movie.release_date.slice(0, 4)}` : ''}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!loading && peopleLoading ? (
                  <p role="status" className="px-4 py-3 text-xs text-neutral-300">Acteurs en regisseurs zoeken…</p>
                ) : !loading && personMatches.length > 0 ? (
                  <div role="group" aria-label="Acteurs en regisseurs">
                    <p className="border-b border-white/[0.08] px-4 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Acteurs en regisseurs</p>
                    {personMatches.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectPerson(person)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.08]"
                      >
                        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs font-bold text-white">
                          {person.profile_path ? (
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                              alt=""
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : person.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-white">{person.name}</span>
                          <span className="block text-[10px] text-neutral-400">
                            {person.known_for_department === 'Directing' ? 'Regisseur' : 'Acteur'}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {!loading && !peopleLoading && movieMatches.length === 0 && personMatches.length === 0 && (
                  <p role="status" className="px-4 py-3 text-xs text-neutral-300">Geen films, acteurs of regisseurs gevonden.</p>
                )}
              </div>
              )}
            </div>
            {(searchQuery.trim() || selectedPerson) && (
              <button
                type="button"
                onClick={clearSearch}
                title="Wis zoektermen en toon aanbevolen films"
                aria-label="Wis zoektermen en toon aanbevolen films"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-lg leading-none text-neutral-300 transition hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
              >
                &times;
              </button>
            )}
          </div>
          )}

        </header>

        {/* Content Area */}
        <main className="dashboard-content flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">
          {currentView === 'activity' || currentView === 'friends' ? (
            <FriendActivityPage activities={FRIENDS_LIST} mode={currentView} />
          ) : (
          <>
          {authError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
          {movieLoadError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{movieLoadError}</p>}
          {libraryView === 'discover' && (
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-4">
              <div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-100/80">Jouw filmavond</p>
                  <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">
                    {selectedPerson
                      ? `${selectedPerson.known_for_department === 'Directing' ? 'Films van' : 'Films met'} ${selectedPerson.name}`
                      : searchQuery.trim() ? 'Zoekresultaten' : discoveryMode === 'new_releases' ? 'Nieuwe releases' : discoveryMode === 'popular' ? 'Populair in NL' : 'Aanbevolen voor jou'}
                  </h1>
                </div>
              </div>
            </div>
          )}

          {shouldLimitRecommendations && isFillingTopMatches && visibleMovies.length < TARGET_DISCOVERY_COUNT && (
            <p role="status" className="text-xs text-neutral-300">
              Beste matches zoeken: {visibleMovies.length} van {TARGET_DISCOVERY_COUNT} gevonden…
            </p>
          )}
          {shouldLimitRecommendations && !isFillingTopMatches && visibleMovies.length < TARGET_DISCOVERY_COUNT && (
            <p role="status" className="text-xs text-neutral-300">
              {visibleMovies.length} films voldoen aan je huidige diensten-, IMDb-, jaar- en duurfilters. Pas een filter aan als je meer resultaten wilt.
            </p>
          )}

          {loading && libraryView === 'discover' ? (
            <div className="py-32 text-center text-xs text-neutral-500">Filmaanbevelingen berekenen...</div>
          ) : visibleMovies.length === 0 ? (
            <div className="py-24 text-center space-y-2">
              <p className="text-sm font-bold text-white">
                {libraryView === 'watchlist' ? 'Je watchlist is nog leeg' : libraryView === 'watched' ? 'Nog geen films als gezien gemarkeerd' : 'Geen films gevonden'}
              </p>
              <p className="text-xs text-neutral-300">
                {libraryView === 'discover' ? 'Pas je zoekopdracht of dienstenfilter aan.' : 'Voeg films toe vanuit je aanbevelingen.'}
              </p>
              {libraryView !== 'discover' && (
                <button onClick={() => setLibraryView('discover')} className="mt-3 rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-400">
                  Bekijk aanbevelingen
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Uitgelichte #1 Match (Schoon en krachtig) */}
              {topMatch && (
                <HeroSpotlight
                  movie={topMatch}
                  featuredMovies={featuredMovies}
                  activeFeaturedIndex={activeFeaturedIndex}
                  rotationPaused={rotationPaused}
                  isSearch={Boolean(searchQuery.trim())}
                  spotlightLabel={
                    spotlightMovie
                      ? 'Gekozen film'
                      : libraryView === 'watchlist'
                        ? 'Watchlist'
                        : libraryView === 'watched'
                          ? 'Gezien'
                      : selectedPerson
                        ? `${selectedPerson.known_for_department === 'Directing' ? 'Film van' : 'Film met'} ${selectedPerson.name}`
                        : searchQuery.trim() ? 'Top zoekresultaat' : discoveryMode === 'new_releases' ? 'Nieuwe release' : discoveryMode === 'popular' ? 'Nu populair' : 'Aanbeveling van het moment'
                  }
                  isWatchlisted={library.watchlist.some((movie) => movie.id === topMatch.id)}
                  isWatched={library.watched.some((movie) => movie.id === topMatch.id)}
                  userRating={ratingsByMovieId[topMatch.id]}
                  onSelectPerson={(name, department) => { void selectSpotlightPerson(name, department); }}
                  onSelectFeatured={(index) => {
                    setSpotlightMovieId(null);
                    setFeaturedIndex(index);
                  }}
                  onToggleRotation={() => setRotationPaused((paused) => !paused)}
                  onEditRating={openMovieRating}
                  onToggleWatchlist={toggleWatchlist}
                  onToggleWatched={openMovieRating}
                />
              )}

              <MovieGrid
                movies={libraryView === 'discover' && !searchQuery.trim() ? visibleMovies : gridMatches}
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
                watchlistIds={library.watchlist.map((movie) => movie.id)}
                watchedIds={library.watched.map((movie) => movie.id)}
                hasMoreMovies={currentPage < totalPages || filteredMovies.length > visibleMovies.length}
                loadingMore={loadingMore}
                onLoadMore={loadMoreMovies}
                onSelectMovie={selectSpotlightMovie}
                ratings={ratingsByMovieId}
                onEditRating={openMovieRating}
                onToggleWatchlist={toggleWatchlist}
                onToggleWatched={openMovieRating}
              />
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
          error={ratingError}
          onRatingChange={setDraftMovieRating}
          onCancel={() => setRatingMovie(null)}
          onConfirm={confirmMovieRating}
          onRemoveWatched={() => {
            removeWatched(ratingMovie.movie);
            setRatingMovie(null);
          }}
        />
      )}

    </div>
  );
}