import { NextResponse } from 'next/server';

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

const imdbRatingCache = new Map<string, { rating: string | null; expiresAt: number }>();
const pendingImdbRatings = new Map<string, Promise<string | null>>();

async function getImdbRating(imdbId: string, apiKey: string): Promise<string | null> {
  const cached = imdbRatingCache.get(imdbId);
  if (cached && cached.expiresAt > Date.now()) return cached.rating;

  const pending = pendingImdbRatings.get(imdbId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`, { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      return data.imdbRating && data.imdbRating !== 'N/A' ? String(data.imdbRating) : null;
    } catch {
      return null;
    }
  })();

  pendingImdbRatings.set(imdbId, request);
  const rating = await request;
  pendingImdbRatings.delete(imdbId);
  imdbRatingCache.set(imdbId, {
    rating,
    expiresAt: Date.now() + (rating ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000),
  });
  return rating;
}

export async function GET(request: Request) {
  const apiKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY ontbreekt' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const query = searchParams.get('query');
  const peopleQuery = searchParams.get('people')?.trim();
  const personId = searchParams.get('personId');
  const genreName = searchParams.get('genre')?.trim();
  const similarToParam = searchParams.get('similarTo');
  const similarToId = similarToParam ? Number.parseInt(similarToParam, 10) : null;
  const isRailRequest = searchParams.get('rail') === '1';
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
      const peopleResponse = await fetch(peopleUrl, { cache: 'no-store' });
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
        .slice(0, 40);
      const metadataMovies = await Promise.all(ids.map(async (id) => {
        const detailsUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=nl-NL&append_to_response=credits,external_ids`;
        const response = await fetch(detailsUrl, { cache: 'no-store' });
        if (!response.ok) return null;
        const details = await response.json();
        const director = details.credits?.crew?.find((person: any) => person.job === 'Director')?.name;
        const imdbId = details.external_ids?.imdb_id || details.imdb_id;
        const rating = imdbId && omdbKey ? await getImdbRating(imdbId, omdbKey) : null;
        return {
          id: details.id,
          title: details.title,
          overview: details.overview || '',
          poster_path: details.poster_path || '',
          backdrop_path: details.backdrop_path || '',
          genres: (details.genres || []).map((genre: any) => genre.name),
          director,
          cast: (details.credits?.cast || []).slice(0, 10).map((person: any) => person.name),
          runtime_minutes: details.runtime || null,
          release_date: details.release_date || '',
          rating,
          rating_source: rating ? 'IMDb' : null,
        };
      }));

      return NextResponse.json({ movies: metadataMovies.filter(Boolean) });
    }

    if (!omdbKey) {
      return NextResponse.json({ error: 'OMDB_API_KEY ontbreekt; echte IMDb-scores zijn niet beschikbaar.' }, { status: 503 });
    }

    let rawMovies: any[] = [];
    let totalPages = 1;

    if (personId) {
      const creditsUrl = `https://api.themoviedb.org/3/person/${encodeURIComponent(personId)}/movie_credits?api_key=${apiKey}&language=nl-NL`;
      const creditsResponse = await fetch(creditsUrl, { cache: 'no-store' });
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
      // Zoek in de volledige wereldwijde database
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=nl-NL&query=${encodeURIComponent(
        query!.trim()
      )}&page=${page}&include_adult=false`;
      const searchRes = await fetch(searchUrl, { cache: 'no-store' });
      if (!searchRes.ok) {
        return NextResponse.json({ error: 'Zoekresultaten konden niet worden opgehaald' }, { status: searchRes.status });
      }
      const searchData = await searchRes.json();
      rawMovies = searchData.results || [];
      totalPages = searchData.total_pages || 1;
    } else if (genreId) {
      const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=nl-NL&sort_by=popularity.desc&watch_region=NL&with_watch_providers=${providerIdsQuery}&with_watch_monetization_types=flatrate&with_genres=${genreId}&page=${page}&include_adult=false`;
      const discoverRes = await fetch(discoverUrl, { cache: 'no-store' });
      if (!discoverRes.ok) {
        return NextResponse.json({ error: 'Films binnen dit genre konden niet worden opgehaald' }, { status: discoverRes.status });
      }
      const discoverData = await discoverRes.json();
      rawMovies = discoverData.results || [];
      totalPages = discoverData.total_pages || 1;
    } else if (similarToId) {
      const recommendationsUrl = `https://api.themoviedb.org/3/movie/${similarToId}/recommendations?api_key=${apiKey}&language=nl-NL&page=${page}`;
      const recommendationsRes = await fetch(recommendationsUrl, { cache: 'no-store' });
      if (!recommendationsRes.ok) {
        return NextResponse.json({ error: 'Vergelijkbare films konden niet worden opgehaald' }, { status: recommendationsRes.status });
      }
      const recommendationsData = await recommendationsRes.json();
      rawMovies = recommendationsData.results || [];
      totalPages = recommendationsData.total_pages || 1;
    } else {
      // Standaard homepage: populaire titels op de 5 diensten
      const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&language=nl-NL&sort_by=popularity.desc&watch_region=NL&with_watch_providers=${providerIdsQuery}&with_watch_monetization_types=flatrate&page=${page}&include_adult=false`;
      const discoverRes = await fetch(discoverUrl, { cache: 'no-store' });
      if (!discoverRes.ok) {
        return NextResponse.json({ error: 'Films konden niet worden opgehaald' }, { status: discoverRes.status });
      }
      const discoverData = await discoverRes.json();
      rawMovies = discoverData.results || [];
      totalPages = discoverData.total_pages || 1;
    }

    if (isRailRequest) {
      const railMovies = await Promise.all(rawMovies.slice(0, 20).map(async (movie: any) => {
        const providerRequest = fetch(
          `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`,
          { cache: 'no-store' }
        );
        const externalRequest = fetch(`https://api.themoviedb.org/3/movie/${movie.id}/external_ids?api_key=${apiKey}`, { cache: 'no-store' });
        const [providerRes, externalRes] = await Promise.all([
          providerRequest,
          externalRequest,
        ]);
        const providerData = providerRes.ok ? await providerRes.json() : null;
        const externalData = externalRes?.ok ? await externalRes.json() : null;
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

        let rating: string | null = null;
        let ratingSource: 'IMDb' | null = null;
        const imdbId = externalData?.imdb_id;
        if (imdbId && omdbKey) {
          rating = await getImdbRating(imdbId, omdbKey);
          if (rating) ratingSource = 'IMDb';
        }

        return {
          id: movie.id,
          title: movie.title,
          overview: movie.overview || '',
          poster_path: movie.poster_path || '',
          backdrop_path: movie.backdrop_path || '',
          release_date: movie.release_date || '',
          genres: (movie.genre_ids || []).map((genreId: number) => TMDB_GENRES[genreId]).filter(Boolean),
          rating,
          rating_source: ratingSource,
          providers: Array.from(providerMap.values()),
        };
      }));

      return NextResponse.json({
        page: Number(page),
        totalPages,
        movies: railMovies.filter((movie) => movie.providers.length > 0),
      });
    }

    const moviesWithDetails = await Promise.all(
      rawMovies.slice(0, 20).map(async (movie: any) => {
        try {
          const [providerRes, detailsRes, externalRes] = await Promise.all([
            fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${apiKey}`,
              { cache: 'no-store' }
            ),
            fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}&language=nl-NL&append_to_response=credits`,
              { cache: 'no-store' }
            ),
            fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}/external_ids?api_key=${apiKey}`,
              { cache: 'no-store' }
            ),
          ]);

          const providerData = providerRes.ok ? await providerRes.json() : null;
          const detailsData = detailsRes.ok ? await detailsRes.json() : null;
          const externalData = externalRes.ok ? await externalRes.json() : null;

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

          const filteredProviders = Array.from(providerMap.values());
          const imdbId = externalData?.imdb_id;

          let realImdbRating: string | null = null;
          if (imdbId && omdbKey) realImdbRating = await getImdbRating(imdbId, omdbKey);

          return {
            id: movie.id,
            imdb_id: imdbId,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            release_date: detailsData?.release_date || movie.release_date,
            genres: detailsData?.genres?.map((genre: any) => genre.name) || (movie.genre_ids || []).map((genreId: number) => TMDB_GENRES[genreId]).filter(Boolean),
            director: detailsData?.credits?.crew?.find((person: any) => person.job === 'Director')?.name,
            cast: (detailsData?.credits?.cast || []).slice(0, 10).map((person: any) => person.name),
            runtime_minutes: detailsData?.runtime || null,
            rating: realImdbRating,
            rating_source: realImdbRating ? 'IMDb' : null,
            providers: filteredProviders,
          };
        } catch {
          return {
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            genres: (movie.genre_ids || []).map((genreId: number) => TMDB_GENRES[genreId]).filter(Boolean),
            rating: null,
            rating_source: null,
            providers: [],
          };
        }
      })
    );

    const finalMovies = moviesWithDetails.filter((movie) => movie.providers.length > 0);

    return NextResponse.json({
      page: Number(page),
      totalPages,
      movies: finalMovies,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}