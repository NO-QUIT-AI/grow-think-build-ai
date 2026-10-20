# Pending completion
- [x] Fix call lifecycle, friend-only permissions, cancelled rings and stale invites; 7 regression tests pass.
- [x] Verify signed-in invalid-invite rejection and database self-call rejection.
- [ ] Verify two-person audio/video calls (blocked: signed-in account has no conversations; requires second consenting accepted friend).
- [x] Add local scene splitting, free voice, stock/local clips, captions and /auto-video editor.
- [x] Generate and download a real MP4; verify H.264 picture, AAC audio and 6.15s duration. Sandbox Chromium lacks H.264 playback; failed Play now shows download guidance.
- [x] Replace Pexels with Pixabay; secure key saved, authenticated search returned 3 large clips, captions-only MP4 export verified; 9 regression tests pass and preview build OK.
- [ ] Publish completed features (waiting for explicit publish request).
- [ ] External setup: wildcard domain, Worker deployment and provider keys (requires account access/setup).