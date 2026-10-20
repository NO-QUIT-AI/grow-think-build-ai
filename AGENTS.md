<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Owner table (owners, is_owner) controls owner-only data; plans in user_plans, viral videos in viral_videos — server routes set plan-sensitive fields, not the client.
- Viral build videos are rendered in the browser (canvas + MediaRecorder) because the Worker runtime has no ffmpeg; uploaded to R2 videos/viral/.
- Auto-story video uses local scene logic, a lazily loaded browser speech engine and single-thread ffmpeg.wasm; only authenticated stock searches run server-side, keeping media editing off the server.
- Stock-provider credentials use server-only secret names and authenticated proxy requests, never VITE-prefixed browser variables — prevents API credentials appearing in browser bundles.
- Build subdomains live on memories.subdomain (one per build, not per profile); served by src/server.ts host match + /s/$subdomain via security-definer RPCs — why: users have many builds and anon must read only published HTML.
- Call invitations use conditional status updates and database validation of friendship/participants; call pages verify the accepted invite before opening media — prevents cancelled rings and forged app invitations.
- Load AdSense after hydration through the shared configuration loader — Auto Ads must not mutate the server HTML before React hydrates.
