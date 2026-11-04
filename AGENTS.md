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
- My Story uses a browser-safe content module with separate faithful language versions and page-scoped theme tokens — keeps the original account intact without changing app-wide styling.
- Jalsa uses QR-exchanged compressed WebRTC SDP with local ICE candidates only; local messages persist before send and require peer acknowledgments, while jalsa_messages is an owner-scoped archive, never a Community transport — browsers cannot provide Bluetooth peripheral mesh.
- Studio's lazily loaded bundled Monaco editor uses /api/studio and memories as the source of truth; persistent history and optimistic version checks prevent stale diff application, while owner writes mirror through the existing Genesis R2 writer.
- Chat passes the active Studio memory ID and draft code, uses user-scoped file_edit/file_undo tools, and opens successful build results by memoryId; unrelated chat model routing remains unchanged.
- ElevenLabs call setup synchronizes a shared configuration with language presets and the language_detection system tool; use a valid primary language rather than unsupported "auto", preserving other agent settings.
- Android uses a separate builder-only entry and explicit server-side chat tool allowlist; keep the full web product unchanged and omit global reward/navigation widgets on that entry.
- Keep Capacitor config and native Android source in the project for reproducible releases; signing credentials stay external and all releases reuse the existing upload certificate.
- Voice capture and sphere feedback share a phase-gated input volume source; stop recognition during assistant playback and only submit final transcripts, avoiding echo-triggered turns.
- App-shell offline support uses generated Workbox with one preview-guarded registration module; never cache API/auth traffic or register in editor previews.
- Genesis self-patches affect allowlisted persisted runtime configuration only; authenticated user clicks apply version-checked backups, never model-provided confirmation or compiled security code.
- Genesis multi-step approvals, tool usage reservations and summaries persist in Cloud; budget reservations and topic consolidation use database locks to prevent concurrent bypasses.
- Genesis plan and paid-action approvals are conversation-bound, atomically single-use and user-click authorized; model confirmation flags never authorize spending, and stable conversation IDs prevent unrelated summaries merging.
