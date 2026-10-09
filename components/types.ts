export type LibraryView = 'discover' | 'watchlist' | 'watched';
export type DiscoveryMode = 'recommended' | 'new_releases' | 'popular';

export interface UserProfile {
  id: string;
  display_name: string;
  streaming_services: string[];
  favorite_movie_ids: number[];
  preferred_genres: string[];
  disliked_genres: string[];
  favorite_directors: string[];
  favorite_cast: string[];
  release_year_before: number | null;
  max_runtime_minutes: number | null;
  onboarding_completed: boolean;
}

export interface MovieRating {
  movie_id: number;
  rating: number;
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path?: string;
  release_date: string;
  rating?: string | null;
  rating_source?: 'IMDb' | 'TMDb' | null;
  runtime?: string;
  runtime_minutes?: number | null;
  genres?: string[];
  director?: string;
  cast?: string[];
  match_percentage?: number;
  providers: Provider[];
  friend_recommendation?: {
    friend_name: string;
    friend_match: number;
    quote: string;
    rating: number;
    avatar: string;
  };
}

export interface StreamingPlatform {
  id: number;
  name: string;
  logo_path: string;
  mark: string;
  color: string;
}

export interface FriendActivityItem {
  id: number;
  friendId: number;
  name: string;
  initial: string;
  avatarGradient: string;
  recentFilm: string;
  movieId: number;
  poster_path: string;
  rating: number;
  minutesAgo: number;
}
