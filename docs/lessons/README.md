# Lessons

Working notes for this project: hard-won facts, corrected mistakes, and practices that
proved effective. Progressive disclosure: this index gives one line per lesson; open the
file for the full story.

Rules for this folder:

- One lesson per file, named `kebab-case.md`.
- Record both mistakes and effective practices, always with the why.
- Update the existing note when new evidence arrives; do not create near-duplicates.
- Delete a note outright if it turns out to be wrong.

## Index

- [sms-auto-capture-infeasible](sms-auto-capture-infeasible.md) - why automatic
  transaction capture was dropped and what replaced it
- [npm-create-arg-forwarding](npm-create-arg-forwarding.md) - npm silently drops flags
  after `--` (create and run scripts alike); invoke tools via npx and verify flags took
- [anchor-tests-to-independent-truth](anchor-tests-to-independent-truth.md) - fixture
  tests need an expectation computed outside the session; decide code-vs-test before
  fixing a failure
- [rtl-cleanup-without-globals](rtl-cleanup-without-globals.md) - without vitest
  globals, register Testing Library cleanup in the setup file or DOM leaks across tests
- [verify-visuals-with-cdp-screenshots](verify-visuals-with-cdp-screenshots.md) - raw
  msedge --headless flags give blank shots and no stdout; use scripts/screenshot.mjs
  (puppeteer-core); also surfaced the blank-page-on-storage-failure bug
- [unique-labels-per-page](unique-labels-per-page.md) - duplicate label text across
  forms on one page breaks both accessibility and tests; fix markup first, then scope
  queries to rows
- [real-data-breaks-curated-fixtures](real-data-breaks-curated-fixtures.md) - the
  first full-year paste broke five format assumptions the two-week excerpt hid; the
  whole corpus is now a permanent fixture with per-block checksums
