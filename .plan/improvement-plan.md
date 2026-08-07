# Improvement plan — code style, quality, and security

Generated: 2026-08-06T20:39:19-04:00
Repository: skypath (skyproject)

Summary
-------
Overall the codebase is well-structured, well-documented, and shows strong attention to correctness and safety. Notable strengths:

- Careful input validation (horizon parser, observatory import) and robust error handling for storage failures.
- Good use of TypeScript and JSDoc-style comments; tests cover parsing and chart rendering paths.
- No uses of innerHTML / eval / unsafe DOM APIs found in source files; external links use rel="noopener noreferrer".
- Thoughtful caching where it matters (twilight `skyBands`) and concise, readable modules.

Still, a few targeted improvements will raise the maintainability, performance, and security posture with small, surgical changes.

Findings & recommendations
--------------------------
Organized by category: code style, code quality, and security. Each item includes location(s), rationale, and suggested action.

1) Code style
-------------
- Add linter configuration (ESLint) with Svelte + TypeScript rules
  - Files: repo root (package.json), new config files (.eslintrc.cjs or .eslintrc.json)
  - Why: Prettier is present but ESLint + svelte plugin will catch patterns Prettier doesn't (dead code, unused imports/vars, problematic conditionals). It will improve consistency for contributors and CI.
  - Suggested: Add `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-svelte` (or `eslint-plugin-svelte3`) and a minimal config enabling recommended rules. Provide an npm script `lint` and optionally `lint:fix`.

- Document contributor code style and run scripts in README / .plan/state.md
  - Files: .plan/state.md or README
  - Why: onboarding and consistency

2) Code quality / maintainability
---------------------------------
- Memoize / cache altitudeChartModel (or sampleTrajectory) for repeated computations
  - Files: `src/lib/charts/model.ts` and/or `src/lib/astro/trajectory.ts`
  - Why: Search results render one `AltitudeChart` per row and models are computed repeatedly on every keystroke. `skyBands` was cached; applying the same pattern to `altitudeChartModel` (or to `sampleTrajectory`) with a small in-memory LRU or key-ed memoization will reduce CPU cost and improve responsiveness.
  - Suggested approach: Add a small memo keyed by `object.id|location.lat|location.lon|dateStartMs|stepMinutes|horizonHash|includeMoon` that returns a shallow-cloned model. If memory becomes a concern, cap items (e.g., 50) using a simple LRU policy.

- Debounce expensive recomputation triggered by search input
  - Files: UI that triggers search (component where results are computed)
  - Why: Complement caching with debouncing to avoid recomputing models while the user is typing.

- Slight tightening of cachedBands key
  - Files: `src/lib/charts/model.ts`
  - Why: The key uses floating latitude/longitude stringification; consider rounding to a sensible precision (e.g., 6 decimal places) so functionally identical locations don't create duplicate cache entries.

- Minor: use crypto?.randomUUID guard
  - Files: `src/lib/observatory/store.ts` (newId)
  - Why: Current check `if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)` works; `crypto?.randomUUID` is slightly clearer. Not strictly required.

3) Security
-----------
- Set referrer policy on external imagery
  - Files: component that renders NASA SkyView image (likely `src/components/ObjectImage.svelte` or where `skyViewUrl` is used)
  - Why: The SkyView URL encodes coordinates/catalog identifiers; adding `referrerpolicy="no-referrer"` prevents leaking the page's URL or query to the remote host in the Referer header. This reduces user data leakage.
  - Suggestion: Add `referrerpolicy="no-referrer"` to the <img> element and document reasons in `.plan`.

- Limit import file size and validate earlier
  - Files: file import path (component that accepts import; e.g., `ObservatoryImportDialog.svelte` + the file-reading path)
  - Why: Large or maliciously crafted import files could cause slow JSON.parse or excessive memory use in the browser. The code already validates parsed JSON and filters invalid entries, which is good — add an explicit file-size cap (e.g., 1–2 MB) in the UI before reading, and return an informative error.

- CSP and hosting guidance
  - Files: documentation only (deploy docs, README or .plan)
  - Why: This is a static app deployed to S3. Recommend publishing guidance for secure headers (Content-Security-Policy, Referrer-Policy, X-Frame-Options) to be applied via CDN (CloudFront) or hosting config.

- Validate/limit horizon input size and complexity
  - Files: `src/lib/horizon/parser.ts`, import UI
  - Why: Parser is robust and validates numeric ranges; add a precautionary limit on the number of lines (e.g., 10k) before parsing to avoid degenerate inputs that can cause excessive CPU or memory consumption.

- External links and anchors
  - Files: `src/components/HelpDialog.svelte` already uses rel="noopener noreferrer" for target=_blank. Good. Consider `rel="noopener noreferrer"` remains set everywhere that uses `_blank`.

Other small security notes
- No uses of innerHTML, eval, or new Function in `src/` — excellent.
- No obvious storage of secrets or credentials in source.

Actionable changes (concrete edits)
----------------------------------
Below are concrete, low-risk edits that can be made quickly (I can implement any or all on request):

A. Add `referrerpolicy` to SkyView <img>
- File(s): locate where `ObjectImage` or skyViewUrl is used (likely `src/components/ObjectImage.svelte`).
- Change: <img src={url} referrerpolicy="no-referrer" alt="SkyView image" />
- Rationale: prevents referer leakage with coordinate-coded URLs.

B. Add import-file size guard
- File(s): component that reads the selected JSON file (the file-picker handler where FileReader is used)
- Change: if (file.size > MAX_BYTES) show error and abort read. Choose MAX_BYTES = 2_000_000 (2 MB) as recommended starting point.

C. Memoize altitudeChartModel / sampleTrajectory
- File(s): `src/lib/charts/model.ts` (implement an LRU or simple Map cache) or `src/lib/astro/trajectory.ts` (cache at sampling-level)
- Change: wrap `altitudeChartModel` in a small memo that returns cached value when key matches. Use weak cloning or freeze to avoid accidental mutation by callers.

D. Add ESLint + config + npm script
- Files: add `.eslintrc.cjs` and add `npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-svelte3` (or equivalent), add `lint` script in package.json.
- Change: minimal recommended ruleset and plugin for Svelte.

E. Parser safety: limit lines before parse
- File: `src/lib/horizon/parser.ts`
- Change: At parse start, if text.length > MAX_CHARS or lines > MAX_LINES, record a parse issue/error and skip or truncate. This avoids pathological inputs (e.g., megabyte-long uploads).

Priorities (recommended)
------------------------
1. Security: add referrerpolicy to SkyView image and add import file-size guard. (High priority — small code and deployment safety win)
2. Performance: memoize models or sampling and add debouncing in the search UI. (Medium-high priority; improves UX)
3. Tooling: add ESLint and CI integration (low effort, medium benefit long-term)
4. Parser hardening: line/size limits (low effort, defensive)

Estimates
---------
- ReferrerPolicy + file-size guard + parser line limit: a few small edits (30–90 minutes) and a couple of tests.
- Memoization of model/sampleTrajectory: 2–4 hours including tests and perf verification.
- Add ESLint + config: 1–2 hours to pick rule set and tune autofixes; more time if the codebase needs many fixes.

Next steps
----------
You asked these suggestions be saved to `.plan/improvement-plan.md` — done.

If you'd like, next actions I can take (pick one):
- Implement the high-priority security fixes (referrerpolicy + file-size guard + parser cap)
- Implement performance changes (model memoization + debounce)
- Add ESLint and CI lint step
- Implement all of the above (I will apply them incrementally and run tests)

Tell me which option you want me to implement next, or I can open a PR draft with the proposed edits.

Notes / Evidence
----------------
Files inspected while producing this plan:
- src/lib/storage.ts
- src/lib/observatory/store.ts
- src/lib/horizon/horizon.ts
- src/lib/horizon/parser.ts
- src/lib/charts/model.ts
- src/components/AltitudeChart.svelte
- src/components/ObservatoryImportDialog.svelte
- src/lib/observatory/transfer.ts
- src/lib/observatory/types.ts
- package.json

No occurrences of `innerHTML`, `eval(` or `new Function` were found in `src/`. External links already include `rel="noopener noreferrer"` in Help dialog.

If you'd like any of the recommended changes implemented, say which and I will make the edits. If you want me to proceed with all of them, I will make small, verifiable, unit-tested commits and run the existing test suite.
