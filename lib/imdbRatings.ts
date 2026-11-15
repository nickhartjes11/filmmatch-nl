import type { SupabaseClient } from '@supabase/supabase-js';

const pendingImdbRatings = new Map<string, Promise<string | null>>();

const IMDB_CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export function validImdbRating(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 10
    ? number.toFixed(1)
    : null;
}

export async function getImdbRating(
  supabase: SupabaseClient | null,
  imdbId: string,
  apiKey: string,
  fallbackRating: unknown = null
): Promise<string | null> {
  const pending = pendingImdbRatings.get(imdbId);
  if (pending) return pending;

  const request = (async () => {
    let previousRating = validImdbRating(fallbackRating);
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('movie_imdb_cache')
          .select('imdb_rating, imdb_fetched_at')
          .eq('imdb_id', imdbId)
          .maybeSingle();

        if (!error && data) {
          const cachedRating = validImdbRating(data.imdb_rating);
          previousRating = cachedRating || previousRating;
          const fetchedAt = Date.parse(data.imdb_fetched_at || '');
          const age = Date.now() - fetchedAt;
          if (cachedRating && Number.isFinite(age) && age >= 0 && age < IMDB_CACHE_MAX_AGE_MS) {
            return cachedRating;
          }
        } else if (error) {
          console.warn('IMDb-cache kon niet worden gelezen:', error.message);
        }
      } catch {
        // Keep the last known rating available during database outages.
      }
    }

    try {
      const response = await fetch(
        `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(apiKey)}`,
        { cache: 'no-store', signal: AbortSignal.timeout(2500) }
      );
      if (!response.ok) return previousRating;
      const data = await response.json();
      const rating = data.Response === 'False' ? null : validImdbRating(data.imdbRating);
      if (!rating) return previousRating;

      if (supabase) {
        try {
          const { error } = await supabase
            .from('movie_imdb_cache')
            .upsert({
              imdb_id: imdbId,
              imdb_rating: Number(rating),
              imdb_fetched_at: new Date().toISOString(),
            }, { onConflict: 'imdb_id' });
          if (error) console.warn('IMDb-cache kon niet worden bijgewerkt:', error.message);
        } catch {
          console.warn('IMDb-cache kon niet worden bijgewerkt.');
        }
      }
      return rating;
    } catch {
      // A failed refresh never deletes the last known IMDb rating.
      return previousRating;
    }
  })();

  pendingImdbRatings.set(imdbId, request);
  try {
    return await request;
  } finally {
    pendingImdbRatings.delete(imdbId);
  }
}

