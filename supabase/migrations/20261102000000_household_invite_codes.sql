-- Household invite codes
--
-- Before: anyone signed in with Google could join a household with just its
-- 4-digit PIN (10,000 possibilities), and could even set user_profiles.pin_code
-- directly through the table API.
--
-- After: joining needs a single-use invite code (8 chars, ~10^12 possibilities)
-- that expires after 7 days. The PIN stays as the internal household ID, but
-- clients can no longer write user_profiles.pin_code themselves.

create table if not exists public.household_invites (
  code text primary key check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  pin_code text not null references public.households(pin_code) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);

create index if not exists idx_household_invites_pin_code
  on public.household_invites (pin_code);

alter table public.household_invites enable row level security;

drop policy if exists "Household members can read their invites" on public.household_invites;
create policy "Household members can read their invites"
  on public.household_invites for select to authenticated
  using (pin_code = public.current_user_pin());

-- No insert/update/delete policies: invites are only created and redeemed
-- through the security definer functions below.

create or replace function public.create_household_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  member_pin text;
  random_bytes bytea;
  new_code text;
  byte_index int;
  new_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to invite someone.';
  end if;

  member_pin := public.current_user_pin();

  if member_pin is null then
    raise exception 'Join a household before inviting someone.';
  end if;

  loop
    -- gen_random_uuid() uses a cryptographically strong source. Skip bytes 6-8,
    -- which carry the UUID version/variant bits. 256 is a multiple of 32, so
    -- taking each byte mod 32 is unbiased.
    random_bytes := uuid_send(gen_random_uuid());
    new_code := '';

    foreach byte_index in array array[0, 1, 2, 3, 4, 5, 9, 10] loop
      new_code := new_code || substr(alphabet, (get_byte(random_bytes, byte_index) % 32) + 1, 1);
    end loop;

    begin
      insert into public.household_invites (code, pin_code, created_by)
      values (new_code, member_pin, auth.uid())
      returning household_invites.expires_at into new_expires_at;
      exit;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return query select new_code, new_expires_at;
end;
$$;

create or replace function public.join_household_with_invite(
  invite_code text,
  profile_display_name text default null,
  profile_avatar_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  invite public.household_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a household.';
  end if;

  normalized_code := upper(regexp_replace(coalesce(invite_code, ''), '[^A-Za-z0-9]', '', 'g'));

  if normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception 'Enter the 8-character invite code.';
  end if;

  select *
  into invite
  from public.household_invites
  where household_invites.code = normalized_code
  for update;

  -- One message for every failure, so codes can't be probed.
  if not found or invite.used_at is not null or invite.expires_at < now() then
    raise exception 'That invite code is invalid or has expired.';
  end if;

  update public.household_invites
  set used_by = auth.uid(),
      used_at = now()
  where household_invites.code = normalized_code;

  insert into public.user_profiles (user_id, pin_code, display_name, avatar_url)
  values (auth.uid(), invite.pin_code, profile_display_name, profile_avatar_url)
  on conflict (user_id) do update
  set pin_code = excluded.pin_code,
      display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
      avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url);

  return invite.pin_code;
end;
$$;

revoke all on function public.create_household_invite() from public, anon;
grant execute on function public.create_household_invite() to authenticated;

revoke all on function public.join_household_with_invite(text, text, text) from public, anon;
grant execute on function public.join_household_with_invite(text, text, text) to authenticated;

-- Joining by PIN is gone.
drop function if exists public.join_household(text, text, text);

-- Clients may only write their own name and avatar. pin_code is set only by
-- create_household and join_household_with_invite (security definer).
revoke insert, update on public.user_profiles from anon, authenticated;
grant insert (user_id, display_name, avatar_url) on public.user_profiles to authenticated;
grant update (display_name, avatar_url) on public.user_profiles to authenticated;
