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
