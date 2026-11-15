import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getImdbRating } from '../../../../lib/imdbRatings';

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const omdbKey = process.env.OMDB_API_KEY;
  if (!url || !serviceKey || !omdbKey) {
    return NextResponse.json({ error: 'IMDb refresh is not configured' }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('claim_imdb_refresh_batch');
  if (error) {
    console.error('IMDb-batch ophalen mislukt:', error.message);
    return NextResponse.json({ error: 'IMDb batch unavailable' }, { status: 503 });
  }

  const rows: Array<{ imdb_id: string }> = data ?? [];
  const uniqueRows = [...new Map(rows.map((row) => [row.imdb_id, row])).values()];
  let updated = 0;
  let writeFailures = 0;
  for (let offset = 0; offset < uniqueRows.length; offset += 8) {
    await Promise.all(uniqueRows.slice(offset, offset + 8).map(async (row) => {
      const rating = await getImdbRating(supabase, row.imdb_id, omdbKey);
      if (!rating) return;
      const { error: writeError } = await supabase.from('cached_movies')
        .update({ rating, rating_source: 'IMDb' })
        .eq('imdb_id', row.imdb_id);
      if (writeError) {
        writeFailures += 1;
        console.error('IMDb-cijfer opslaan mislukt:', writeError.message);
        return;
      }
      updated += 1;
    }));
  }

  return NextResponse.json({ checked: uniqueRows.length, updated, writeFailures }, { status: writeFailures ? 502 : 200 });
}
