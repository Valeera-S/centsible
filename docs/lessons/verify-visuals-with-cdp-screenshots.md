# Verify UI visually via puppeteer-core screenshots, not raw headless flags

Date: 2026-06-11 (phase 3)

## Mistake

Tried to verify the dashboard with `msedge --headless --screenshot` and `--dump-dom`.
Screenshots came out blank (the app mounts async after IndexedDB seeding, which the
virtual-time budget cut off) and `--dump-dom` printed nothing at all on Windows
PowerShell (Edge detaches from the console, stdout is lost). Wasted several rounds.

## Correct approach

`scripts/screenshot.mjs` drives the locally installed Edge through puppeteer-core
(devDependency, no browser download): real waits (`networkidle0`), console/pageerror
forwarding, optional demo-data seeding into IndexedDB, full-page capture. Works for
desktop and 375px mobile shots and will produce the README screenshots later.

## Bonus bug it surfaced

main.tsx rendered nothing when IndexedDB seeding failed - a silent blank page. It now
catches the failure and renders an explicit storage-unavailable message.

## Why

Async-mounting local-first apps need a real readiness signal before capture; raw
headless flags give none, and on Windows Edge you cannot even see why. CDP gives
console output, errors, and deterministic waits.
