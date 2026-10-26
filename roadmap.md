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

# Lovable-clone autonomy (15 updates)
Phase 1:
- [ ] 1. Auto agent loop: tool errors auto-read + self-fix retry up to 5 (prompt rules + maxRetries).
- [ ] 2. db_write tool (insert/update/delete on profiles, nqai_wallets, community_posts, user_plans, referrals) + save referral code JYKXBWSA for owner.
- [ ] 3. Free video fallback chain: FAL → HuggingFace → Google Veo → Pollinations poster.
Phase 2:
- [ ] 4. read_project tool (all files at once).
- [ ] 5. Cost guard: paid tools ask "cost OK?" before running.
- [ ] 6. Background jobs: video/voice run in background, agent keeps chatting.
- [ ] 7. write_files multi-file write (5-6 files in one call).
Phase 3:
- [ ] 8. preview_url tool: instant live preview without full deploy.
- [ ] 9. design_review tool: agent checks its own site for design flaws (heuristics; real screenshots not possible in worker).
- [ ] 10. Cron job: daily mining report (/api/public/jobs/daily-report + managed schedule).
- [ ] 11. Error telemetry: client errors auto-reported to owner (/api/public/error-report).
- [ ] 12. Team/roles: list_users owner tool on top of existing user_roles + admin panel.
- [ ] 13. Voice input: already exists in ChatPanel (verify only).
- [ ] 14. persona_save tool: owner tone/style saved as permanent system prompt.
- [ ] 15. Tool chaining: "banao + deploy + test + report" single-command chain (prompt rules).
