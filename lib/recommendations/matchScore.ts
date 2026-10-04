export interface MovieTasteSignals {
  id: number;
  genres: readonly string[];
  director?: string | null;
  cast?: readonly string[];
}

export interface RatedMovieTasteSignals extends MovieTasteSignals {
  rating: number;
}

export interface MatchPreferences {
  favoriteMovies: readonly MovieTasteSignals[];
  ratedMovies: readonly RatedMovieTasteSignals[];
}

const MATCH_WEIGHTS = {
  genres: 0.6,
  director: 0.25,
  cast: 0.15,
} as const;

export function getMatchColorBand(score: number): 'strong' | 'medium' | 'low' {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'medium';
  return 'low';
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function ratingWeight(rating: number): number {
  return Math.max(-1, Math.min(1, (rating - 5.5) / 4.5));
}

function createTraitWeights(
  favoriteMovies: readonly MovieTasteSignals[],
  ratedMovies: readonly RatedMovieTasteSignals[],
  getTraits: (movie: MovieTasteSignals) => readonly string[]
): Map<string, number> {
  const weights = new Map<string, number>();
  const ratingsByMovie = new Map(ratedMovies.map((movie) => [movie.id, movie.rating]));
  const includedIds = new Set<number>();

  const addMovie = (movie: MovieTasteSignals, weight: number) => {
    includedIds.add(movie.id);
    new Set(getTraits(movie).map(normalize).filter(Boolean)).forEach((trait) => {
      weights.set(trait, (weights.get(trait) || 0) + weight);
    });
  };

  favoriteMovies.forEach((movie) => {
    const rating = ratingsByMovie.get(movie.id);
    addMovie(movie, rating === undefined ? 1 : ratingWeight(rating));
  });

  ratedMovies.forEach((movie) => {
    if (!includedIds.has(movie.id)) addMovie(movie, ratingWeight(movie.rating));
  });

  return weights;
}

function scoreTraits(candidateTraits: readonly string[], preferenceWeights: Map<string, number>): number | null {
  const traits = Array.from(new Set(candidateTraits.map(normalize).filter(Boolean)));
  if (traits.length === 0 || preferenceWeights.size === 0) return null;

  const strongestPreference = Math.max(...Array.from(preferenceWeights.values()).map(Math.abs));
  if (strongestPreference === 0) return null;

  const affinity = traits.reduce(
    (total, trait) => total + (preferenceWeights.get(trait) || 0) / strongestPreference,
    0
  ) / traits.length;

  return Math.round(Math.max(0, Math.min(100, 50 + affinity * 50)));
}

export function calculateMatchScore(
  movie: MovieTasteSignals,
  preferences: MatchPreferences | null | undefined
): number {
  const favoriteMovies = Array.isArray(preferences?.favoriteMovies) ? preferences.favoriteMovies : [];
  const ratedMovies = Array.isArray(preferences?.ratedMovies) ? preferences.ratedMovies : [];
  const categories = [
    {
      score: scoreTraits(
        movie.genres || [],
        createTraitWeights(favoriteMovies, ratedMovies, (item) => item.genres)
      ),
      weight: MATCH_WEIGHTS.genres,
    },
    {
      score: movie.director
        ? scoreTraits(
            [movie.director],
            createTraitWeights(favoriteMovies, ratedMovies, (item) => item.director ? [item.director] : [])
          )
        : null,
      weight: MATCH_WEIGHTS.director,
    },
    {
      score: scoreTraits(
        movie.cast || [],
        createTraitWeights(favoriteMovies, ratedMovies, (item) => item.cast || [])
      ),
      weight: MATCH_WEIGHTS.cast,
    },
  ];

  const validCategories = categories.flatMap((category) =>
    category.score !== null ? [{ score: category.score, weight: Number(category.weight) }] : []
  );

  if (validCategories.length === 0) return 50;

  const totalWeight = validCategories.reduce((total, category) => total + category.weight, 0);
  return Math.round(validCategories.reduce((total, category) => total + category.score * category.weight, 0) / totalWeight);
}