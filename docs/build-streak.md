# Build Streak — Feature Blueprint

**Purpose:** One small AI-generated build mission per day (about 2 minutes) that produces a real artifact; a streak counter with 2 monthly freezes; and a local 8 PM reminder.

## Why Not a Game

Retention comes from three real drivers — no game is added:

- **Loss aversion** — the streak counter.
- **Curiosity** — tomorrow's mission.
- **Ownership** — the build library.

## Screens

| Screen | Purpose |
| --- | --- |
| Today (Home) | Shows today's single mission and current streak. |
| Mission Player | Runs the ~2-minute build and saves the artifact. |
| Build Library | Lists every completed build the user owns. |
| Streak Calendar | Shows completed days and applied freeze days. |
| Notification Settings | Sets the local reminder time (default 20:00). |
| Streak Broken / Recovery | Explains a broken streak and offers recovery. |

## Core Rules

- One mission per day, reset at the user's local midnight.
- Mission is AI-generated the night before.
- Mission is scoped to ~2 minutes and a single small deliverable.
- Streak increments only on explicit completion **and** a saved build.
- 2 freeze tokens per calendar month, auto-applied on the first missed day.
- Local notification default 20:00 in the user's timezone.
- Server-side streak truth computed from completed days; never trusted from the client.
- Duplicate-mission guard.
- Fallback mission pool so an AI provider failure never breaks the loop.

## Data Model

### `missions`

| Field | Notes |
| --- | --- |
| id | Primary key |
| title | Mission title |
| prompt | AI-generated mission instructions |
| deliverable | Expected small artifact |
| est_seconds | Target duration (~120) |
| source | ai \| fallback |
| created_at | Timestamp |

### `user_missions`

| Field | Notes |
| --- | --- |
| id | Primary key |
| user_id | Owner |
| mission_id | Reference to `missions` |
| local_date | User-timezone date (YYYY-MM-DD) |
| status | pending \| completed \| expired |
| completed_at | Timestamp or null |
| created_at | Timestamp |
| | Unique (user_id, local_date) — duplicate-mission guard |

### `builds`

| Field | Notes |
| --- | --- |
| id | Primary key |
| user_id | Owner |
| user_mission_id | Reference to `user_missions` |
| artifact_ref | Reuses existing build/storage |
| snapshot | Artifact snapshot |
| created_at | Timestamp |

### `streaks`

| Field | Notes |
| --- | --- |
| user_id | Primary key |
| current_count | Current streak |
| longest_count | Best streak |
| freezes_used | This calendar month |
| freezes_month | YYYY-MM |
| last_completed_date | User-local date |
| updated_at | Timestamp |

### `streak_days`

| Field | Notes |
| --- | --- |
| id | Primary key |
| user_id | Owner |
| local_date | YYYY-MM-DD |
| kind | completed \| frozen |
| created_at | Timestamp |
| | Unique (user_id, local_date) |

### `notification_prefs`

| Field | Notes |
| --- | --- |
| user_id | Primary key |
| enabled | Boolean |
| hour | Local hour (default 20) |
| minute | Local minute (default 0) |
| timezone | IANA timezone |
| expo_push_token | Push token |
| updated_at | Timestamp |

### `mission_history_seen`

| Field | Notes |
| --- | --- |
| user_id | Owner |
| mission_id | Mission |
| seen_at | Timestamp |
| | Unique (user_id, mission_id) |

## Tech Stack Notes

- Reuse the existing mobile client.
- Reuse the existing API layer and scheduled job runner.
- Reuse the existing AI provider module (Groq → DeepSeek → Gemini).
- Server-side date logic uses the user's timezone.
- Use Expo push notifications for reminders.
- Reuse the existing database.
- Reuse existing build/storage for artifact snapshots.

## Roadmap

| Phase | Week | Scope |
| --- | --- | --- |
| 1 | Week 1 | Schema (`missions`, `user_missions`, `builds`) and duplicate-mission guard. |
| 2 | Week 2 | Nightly AI mission generation with fallback mission pool. |
| 3 | Week 3 | Mission Player flow and explicit completion + saved build. |
| 4 | Week 4 | Server-side streak truth (`streaks`, `streak_days`). |
| 5 | Week 5 | Freeze tokens (2 per month) and Streak Calendar screen. |
| 6 | Week 6 | Notification prefs, Expo push, local 20:00 reminder. |
| 7 | Week 7 | Build Library, Streak Broken / Recovery, polish and launch. |

A gamified layer is only considered **after launch**, and only if D30 retention is low.
