# SMART NO QUIT AI — completion plan

Goal: turn NO QUIT AI into a self-growing workspace where every build lives in a central `memories` store, the Studio gives a real code + live-preview editor, and a multi-agent crew plans, builds and improves projects autonomously.

## Phase 1 — Make `memories` the project brain

- Update `build_website`, `create_app_blueprint` and `create_domains` chat tools so every generated artifact is also saved into `public.memories` with `prompt`, `project_type`, `code`, `summary`, `blueprint`, `liked=false`, `version=1`.
- Keep `artifacts` as a read-only mirror for now to avoid breaking the existing Builds/Studio tabs.
- Add a `liked` toggle and a `project_type` filter to the **Mind** tab.
- Add a text search box in Mind that searches `prompt`, `summary` and `code`.
- Show a "preferred style" badge based on liked memories so the AI learns what the user repeats/loves.

## Phase 2 — Redesign Builds tab around memories

- Switch `BuildsPanel` source from `artifacts` to `memories`.
- Each build card shows: project type badge, prompt snippet, summary, and action buttons **Preview · Code · Improve · Delete**.
- "Improve" sends the memory back to the chat as context with a request to refine it, then saves the result as a new version (`parent_id` chain, `version` incremented).
- "Delete" soft-removes the memory row.
- Empty state guides the user to ask for a domain, blueprint or website in chat.

## Phase 3 — Studio: split-screen code editor + live preview

- Replace the current read-only Studio iframe with a resizable split-screen using `react-resizable-panels`.
- Left pane: a code editor textarea for the single-file HTML (`code` column). Add line numbers and a "Copy / Download / Save" toolbar.
- Right pane: live iframe preview that updates on every code change (debounced 600 ms).
- Selecting a build in Builds tab opens it in Studio; Studio remembers the active memory id.
- Saving writes the edited HTML back to `memories.code` and bumps `version` if the user chooses "Save as new version".

## Phase 4 — PWA manifest

- Create `public/manifest.webmanifest` with the NO QUIT AI name, theme colour from the neural-night palette, and icon references to the existing `logo-*.png` and `apple-touch-icon.png` files.
- Verify `__root.tsx` already links the manifest.

## Phase 5 — Agent crew (Planner + Builder + Critic)

- Add a new server route `/api/agents` that runs three coordinated calls:
  1. **Planner Agent** — breaks the user's prompt into steps (tech stack, pages, data model, assets).
  2. **Builder Agent** — writes the single-file HTML/JS/CSS based on the plan.
  3. **Critic Agent** — reviews the code for quality, accessibility and completeness, then suggests fixes.
- The route returns the final plan + code + review, and the client saves it to `memories`.
- In the chat system prompt, teach NO QUIT AI to invoke the agent crew for any "bana do" / "build" / "website" / "app" request instead of generating raw HTML directly.
- Surface agent progress in the chat UI as "Planner soch raha hai… → Builder code likh raha hai… → Critic check kar raha hai…".

## Phase 6 — Vector memory (preference learning)

- Enable the `vector` extension via migration and add `embedding vector(768)` to `memories`.
- Add a server function that generates an embedding for a memory prompt/code via the Lovable AI Gateway embedding endpoint.
- On save, automatically generate and store the embedding.
- In Mind/Builds, add a "Mujhe is jaisi aur cheezein dikhayo" button that runs a similarity search against liked memories and surfaces matching projects.
- Use this similarity signal to rank suggestions in chat and auto-prompts from the Mind engine.

## Out of scope for this plan

- Real deployment/hosting of generated sites (Deploy button will download the HTML or open a blob tab, same as today).
- Multi-file project exports.
- Fine-grained user roles / admin features.

## Order of work

Implement phases 1 → 2 → 3 first so the app is usable end-to-end, then phase 4, then 5 and 6. Each phase will be built and verified before moving to the next.
