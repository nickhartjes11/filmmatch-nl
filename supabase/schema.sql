create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  streaming_services text[] not null default '{}',
  favorite_movie_ids bigint[] not null default '{}',
  preferred_genres text[] not null default '{}',
  release_year_before integer,
  max_runtime_minutes integer,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists release_year_before integer,
  add column if not exists max_runtime_minutes integer;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select, insert, update on public.profiles to authenticated;

create table if not exists public.movie_ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  movie_id bigint not null,
  rating numeric(3, 1) not null check (
    rating >= 1 and rating <= 10 and rating * 2 = trunc(rating * 2)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

alter table public.movie_ratings enable row level security;

drop policy if exists "Users can read their own movie ratings" on public.movie_ratings;
create policy "Users can read their own movie ratings"
  on public.movie_ratings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own movie ratings" on public.movie_ratings;
create policy "Users can create their own movie ratings"
  on public.movie_ratings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own movie ratings" on public.movie_ratings;
create policy "Users can update their own movie ratings"
  on public.movie_ratings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own movie ratings" on public.movie_ratings;
create policy "Users can delete their own movie ratings"
  on public.movie_ratings for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.movie_ratings to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_movie_rating_updated_at on public.movie_ratings;
create trigger set_movie_rating_updated_at
  before update on public.movie_ratings
  for each row execute procedure public.set_profile_updated_at();
