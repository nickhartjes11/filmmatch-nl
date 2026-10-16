'use client';

import { startTransition, useState, useEffect, useMemo, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import LandingView from '../components/LandingView';
import RegisterFlow from '../components/RegisterFlow';
import ProfileView from '../components/ProfileView';
import DashboardHeader from '../components/DashboardHeader';
import FriendActivityPage from '../components/FriendActivityPage';
import HeroSpotlight from '../components/HeroSpotlight';
import AuthPage from '../components/AuthPage';
import MovieGrid from '../components/MovieGrid';
import MovieRatingDialog from '../components/MovieRatingDialog';
import Sidebar from '../components/Sidebar';
import type { DiscoveryMode, FriendActivityItem, LibraryView, Movie, MovieRating, StreamingPlatform, UserProfile } from '../components/types';
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
}

interface MovieTasteMetadata extends MovieTasteSignals {
  release_date: string;
  runtime_minutes: number | null;
}

type AppView = 'landing' | 'register' | 'login' | 'dashboard' | 'profile' | 'activity' | 'friends';

function mapMovieResults(list: MovieApiResult[], query: string, offset = 0): Movie[] {
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
  maxRuntimeMinutes: number | null
): boolean {
  const year = Number.parseInt(movie.release_date?.slice(0, 4) || '', 10);
  const matchesPlatform = selectedPlatforms.length === 0 ||
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
  { id: 120467, title: 'The Grand Budapest Hotel', poster_path: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', year: '2014', genres: ['Komedie', 'Drama'] },
  { id: 354912, title: 'Coco', poster_path: '/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg', year: '2017', genres: ['Animatie', 'Avontuur', 'Familie', 'Muziek'] },
  { id: 324857, title: 'Spider-Man: Into the Spider-Verse', poster_path: '/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg', year: '2018', genres: ['Animatie', 'Actie', 'Avontuur', 'Sciencefiction'] },
  { id: 313369, title: 'La La Land', poster_path: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', year: '2016', genres: ['Komedie', 'Drama', 'Romantiek'] },
  { id: 11631, title: 'Mamma Mia!', poster_path: '/xYLiCWmAMHJubx5jNZ7HuXKjAbV.jpg', year: '2008', genres: ['Komedie', 'Romantiek', 'Muziek'] },
  { id: 419430, title: 'Get Out', poster_path: '/5Axrbsz7ps5RzYB7a1L8IxBSfsD.jpg', year: '2017', genres: ['Horror', 'Mysterie', 'Thriller'] },
  { id: 68718, title: 'Django Unchained', poster_path: '/7oWY8VDWW7thTzWh3OKYRkWUlD5.jpg', year: '2012', genres: ['Western', 'Drama'] },
  { id: 530915, title: '1917', poster_path: '/iZf0KyrE25z1sage4SYFLCCrMi9.jpg', year: '2019', genres: ['Oorlog', 'Drama', 'Historisch'] },
  { id: 515042, title: 'Free Solo', poster_path: '/v4QfYZMACODlWul9doN9RxE99ag.jpg', year: '2018', genres: ['Documentaire', 'Avontuur'] },
];

const GENRE_OPTIONS = [
  'Actie', 'Avontuur', 'Animatie', 'Komedie', 'Misdaad', 'Documentaire', 'Drama', 'Familie',
  'Fantasy', 'Historisch', 'Horror', 'Muziek', 'Mysterie', 'Romantiek', 'Sciencefiction',
  'Thriller', 'Oorlog', 'Western',
];

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleMovieLimit, setVisibleMovieLimit] = useState(TARGET_DISCOVERY_COUNT);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(FIVE_PLATFORMS.map((p) => p.name));
  const [minimumImdbRating, setMinimumImdbRating] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null);
  const [spotlightMovieId, setSpotlightMovieId] = useState<number | null>(null);
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
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [favoriteDirectors, setFavoriteDirectors] = useState<string[]>([]);
  const [favoriteCast, setFavoriteCast] = useState<string[]>([]);
  const [favoritePersonQuery, setFavoritePersonQuery] = useState('');
  const [favoritePersonMatches, setFavoritePersonMatches] = useState<PersonSearchResult[]>([]);
  const [favoritePersonLoading, setFavoritePersonLoading] = useState(false);
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
  const canCreateAccount = Boolean(
    displayName.trim() && accountEmail.trim() && accountPassword.length >= 8 && passwordsMatch
  );

  // Complete resetfunctie voor het FilmMatchNL logo linksboven
  const handleResetToHome = () => {
    setCurrentView('dashboard');
    setLibraryView('discover');
    setDiscoveryMode('recommended');
    setSearchQuery('');
    setSelectedPerson(null);
    setSpotlightMovieId(null);
    setFeaturedIndex(0);
    setMinimumImdbRating(0);
    setReleaseYearBefore(null);
    setMaxRuntimeMinutes(null);
    setSelectedPlatforms(FIVE_PLATFORMS.map((p) => p.name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    () => ({ favoriteMovies, ratedMovies, dislikedGenres, favoriteDirectors, favoriteCast }),
    [favoriteMovies, ratedMovies, dislikedGenres, favoriteDirectors, favoriteCast]
  );

  const toggleDislikedGenre = (genre: string) => {
    setDislikedGenres((current) => (
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre]
    ));
  };

  const addFavoritePerson = (person: PersonSearchResult) => {
    const setter = person.known_for_department === 'Directing' ? setFavoriteDirectors : setFavoriteCast;
    setter((current) => (
      current.some((name) => name.trim().toLocaleLowerCase() === person.name.trim().toLocaleLowerCase())
        ? current
        : [...current, person.name]
    ));
    setFavoritePersonQuery('');
    setFavoritePersonMatches([]);
  };

  const removeFavoriteDirector = (name: string) => {
    setFavoriteDirectors((current) => current.filter((item) => item !== name));
  };
  const removeFavoriteCast = (name: string) => {
    setFavoriteCast((current) => current.filter((item) => item !== name));
  };

  const scoredMovies = useMemo(
    () => movies
      .map((movie) => ({
        ...movie,
        match_percentage: calculateMatchScore(
          {
            id: movie.id,
            genres: movie.genres || [],
            director: movie.director,
            cast: movie.cast,
            rating: movie.rating,
          },
          matchPreferences
        ),
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

    return rankedPreferences.slice(0, 2);
  }, [favoriteMovies, ratedMovies]);

  const tasteGenresByMovie = useMemo(() => {
    const map = new Map<number, string[]>();
    [...favoriteMovies, ...ratedMovies].forEach((movie) => {
      map.set(movie.id, Array.from(new Set([
        ...(map.get(movie.id) || []),
        ...(movie.genres || []),
      ])));
    });
    return map;
  }, [favoriteMovies, ratedMovies]);

  const profileTopGenres = useMemo(() => {
    const counts = new Map<string, number>();
    tasteGenresByMovie.forEach((genres) => genres.forEach((genre) => {
      counts.set(genre, (counts.get(genre) || 0) + 1);
    }));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [tasteGenresByMovie]);

  const loadFriendsActivity = async (userId: string) => {
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      const { data: friendRows } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId);

      const friendIds = (friendRows || []).map((row) => row.friend_id);
      if (friendIds.length === 0) {
        setFriendsActivity([]);
        setFriendsList([]);
        return;
      }

      const [{ data: profiles }, { data: ratings }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', friendIds),
        supabase
          .from('movie_ratings')
          .select('user_id, movie_id, rating, created_at')
          .in('user_id', friendIds)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setFriendsList(profiles || []);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.display_name || 'Vriend']));
      const movieIds = Array.from(new Set((ratings || []).map((r) => r.movie_id)));
      let movieMap: Record<number, { title: string; poster_path: string }> = {};

      if (movieIds.length > 0) {
        const response = await fetch(`/api/movies?metadataIds=${movieIds.join(',')}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.movies)) {
            movieMap = Object.fromEntries(
              data.movies.map((m: Movie) => [m.id, { title: m.title, poster_path: m.poster_path || '' }])
            );
          }
        }
      }

      const activityItems: FriendActivityItem[] = (ratings || []).map((item, index) => {
        const friendName = profileMap.get(item.user_id) || 'Vriend';
        const movieInfo = movieMap[item.movie_id];
        const createdDate = item.created_at ? new Date(item.created_at) : new Date();
        const minutesAgo = Math.max(1, Math.round((Date.now() - createdDate.getTime()) / 60000));

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
          minutesAgo,
        };
      });

      setFriendsActivity(activityItems);
    } catch (e) {
      console.warn('Friends activity load error:', e);
    }
  };

  const loadAuthenticatedUser = async (user: User) => {
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const name = profile?.display_name || String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Gebruiker');
      const services = profile?.streaming_services || FIVE_PLATFORMS.map((p) => p.name);
      const favorites = profile?.favorite_movie_ids?.map(Number) || [];

      const { data: ratingRows } = await supabase
        .from('movie_ratings')
        .select('movie_id, rating')
        .eq('user_id', user.id);

      const [{ data: watchlistRows }, { data: watchedRows }] = await Promise.all([
        supabase.from('user_watchlist').select('movie_data').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_watched').select('movie_data').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      const userWatchlist = (watchlistRows || []).map((row) => row.movie_data as Movie).filter(Boolean);
      const userWatched = (watchedRows || []).map((row) => row.movie_data as Movie).filter(Boolean);

      startTransition(() => {
        setAuthUserId(user.id);
        setAccountEmail(user.email || '');
        setDisplayName(name);
        setChosenPlatforms(services);
        setSelectedPlatforms(services);
        setSelectedFavorites(favorites);
        setLibrary({
          watchlist: userWatchlist,
          watched: userWatched,
        });
        setMovieRatings((ratingRows || []).map((row) => ({ movie_id: Number(row.movie_id), rating: Number(row.rating) })));
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

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

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

    if (error) {
      setAuthError(error.message);
      return;
    }
    if (data.session && data.user) {
      await loadAuthenticatedUser(data.user);
      setCurrentView('dashboard');
      return;
    }

    setAuthNotice('Controleer je e-mail om je account te bevestigen.');
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }
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

  const completeOnboarding = async () => {
    await saveProfile();
    setCurrentView('dashboard');
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user) void loadAuthenticatedUser(data.user);
    });
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (libraryView !== 'discover') {
      return;
    }

    let isActive = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      const candidateMovies: Movie[] = [];
      setMovieLoadError('');

      try {
        const pagesToFetch = query || selectedPerson ? [1] : [1, 2];
        const requests = pagesToFetch.map(async (p) => {
          const params = new URLSearchParams({
            page: String(p),
            providers: selectedPlatforms.length > 0 ? selectedPlatforms.join(',') : FIVE_PLATFORMS.map((x) => x.name).join(','),
          });

          if (selectedPerson) {
            params.set('personId', String(selectedPerson.id));
          } else if (query) {
            params.set('query', query);
          } else if (preferredGenres.length > 0) {
            params.set('genre', preferredGenres[0]);
          }

          const res = await fetch(`/api/movies?${params.toString()}`);
          if (!res.ok) return null;
          return res.json();
        });

        const results = await Promise.all(requests);
        if (!isActive) return;

        results.forEach((data) => {
          if (!data) return;
          const list: MovieApiResult[] = Array.isArray(data.movies) ? data.movies : [];
          const mapped = mapMovieResults(list, selectedPerson?.name || query, candidateMovies.length);
          const existingIds = new Set(candidateMovies.map((m) => m.id));
          candidateMovies.push(...mapped.filter((m) => !existingIds.has(m.id)));
          if (data.totalPages) setTotalPages(Number(data.totalPages));
        });

        const scored = candidateMovies.map((movie) => ({
          ...movie,
          match_percentage: calculateMatchScore(
            {
              id: movie.id,
              genres: movie.genres || [],
              director: movie.director,
              cast: movie.cast,
              rating: movie.rating,
            },
            matchPreferences
          ),
        }));

        setMovies(scored);
      } catch (e) {
        if (isActive) {
          console.error(e);
          setMovieLoadError('Films konden niet worden geladen.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [searchQuery, libraryView, selectedPerson, selectedPlatforms, preferredGenres, matchPreferences]);

  const loadMoreMovies = async () => {
    setVisibleMovieLimit((current) => current + TARGET_DISCOVERY_COUNT);
  };

  const togglePlatform = (name: string) => {
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
    const alreadyWatched = library.watched.some((m) => m.id === movie.id);
    setRatingMovie({ movie, alreadyWatched });
    setDraftMovieRating(ratingsByMovieId[movie.id] ?? null);
  };

  const removeWatched = async (movie: Movie) => {
    setLibrary((prev) => ({
      ...prev,
      watched: prev.watched.filter((m) => m.id !== movie.id),
    }));

    if (spotlightMovieId === movie.id) {
      setSpotlightMovieId(null);
    }

    if (!authUserId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from('user_watched').delete().match({ user_id: authUserId, movie_id: movie.id });
  };

  const confirmMovieRating = async () => {
    if (!ratingMovie || draftMovieRating === null) return;
    setRatingSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (supabase && authUserId) {
        await supabase.from('movie_ratings').upsert(
          { user_id: authUserId, movie_id: ratingMovie.movie.id, rating: draftMovieRating },
          { onConflict: 'user_id,movie_id' }
        );
        await supabase.from('user_watched').upsert({
          user_id: authUserId,
          movie_id: ratingMovie.movie.id,
          movie_data: ratingMovie.movie,
          created_at: new Date().toISOString(),
        });
      }

      setMovieRatings((current) => [
        ...current.filter((r) => r.movie_id !== ratingMovie.movie.id),
        { movie_id: ratingMovie.movie.id, rating: draftMovieRating },
      ]);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedPerson(null);
    setSpotlightMovieId(null);
  };

  const selectPerson = (person: PersonSearchResult) => {
    setSelectedPerson(person);
    setSearchQuery(person.name);
  };

  const filteredMovies = useMemo(() => {
    const watchedIds = new Set(library.watched.map((m) => m.id));
    let catalog = libraryView === 'watchlist'
      ? [...library.watchlist]
      : libraryView === 'watched'
        ? [...library.watched]
        : scoredMovies;

    if (libraryView === 'watchlist' || libraryView === 'watched') {
      if (librarySort === 'rating') {
        catalog.sort((a, b) => {
          const ratingA = ratingsByMovieId[a.id] ?? Number.parseFloat(a.rating || '0');
          const ratingB = ratingsByMovieId[b.id] ?? Number.parseFloat(b.rating || '0');
          return ratingB - ratingA;
        });
      } else if (librarySort === 'match') {
        catalog.sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));
      }
    }

    return catalog.filter((m) => {
      const matchQuery = selectedPerson || !searchQuery.trim() || `${m.title} ${m.overview}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesFilters = libraryView !== 'discover' || matchesDiscoveryFilters(m, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes);
      const isUnwatched = libraryView !== 'discover' || !watchedIds.has(m.id);
      return matchQuery && matchesFilters && isUnwatched;
    });
  }, [scoredMovies, library, libraryView, searchQuery, selectedPerson, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes, librarySort, ratingsByMovieId]);

  const visibleMovies = filteredMovies.slice(0, visibleMovieLimit);

  const featuredCarrouselMovies = useMemo(() => {
    return visibleMovies.slice(0, 5);
  }, [visibleMovies]);

  useEffect(() => {
    if (libraryView !== 'discover' || spotlightMovieId !== null || searchQuery.trim() || rotationPaused) {
      return;
    }

    if (featuredCarrouselMovies.length <= 1) return;

    const timer = setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % featuredCarrouselMovies.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [libraryView, spotlightMovieId, searchQuery, rotationPaused, featuredCarrouselMovies.length]);

  const spotlightMovie = spotlightMovieId
    ? (library.watched.find((m) => m.id === spotlightMovieId) ||
       library.watchlist.find((m) => m.id === spotlightMovieId) ||
       movies.find((m) => m.id === spotlightMovieId))
    : null;

  const topMatch = spotlightMovie || (libraryView === 'discover' ? featuredCarrouselMovies[featuredIndex % Math.max(1, featuredCarrouselMovies.length)] || visibleMovies[0] : null);

  const gridMatches = libraryView === 'watched'
    ? visibleMovies
    : (topMatch ? visibleMovies.filter((m) => m.id !== topMatch.id) : visibleMovies);

  const bannerLabel = libraryView === 'watched'
    ? 'GEZIENE FILM'
    : libraryView === 'watchlist'
      ? 'IN JE WATCHLIST'
      : spotlightMovieId
        ? 'GEKOZEN FILM'
        : 'AANBEVELING VAN HET MOMENT';

  if (currentView === 'landing') {
    return (
      <LandingView
        platforms={FIVE_PLATFORMS}
        onOpenDashboard={() => setCurrentView('dashboard')}
        onOpenRegister={() => { setRegisterStep(1); setCurrentView('register'); }}
        onOpenLogin={() => setCurrentView('login')}
      />
    );
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
        toggleRegisterPlatform={toggleRegisterPlatform}
        onboardingFavorites={ONBOARDING_FAVORITES}
        selectedFavorites={selectedFavorites}
        toggleFavorite={toggleFavorite}
        onSignUp={handleSignUp}
        onCompleteOnboarding={completeOnboarding}
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

  const profileFriendCount = new Set(friendsActivity.map((activity) => activity.friendId)).size;
  const profileHeaderPosters = (
    library.watched.length > 0 ? library.watched : ONBOARDING_FAVORITES
  ).slice(0, 4) as Movie[];

  if (currentView === 'profile') {
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
          onResetToHome={handleResetToHome}
          onNavigate={(view) => {
            setCurrentView('dashboard');
            setLibraryView(view);
            setSpotlightMovieId(null);
            setSearchQuery('');
          }}
          onSelectDiscoveryMode={(mode) => {
            setCurrentView('dashboard');
            setLibraryView('discover');
            setDiscoveryMode(mode);
            setSpotlightMovieId(null);
            setSearchQuery('');
          }}
          onOpenFriends={() => navigateToView('friends')}
          onOpenProfile={() => navigateToView('profile')}
          onLogout={handleSignOut}
          onTogglePlatform={togglePlatform}
          onMinimumImdbRatingChange={(rating) => setMinimumImdbRating(rating)}
        />

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
            setCurrentView('dashboard');
            setLibraryView('watched');
            setSearchQuery('');
          }}
          onOpenFavoritesOnboarding={() => {
            setRegisterStep(3);
            setCurrentView('register');
          }}
          onSelectMovieSpotlight={(id) => {
            setCurrentView('dashboard');
            setLibraryView('watched');
            setSpotlightMovieId(id);
            setSearchQuery('');
          }}
          tasteCount={tasteGenresByMovie.size}
          profileTopGenres={profileTopGenres}
          dislikedGenres={dislikedGenres}
          toggleDislikedGenre={toggleDislikedGenre}
          genreOptions={GENRE_OPTIONS}
          favoriteDirectors={favoriteDirectors}
          removeFavoriteDirector={removeFavoriteDirector}
          favoriteCast={favoriteCast}
          removeFavoriteCast={removeFavoriteCast}
          favoritePersonQuery={favoritePersonQuery}
          setFavoritePersonQuery={setFavoritePersonQuery}
          favoritePersonMatches={favoritePersonMatches}
          favoritePersonLoading={favoritePersonLoading}
          addFavoritePerson={addFavoritePerson}
          profileHeaderPosters={profileHeaderPosters}
          profileFriendCount={profileFriendCount}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-shell min-h-screen text-neutral-100 flex selection:bg-rose-600 selection:text-white">
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
        onResetToHome={handleResetToHome}
        onNavigate={(view) => {
          setCurrentView('dashboard');
          setLibraryView(view);
          setSpotlightMovieId(null);
          setSearchQuery('');
        }}
        onSelectDiscoveryMode={(mode) => {
          setCurrentView('dashboard');
          setLibraryView('discover');
          setDiscoveryMode(mode);
          setSpotlightMovieId(null);
          setSearchQuery('');
        }}
        onOpenFriends={() => navigateToView('friends')}
        onOpenProfile={() => navigateToView('profile')}
        onLogout={handleSignOut}
        onTogglePlatform={togglePlatform}
        onMinimumImdbRatingChange={(rating) => setMinimumImdbRating(rating)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          currentView={currentView}
          libraryView={libraryView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
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
          setFeaturedIndex={setFeaturedIndex}
          targetCount={TARGET_DISCOVERY_COUNT}
        />

        <main className="dashboard-content flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">
          {currentView === 'activity' || currentView === 'friends' ? (
            <FriendActivityPage
              currentUserId={authUserId}
              currentUserName={displayName || 'Jij'}
              myStreamingServices={selectedPlatforms}
              allMovies={movies}
              myWatchedIds={library.watched.map((m) => m.id)}
              myWatchlistIds={library.watchlist.map((m) => m.id)}
              activities={friendsActivity}
              friends={friendsList}
              onFriendshipChanged={() => {
                if (authUserId) void loadFriendsActivity(authUserId);
              }}
              onSelectMovieSpotlight={(id) => {
                setCurrentView('dashboard');
                setLibraryView('discover');
                setSpotlightMovieId(id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onToggleWatchlist={toggleWatchlist}
            />
          ) : (
            <>
              {authError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{authError}</p>}
              {movieLoadError && <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{movieLoadError}</p>}

              {loading ? (
                <div className="py-32 text-center text-xs text-neutral-400">Films inladen...</div>
              ) : visibleMovies.length === 0 ? (
                <div className="py-24 text-center space-y-2">
                  <p className="text-sm font-bold text-white">
                    {libraryView === 'watched' ? 'Je hebt nog geen films als gezien gemarkeerd' : libraryView === 'watchlist' ? 'Je watchlist is leeg' : 'Geen films gevonden'}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {libraryView === 'discover' ? 'Controleer je dienstenfilters.' : 'Voeg films toe vanuit het aanbevolen overzicht.'}
                  </p>
                </div>
              ) : (
                <>
                  {topMatch && (
                    <HeroSpotlight
                      movie={topMatch}
                      featuredMovies={featuredCarrouselMovies}
                      activeFeaturedIndex={featuredIndex % Math.max(1, featuredCarrouselMovies.length)}
                      rotationPaused={rotationPaused}
                      isSearch={Boolean(searchQuery.trim())}
                      spotlightLabel={bannerLabel}
                      isWatchlisted={library.watchlist.some((m) => m.id === topMatch.id)}
                      isWatched={library.watched.some((m) => m.id === topMatch.id)}
                      userRating={ratingsByMovieId[topMatch.id]}
                      onSelectPerson={async (name: string, department: 'Acting' | 'Directing') => {
                        try {
                          const res = await fetch(`/api/movies?people=${encodeURIComponent(name)}`);
                          if (res.ok) {
                            const data = await res.json();
                            const match = data.people?.[0];
                            if (match) {
                              selectPerson(match);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              return;
                            }
                          }
                        } catch (err) {
                          console.error(err);
                        }
                        setSearchQuery(name);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onSelectFeatured={(idx) => {
                        setSpotlightMovieId(null);
                        setFeaturedIndex(idx);
                      }}
                      onToggleRotation={() => setRotationPaused((p) => !p)}
                      onEditRating={openMovieRating}
                      onToggleWatchlist={toggleWatchlist}
                      onToggleWatched={openMovieRating}
                    />
                  )}

                  {(libraryView === 'watchlist' || libraryView === 'watched') &&
                    (libraryView === 'watchlist' ? library.watchlist.length > 0 : library.watched.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 pt-2 border-b border-white/[0.08]">
                      <span className="text-xs font-semibold text-neutral-400">
                        {libraryView === 'watchlist'
                          ? `${library.watchlist.length} ${library.watchlist.length === 1 ? 'film' : 'films'} in je watchlist`
                          : `${library.watched.length} ${library.watched.length === 1 ? 'film' : 'films'} gezien`}
                      </span>
                      <div className="flex items-center gap-1.5 bg-neutral-900/90 p-1 rounded-xl border border-white/10 shadow-lg">
                        <button
                          type="button"
                          onClick={() => setLibrarySort('default')}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                            librarySort === 'default'
                              ? 'bg-white/15 text-white font-bold shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Recent toegevoegd
                        </button>
                        <button
                          type="button"
                          onClick={() => setLibrarySort('rating')}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition flex items-center gap-1.5 ${
                            librarySort === 'rating'
                              ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <span>★</span> Hoogste cijfer
                        </button>
                        <button
                          type="button"
                          onClick={() => setLibrarySort('match')}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition flex items-center gap-1.5 ${
                            librarySort === 'match'
                              ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          <span>⚡</span> Hoogste match
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
            void removeWatched(ratingMovie.movie);
            setRatingMovie(null);
          }}
        />
      )}
    </div>
  );
}