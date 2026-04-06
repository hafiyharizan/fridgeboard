import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
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

export async function joinHousehold(
  supabase: SupabaseClient<Database>,
  user: User,
  targetPin: string,
) {
  const identity = getProfileIdentity(user);
  const { data, error } = await supabase.rpc("join_household", {
    target_pin: targetPin,
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
