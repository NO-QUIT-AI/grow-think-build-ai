# Selected-language experience

## Goal
The user's chosen language will control both the visible app text and every AI response. The choice remains saved between visits, and Arabic keeps right-to-left layout.

## Changes
- Expand the shared translations for English, Urdu, Hindi, and Arabic so every user-facing screen has matching copy.
- Replace remaining hard-coded labels, placeholders, notices, buttons, empty states, errors, and confirmation messages across Home, Studio/Chat, Community, Earn, Profile, Auth, Tasks, CV, messages, leaderboard, invite, and legal pages.
- Send the selected language with chat and other AI requests.
- Update AI instructions to treat the explicit selected language as authoritative: English replies in English; Urdu, Hindi, and Arabic replies in their selected language.
- Localize chat suggestions, history controls, upload/edit feedback, and generated progress text.
- Keep saved chat content unchanged; only new AI replies and interface text follow the current selection.

## Technical details
- Keep `LanguageContext` as the single source of truth using `nqai_lang`.
- Add interpolation support for translated text containing names, counts, times, or errors.
- Validate request language values on the server before adding language-specific AI instructions.
- Preserve existing data, layouts, mining rules, ads, auth, builds, and community behavior.
- Verify the app build and test language switching, Arabic RTL, and a chat request in the selected language.
