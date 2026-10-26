# Pending completion
- [x] Add /my-story with exact original Roman Urdu plus English and Urdu-script translations, five icon sections, black/neon-green design, header/footer links and metadata; verified language switching, RTL, mobile layout, CTA and exact original-text match. Build OK; not published.
- [x] Update ElevenLabs motivational prompt, eleven_multilingual_v2 and language_detection; PATCH 200 and hosted GET readback verified, 6 voice tests pass, build OK. API rejects literal auto; model cannot enable Urdu/Punjabi/Bengali presets. Real spoken call remains untested.
- [x] Upgrade Build Studio: bundled Monaco Ctrl+K and Claude Sonnet 5 streaming, diff approval, persistent undo and user-scoped Chat-to-Studio files. Signed-in real Claude → Apply → saved code → Undo and Chat → same file → auto-open verified; 12 regression tests pass, build OK. Voice shares Chat submission but microphone recognition was not tested.
- [x] Add separate /jalsa-chat, QR pairing, local offline queue and private online archive sync. Signed-in offline save → reconnect sync → cloud readback verified; mode OFF disables sending and mobile has no overflow. Calls/Pixabay regression tests pass.
- [ ] Verify two-device direct Jalsa delivery and QR camera scan (blocked: sandbox WebRTC host candidate gathering never completes; real Wi-Fi/hotspot devices required).
- [x] Fix call lifecycle, friend-only permissions, cancelled rings and stale invites; 7 regression tests pass.
- [x] Verify signed-in invalid-invite rejection and database self-call rejection.
- [x] Two-browser test: accepted the chosen accounts' pending friendship, verified ring, reject→Missed bubble, accept→same call room, hangup→Ended bubble in both browsers. Fixed clipped Jitsi iframe; build OK and 3 call tests pass.
- [ ] Verify actual two-person media connection (blocked: meet.jit.si requires moderator login; both browsers reached Join and then the moderator-login waiting screen).
- [x] Add local scene splitting, free voice, stock/local clips, captions and /auto-video editor.
- [x] Generate and download a real MP4; verify H.264 picture, AAC audio and 6.15s duration. Sandbox Chromium lacks H.264 playback; failed Play now shows download guidance.
- [x] Replace Pexels with Pixabay; secure key saved, authenticated search returned 3 large clips, captions-only MP4 export verified; 9 regression tests pass and preview build OK.
- [ ] Publish completed features (waiting for explicit publish request).
- [ ] External setup: wildcard domain, Worker deployment and provider keys (requires account access/setup).

# Lovable-clone autonomy (15 updates) — ALL DONE (build OK, 30 tests pass)
Phase 1:
- [x] 1. Auto agent loop: AUTONOMY_PROMPT self-fix rules (max 5 retries) + maxRetries 3 + stepCountIs 40 in chat.ts.
- [x] 2. db_write tool (insert/update/delete on users/wallet/posts/plans/invites, column allowlist, match required for update/delete) + referral code JYKXBWSA saved on owner profile (verified).
- [x] 3. Free video chain in video-providers.server.ts: FAL → HuggingFace (HF_TOKEN) → Google Veo (GOOGLE_AI_KEY) → Pollinations poster; generate_video/video_status rewired.
Phase 2:
- [x] 4. read_project tool (all files at once, 150KB cap).
- [x] 5. Cost guard: costGate on generate_image (~$0.04), voiceover (~$0.10), FAL video (~$0.10) — confirm:true required.
- [x] 6. Background jobs: start_job/job_status with R2 job store; chat continues while video renders.
- [x] 7. write_files multi-file write (up to 8 files per call).
Phase 3:
- [x] 8. preview_url tool: instant R2 live preview without Vercel deploy.
- [x] 9. design_review tool: fetches own site HTML, flags viewport/alt/contrast/overflow/responsive flaws (real screenshots impossible in worker runtime — heuristic review is the honest subset).
- [x] 10. Cron: /api/public/jobs/daily-report + managed schedule nqai-daily-report at 06:00 UTC (10:00 Dubai); unauth POST correctly rejected.
- [x] 11. Error telemetry: __root.tsx window error/rejection listeners → /api/public/error-report → R2 telemetry/*.jsonl (sanitized, size-capped, no PII); endpoint verified ok:true.
- [x] 12. Team/roles: list_users owner tool (profiles + plans + roles) on top of existing user_roles/admin panel.
- [x] 13. Voice input: already in ChatPanel (SpeechRecognition, verified).
- [x] 14. persona_save tool: owner style stored in R2, injected into every owner chat system prompt.
- [x] 15. Tool chaining: AUTONOMY_PROMPT rules — "banao+deploy+test+report" runs write_files → vercel_deploy → deploy_status → design_review → report without interruption.
