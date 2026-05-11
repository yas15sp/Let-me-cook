-- Run this in your Supabase SQL Editor

-- Users / profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  rank text not null default 'Gold Cook',
  rank_tier text not null default 'I',
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  global_rank integer,
  created_at timestamptz default now()
);

-- Onboarding answers (saved from AsyncStorage → DB after sign-up)
create table public.onboarding_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null unique,
  cooking_level text,
  cuisine_style text[],
  goal text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Cooks (each cook session submitted to the feed)
create table public.cooks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  dish_name text not null,
  event_id uuid,
  cook_time_secs integer not null,
  photo_urls text[] not null default '{}',
  video_url text,
  boosts text[] not null default '{}',
  xp_earned integer not null default 0,
  verified boolean not null default false,
  created_at timestamptz default now()
);

-- Votes (one per user per cook)
create table public.votes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  cook_id uuid references public.cooks on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, cook_id)
);

-- Events
create table public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  subtitle text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  xp_reward integer not null default 200,
  min_rank text,
  prize_label text,
  created_at timestamptz default now()
);

-- Duels
create table public.duels (
  id uuid default gen_random_uuid() primary key,
  challenger_id uuid references public.profiles on delete cascade not null,
  opponent_id uuid references public.profiles on delete cascade not null,
  status text not null default 'pending', -- pending | active | complete
  ends_at timestamptz,
  winner_id uuid references public.profiles,
  created_at timestamptz default now()
);

-- Row level security
alter table public.profiles enable row level security;
alter table public.onboarding_answers enable row level security;
alter table public.cooks enable row level security;
alter table public.votes enable row level security;
alter table public.events enable row level security;
alter table public.duels enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Onboarding: only owner
create policy "Users manage own onboarding" on public.onboarding_answers using (auth.uid() = user_id);

-- Cooks: anyone can read, only owner can insert/update/delete
create policy "Cooks are viewable by everyone" on public.cooks for select using (true);
create policy "Users can insert own cooks" on public.cooks for insert with check (auth.uid() = user_id);
create policy "Users can update own cooks" on public.cooks for update using (auth.uid() = user_id);

-- Votes: anyone can read, only owner can insert/delete
create policy "Votes are viewable by everyone" on public.votes for select using (true);
create policy "Users can vote" on public.votes for insert with check (auth.uid() = user_id);
create policy "Users can unvote" on public.votes for delete using (auth.uid() = user_id);

-- Events: anyone can read
create policy "Events are viewable by everyone" on public.events for select using (true);

-- Duels: participants can read
create policy "Duel participants can view" on public.duels for select using (auth.uid() = challenger_id or auth.uid() = opponent_id);
create policy "Users can create duels" on public.duels for insert with check (auth.uid() = challenger_id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
