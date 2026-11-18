// Only opening consent is deterministic; code changes still go through AI review.
export function isGitHubConnectRequest(text: string) {
  return /\bgithub\b/i.test(text) && /\b(connect|j[oó]r|jod|link|repo.?select)\b/i.test(text) && !/\b(change|edit|fix|push|merge|badal|theek)\b/i.test(text);
}