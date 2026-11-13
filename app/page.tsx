'use client';

import { startTransition, useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import LandingView from '../components/LandingView';
import RegisterFlow from '../components/RegisterFlow';
import { ONBOARDING_MOVIES, canFinishTasteSelection, toOnboardingMovie, type OnboardingMovie, type MovieReaction } from '../lib/recommendations/onboardingCatalog';
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
  title?: string;
  poster_path?: string;
  year?: string;
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

const ONBOARDING_FAVORITES = ONBOARDING_MOVIES;

function FilmMatchApp() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [watchTogetherFriendId, setWatchTogetherFriendId] = useState('');
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

  const [loadedMovies, setLoadedMovies] = useState<Movie[]>([]);
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
  const [dislikedMovieIds, setDislikedMovieIds] = useState<number[]>([]);
  const [unseenMovieIds, setUnseenMovieIds] = useState<number[]>([]);
  const [movieRatings, setMovieRatings] = useState<MovieRating[]>([]);
  const [ratingMovie, setRatingMovie] = useState<{ movie: Movie; alreadyWatched: boolean } | null>(null);
  const [draftMovieRating, setDraftMovieRating] = useState<number | null>(null);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [tasteMovieMetadata, setTasteMovieMetadata] = useState<Record<number, MovieTasteMetadata>>({});
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
  const [authReady, setAuthReady] = useState(false);
  const authUserRef = useRef<string | null>(null);
  const authRevision = useRef(0);
  const onboardingDraftRef = useRef(false);
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
  const canCreateAccount = Boolean(displayName.trim() && accountEmail.trim() && accountPassword.length >= 8 && passwordsMatch);

  const resetAuthenticatedState = () => {
    authUserRef.current = null;
    onboardingDraftRef.current = false;
    setAuthUserId(null);
    setAccountEmail('');
    setDisplayName('');
    setLibrary({ watchlist: [], watched: [] });
    setMovieRatings([]);
    setFriendsActivity([]);
    setFriendsList([]);
    setChosenPlatforms([]);
    setSelectedPlatforms(FIVE_PLATFORMS.map((platform) => platform.name));
    setSelectedFavorites([]);
    setDislikedMovieIds([]);
    setUnseenMovieIds([]);
    setTasteMovieMetadata({});
    setDislikedGenres([]);
    setFavoriteDirectors([]);
    setFavoriteCast([]);
    setReleaseYearBefore(null);
    setMaxRuntimeMinutes(null);
    setRatingMovie(null);
    setSelectedSpotlightMovie(null);
    setSpotlightMovieId(null);
    setSelectedPerson(null);
    setSearchQuery('');
    setViewHistory([]);
  };

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

  const rememberOnboardingMovies = (items: OnboardingMovie[]) => {
    setTasteMovieMetadata((current) => ({ ...current, ...Object.fromEntries(items.map((movie) => [movie.id, {
      ...movie, release_date: movie.year ? movie.year + '-01-01' : '', runtime_minutes: null,
    }])) }));
  };
  const recordOnboardingReaction = (movie: OnboardingMovie, reaction: MovieReaction | null) => {
    rememberOnboardingMovies([movie]);
    setSelectedFavorites((ids) => [...ids.filter((id) => id !== movie.id), ...(reaction === 'like' ? [movie.id] : [])]);
    setDislikedMovieIds((ids) => [...ids.filter((id) => id !== movie.id), ...(reaction === 'dislike' ? [movie.id] : [])]);
    setUnseenMovieIds((ids) => [...ids.filter((id) => id !== movie.id), ...(reaction === 'unseen' ? [movie.id] : [])]);
  };
  const onboardingChoices = useMemo(() => ONBOARDING_FAVORITES.map((movie) => ({
    ...movie, ...(toOnboardingMovie(tasteMovieMetadata[movie.id]) || {}),
  })), [tasteMovieMetadata]);
  const savedTasteMovies = useMemo(() => Object.values(tasteMovieMetadata).map(toOnboardingMovie).filter((movie): movie is OnboardingMovie => movie !== null), [tasteMovieMetadata]);
  const tasteById = useMemo(() => new Map<number, MovieTasteSignals>([
    ...ONBOARDING_FAVORITES, ...library.watchlist, ...library.watched, ...Object.values(tasteMovieMetadata),
  ].map((movie) => [movie.id, { ...movie, genres: movie.genres || [] }])), [library, tasteMovieMetadata]);
  const favoriteMovies = useMemo<MovieTasteSignals[]>(
    () => [...new Set(selectedFavorites)].map((id) => tasteById.get(id) || { id, genres: [] }),
    [selectedFavorites, tasteById]
  );
  const dislikedMovies = useMemo<MovieTasteSignals[]>(
    () => [...new Set(dislikedMovieIds)].filter((id) => !selectedFavorites.includes(id)).map((id) => tasteById.get(id) || { id, genres: [] }),
    [dislikedMovieIds, selectedFavorites, tasteById]
  );
  const tasteMetadataIds = [...new Set([...selectedFavorites, ...dislikedMovieIds, ...movieRatings.map((rating) => rating.movie_id), ...library.watched.map((movie) => movie.id)])].sort((a, b) => a - b).join(',');
  useEffect(() => {
    if (!authUserId || !tasteMetadataIds) return;
    const controller = new AbortController();
    const ids = tasteMetadataIds.split(',');
    void (async () => {
      const metadata: OnboardingMovie[] = [];
      try {
        for (let offset = 0; offset < ids.length; offset += 25) {
          const response = await fetch(`/api/movies?metadataIds=${ids.slice(offset, offset + 25).join(',')}`, { signal: controller.signal });
          if (!response.ok) continue;
          const data = await response.json();
          if (controller.signal.aborted) return;
          const items = (Array.isArray(data.movies) ? data.movies : []).map(toOnboardingMovie).filter((movie: OnboardingMovie | null): movie is OnboardingMovie => movie !== null);
          metadata.push(...items);
        }
      } catch { /* Existing catalog and saved metadata remain usable. */ }
      if (!controller.signal.aborted && metadata.length) rememberOnboardingMovies(metadata);
    })();
    return () => controller.abort();
  }, [authUserId, tasteMetadataIds]);

  const ratedMovies = useMemo<RatedMovieTasteSignals[]>(
    () => movieRatings.map((mr) => ({
      ...(tasteById.get(mr.movie_id) || { id: mr.movie_id, genres: [] }),
      rating: mr.rating,
    })),
    [movieRatings, tasteById]
  );

  const matchPreferences = useMemo<MatchPreferences>(
    () => ({ favoriteMovies, ratedMovies, dislikedMovies, offeredMovies: ONBOARDING_FAVORITES, dislikedGenres, favoriteDirectors, favoriteCast }),
    [favoriteMovies, ratedMovies, dislikedMovies, dislikedGenres, favoriteDirectors, favoriteCast]
  );
  const movies = useMemo(() => loadedMovies.map((movie) => ({
    ...movie,
    match_percentage: calculateMatchScore({ ...movie, genres: movie.genres || [] }, matchPreferences),
  })), [loadedMovies, matchPreferences]);

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
        genreWeights.set(key, { name: cur?.name || name, weight: (cur?.weight || 0) + weight / Math.max(1, genres.length) / Math.sqrt(Math.max(1, ONBOARDING_FAVORITES.filter((film) => film.genres.some((genre) => genre.toLocaleLowerCase() === key)).length / 3)) });
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
    [...library.watched, ...onboardingChoices.filter((movie) => selectedFavorites.includes(movie.id)), ...savedTasteMovies.filter((movie) => selectedFavorites.includes(movie.id))]
      .forEach((movie) => { if (movie.poster_path && !posters.has(movie.id)) posters.set(movie.id, { id: movie.id, title: movie.title, poster_path: movie.poster_path }); });
    return Array.from(posters.values()).slice(0, 5);
  }, [library.watched, selectedFavorites, onboardingChoices, savedTasteMovies]);

  const loadFriendsActivity = async (userId: string) => {
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data, error } = await supabase.rpc('fm_mutual_friends');
      if (authUserRef.current !== userId) return;
      if (error) throw error;
      const profiles: { id: string; display_name: string }[] = data ?? [];
      const friendIds = profiles.map((row) => row.id);
      setFriendsList(profiles);
      if (friendIds.length === 0) {
        setFriendsActivity([]);
        return;
      }
      const { data: ratings } = await supabase.from('movie_ratings').select('user_id, movie_id, rating, created_at').in('user_id', friendIds).order('created_at', { ascending: false }).limit(20);
      if (authUserRef.current !== userId) return;
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

      if (authUserRef.current !== userId) return;
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
    if (authUserRef.current !== user.id) return;
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const name = profile?.display_name || String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Gebruiker');
      const services = profile?.streaming_services || FIVE_PLATFORMS.map((p) => p.name);
      const favorites: number[] = [...new Set<number>((profile?.favorite_movie_ids || []).map(Number))];
      const negatives: number[] = [...new Set<number>((profile?.disliked_movie_ids || []).map(Number))].filter((id) => !favorites.includes(id));
      const unseen: number[] = [...new Set<number>((profile?.unseen_movie_ids || []).map(Number))].filter((id) => !favorites.includes(id) && !negatives.includes(id));
      const rawMetadata = profile?.taste_movie_metadata;
      const storedMovies = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
        ? Object.values(rawMetadata).map(toOnboardingMovie).filter((movie): movie is OnboardingMovie => movie !== null) : [];

      const { data: ratingRows } = await supabase.from('movie_ratings').select('movie_id, rating').eq('user_id', user.id);
      const [{ data: watchlistRows }, { data: watchedRows }] = await Promise.all([
        supabase.from('user_watchlist').select('movie_data').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_watched').select('movie_data').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (authUserRef.current !== user.id) return;
      startTransition(() => {
        setAuthUserId(user.id);
        setAccountEmail(user.email || '');
        setDisplayName(name);
        setChosenPlatforms(services);
        setSelectedPlatforms(services);
        setSelectedFavorites(favorites);
        setDislikedMovieIds(negatives);
        setUnseenMovieIds(unseen);
        setTasteMovieMetadata(Object.fromEntries(storedMovies.map((movie) => [movie.id, { ...movie, release_date: movie.year ? movie.year + '-01-01' : '', runtime_minutes: null }])));
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
      return Boolean(profile?.onboarding_completed);
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
      authRevision.current++;
      authUserRef.current = data.user.id;
      setAuthUserId(data.user.id);
      await loadAuthenticatedUser(data.user);
      if (authUserRef.current !== data.user.id) return;
      setAuthReady(true);
      onboardingDraftRef.current = true;
      setRegisterStep(2);
      setCurrentView('register');
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
    if (data.session && data.user) {
      authRevision.current++;
      authUserRef.current = data.user.id;
      setAuthUserId(data.user.id);
      const onboardingCompleted = await loadAuthenticatedUser(data.user);
      if (authUserRef.current !== data.user.id) return;
      setAuthReady(true);
      if (!onboardingCompleted) { onboardingDraftRef.current = true; setRegisterStep(2); }
      setCurrentView(onboardingCompleted ? 'dashboard' : 'register');
    }
  };

  const handleSignOut = async () => {
    authRevision.current++;
    resetAuthenticatedState();
    setLoginPassword('');
    setAuthReady(true);
    setCurrentView('login');
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) setAuthError('Uitloggen kon niet volledig worden afgerond. Probeer het opnieuw.');
    }
  };

  const persistProfile = async (): Promise<boolean> => {
    if (!authUserId) return false;
    const onboarding = currentView === 'register';
    const services = onboarding ? chosenPlatforms : selectedPlatforms;
    if (onboarding && (services.length === 0 || !canFinishTasteSelection(selectedFavorites, dislikedMovieIds))) {
      setAuthError('Kies minimaal één dienst en beoordeel vijf films, waarvan minstens drie positief.');
      return false;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return false;
    setAuthLoading(true);
    setAuthError('');
    setAuthNotice('');
    try {
      const reactionIds = new Set([...selectedFavorites, ...dislikedMovieIds, ...unseenMovieIds]);
      const metadata = Object.fromEntries([...reactionIds].map((id) => {
        const stored = toOnboardingMovie(tasteMovieMetadata[id]) || ONBOARDING_FAVORITES.find((movie) => movie.id === id);
        return [id, stored];
      }).filter((entry) => Boolean(entry[1])));
      const { error } = await supabase.from('profiles').upsert({
        id: authUserId, display_name: displayName.trim(), streaming_services: services,
        favorite_movie_ids: [...new Set(selectedFavorites)],
        disliked_movie_ids: [...new Set(dislikedMovieIds)].filter((id) => !selectedFavorites.includes(id)),
        unseen_movie_ids: [...new Set(unseenMovieIds)].filter((id) => !selectedFavorites.includes(id) && !dislikedMovieIds.includes(id)),
        taste_movie_metadata: metadata,
        preferred_genres: preferredGenres, disliked_genres: dislikedGenres,
        favorite_directors: favoriteDirectors, favorite_cast: favoriteCast,
        release_year_before: releaseYearBefore, max_runtime_minutes: maxRuntimeMinutes,
        onboarding_completed: true,
      });
      if (error) throw error;
      setSelectedPlatforms(services);
      onboardingDraftRef.current = false;
      setAuthNotice('Je profiel is opgeslagen.');
      return true;
    } catch {
      setAuthError('Je profiel kon niet worden opgeslagen. Probeer het opnieuw.');
      return false;
    } finally { setAuthLoading(false); }
  };

  const saveProfile = async (): Promise<void> => { await persistProfile(); };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      resetAuthenticatedState();
      setCurrentView('login');
      setAuthReady(true);
      return;
    }

    let active = true;
    let scheduledCheck: ReturnType<typeof setTimeout> | undefined;
    const verifySession = async () => {
      const revision = ++authRevision.current;
      try {
        // Validate the user with Supabase before showing a personal dashboard.
        const { data, error } = await supabase.auth.getUser();
        if (!active || revision !== authRevision.current) return;
        if (error || !data.user) {
          resetAuthenticatedState();
          setCurrentView((view) => view === 'register' ? view : 'login');
          return;
        }
        if (authUserRef.current === data.user.id && onboardingDraftRef.current) return;
        authUserRef.current = data.user.id;
        setAuthUserId(data.user.id);
        const onboardingCompleted = await loadAuthenticatedUser(data.user);
        if (!active || revision !== authRevision.current || authUserRef.current !== data.user.id) return;
        if (!onboardingCompleted) { onboardingDraftRef.current = true; setRegisterStep((step) => step === 1 ? 2 : step); }
        setCurrentView((view) => view === 'login' || view === 'landing' ? (onboardingCompleted ? 'dashboard' : 'register') : view);
      } catch {
        if (!active || revision !== authRevision.current) return;
        resetAuthenticatedState();
        setCurrentView((view) => view === 'register' ? view : 'login');
      } finally {
        if (active && revision === authRevision.current) setAuthReady(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active || event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        authRevision.current++;
        clearTimeout(scheduledCheck);
        resetAuthenticatedState();
        setCurrentView('login');
        setAuthReady(true);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Run database work after the synchronous auth event has finished.
        clearTimeout(scheduledCheck);
        scheduledCheck = setTimeout(() => { void verifySession(); }, 0);
      }
    });
    void verifySession();

    return () => {
      active = false;
      authRevision.current++;
      authUserRef.current = null;
      clearTimeout(scheduledCheck);
      subscription.unsubscribe();
    };
  }, []);

  const movieQuery = searchQuery.trim();
  const moviePersonId = selectedPerson?.id;
  const isCinemaRequest = libraryView === 'cinema';
  const movieProviders = isCinemaRequest ? '' : (selectedPlatforms.length ? selectedPlatforms : FIVE_PLATFORMS.map((platform) => platform.name)).join(',');
  const movieGenre = !isCinemaRequest && !movieQuery && !moviePersonId ? preferredGenres[0] ?? '' : '';

  // Fetch only when the actual catalogue query changes.
  useEffect(() => {
    if (!authReady || !authUserId || (libraryView !== 'discover' && libraryView !== 'cinema')) {
      setLoading(false);
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      const candidateMovies: Movie[] = [];
      setMovieLoadError('');
      try {
        const pages = movieQuery || moviePersonId || isCinemaRequest ? [1] : [1, 2];
        const requests = pages.map(async (p) => {
          const params = new URLSearchParams({ page: String(p) });
          if (isCinemaRequest) {
            params.set('nowPlaying', 'true');
          } else {
            params.set('providers', movieProviders);
            if (moviePersonId) params.set('personId', String(moviePersonId));
            else if (movieQuery) params.set('query', movieQuery);
            else if (movieGenre) params.set('genre', movieGenre);
          }
          const res = await fetch(`/api/movies?${params.toString()}`, { signal: controller.signal });
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

        setLoadedMovies(candidateMovies);
      } catch (e) {
        if (isActive) setMovieLoadError('Films konden niet worden geladen.');
      } finally {
        if (isActive) setLoading(false);
      }
    }, 200);

    return () => {
      isActive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [authReady, authUserId, libraryView, isCinemaRequest, movieQuery, moviePersonId, movieProviders, movieGenre]);

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
      const matchQuery = libraryView === 'discover' || selectedPerson || !searchQuery.trim() || `${m.title} ${m.overview}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesFilters = (libraryView !== 'discover' && !isCinema) || matchesDiscoveryFilters(m, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes, isCinema);
      const isUnwatched = (libraryView !== 'discover' && !isCinema) || (libraryView === 'discover' && Boolean(searchQuery.trim())) || !watchedIds.has(m.id);
      return matchQuery && matchesFilters && isUnwatched;
    });
  }, [movies, library, libraryView, searchQuery, selectedPerson, selectedPlatforms, minimumImdbRating, releaseYearBefore, maxRuntimeMinutes, librarySort, ratingsByMovieId]);

  const visibleMovies = filteredMovies.slice(0, visibleMovieLimit);
  const spotlightMovie = spotlightMovieId ? (selectedSpotlightMovie || visibleMovies.find((m) => m.id === spotlightMovieId) || null) : null;
  const topMatch = spotlightMovie;
  const gridMatches = libraryView === 'watched' ? visibleMovies : topMatch ? visibleMovies.filter((m) => m.id !== topMatch.id) : visibleMovies;
  const showRecommendationRows = libraryView === 'discover' && !searchQuery.trim() && !selectedPerson;
  const isWatchlist = libraryView === 'watchlist';
  const showLibraryBanner = (isCinemaRequest || isWatchlist) && !selectedSpotlightMovie;
  const libraryBannerImage = isCinemaRequest ? '/cinema-banner.png' : '/watchlist-banner.png';

  if (!authReady) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center bg-[#173553] px-5 text-sky-100" role="status" aria-live="polite">
        <div className="text-center">
          <p className="text-3xl" aria-hidden="true">🍿</p>
          <p className="mt-3 text-sm">Je sessie controleren…</p>
        </div>
      </main>
    );
  }

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
        onboardingFavorites={onboardingChoices}
        selectedFavorites={selectedFavorites}
        dislikedMovieIds={dislikedMovieIds}
        unseenMovieIds={unseenMovieIds}
        savedTasteMovies={savedTasteMovies}
        onMovieReaction={recordOnboardingReaction}
        onMovieMetadata={rememberOnboardingMovies}
        toggleFavorite={(id) => setSelectedFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
        onSignUp={handleSignUp}
        onCompleteOnboarding={async () => { if (await persistProfile()) setRegisterStep(5); }}
        onOpenDashboard={() => setCurrentView('dashboard')}
        onCancel={() => setCurrentView('login')}
      />
    );
  }

  if (currentView === 'login' || !authUserId) {
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
        onCompleteOnboarding={async () => { if (await persistProfile()) setRegisterStep(5); }}
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
        onOpenFriends={() => {
          navigateToView('friends');
          if (authUserId) void loadFriendsActivity(authUserId);
        }}
        onOpenWatchTogether={() => {
          setWatchTogetherFriendId('');
          navigateToView('watch-together');
          if (authUserId) void loadFriendsActivity(authUserId);
        }}
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
              onOpenFavoritesOnboarding={() => { onboardingDraftRef.current = true; setRegisterStep(3); setCurrentView('register'); }}
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
              favoriteFilmTitles={[...new Set([...onboardingChoices, ...savedTasteMovies].filter((movie) => selectedFavorites.includes(movie.id)).map((movie) => movie.title))]}
              profileFriendCount={friendsList.length}
              watchedCredits={tasteMovieMetadata}
            />
          ) : currentView === 'watch-together' ? (
            <WatchTogetherPage
              initialFriendId={watchTogetherFriendId}
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
              onWatchTogether={(friendId) => {
                setWatchTogetherFriendId(friendId);
                navigateToView('watch-together');
              }}
              currentUserId={authUserId}
              currentUserName={displayName || 'Jij'}
              myStreamingServices={selectedPlatforms}
              allMovies={movies}
              myWatchedIds={library.watched.map((m) => m.id)}
              myWatchlistIds={library.watchlist.map((m) => m.id)}
              matchPreferences={matchPreferences}
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

              {showLibraryBanner && (
                <header className="relative isolate flex min-h-36 items-center overflow-hidden rounded-2xl border border-sky-200/20 bg-[#10283e] px-5 py-6 sm:min-h-52 sm:px-8">
                  <img src={libraryBannerImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_50%]" />
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#10283e] via-[#10283e]/55 to-transparent" />
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">{isWatchlist ? 'Jouw watchlist' : 'Nu in de bioscoop'}</h1>
                    {isWatchlist && <p className="mt-1 text-sm text-sky-100/85">{library.watchlist.length} {library.watchlist.length === 1 ? 'bewaarde film' : 'bewaarde films'}</p>}
                  </div>
                </header>
              )}

              {loading && !showRecommendationRows && !isWatchlist && !(isCinemaRequest && selectedSpotlightMovie) ? (
                <div className="py-32 text-center text-xs text-neutral-400">Films inladen...</div>
              ) : visibleMovies.length === 0 && !showRecommendationRows && !((isCinemaRequest || isWatchlist) && selectedSpotlightMovie) ? (
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
                      backLabel={isWatchlist ? 'Terug naar je watchlist' : isCinemaRequest ? 'Terug naar de bioscoop' : undefined}
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
                          {libraryView === 'watchlist' ? (showLibraryBanner ? 'Bewaarde films' : 'Watchlist') : libraryView === 'watched' ? 'Gezien' : 'In de bioscoop'}
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
                    recommendationUserId={authUserId ?? undefined}
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




function LocalRegistrationPreview({ initialStep }: { initialStep: 1 | 2 | 3 | 4 | 5 }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialStep);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [services, setServices] = useState<string[]>(['Netflix', 'Prime Video', 'Disney+']);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [negatives, setNegatives] = useState<number[]>([]);
  const [unseen, setUnseen] = useState<number[]>([]);
  const [details, setDetails] = useState<Record<number, OnboardingMovie>>({});
  const remember = (items: OnboardingMovie[]) => setDetails((current) => ({ ...current, ...Object.fromEntries(items.map((movie) => [movie.id, movie])) }));
  const reactToMovie = (movie: OnboardingMovie, reaction: MovieReaction | null) => {
    remember([movie]);
    setFavorites((ids) => [...ids.filter((id) => id !== movie.id), ...(reaction === 'like' ? [movie.id] : [])]);
    setNegatives((ids) => [...ids.filter((id) => id !== movie.id), ...(reaction === 'dislike' ? [movie.id] : [])]);
    setUnseen((ids) => [...ids.filter((id) => id !== movie.id), ...(reaction === 'unseen' ? [movie.id] : [])]);
  };
  const changeStep = (next: 1 | 2 | 3 | 4 | 5) => {
    setStep(next);
    const url = new URL(window.location.href);
    url.searchParams.set('preview', 'register');
    url.searchParams.set('step', String(next));
    window.history.replaceState(null, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const leavePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('preview');
    url.searchParams.delete('step');
    window.location.assign(url.toString());
  };
  const matching = password.length > 0 && password === confirmation;
  return (
    <div className="min-h-screen bg-[#173553] text-white">
      <nav aria-label="Lokale registratiepreview" className="relative z-50 flex flex-wrap items-center justify-center gap-2 border-b border-sky-200/25 bg-[#173553] px-4 py-3">
        <p className="w-full text-center text-xs text-sky-100">Lokale preview — geen account- of profielgegevens opgeslagen</p>
        <button type="button" disabled={step === 1} onClick={() => changeStep((step - 1) as 1 | 2 | 3 | 4 | 5)} className="min-h-11 rounded-full border border-sky-200/30 px-3 text-sm disabled:opacity-40">← Vorige</button>
        {[1, 2, 3, 4, 5].map((number) => (
          <button key={number} type="button" aria-label={`Bekijk stap ${number}`} aria-pressed={step === number} onClick={() => changeStep(number as 1 | 2 | 3 | 4 | 5)} className={`h-11 w-11 rounded-full text-sm font-semibold ${step === number ? 'bg-rose-500 text-white' : 'bg-sky-100/10 text-sky-100'}`}>{number}</button>
        ))}
        <button type="button" disabled={step === 5} onClick={() => changeStep((step + 1) as 1 | 2 | 3 | 4 | 5)} className="min-h-11 rounded-full border border-sky-200/30 px-3 text-sm disabled:opacity-40">Volgende →</button>
        <button type="button" onClick={leavePreview} className="min-h-11 rounded-full px-3 text-xs text-sky-100 underline underline-offset-4">Preview sluiten</button>
      </nav>
      <RegisterFlow
        registerStep={step}
        setRegisterStep={changeStep}
        displayName={name}
        setDisplayName={setName}
        accountEmail={email}
        setAccountEmail={setEmail}
        accountPassword={password}
        setAccountPassword={setPassword}
        confirmPassword={confirmation}
        setConfirmPassword={setConfirmation}
        passwordsMatch={matching}
        canCreateAccount={Boolean(name.trim() && email.trim() && password.length >= 8 && matching)}
        authError=""
        authNotice=""
        authLoading={false}
        supabaseConfigured={true}
        platforms={FIVE_PLATFORMS}
        chosenPlatforms={services}
        toggleRegisterPlatform={(platform) => setServices((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])}
        onboardingFavorites={ONBOARDING_FAVORITES}
        selectedFavorites={favorites}
        dislikedMovieIds={negatives}
        unseenMovieIds={unseen}
        savedTasteMovies={Object.values(details)}
        onMovieReaction={reactToMovie}
        onMovieMetadata={remember}
        toggleFavorite={(id) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
        onSignUp={(event) => { event.preventDefault(); changeStep(2); }}
        onCompleteOnboarding={() => changeStep(5)}
        onOpenDashboard={leavePreview}
        onCancel={leavePreview}
      />
    </div>
  );
}

export default function Home() {
  const [preview, setPreview] = useState<{ step: 1 | 2 | 3 | 4 | 5 } | null | undefined>(undefined);
  useEffect(() => {
    const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
    if (process.env.NODE_ENV !== 'development' || !local) {
      setPreview(null);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') !== 'register') {
      setPreview(null);
      return;
    }
    const requested = Number(params.get('step') || 1);
    const step = (Number.isInteger(requested) && requested >= 1 && requested <= 5 ? requested : 1) as 1 | 2 | 3 | 4 | 5;
    setPreview({ step });
  }, []);

  if (process.env.NODE_ENV !== 'development') return <FilmMatchApp />;
  if (preview === undefined) {
    return <main className="flex min-h-[100svh] items-center justify-center bg-[#173553] text-sm text-sky-100" role="status">FilmMatch laden…</main>;
  }
  // The real app and its Supabase effects are never mounted in preview mode.
  return preview ? <LocalRegistrationPreview initialStep={preview.step} /> : <FilmMatchApp />;
}
