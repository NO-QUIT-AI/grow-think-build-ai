import { supabase } from "@/integrations/supabase/client";

export type CommunityProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_apps_built: number;
  reputation_points: number;
};

export const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, bio, total_apps_built, reputation_points";

export function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "abhi";
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function nameOf(profile?: CommunityProfile | null) {
  return profile?.display_name || profile?.username || "Member";
}

export function handleOf(profile?: CommunityProfile | null) {
  return profile?.username ?? "member";
}

export function initials(profile?: CommunityProfile | null) {
  return nameOf(profile).slice(0, 2).toUpperCase();
}

export async function fetchProfiles(ids: string[]) {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {} as Record<string, CommunityProfile>;
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique);
  const map: Record<string, CommunityProfile> = {};
  for (const row of data ?? []) map[row.id] = row as CommunityProfile;
  return map;
}

export async function notify(input: {
  userId: string;
  actorId: string;
  type: "like" | "comment" | "follow" | "message";
  entityId?: string | null;
  body?: string;
}) {
  if (input.userId === input.actorId) return;
  await supabase.from("notifications").insert({
    user_id: input.userId,
    actor_id: input.actorId,
    type: input.type,
    entity_id: input.entityId ?? null,
    body: input.body ?? null,
  });
}

/** Finds (or creates) the 1:1 conversation between two members. */
export async function ensureConversation(meId: string, otherId: string) {
  const sorted = [meId, otherId].sort();
  const a = sorted[0] as string;
  const b = sorted[1] as string;
  const { data: existing } = await supabase
    .from("dm_conversations")
    .select("id")
    .or(
      `and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`,
    )
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("dm_conversations")
    .insert({ user1_id: a, user2_id: b })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
