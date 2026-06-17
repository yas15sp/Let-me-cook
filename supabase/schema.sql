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
create policy "Users can insert own cooks" on public.cooks for insert
  with check (
    auth.uid() = user_id
    and (
      event_id is not null
      or (
        select count(*) from public.cooks
        where user_id = auth.uid()
          and created_at >= current_date
      ) < 5
    )
  );
create policy "Users can update own cooks" on public.cooks for update using (auth.uid() = user_id);
create policy "Users can delete own cooks" on public.cooks for delete using (auth.uid() = user_id);

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

-- XP increment function (call after submitting a cook)
-- Bonuses applied when p_apply_bonuses = true (default):
--   event x1.5, streak +25% (day 2+ only), first cook of day +100 flat
-- Pass p_apply_bonuses = false for duel/admin XP grants that should not trigger bonuses
-- Also manages streak: increments on first cook if user cooked yesterday, resets to 1 otherwise
-- Returns actual XP earned after bonuses
create or replace function public.increment_xp(
  p_user_id       uuid,
  base_amount     integer,
  p_event_id      uuid    default null,
  p_apply_bonuses boolean default true
)
returns integer
language plpgsql
security definer
as $func$
declare
  v_streak     integer;
  v_today      bigint;
  v_yest       bigint;
  v_first      boolean;
  v_had_yest   boolean;
  v_xp         integer;
  v_new_streak integer;
begin
  v_today    := 0;
  v_yest     := 0;
  v_first    := false;
  v_had_yest := false;

  select streak into v_streak
  from public.profiles
  where id = p_user_id;

  if p_apply_bonuses then
    select count(*) into v_today
    from public.cooks
    where user_id = p_user_id
      and created_at >= current_date
      and created_at < current_date + interval '1 day';

    select count(*) into v_yest
    from public.cooks
    where user_id = p_user_id
      and created_at >= current_date - interval '1 day'
      and created_at < current_date;

    if v_today = 1 then
      v_first := true;
    end if;

    if v_yest > 0 then
      v_had_yest := true;
    end if;
  end if;

  if v_first then
    if v_had_yest then
      v_new_streak := v_streak + 1;
    else
      v_new_streak := 1;
    end if;
  else
    v_new_streak := v_streak;
  end if;

  v_xp := base_amount;

  if p_event_id is not null then
    v_xp := (v_xp * 3) / 2;
  end if;

  if v_first and v_new_streak > 1 then
    v_xp := v_xp + (base_amount / 4);
  end if;

  if v_first then
    v_xp := v_xp + 100;
  end if;

  update public.profiles
  set xp     = xp + v_xp,
      streak = v_new_streak
  where id = p_user_id;

  return v_xp;
end;
$func$;

-- Add cook/vote counters to profiles
alter table public.profiles add column if not exists dishes_cooked integer not null default 0;
alter table public.profiles add column if not exists total_votes integer not null default 0;

-- Auto-increment dishes_cooked when a cook is inserted
create or replace function public.handle_new_cook()
returns trigger as $$
begin
  update public.profiles set dishes_cooked = dishes_cooked + 1 where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_cook_created
  after insert on public.cooks
  for each row execute procedure public.handle_new_cook();

-- Auto-update total_votes on profiles when votes are cast/removed
create or replace function public.handle_new_vote()
returns trigger as $$
begin
  update public.profiles
  set total_votes = total_votes + 1
  where id = (select user_id from public.cooks where id = new.cook_id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_vote_created
  after insert on public.votes
  for each row execute procedure public.handle_new_vote();

create or replace function public.handle_remove_vote()
returns trigger as $$
begin
  update public.profiles
  set total_votes = greatest(0, total_votes - 1)
  where id = (select user_id from public.cooks where id = old.cook_id);
  return old;
end;
$$ language plpgsql security definer;

create trigger on_vote_deleted
  after delete on public.votes
  for each row execute procedure public.handle_remove_vote();

-- Storage policies for cook-media bucket
create policy "Authenticated users can upload cook media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cook-media');

create policy "Cook media is publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'cook-media');

create policy "Users can delete own cook media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'cook-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ingredients, inspiration tracking
alter table public.cooks add column if not exists ingredients text[] not null default '{}';
alter table public.cooks add column if not exists inspired_by_cook_id uuid references public.cooks(id);
alter table public.cooks add column if not exists inspired_by_user_id uuid references public.profiles(id);

-- Comments on cooks
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  cook_id uuid references public.cooks on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);
alter table public.comments enable row level security;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Authenticated users can comment" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);
