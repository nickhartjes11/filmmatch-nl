import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

const TARGET_PROVIDERS: Record<number, string> = {
  8: 'Netflix',
  72: 'Videoland',
  119: 'Prime Video',
  9: 'Prime Video',
  337: 'Disney+',
  1899: 'HBO Max',
  384: 'HBO Max',
};

const PROVIDER_IDS_QUERY = '8|72|119|9|337|1899|384';

const TMDB_GENRES: Record<number, string> = {
  28: 'Actie',
  12: 'Avontuur',
  16: 'Animatie',
  35: 'Komedie',
  80: 'Misdaad',
  99: 'Documentaire',
  18: 'Drama',
  10751: 'Familie',
  14: 'Fantasy',
  36: 'Historisch',
  27: 'Horror',
  10402: 'Muziek',
  9648: 'Mysterie',
  10749: 'Romantiek',
  878: 'Sciencefiction',
  10770: 'Televisiefilm',
  53: 'Thriller',
  10752: 'Oorlog',
  37: 'Western',
};

const pendingImdbRatings = new Map<string, Promise<string | null>>();

function formatTmdbRating(value: unknown): string | null {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : null;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3500
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getImdbRating(imdbId: string, apiKey: string): Promise<string | null> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('movie_imdb_cache')
        .select('imdb_rating')
        .eq('imdb_id', imdbId)
        .maybeSingle();

      if (data?.imdb_rating) {
        return Number(data.imdb_rating).toFixed(1);
      }
    } catch {
      // Continue to OMDb if the cache is unavailable.
    }
  }

  const pending = pendingImdbRatings.get(imdbId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetchWithTimeout(
        `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`,
        { next: { revalidate: 86400 } },
        2500
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (!data.imdbRating || data.imdbRating === 'N/A') return null;

      const ratingString = String(data.imdbRating);
      const ratingNumber = Number.parseFloat(ratingString);

      if (supabase && Number.isFinite(ratingNumber)) {
        void supabase
          .from('movie_imdb_cache')
          .upsert({ imdb_id: imdbId, imdb_rating: ratingNumber })
          .then();
      }

      return ratingString;
    } catch {
      return null;
    }
  })();

  pendingImdbRatings.set(imdbId, request);
  const rating = await request;
  pendingImdbRatings.delete(imdbId);

  return rating;
}

export async function GET(request: Request) {
  const apiKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY ontbreekt' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const trailerMovieId = searchParams.get('trailerMovieId');

  if (trailerMovieId) {
    try {
      const videosUrl = `https://api.themoviedb.org/3/movie/${encodeURIComponent(
        trailerMovieId
      )}/videos?api_key=${apiKey}`;
      const videosResponse = await fetchWithTimeout(videosUrl, {
        next: { revalidate: 3600 },
      });
      const videosData = videosResponse.ok ? await videosResponse.json() : null;

      const videos = (videosData?.results || []) as Array<{
        site?: string;
        type?: string;
        key?: string;
        official?: boolean;
        iso_639_1?: string;
      }>;

      const youtubeVideos = videos.filter(
        (video) => video.site?.toLowerCase() === 'youtube' && Boolean(video.key)
      );

      const trailer =
        youtubeVideos.find(
          (video) =>
            video.type === 'Trailer' &&
            video.official &&
            video.iso_639_1 === 'nl'
        ) ||
        youtubeVideos.find((video) => video.type === 'Trailer' && video.official) ||
        youtubeVideos.find((video) => video.type === 'Trailer') ||
        youtubeVideos.find((video) => video.type === 'Teaser') ||
        youtubeVideos[0];

      return NextResponse.json({ youtubeKey: trailer?.key ?? null });
    } catch {
      return NextResponse.json(
        { error: 'Fout bij het ophalen van de trailer' },
        { status: 500 }
      );
    }
  }

  const page = searchParams.get('page') || '1';
  const query = searchParams.get('query');
  const peopleQuery = searchParams.get('people')?.trim();
  const personId = searchParams.get('personId');
  const similarToParam = searchParams.get('similarTo');
  const similarToId = similarToParam ? Number.parseInt(similarToParam, 10) : null;
  const nowPlaying = searchParams.get('nowPlaying') === 'true';

  const providersParam = searchParams.get('providers');
  const selectedProviderNames = providersParam
    ? new Set(providersParam.split(',').filter(Boolean))
    : null;

  const selectedProviderIds = selectedProviderNames
    ? Object.entries(TARGET_PROVIDERS)
        .filter(([, providerName]) => selectedProviderNames.has(providerName))
        .map(([providerId]) => providerId)
    : [];

  const providerIdsQuery =
    selectedProviderIds.length > 0 ? selectedProviderIds.join('|') : PROVIDER_IDS_QUERY;

  const isSearch = Boolean(query && query.trim() !== '');
  const genreNames = (searchParams.get('genre') || '')
    .split('|')
    .map((name) => name.trim())
    .filter(Boolean);

  const genreNameToId = new Map(
    Object.entries(TMDB_GENRES).map(([id, name]) => [name.toLocaleLowerCase(), id])
  );

  const genreIds = Array.from(
    new Set(
      genreNames
        .map((name) => genreNameToId.get(name.toLocaleLowerCase()))
        .filter((id): id is string => Boolean(id))
    )
  );

  if (genreIds.length !== new Set(genreNames.map((name) => name.toLocaleLowerCase())).size) {
    return NextResponse.json({ error: 'Onbekend filmgenre' }, { status: 400 });
  }

  if (similarToParam && (!Number.isSafeInteger(similarToId) || (similarToId || 0) <= 0)) {
    return NextResponse.json({ error: 'Ongeldig filmnummer' }, { status: 400 });
  }

  try {
    if (peopleQuery) {
      const peopleUrl =
        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}` +
        `&language=nl-NL&query=${encodeURIComponent(peopleQuery)}&include_adult=false`;
      const peopleResponse = await fetchWithTimeout(peopleUrl, {
        next: { revalidate: 3600 },
      });

      if (!peopleResponse.ok) {
        return NextResponse.json(
          { error: 'Personen konden niet worden opgehaald' },
          { status: peopleResponse.status }
        );
      }

      const peopleData = await peopleResponse.json();
      const people = (peopleData.results || [])
        .filter((person: any) =>
          ['Acting', 'Directing'].includes(person.known_for_department)
        )
        .slice(0, 8)
        .map((person: any) => ({
          id: person.id,
          name: person.name,
          known_for_department: person.known_for_department,
          profile_path: person.profile_path,
        }));

      return NextResponse.json({ people });
    }

    const metadataIds = searchParams.get('metadataIds');

    if (metadataIds) {
      const ids = Array.from(
        new Set(
          metadataIds
            .split(',')
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isSafeInteger(id) && id > 0)
        )
      ).slice(0, 25);

      const cachedMap = new Map<number, any>();

      if (supabase && ids.length > 0) {
        try {
          const { data } = await supabase
            .from('cached_movies')
            .select('*')
            .in('id', ids);

          (data || []).forEach((row: any) => {
            if (!row.imdb_id) return;

            const providers = Array.isArray(row.providers) ? row.providers : [];
            const updatedAt = Date.parse(row.updated_at || '');
            const cacheIsFresh =
              Number.isFinite(updatedAt) &&
              Date.now() - updatedAt < 24 * 60 * 60 * 1000;

            if (providers.length > 0 && cacheIsFresh) {
              cachedMap.set(row.id, {
                ...row,
                cast: row.cast_members || [],
                providers,
              });
            }
          });
        } catch {
          // Continue with TMDb if the database cache is unavailable.
        }
      }

      const missingIds = ids.filter((id) => !cachedMap.has(id));
      const fetchedMovies = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const [detailsResponse, providerResponse] = await Promise.all([
              fetchWithTimeout(
                `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=nl-NL&append_to_response=credits,external_ids`,
                { next: { revalidate: 3600 } }
              ),
              fetchWithTimeout(
                `https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${apiKey}`,
                { next: { revalidate: 86400 } },
                2500
              ).catch(() => null),
            ]);

            if (!detailsResponse.ok) return null;

            const details = await detailsResponse.json();
            const providerData = providerResponse?.ok
              ? await providerResponse.json()
              : null;
            const dutchFlatrateProviders: any[] =
              providerData?.results?.NL?.flatrate || [];
            const providerMap = new Map<string, Provider>();

            dutchFlatrateProviders.forEach((provider) => {
              const canonicalName = TARGET_PROVIDERS[provider.provider_id];

              if (canonicalName && !providerMap.has(canonicalName)) {
                providerMap.set(canonicalName, {
                  provider_id: provider.provider_id,
                  provider_name: canonicalName,
                  logo_path: provider.logo_path,
                });
              }
            });

            const director = details.credits?.crew?.find(
              (person: any) => person.job === 'Director'
            )?.name;
            const imdbId = details.external_ids?.imdb_id || details.imdb_id || null;
            const imdbRating =
              imdbId && omdbKey ? await getImdbRating(imdbId, omdbKey) : null;
            const rating = imdbRating || formatTmdbRating(details.vote_average);
            const cast = (details.credits?.cast || [])
              .slice(0, 8)
              .map((person: any) => person.name);
            const genres = (details.genres || []).map((genre: any) => genre.name);
            const providers = Array.from(providerMap.values());

            const movie = {
              id: details.id,
              imdb_id: imdbId,
              title: details.title,
              overview: details.overview || '',
              poster_path: details.poster_path || '',
              backdrop_path: details.backdrop_path || '',
              genres,
              director,
              cast,
              runtime_minutes: details.runtime || null,
              release_date: details.release_date || '',
              rating,
              rating_source: imdbRating ? 'IMDb' : rating ? 'TMDb' : null,
              providers,
            };

            if (supabase) {
              void supabase
                .from('cached_movies')
                .upsert({
                  id: movie.id,
                  imdb_id: movie.imdb_id,
                  title: movie.title,
                  overview: movie.overview,
                  poster_path: movie.poster_path,
                  backdrop_path: movie.backdrop_path,
                  release_date: movie.release_date,
                  runtime_minutes: movie.runtime_minutes,
                  genres: movie.genres,
                  director: movie.director,
                  cast_members: movie.cast,
                  rating: movie.rating,
                  rating_source: movie.rating_source,
                  providers: movie.providers,
                  updated_at: new Date().toISOString(),
                })
                .then();
            }

            return movie;
          } catch {
            return null;
          }
        })
      );

      fetchedMovies
        .filter((movie): movie is NonNullable<typeof movie> => movie !== null)
        .forEach((movie) => cachedMap.set(movie.id, movie));

      const resultList = ids
        .map((id) => cachedMap.get(id))
        .filter((movie) => movie !== undefined && movie !== null);

      return NextResponse.json({ movies: resultList });
    }

    let rawMovies: any[] = [];
    let totalPages = 1;

    if (nowPlaying) {
      const cinemaUrl =
        `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}` +
        `&language=en-US&region=NL&page=${page}`;
      const cinemaResponse = await fetchWithTimeout(cinemaUrl, {
        next: { revalidate: 1800 },
      });

      if (!cinemaResponse.ok) {
        return NextResponse.json(
          { error: 'Bioscoopfilms konden niet worden opgehaald' },
          { status: cinemaResponse.status }
        );
      }

      const cinemaData = await cinemaResponse.json();
      rawMovies = cinemaData.results || [];
      totalPages = cinemaData.total_pages || 1;
    } else if (personId) {
      const creditsUrl =
        `https://api.themoviedb.org/3/person/${encodeURIComponent(personId)}/movie_credits` +
        `?api_key=${apiKey}&language=en-US`;
      const creditsResponse = await fetchWithTimeout(creditsUrl, {
        next: { revalidate: 3600 },
      });

      if (!creditsResponse.ok) {
        return NextResponse.json(
          { error: 'Films van deze persoon konden niet worden opgehaald' },
          { status: creditsResponse.status }
        );
      }

      const creditsData = await creditsResponse.json();
      const credits = [
        ...(creditsData.cast || []),
        ...(creditsData.crew || []).filter(
          (credit: any) => credit.job === 'Director'
        ),
      ];
      const uniqueCredits = new Map<number, any>();

      credits.forEach((credit: any) => {
        if (!uniqueCredits.has(credit.id)) {
          uniqueCredits.set(credit.id, credit);
        }
      });

      rawMovies = Array.from(uniqueCredits.values())
        .sort((first, second) => (second.popularity || 0) - (first.popularity || 0))
        .slice(0, 25);
    } else if (isSearch) {
      const searchUrl =
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}` +
        `&language=en-US&query=${encodeURIComponent(query!.trim())}` +
        `&page=${page}&include_adult=false`;
      const searchResponse = await fetchWithTimeout(searchUrl, {
        next: { revalidate: 600 },
      });

      if (!searchResponse.ok) {
        return NextResponse.json(
          { error: 'Zoekresultaten konden niet worden opgehaald' },
          { status: searchResponse.status }
        );
      }

      const searchData = await searchResponse.json();
      rawMovies = searchData.results || [];
      totalPages = searchData.total_pages || 1;
    } else if (genreIds.length > 0) {
      const discoverUrl =
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}` +
        `&language=en-US&sort_by=popularity.desc&watch_region=NL` +
        `&with_watch_providers=${providerIdsQuery}` +
        `&with_watch_monetization_types=flatrate` +
        `&with_genres=${genreIds.join('|')}&page=${page}&include_adult=false`;
      const discoverResponse = await fetchWithTimeout(discoverUrl, {
        next: { revalidate: 3600 },
      });

      if (!discoverResponse.ok) {
        return NextResponse.json(
          { error: 'Films binnen dit genre konden niet worden opgehaald' },
          { status: discoverResponse.status }
        );
      }

      const discoverData = await discoverResponse.json();
      rawMovies = discoverData.results || [];
      totalPages = discoverData.total_pages || 1;
    } else if (similarToId) {
      const recommendationsUrl =
        `https://api.themoviedb.org/3/movie/${similarToId}/recommendations` +
        `?api_key=${apiKey}&language=en-US&page=${page}`;
      const recommendationsResponse = await fetchWithTimeout(recommendationsUrl, {
        next: { revalidate: 3600 },
      });

      if (!recommendationsResponse.ok) {
        return NextResponse.json(
          { error: 'Vergelijkbare films konden niet worden opgehaald' },
          { status: recommendationsResponse.status }
        );
      }

      const recommendationsData = await recommendationsResponse.json();
      rawMovies = recommendationsData.results || [];
      totalPages = recommendationsData.total_pages || 1;
    } else {
      const discoverUrl =
        `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}` +
        `&language=en-US&sort_by=popularity.desc&watch_region=NL` +
        `&with_watch_providers=${providerIdsQuery}` +
        `&with_watch_monetization_types=flatrate&page=${page}&include_adult=false`;
      const discoverResponse = await fetchWithTimeout(discoverUrl, {
        next: { revalidate: 3600 },
      });

      if (!discoverResponse.ok) {
        return NextResponse.json(
          { error: 'Films konden niet worden opgehaald' },
          { status: discoverResponse.status }
        );
      }

      const discoverData = await discoverResponse.json();
      rawMovies = discoverData.results || [];
      totalPages = discoverData.total_pages || 1;
    }

    const movieIds = rawMovies.map((movie: any) => movie.id);
    const cachedMoviesMap = new Map<number, any>();

    if (supabase && movieIds.length > 0) {
      try {
        const { data: dbMovies } = await supabase
          .from('cached_movies')
          .select('*')
          .in('id', movieIds);

        (dbMovies || []).forEach((row: any) => {
          const providersList = Array.isArray(row.providers) ? row.providers : [];

          if (row.imdb_id && (nowPlaying || providersList.length > 0)) {
            cachedMoviesMap.set(row.id, {
              id: row.id,
              imdb_id: row.imdb_id,
              title: row.title,
              overview: row.overview || '',
              poster_path: row.poster_path || '',
              backdrop_path: row.backdrop_path || '',
              release_date: row.release_date || '',
              runtime_minutes: row.runtime_minutes,
              genres: row.genres || [],
              director: row.director,
              cast: row.cast_members || [],
              rating: row.rating,
              rating_source: row.rating_source,
              providers: providersList,
            });
          }
        });
      } catch (error) {
        console.warn('Fout bij het uitlezen van cached_movies:', error);
      }
    }

    const enrichedMovies = await Promise.all(
      rawMovies.map(async (movie: any) => {
        if (cachedMoviesMap.has(movie.id)) {
          const cachedMovie = cachedMoviesMap.get(movie.id);
          return { ...cachedMovie, title: movie.title || cachedMovie.title };
        }

        try {
          const [providerResponse, externalIdsResponse, detailsResponse] =
            await Promise.all([
              fetchWithTimeout(
                `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`,
                { next: { revalidate: 86400 } },
                2500
              ).catch(() => null),
              fetchWithTimeout(
                `https://api.themoviedb.org/3/movie/${movie.id}/external_ids?api_key=${apiKey}`,
                { next: { revalidate: 86400 } },
                2500
              ).catch(() => null),
              fetchWithTimeout(
                `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}&language=nl-NL&append_to_response=credits`,
                { next: { revalidate: 3600 } },
                2500
              ).catch(() => null),
            ]);

          const providerData = providerResponse?.ok
            ? await providerResponse.json()
            : null;
          const externalIdsData = externalIdsResponse?.ok
            ? await externalIdsResponse.json()
            : null;
          const detailsData = detailsResponse?.ok
            ? await detailsResponse.json()
            : null;
          const dutchFlatrateProviders: any[] =
            providerData?.results?.NL?.flatrate || [];
          const providerMap = new Map<string, Provider>();

          dutchFlatrateProviders.forEach((provider) => {
            const canonicalName = TARGET_PROVIDERS[provider.provider_id];

            if (canonicalName && !providerMap.has(canonicalName)) {
              providerMap.set(canonicalName, {
                provider_id: provider.provider_id,
                provider_name: canonicalName,
                logo_path: provider.logo_path,
              });
            }
          });

          const imdbId = externalIdsData?.imdb_id || detailsData?.imdb_id || null;
          let realImdbRating: string | null = null;

          if (imdbId && omdbKey) {
            realImdbRating = await getImdbRating(imdbId, omdbKey);
          }

          const rating =
            realImdbRating ||
            formatTmdbRating(detailsData?.vote_average ?? movie.vote_average);
          const genres =
            detailsData?.genres?.map((genre: any) => genre.name) ||
            (movie.genre_ids || [])
              .map((id: number) => TMDB_GENRES[id])
              .filter(Boolean);
          const director =
            detailsData?.credits?.crew?.find(
              (person: any) => person.job === 'Director'
            )?.name || null;
          const cast = (detailsData?.credits?.cast || [])
            .slice(0, 8)
            .map((person: any) => person.name);
          const providers = Array.from(providerMap.values());

          const newMovie = {
            id: movie.id,
            imdb_id: imdbId,
            title: movie.title || detailsData?.title,
            overview: detailsData?.overview || movie.overview || '',
            poster_path: detailsData?.poster_path || movie.poster_path || '',
            backdrop_path: detailsData?.backdrop_path || movie.backdrop_path || '',
            release_date: detailsData?.release_date || movie.release_date || '',
            runtime_minutes: detailsData?.runtime || null,
            genres,
            director,
            cast,
            rating,
            rating_source: realImdbRating ? 'IMDb' : rating ? 'TMDb' : null,
            providers,
          };

          if (supabase) {
            void supabase
              .from('cached_movies')
              .upsert({
                id: newMovie.id,
                imdb_id: newMovie.imdb_id,
                title: newMovie.title,
                overview: newMovie.overview,
                poster_path: newMovie.poster_path,
                backdrop_path: newMovie.backdrop_path,
                release_date: newMovie.release_date,
                runtime_minutes: newMovie.runtime_minutes,
                genres: newMovie.genres,
                director: newMovie.director,
                cast_members: newMovie.cast,
                rating: newMovie.rating,
                rating_source: newMovie.rating_source,
                providers: newMovie.providers,
                updated_at: new Date().toISOString(),
              })
              .then();
          }

          return newMovie;
        } catch {
          const rating = formatTmdbRating(movie.vote_average);

          return {
            id: movie.id,
            title: movie.title,
            overview: movie.overview || '',
            poster_path: movie.poster_path || '',
            release_date: movie.release_date || '',
            genres: (movie.genre_ids || [])
              .map((id: number) => TMDB_GENRES[id])
              .filter(Boolean),
            rating,
            rating_source: rating ? 'TMDb' : null,
            providers: [],
          };
        }
      })
    );

    const finalMovies = nowPlaying
      ? enrichedMovies
      : enrichedMovies.filter((movie) => {
          if (!selectedProviderNames || selectedProviderNames.size === 0) {
            return movie.providers && movie.providers.length > 0;
          }

          return movie.providers?.some((provider: any) =>
            selectedProviderNames.has(provider.provider_name)
          );
        });

    return NextResponse.json({
      page: Number(page),
      totalPages,
      movies: finalMovies,
    });
  } catch {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}