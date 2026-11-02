import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { normalizeInviteCode } from "@/lib/invite-code";
import { getProfileIdentity } from "@/lib/user-profile";

export async function createHousehold(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const identity = getProfileIdentity(user);
  const { data, error } = await supabase.rpc("create_household", {
    profile_display_name: identity.display_name,
    profile_avatar_url: identity.avatar_url,
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "string") {
    throw new Error("Could not create a household right now.");
  }

  return data;
}

export async function joinHouseholdWithInvite(
  supabase: SupabaseClient<Database>,
  user: User,
  inviteCode: string,
) {
  const identity = getProfileIdentity(user);
  const { data, error } = await supabase.rpc("join_household_with_invite", {
    invite_code: normalizeInviteCode(inviteCode),
    profile_display_name: identity.display_name,
    profile_avatar_url: identity.avatar_url,
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "string") {
    throw new Error("Could not join that household right now.");
  }

  return data;
}

export type HouseholdInvite = {
  code: string;
  expiresAt: string;
};

export async function createHouseholdInvite(
  supabase: SupabaseClient<Database>,
): Promise<HouseholdInvite> {
  const { data, error } = await supabase.rpc("create_household_invite");

  if (error) {
    throw error;
  }

  const invite = data?.[0];

  if (!invite) {
    throw new Error("Could not create an invite right now.");
  }

  return { code: invite.code, expiresAt: invite.expires_at };
}
