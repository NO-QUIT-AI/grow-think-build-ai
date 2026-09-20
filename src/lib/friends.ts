import { supabase } from "@/integrations/supabase/client";

export type FriendStatus = "pending" | "accepted" | "rejected";

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendStatus;
  created_at: string;
};

/** What the current user sees for another member. */
export type FriendState = "none" | "outgoing" | "incoming" | "friends" | "rejected";

const COLUMNS = "id, sender_id, receiver_id, status, created_at";

function stateOf(me: string, row: FriendRequest | undefined): FriendState {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  if (row.status === "rejected") return "rejected";
  return row.sender_id === me ? "outgoing" : "incoming";
}

/** Friend state between me and one other member. */
export async function fetchFriendState(meId: string, otherId: string) {
  const { data } = await supabase
    .from("friend_requests")
    .select(COLUMNS)
    .or(
      `and(sender_id.eq.${meId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${meId})`,
    )
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as FriendRequest | undefined;
  return { state: stateOf(meId, row), request: row ?? null };
}

/** Friend state for every member visible in a list. */
export async function fetchFriendStates(meId: string) {
  const { data } = await supabase
    .from("friend_requests")
    .select(COLUMNS)
    .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`);
  const map: Record<string, { state: FriendState; request: FriendRequest }> = {};
  for (const row of (data ?? []) as FriendRequest[]) {
    const other = row.sender_id === meId ? row.receiver_id : row.sender_id;
    map[other] = { state: stateOf(meId, row), request: row };
  }
  return map;
}

export async function areFriends(meId: string, otherId: string) {
  const { state } = await fetchFriendState(meId, otherId);
  return state === "friends";
}

export async function sendFriendRequest(meId: string, otherId: string, myName: string) {
  const { error } = await supabase
    .from("friend_requests")
    .upsert(
      { sender_id: meId, receiver_id: otherId, status: "pending" },
      { onConflict: "sender_id,receiver_id" },
    );
  if (error) throw error;
  await supabase.from("notifications").insert({
    user_id: otherId,
    actor_id: meId,
    type: "friend_request",
    body: `${myName} ne aapko friend request bheji hai`,
  });
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

/** Pending requests waiting for my Accept / Reject. */
export async function fetchIncomingRequests(meId: string) {
  const { data } = await supabase
    .from("friend_requests")
    .select(COLUMNS)
    .eq("receiver_id", meId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as FriendRequest[];
}
