import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, UserProfile } from "@/lib/types";

type ProfileIdentity = Pick<UserProfile, "avatar_url" | "display_name">;

export function getProfileIdentity(user: User): ProfileIdentity {
  return {
    display_name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email ??
      null,
    avatar_url:
      user.user_metadata?.avatar_url ??
      user.user_metadata?.picture ??
      null,
  };
}

export function getUserDisplayName(
  user: Pick<User, "email" | "user_metadata">,
  profile?: Pick<UserProfile, "display_name"> | null,
) {
  return (
    profile?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "User"
  );
}

export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const identity = getProfileIdentity(user);
  const { data: existingProfile, error: loadError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!existingProfile) {
    const { data: createdProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: user.id,
        ...identity,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    return createdProfile as UserProfile;
  }

  const nextDisplayName = identity.display_name ?? existingProfile.display_name;
  const nextAvatarUrl = identity.avatar_url ?? existingProfile.avatar_url;

  if (
    existingProfile.display_name === nextDisplayName &&
    existingProfile.avatar_url === nextAvatarUrl
  ) {
    return existingProfile as UserProfile;
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("user_profiles")
    .update({
      display_name: nextDisplayName,
      avatar_url: nextAvatarUrl,
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return updatedProfile as UserProfile;
}
