# Project working agreement

Use ES modules on Node 22. Do not install dependencies for this exercise. Preserve owner authorization and never log patient or claim payloads. Keep changes small and explain verification.

## Current conventions
- Customer codes use the current schema v3 format `CUS-000123`: `CUS-` followed by exactly six digits. Normalize surrounding whitespace and letter case, preserve leading zeroes, and reject any other format with TypeError. See `docs/current-schema.md`.
- Status retrieval keeps the per-customer cache: each normalized customer code is cached for 30 seconds (`ttlMs`, default 30000) and refreshed at age >= ttlMs. Failures are not cached. Keep this cache when changing status retrieval. See `docs/status-design.md`.
- Finish by running the full suite from the repository root: `node --test tests/*.test.mjs tests/student/*.test.mjs`. The smoke test alone is not sufficient. See `docs/testing.md`.

Respect the current approved product scope. Do not create new recipients or expose clinical details.
