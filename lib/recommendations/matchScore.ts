export interface MovieTasteSignals {
  id: number;
  genres: readonly string[];
  director?: string | null;
  cast?: readonly string[];
  rating?: string | number | null;
}

export interface RatedMovieTasteSignals extends MovieTasteSignals {
  rating: number;
}

export interface MatchPreferences {
  favoriteMovies: readonly MovieTasteSignals[];
  ratedMovies: readonly RatedMovieTasteSignals[];
  dislikedMovies?: readonly MovieTasteSignals[];
  // Only movies actually offered by onboarding; unseen answers are NOT preferences.
  offeredMovies?: readonly MovieTasteSignals[];
  dislikedGenres?: readonly string[];
  favoriteDirectors?: readonly string[];
  favoriteCast?: readonly string[];
}

const MATCH_WEIGHTS = { genres: 0.55, imdb: 0.10, director: 0.20, cast: 0.15 } as const;
const EXPLICIT_PERSON_PREFERENCE_WEIGHT = 2.5;
const DISLIKE_PENALTY_PER_GENRE = 30;

export function getMatchColorBand(score: number): 'strong' | 'medium' | 'low' {
  return score >= 80 ? 'strong' : score >= 60 ? 'medium' : 'low';
}

function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }
function userRatingWeight(rating: number): number { return Math.max(-1, Math.min(1, (rating - 5.5) / 4.5)); }

function createTraitWeights(
  favorites: readonly MovieTasteSignals[], ratings: readonly RatedMovieTasteSignals[],
  dislikes: readonly MovieTasteSignals[], getTraits: (movie: MovieTasteSignals) => readonly string[]
): Map<string, number> {
  const weights = new Map<string, number>();
  const judgments = new Map<number, { movie: MovieTasteSignals; weight: number }>();
  // An onboarding dislike is deliberately weaker than a full 1/10 review.
  dislikes.forEach((movie) => judgments.set(movie.id, { movie, weight: -0.45 }));
  favorites.forEach((movie) => judgments.set(movie.id, { movie, weight: 1 }));
  // Later, explicit user ratings supersede the earlier onboarding response.
  ratings.forEach((movie) => {
    if (Number.isFinite(movie.rating)) judgments.set(movie.id, { movie, weight: userRatingWeight(movie.rating) });
  });
  judgments.forEach(({ movie, weight }) => {
    const traits = [...new Set(getTraits(movie).map(normalize).filter(Boolean))];
    // A movie contributes one vote per category, not one vote per genre/actor.
    traits.forEach((trait) => weights.set(trait, (weights.get(trait) || 0) + weight / traits.length));
  });
  return weights;
}

function balanceGenreExposure(weights: Map<string, number>, offered: readonly MovieTasteSignals[]): Map<string, number> {
  const counts = new Map<string, number>();
  const seen = new Set<number>();
  offered.forEach((movie) => {
    if (seen.has(movie.id)) return;
    seen.add(movie.id);
    new Set(movie.genres.map(normalize).filter(Boolean)).forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
  });
  if (!counts.size) return weights;
  const frequencies = [...counts.values()].sort((a, b) => a - b);
  const median = frequencies[Math.floor(frequencies.length / 2)] || 1;
  return new Map([...weights].map(([trait, weight]) => {
    // Only damp over-represented genres; do not boost rare ones into certainty.
    const divisor = Math.sqrt(Math.max(1, (counts.get(trait) || median) / median));
    return [trait, weight / divisor];
  }));
}

function withExplicitPreferences(weights: Map<string, number>, traits?: readonly string[]): Map<string, number> {
  new Set((traits || []).map(normalize).filter(Boolean)).forEach((trait) => weights.set(trait, (weights.get(trait) || 0) + EXPLICIT_PERSON_PREFERENCE_WEIGHT));
  return weights;
}

function scoreTraits(candidate: readonly string[], weights: Map<string, number>): number | null {
  const traits = [...new Set(candidate.map(normalize).filter(Boolean))];
  if (!traits.length || !weights.size) return null;
  // Unknown traits are neutral. Confidence grows gradually as evidence accumulates.
  const affinities = traits.map((trait) => { const weight = weights.get(trait) || 0; return weight / (Math.abs(weight) + 1.5); });
  const average = affinities.reduce((sum, value) => sum + value, 0) / affinities.length;
  const blended = Math.max(...affinities) * 0.6 + average * 0.4;
  return Math.round(Math.max(0, Math.min(100, 50 + blended * 50)));
}

function scoreImdb(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 10 ? Math.round(number * 10) : null;
}

export function calculateMatchScore(movie: MovieTasteSignals, preferences: MatchPreferences | null | undefined): number {
  const favorites = Array.isArray(preferences?.favoriteMovies) ? preferences.favoriteMovies : [];
  const ratings = Array.isArray(preferences?.ratedMovies) ? preferences.ratedMovies : [];
  const dislikes = Array.isArray(preferences?.dislikedMovies) ? preferences.dislikedMovies : [];
  const categories = [
    { score: scoreTraits(movie.genres || [], balanceGenreExposure(createTraitWeights(favorites, ratings, dislikes, (item) => item.genres || []), preferences?.offeredMovies || [])), weight: MATCH_WEIGHTS.genres },
    { score: scoreImdb(movie.rating), weight: MATCH_WEIGHTS.imdb },
    { score: movie.director ? scoreTraits([movie.director], withExplicitPreferences(createTraitWeights(favorites, ratings, dislikes, (item) => item.director ? [item.director] : []), preferences?.favoriteDirectors)) : null, weight: MATCH_WEIGHTS.director },
    { score: scoreTraits(movie.cast || [], withExplicitPreferences(createTraitWeights(favorites, ratings, dislikes, (item) => item.cast || []), preferences?.favoriteCast)), weight: MATCH_WEIGHTS.cast },
  ].filter((category) => category.score !== null);
  const total = categories.reduce((sum, category) => sum + category.weight, 0);
  const base = total ? categories.reduce((sum, category) => sum + category.score! * category.weight, 0) / total : 60;
  const excluded = new Set((preferences?.dislikedGenres || []).map(normalize).filter(Boolean));
  const explicitPenalty = [...new Set((movie.genres || []).map(normalize))].filter((genre) => excluded.has(genre)).length * DISLIKE_PENALTY_PER_GENRE;
  // Recommending the very movie explicitly rejected should also score lower.
  const ratedIds = new Set(ratings.map((item) => item.id));
  const favoriteIds = new Set(favorites.map((item) => item.id));
  const directRejection = !ratedIds.has(movie.id) && !favoriteIds.has(movie.id) && dislikes.some((item) => item.id === movie.id) ? 15 : 0;
  return Math.round(Math.max(0, Math.min(100, base - explicitPenalty - directRejection)));
}
