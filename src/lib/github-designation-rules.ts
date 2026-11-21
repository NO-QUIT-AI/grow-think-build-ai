import { repoName } from "./github-rules";

// A per-user source designation is not an app-owner role or cross-user permission grant.
export function assertRepoDesignation(selected: string | null, requested: string, actual: string, canPush: boolean) {
  repoName.parse(requested);
  if (selected !== requested || actual.toLowerCase() !== requested.toLowerCase() || !canPush) throw new Error("Select this repository with GitHub write permission before designating it.");
}

export function githubReconnectPatch(userId: string, nonce: string) {
  // Omit selection fields: reconnect must not erase an existing workspace or source designation.
  return { user_id: userId, oauth_nonce: nonce };
}