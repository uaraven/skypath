# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**FlightPlan** — a static single-page web app (no backend) for planning astronomical observations: pick a target (Messier object or planet), a date, and an observatory (location + custom horizon), and see the target's sky trajectory plus rise/set/culmination and twilight times. Deploys as plain files to S3 as part of the voronin.cc site. The directory is named `skyproject/` for historical reasons; the project name is FlightPlan.

## Current state: planning phase — no code yet

All work so far lives in `.plan/`:

- `.plan/flightplan-spec.md` — requirements (source of truth for functionality)
- `.plan/implementation-plan.md` — tech decisions, architecture, phases 0–9 with "done when" criteria
- `.plan/state.md` — per-phase status table and decision log. **Keep this updated**: mark phase status changes and append dated log entries for any decision or requirement change.
- `altitude.png` / `azimutal.png` — reference renderings the two chart types must visually match

Once Phase 0 scaffolding lands, update this file with the real build/test/dev commands.

## Decided stack (do not re-litigate without the user)

- Vite + Svelte 5 + TypeScript, `base: './'` (must keep working from both a subdomain and a path prefix — final URL is an open question)
- `astronomy-engine` (npm) for all ephemeris math — do not hand-roll coordinate transforms or rise/set searches
- Hand-rolled SVG for both charts (no charting library)
- Vitest for unit tests; astronomy results validated against Stellarium/USNO reference values
- `localStorage` for all persistence (single versioned key `flightplan.observatories.v1`); no backend ever

## Styling

Must match the main site, whose sources are in the sibling repo `../voronin_cc` (Eleventy site; CSS at `static/css/styles.css`, fonts in `_includes/head.html`). Design tokens are already extracted into the implementation plan's "Visual design" section — use those as CSS custom properties in `src/theme.css` rather than re-deriving from the site. Fonts come from Google Fonts CDN (Red Hat Display, Fira Code), same `<link>` tags as the main site. External CDN resources are allowed; only a backend is excluded.

## Domain notes

- Horizon files are NINA-compatible: plain text, one `azimuth altitude` pair per line (azimuth 0–359°); interpolation must wrap around 360°→0°.
- "Above horizon" events compare object altitude to the *user horizon* altitude at the object's current azimuth — distinct from the "above 0°" events; both are reported.
- Charts are centered on local midnight (time axis ≈ noon→noon); handle circumpolar / never-rises objects and polar day/night explicitly.
- Times display in the browser's local timezone (known limitation, noted in plan).
