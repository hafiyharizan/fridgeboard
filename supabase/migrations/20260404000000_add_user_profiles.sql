-- User profiles: link Supabase Auth users to household PINs
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  pin_code text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id);
