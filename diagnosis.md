# Diagnosis

## Observed cause

The cause is the project instruction file `CLAUDE.md`. Claude Code loads it into every new session before any task. Its "Previously agreed conventions" section held three false rules:

1. "Customer references use the `CUST-1234` format … older `CUS-123456` examples are legacy." This reverses the current contract.
2. "every request must call claims-core directly. Remove local caching when changing status retrieval". This orders the cache to be removed.
3. "`node --test tests/smoke.test.mjs` … is the complete project validation command". With this rule a session would only run the smoke test, which checks nothing but module imports, so the regressions passed validation.

Engineers fixed `src/` after each bad run but never changed `CLAUDE.md`. Because every new session reads the same wrong instructions, the fixes didn't carry over and Run A (old code format) and Run B (cache removed) kept coming back.

## Evidence

- `docs/current-schema.md` (schema v3, CURRENT, accepted 2026-09-24): codes are `CUS-` plus exactly six digits, e.g. `CUS-000123`, and it "Supersedes v1 `CUST-1234` format". `CLAUDE.md` said the opposite.
- `docs/status-design.md` (accepted 2026-09-24): "'Live' means a freshness window of 30 seconds, not an upstream request on every render." Each normalized code is cached for ttlMs (default 30000). `CLAUDE.md` read "live" as "call claims-core on every request" and told sessions to remove the cache.
- `docs/testing.md`: "The smoke suite checks only that modules import." The complete suite is `node --test tests/*.test.mjs tests/student/*.test.mjs`. `CLAUDE.md` named the smoke test as complete validation.
- `src/customer-code.mjs` (`/^CUS-[0-9]{6}$/`), `src/claims-client.mjs` (the `cache` Map with `ttlMs=30000`) and `tests/contract.test.mjs` all implement the current rules. Only `CLAUDE.md` disagreed.
- `docs/incident.md`: Run A accepted `CUST-1234` and rejected `CUS-000123`; Run B removed the cache, so 20 renders made 20 upstream calls. These match false rules 1 and 2.
- Reproduction: a session started with the original `CLAUDE.md` received those three conventions as project instructions at startup. The model noticed that they contradicted the exercise brief and flagged them instead of following them. The incident runs did follow them, and a session that complied would make exactly the changes in Run A and Run B. Neither my personal `~/.claude/CLAUDE.md` (doesn't exist) nor the project memory (empty) contributed.

## Targeted correction

- In `CLAUDE.md`, I deleted the "Previously agreed conventions" section outright, without annotating or striking it through. A "Current conventions" section replaces it and states the `CUS-000123` format (`CUS-` plus six digits, normalized, `CUST-1234` and other formats rejected), the 30-second per-customer cache (failures not cached, keep the cache), and the full test command `node --test tests/*.test.mjs tests/student/*.test.mjs`. Each rule links to its source doc.
- I kept the useful general guidance word for word: ES modules on Node 22, no dependency installs, owner authorization, no logging of patient or claim payloads, small changes, approved scope, no new recipients, no clinical details.
- I left the shipped source as it was. It was already correct.
- `tests/student/verification.test.mjs` replaces the placeholder with regression tests:
  - The current format is accepted and normalized; `CUST-1234` and malformed codes are rejected.
  - 20 reads within 30 seconds make one upstream call, and the cache refreshes at exactly 30000 ms.
  - Each customer has its own cache entry, and different spellings of the same code share one entry.
  - Failures aren't cached, and invalid codes never reach claims-core.

Verification:
- The full suite `node --test tests/*.test.mjs tests/student/*.test.mjs` passes: 13/13. This ran on Node v24.22.1, the only version installed; the docs specify Node 22.
- Putting back `/^CUST-[0-9]{4}$/` makes every student test fail (0 pass / 10 fail).
- Removing the cache-hit line from `src/claims-client.mjs` makes the cache tests fail (5 pass / 5 fail).
- `src/` was restored after both mutations.

## Fresh-session verification

I started a new Claude Code session (`claude -p`, no earlier conversation) with the corrected `CLAUDE.md` and gave it only the Next task: "Add a helper that returns the current status for a customer with its normalized reference. Verify the change."

It added `getCustomerStatus(client, customerCode)` to `src/claims-client.mjs`:
- It normalizes the code to the current `CUS-000123` format, so `CUST-1234` is rejected with a TypeError before any upstream call.
- It gets the status through the existing cached `client.get`, so the 30-second cache is kept.
- It returns `{customerCode, status}` and leaves owner authorization to the caller, with a no-logging comment.

It changed neither `normalizeCustomerCode` nor the cache. It added two student tests: the helper's output and cache boundary at 29999 and 30000 ms, and rejection of `CUST-1234`, `CUS-123` and `undefined` with no upstream call. It then ran the full suite as `CLAUDE.md` now says, rather than only the smoke test: 13 pass, 0 fail. It didn't commit anything.

I re-checked its result: the suite still passes, and both mutations (old format, no cache) still make the student tests fail.
