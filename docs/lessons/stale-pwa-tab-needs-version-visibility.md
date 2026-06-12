# A stale PWA tab silently runs old code; show the version and ship an undo

Date: 2026-06-12 (post-release)

## Mistake

Hours after the memo-parser fix deployed, the user imported their data and got
year-2026 dates and missing 号 lines again. Nothing was wrong with the deploy: their
tab (or the service worker cache) was still running the previous build. autoUpdate
only takes effect after the new worker activates and the page reloads, so anything
the user does in an open tab right after a deploy runs old code - and there was no
way for either of us to tell which version the page was.

Compounding it, the planned "danger zone (wipe data)" settings feature had been
silently dropped during phase 2, so there was no in-app way to recover from the bad
import short of clearing browser site data.

## Correct approach

- The footer now shows the build version (vite define from package.json), so "which
  version are you on" is answerable with a glance and a screenshot.
- Settings has an Erase-all-data button (confirm-gated, restores seeds) - bad imports
  are now recoverable in two clicks.
- When diagnosing a "fixed bug came back" report on a PWA, check version skew before
  re-opening the parser: the exact arithmetic of the wrong numbers identified the old
  build here (the wrong total matched the old parser's known blind spots to the cent).

## Why

Local-first PWAs have no server logs; the user's tab is the deployment. Version
visibility and a data reset are not polish, they are the support toolkit. And when a
plan line item quietly disappears (the wipe button), it resurfaces at the worst time;
acceptance checklists should be generated from the plan, not from memory.
