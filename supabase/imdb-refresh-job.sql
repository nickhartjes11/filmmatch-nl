alter table public.cached_movies
  add column if not exists imdb_last_checked_at timestamptz;

create or replace function public.claim_imdb_refresh_batch()
returns table (imdb_id text, rating text, rating_source text)
language sql
set search_path = ''
as $$
  with candidates as (
    select m.id
    from public.cached_movies m
    left join public.movie_imdb_cache c on c.imdb_id = m.imdb_id
    where m.imdb_id ~ '^tt[0-9]+$'
      and (m.imdb_last_checked_at is null or m.imdb_last_checked_at <= now() - interval '2 days')
      and (c.imdb_fetched_at is null or c.imdb_fetched_at <= now() - interval '2 days')
    order by
      case when coalesce(c.imdb_rating, 0) > 0 or m.rating_source = 'IMDb' then 1 else 0 end,
      m.imdb_last_checked_at asc nulls first,
      m.release_date desc nulls last,
      m.id
    limit 60
    for update of m skip locked
  )
  update public.cached_movies m
  set imdb_last_checked_at = now()
  from candidates
  where m.id = candidates.id
  returning m.imdb_id::text, m.rating::text, m.rating_source::text
$$;

revoke execute on function public.claim_imdb_refresh_batch() from public, anon, authenticated;
grant execute on function public.claim_imdb_refresh_batch() to service_role;
