# ShipLog for Anna — SPEC (SDD, v1.0 2026-09-24)

## 0. One line
For solo builders on Anna AI OS: paste this week's commits (or notes) and get **three ready-to-post drafts — an X post, a LinkedIn update and a changelog — in which every number is checked against your own log**.
Essence: not "a post generator" but **a weekly loop that turns work records into public proof** (history + streak bring the builder back every week).

## 1. Success conditions (numbers) · deadline · non-goals
- Reference: no ranked winners in this program (forum.anna.partners/t/205: "No Top 3 leaderboard"); the scoreboard is the monthly MAU tier table — Tier E 200 MAU ($50/mo) … Tier S 20,000 MAU ($5,000/mo). Target = the highest tier; realistic anchor = Tier E.
- Primary function = one **Qualified App Run** (forum §6): a signed-in user pastes notes → gets 3 drafts that pass the checks. Success of one run:
  - S1 3 non-empty drafts, each ≥ 40 characters ("meaningful, non-trivial result").
  - S2 X post weighted length ≤ 280 (guaranteed: repair call, then word-boundary trim).
  - S3 every number in the drafts appears in the user's input or in the digest counts; otherwise it is shown to the user as a warning (never silently shipped as fact).
  - S4 ≤ 2 LLM calls per run (1 draft + at most 1 repair) — bounded cost on the user's quota.
  - S5 run is saved to the user's Anna storage; history shows past weeks and the weekly streak.
- Review gate (forum §8): usable UI, working logic, clear inputs/outputs, loading **and** error states; AI is the core; no broken external dependency.
- Deadline: bundle ready for App Review 2026-09-25 (review 3–5 business days) · DoraHacks BUIDL 2026-10-01 00:59 KST.
- Non-goals (v1): posting to X/LinkedIn on the user's behalf (no OAuth), private-repo import, team accounts, paid features, Executa plugin (not needed: host APIs cover LLM + storage; "Default to the Host API" — developers/apps/host-api-vs-executa).

## 2. Constraints
- Anna runtime: sandboxed iframe (opaque origin → no localStorage), SDK `/static/anna-apps/_sdk/latest/index.js` (v0.16.1 measured 2026-09-24: RPCs resolve to the result; errors are `Error` with `.code`).
- ACL = `manifest.ui.host_api` only. Used: `llm.complete`, `storage.get/set/list/delete`, `chat.append_artifact`, `window.set_title` (always granted).
- Manifest schema 2 (local validator `@anna-ai/app-schema` 0.22.0 caps schema at 2). Bundle-only apps may leave `required_executas` empty at schema ≥ 2 (developers/apps/app-manifest §Validation 3).
- LLM: `llm.complete` per-call cap 4096 tokens (silently clamped); billed to the user's Anna quota/BYOK. Default SDK timeout 180 s.
- Mobile (declared): ≥ 320 px usable, safe-area padding, touch targets ≥ 44 px, no hover-only actions, **no own viewport meta** (shell injects it), no reliance on window geometry.
- Fair play: no self-runs, no paid/incentivised usage (forum §6, §10). No hidden data collection (Developer ToS §2.2).
- Privacy: notes and drafts stay in the user's Anna storage (`scope=app`, per user). The only outbound request besides Anna is the optional GitHub import, from the user's own browser to `api.github.com` (public repos, unauthenticated).

## 3. Ubiquitous language (code names 1:1)
| Term | Meaning | Code |
|---|---|---|
| Ship notes | Raw text the user pastes (git log, bullets, release notes) | `notes` |
| Change | One parsed line of the notes with a kind | `Change` (`parseChanges`) |
| Change kind | feat · fix · perf · refactor · docs · test · release · noise · other | `ChangeKind` |
| Noise | Changes readers don't care about (merges, deps bumps, typos, wip, formatting) | `kind === "noise"` |
| Week digest | Counts + highlights + known numbers built from the notes | `WeekDigest` (`digestNotes`) |
| Known numbers | Numbers a draft may state: those in the notes + digest counts | `digest.knownNumbers` |
| Draft set | `xPost`, `linkedinPost`, `changelog` | `DraftSet` |
| Draft check | Limits + unsupported numbers + emptiness per draft | `checkDrafts` → `DraftCheck` |
| Ship entry | One saved run (digest summary + drafts + options + time) | `ShipEntry` |
| Streak | Consecutive ISO weeks (ending this or last week) with ≥ 1 entry | `weeklyStreak` |
| Tone | `build-in-public` · `professional` · `technical` | `TONES` |

## 4. Domain model (bundle/src/domain — pure, no I/O, no SDK)
- `changes.js`: `parseChanges(notes) → Change[]`; `Change = {kind, scope, subject, ref, breaking}`.
- `digest.js`: `digestNotes(notes) → WeekDigest {changeCount, counts{kind→n}, highlights[], noiseCount, versions[], refs[], knownNumbers:Set, truncated}`.
- `drafts.js`: `parseDraftSet(text)`, `weightedLength(text)` (X rule: CJK/emoji weight 2, URL 23), `fitXPost(text)`.
- `check.js`: `checkDrafts(drafts, digest) → {ok, issues[]}`; issue codes `EMPTY`, `TOO_SHORT`, `X_TOO_LONG`, `LINKEDIN_TOO_LONG`, `UNSUPPORTED_NUMBER`.
- `entry.js`: `createEntry(...)`, `isoWeekKey(date)`, `weeklyStreak(entries, now)`.
- Ports (application/ports.js): `LlmPort.complete({systemPrompt, messages, maxTokens, temperature}) → string`, `EntryStore.save/list/remove`, `CommitSource.recentCommits(repoRef, sinceIso) → string[]`, `Clock.now()`, `Ids.next()`.

## 5. Use cases (bundle/src/application)
| UC | Input | Output | Rules |
|---|---|---|---|
| UC-1 generateShipLog | notes, tone, language, projectName | `{entry, check, calls}` | digest → draft call → parse (1 JSON-repair allowed within the same budget) → check → ≤1 repair call → X fit → save (best-effort) |
| UC-2 listHistory | — | `{entries (newest first), streak}` | max 20 entries kept and shown |
| UC-3 importFromGitHub | repo URL or `owner/repo`, days=7 | notes text | public repos only; errors: NOT_FOUND, RATE_LIMITED, NETWORK, EMPTY |
| UC-4 deleteEntry | id | — | removes from store |

## 6. Acceptance criteria (each → ≥ 1 test)
- AC-1 Given `git log --oneline` lines with conventional prefixes, When parsed, Then kinds/scopes/subjects/PR refs are extracted and short SHAs stripped.
- AC-2 Given merge commits, dependency bumps, typo/wip/format commits, Then they are `noise` and excluded from highlights.
- AC-3 Given free-form bullet notes without prefixes, Then kinds are inferred by keywords (add→feat, fix→fix, faster→perf …).
- AC-4 Given notes, Then `knownNumbers` contains every number in the notes plus the digest counts (change count, per-kind counts, highlight count).
- AC-5 Given a draft stating a number not in `knownNumbers` (e.g. "40% faster"), Then `checkDrafts` reports `UNSUPPORTED_NUMBER` with that value.
- AC-6 Given an X draft over 280 weighted chars, Then `X_TOO_LONG`; `fitXPost` returns ≤ 280 ending at a word boundary with "…".
- AC-7 Given CJK text, Then `weightedLength` counts each CJK char as 2.
- AC-8 Given an LLM reply wrapped in prose/```json fences, Then `parseDraftSet` extracts the 3 drafts; missing keys → error `BAD_MODEL_OUTPUT`.
- AC-9 UC-1: Given a first reply with an issue, Then exactly one repair call is made and the final check is recomputed; total LLM calls ≤ 2 (+1 only for unparsable JSON, still ≤ 2 total).
- AC-10 UC-1: Given empty/too-short notes, Then `EMPTY_NOTES` error and **zero** LLM calls.
- AC-11 UC-1: Given the store fails, Then drafts are still returned with `saved=false`.
- AC-12 UC-2: Given entries in weeks W37, W38, W39 and now in W39, Then streak = 3; a gap resets it.
- AC-13 UC-3: Given `https://github.com/o/r` or `o/r`, Then the adapter requests `api.github.com/repos/o/r/commits?since=…`; 404 → NOT_FOUND, 403 with rate-limit header → RATE_LIMITED.
- AC-14 Adapter: Given the SDK throws `{code:"APP_QUOTA_EXCEEDED"}` (or `quota_exceeded`), Then the app shows the quota message (error code `QUOTA`); `APP_NOT_GRANTED`/`permission_denied` → `NOT_ALLOWED`; timeout → `TIMEOUT`.
- AC-15 Manifest ACL: every host call the bundle makes (`llm.complete`, `storage.get/set/list/delete`, `chat.append_artifact`) is allowed by `manifest.ui.host_api` under the official `mountBundle` harness; `anna-app validate --strict` passes.
- AC-16 Mobile/UI static rules: no `<meta name="viewport">`; safe-area tokens present; every `:hover` rule has a non-hover twin; buttons/inputs `min-height ≥ 44px`; no external font/CDN URL; bundle paths match `^[A-Za-z0-9_./\-]+$`.

## 7. Architecture (Clean — dependencies point inward)
```
bundle/src/domain/          pure rules (no imports from outer layers)
bundle/src/application/     use cases + prompts + ports (imports domain only)
bundle/src/adapters/        anna-llm.js, anna-store.js, github-commits.js, memory-store.js, ui/*
bundle/src/infrastructure/  main.js (composition root: connects the Anna SDK, wires adapters → use cases → UI)
```

## 8. UI acceptance (Toss checklist → this app; notes/원칙-디자인)
1 Mobile-first: usable at 320/390 px, fine at 1280 (Anna forbids an own viewport meta → rule adapted). 2 One question per screen: step 1 = notes (+ optional project name), options collapsed to one row. 3 Type scale: title 22px bold · body 15–16px · meta 13px. 4 Sections ≥ 24px apart, cards radius 16px, ≤ 1 shadow level. 5 One primary CTA fixed at the bottom, ≥ 52px, full width. 6 Numbers first: result header = "{n} changes → 3 drafts" (≥ 28px). 7 Evidence folded: digest detail and history in `<details>` closed by default. 8 Micro-copy short and friendly ("Paste anything — commit lines or bullet notes"). 9 One brand blue (#3182F6) + ok/warn/error, contrast ≥ 4.5:1, light + dark. 10 No external fonts/CDN; skeleton loading with real step labels.

## 9. Physical verification
- `anna-app validate --strict` green · vitest green · `anna-app dev --mock-llm` harness boot + headless click-through (320/390/1280 captures) · after login (Aside lane): one real `--llm real` run to confirm model output shape, then App Review.

## 10. Change log
- v1.0 2026-09-24 first version (Jarvis).
