import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
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
    } catch {}
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
      
      if (data.imdbRating && data.imdbRating !== 'N/A') {
        const ratingStr = String(data.imdbRating);
        const ratingNum = Number.parseFloat(ratingStr);

        if (supabase && Number.isFinite(ratingNum)) {
          void supabase
            .from('movie_imdb_cache')
            .upsert({ imdb_id: imdbId, imdb_rating: ratingNum })
            .then();
        }

        return ratingStr;
      }
      return null;
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
      const videosUrl = `https://api.themoviedb.org/3/movie/${encodeURIComponent(trailerMovieId)}/videos?api_key=${apiKey}`;
      const videosRes = await fetchWithTimeout(videosUrl, { next: { revalidate: 3600 } });
      const videosData = videosRes.ok ? await videosRes.json() : null;

      const videos = (videosData?.results || []) as Array<{
        site?: string;
        type?: string;
        key?: string;
        official?: boolean;
        iso_639_1?: string;
      }>;

      const ytVideos = videos.filter(
        (v) => v.site?.toLowerCase() === 'youtube' && Boolean(v.key)
      );

      const trailer =
        ytVideos.find((v) => v.type === 'Trailer' && v.official && v.iso_639_1 === 'nl') ||
        ytVideos.find((v) => v.type === 'Trailer' && v.official) ||
        ytVideos.find((v) => v.type === 'Trailer') ||
        ytVideos.find((v) => v.type === 'Teaser') ||
        ytVideos[0];

      return NextResponse.json({ youtubeKey: trailer?.key ?? null });
    } catch {
      return NextResponse.json({ error: 'Fout bij het ophalen van de trailer' }, { status: 500 });
    }
  }

  const page = searchParams.get('page') || '1';
  const query = searchParams.get('query');
  const peopleQuery = searchParams.get('people')?.trim();
  const personId = searchParams.get('personId');
  const genreName = searchParams.get('genre')?.trim();
  const similarToParam = searchParams.get('similarTo');
  const similarToId = similarToParam ? Number.parseInt(similarToParam, 10) : null;
  const isRailRequest = searchParams.get('rail') === '1';
  const nowPlaying = searchParams.get('nowPlaying') === 'true';

  const providersParam = searchParams.get('providers');
  const selectedProviderNames = providersParam ? new Set(providersParam.split(',').filter(Boolean)) : null;
  const selectedProviderIds = selectedProviderNames
    ? Object.entries(TARGET_PROVIDERS)
        .filter(([, providerName]) => selectedProviderNames.has(providerName))
        .map(([providerId]) => providerId)
    : [];
  const providerIdsQuery = selectedProviderIds.length > 0 ? selectedProviderIds.join('|') : PROVIDER_IDS_QUERY;
  const isSearch = Boolean(query && query.trim() !== '');
  const genreId = genreName
    ? Object.entries(TMDB_GENRES).find(([, name]) => name.toLocaleLowerCase() === genreName.toLocaleLowerCase())?.[0]
    : null;

  if (genreName && !genreId) {
    return NextResponse.json({ error: 'Onbekend filmgenre' }, { status: 400 });
  }

  if (similarToParam && (!Number.isSafeInteger(similarToId) || (similarToId || 0) <= 0)) {
    return NextResponse.json({ error: 'Ongeldig filmnummer' }, { status: 400 });
  }

  try {
    if (peopleQuery) {
      const peopleUrl = `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&language=nl-NL&query=${encodeURIComponent(peopleQuery)}&include_adult=false`;
      const peopleResponse = await fetchWithTimeout(peopleUrl, { next: { revalidate: 3600 } });
      if (!peopleResponse.ok) {
        return NextResponse.json({ error: 'Personen konden niet worden opgehaald' }, { status: peopleResponse.status });
      }

      const peopleData = await peopleResponse.json();
      const people = (peopleData.results || [])
        .filter((person: any) => ['Acting', 'Directing'].includes(person.known_for_department))
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
      const ids = Array.from(new Set(metadataIds.split(',')
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isSafeInteger(id) && id > 0)))
        .slice(0, 20);
      const metadataMovies = await Promise.all(ids.map(async (id) => {
        try {
          const detailsUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=nl-NL&append_to_response=credits,external_ids`;
          const response = await fetchWithTimeout(detailsUrl, { next: { revalidate: 3600 } });
          if (!response.ok) return null;
          const details = await response.json();
          const director = details.credits?.crew?.find((person: any) => person.job === 'Director')?.name;
          const imdbId = details.external_ids?.imdb_id || details.imdb_id;
          const imdbRating = imdbId && omdbKey ? await getImdbRating(imdbId, omdbKey) : null;
          const rating = imdbRating || formatTmdbRating(details.vote_average);
          return {
            id: details.id,
            title: details.title,
            overview: details.overview || '',
            poster_path: details.poster_path || '',
            backdrop_path: details.backdrop_path || '',
            genres: (details.genres || []).map((genre: any) => genre.name),
            director,
            cast: (details.credits?.cast || []).slice(0, 8).map((person: any) => person.name),
            runtime_minutes: details.runtime || null,
            release_date: details.release_date || '',
            rating,
            rating_source: imdbRating ? 'IMDb' : rating ? 'TMDb' : null,
          };
        } catch {
          return null;
        }
      }));

      return NextResponse.json({ movies: metadataMovies.filter(Boolean) });
    }

    let rawMovies: any[] = [];
    let totalPages = 1;

    if (nowPlaying) {
      const cinemaUrl = `https://api.themoviedb.org/3/movie/now_playing?api_key=${apiKey}&language=nl-NL&region=NL&page=${page}`;
      const cinemaRes = await fetchWithTimeout(cinemaUrl, { next: { revalidate: 1800 } });
      if (!cinemaRes.ok) {
        return NextResponse.json({ error: 'Bioscoopfilms konden niet worden opgehaald' }, { status: cinemaRes.status });
      }
      const cinemaData = await cinemaRes.json();
      rawMovies = cinemaData.results || [];
      totalPages = cinemaData.total_pages || 1;
    } else if (personId) {
      const creditsUrl = `https://api.themoviedb.org/3/person/${encodeURIComponent(personId)}/movie_credits?api_key=${apiKey}&language=nl-NL`;
      const creditsResponse = await fetchWithTimeout(creditsUrl, { next: { revalidate: 3600 } });
      if (!creditsResponse.ok) {
        return NextResponse.json({ error: 'Films van deze persoon konden niet worden opgehaald' }, { status: creditsResponse.status });
      }

      const creditsData = await creditsResponse.json();
      const credits = [
        ...(creditsData.cast || []),
        ...(creditsData.crew || []).filter((credit: any) => credit.job === 'Director'),
      ];
      const uniqueCredits = new Map<number, any>();
      credits.forEach((credit: any) => {
        if (!uniqueCredits.has(credit.id)) uniqueCredits.set(credit.id, credit);
      });
      rawMovies = Array.from(uniqueCredits.values())
        .sort((first, second) => (second.popularity || 0) - (first.popularity || 0))
        .slice(0, 20);
    } else if (isSearch) {
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=nl-NL&query=${encodeURIComponent(
        query!.trim()
      )}&page=${page}&include_adult=false`;
      const searchRes = await fetchWithTimeout(searchUrl, { next: { revalidate: 600 } });
      if (!searchRes.ok) {
        return NextResponse.json({ error: 'Zoekresultaten konden niet worden opgehaald' }, { status: searchRes.status });
      }
      const searchData = await searchRes.json();
      rawMovies = searchData.results || [];
      totalPages = searchData.total_pages || 1;
    } else if (genreId) {
      const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=nl-NL&sort_by=popularity.desc&watch_region=NL&with_watch_providers=${providerIdsQuery}&with_watch_monetization_types=flatrate&with_genres=${genreId}&page=${page}&include_adult=false`;
      const discoverRes = await fetchWithTimeout(discoverUrl, { next: { revalidate: 3600 } });
      if (!discoverRes.ok) {
        return NextResponse.json({ error: 'Films binnen dit genre konden niet worden opgehaald' }, { status: discoverRes.status });
      }
      const discoverData = await discoverRes.json();
      rawMovies = discoverData.results || [];
      totalPages = discoverData.total_pages || 1;
    } else if (similarToId) {
      const recommendationsUrl = `https://api.themoviedb.org/3/movie/${similarToId}/recommendations?api_key=${apiKey}&language=nl-NL&page=${page}`;
      const recommendationsRes = await fetchWithTimeout(recommendationsUrl, { next: { revalidate: 3600 } });
      if (!recommendationsRes.ok) {
        return NextResponse.json({ error: 'Vergelijkbare films konden niet worden opgehaald' }, { status: recommendationsRes.status });
      }
      const recommendationsData = await recommendationsRes.json();
      rawMovies = recommendationsData.results || [];
      totalPages = recommendationsData.total_pages || 1;
    } else {
      const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=nl-NL&sort_by=popularity.desc&watch_region=NL&with_watch_providers=${providerIdsQuery}&with_watch_monetization_types=flatrate&page=${page}&include_adult=false`;
      const discoverRes = await fetchWithTimeout(discoverUrl, { next: { revalidate: 3600 } });
      if (!discoverRes.ok) {
        return NextResponse.json({ error: 'Films konden niet worden opgehaald' }, { status: discoverRes.status });
      }
      const discoverData = await discoverRes.json();
      rawMovies = discoverData.results || [];
      totalPages = discoverData.total_pages || 1;
    }

    if (isRailRequest) {
      const railMovies = await Promise.all(rawMovies.slice(0, 16).map(async (movie: any) => {
        try {
          const providerRes = await fetchWithTimeout(
            `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`,
            { next: { revalidate: 86400 } },
            2000
          );
          const providerData = providerRes.ok ? await providerRes.json() : null;
          const providerMap = new Map<string, Provider>();
          (providerData?.results?.NL?.flatrate || []).forEach((provider: any) => {
            const providerName = TARGET_PROVIDERS[provider.provider_id];
            if (providerName && (!selectedProviderNames || selectedProviderNames.has(providerName)) && !providerMap.has(providerName)) {
              providerMap.set(providerName, {
                provider_id: provider.provider_id,
                provider_name: providerName,
                logo_path: provider.logo_path,
              });
            }
          });

          const rating = formatTmdbRating(movie.vote_average);

          return {
            id: movie.id,
            title: movie.title,
            overview: movie.overview || '',
            poster_path: movie.poster_path || '',
            backdrop_path: movie.backdrop_path || '',
            release_date: movie.release_date || '',
            genres: (movie.genre_ids || []).map((id: number) => TMDB_GENRES[id]).filter(Boolean),
            rating,
            rating_source: rating ? 'TMDb' : null,
            providers: Array.from(providerMap.values()),
          };
        } catch {
          return null;
        }
      }));

      const validRailMovies = railMovies.filter(Boolean) as any[];

      return NextResponse.json({
        page: Number(page),
        totalPages,
        movies: nowPlaying ? validRailMovies : validRailMovies.filter((movie) => movie.providers.length > 0),
      });
    }

    const moviesWithDetails = await Promise.all(
      rawMovies.slice(0, 16).map(async (movie: any) => {
        try {
          const [providerRes, detailsRes] = await Promise.all([
            fetchWithTimeout(
              `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`,
              { next: { revalidate: 86400 } },
              2500
            ).catch(() => null),
            fetchWithTimeout(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}&language=nl-NL&append_to_response=credits,external_ids`,
              { next: { revalidate: 3600 } },
              2500
            ).catch(() => null),
          ]);

          const providerData = providerRes?.ok ? await providerRes.json() : null;
          const detailsData = detailsRes?.ok ? await detailsRes.json() : null;

          const nlFlatrate: any[] = providerData?.results?.NL?.flatrate || [];
          const providerMap = new Map<string, Provider>();
          nlFlatrate.forEach((p) => {
            const canonicalName = TARGET_PROVIDERS[p.provider_id];
            if (canonicalName && !providerMap.has(canonicalName)) {
              providerMap.set(canonicalName, {
                provider_id: p.provider_id,
                provider_name: canonicalName,
                logo_path: p.logo_path,
              });
            }
          });

          const imdbId = detailsData?.external_ids?.imdb_id || detailsData?.imdb_id;
          let realImdbRating: string | null = null;
          if (imdbId && omdbKey) realImdbRating = await getImdbRating(imdbId, omdbKey);
          const rating = realImdbRating || formatTmdbRating(detailsData?.vote_average ?? movie.vote_average);

          return {
            id: movie.id,
            imdb_id: imdbId,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            release_date: detailsData?.release_date || movie.release_date,
            genres: detailsData?.genres?.map((genre: any) => genre.name) || (movie.genre_ids || []).map((id: number) => TMDB_GENRES[id]).filter(Boolean),
            director: detailsData?.credits?.crew?.find((person: any) => person.job === 'Director')?.name,
            cast: (detailsData?.credits?.cast || []).slice(0, 8).map((person: any) => person.name),
            runtime_minutes: detailsData?.runtime || null,
            rating,
            rating_source: realImdbRating ? 'IMDb' : rating ? 'TMDb' : null,
            providers: Array.from(providerMap.values()),
          };
        } catch {
          const rating = formatTmdbRating(movie.vote_average);
          return {
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            genres: (movie.genre_ids || []).map((id: number) => TMDB_GENRES[id]).filter(Boolean),
            rating,
            rating_source: rating ? 'TMDb' : null,
            providers: [],
          };
        }
      })
    );

    const finalMovies = nowPlaying
      ? moviesWithDetails
      : moviesWithDetails.filter((movie) => movie.providers.length > 0);

    return NextResponse.json({
      page: Number(page),
      totalPages,
      movies: finalMovies,
    });
  } catch {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}