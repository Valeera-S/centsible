# Centsible

Local-first expense tracker PWA. React 19 + TypeScript (strict) + Vite + Dexie.
Money is always integer cents; dates are ISO `yyyy-mm-dd` strings.

## Hard rules

- Git commits must NOT include any "Co-Authored-By: Claude" trailer or AI attribution.
- No emoji anywhere in the repo: code, UI strings, docs, README, commit messages.
- Comments are concise and only state what the code cannot (constraints, why); never
  narrate what a line does.
- `src/domain/` is pure TypeScript with zero browser/DOM/Dexie imports; all business
  logic lives there and is unit-tested. Only `src/db/` touches IndexedDB.
- All UI strings go through `src/i18n/strings.ts` (English v1, i18n-ready).

## Workflow

- Each phase ends with: all checks pass locally, a fresh-context verifier subagent
  passes the phase checklist, and `docs/lessons/` is updated (one lesson per file,
  update rather than duplicate, delete notes proven wrong).
- Progress reports only claim what was actually run and observed; label anything else
  "not verified".
- Ask the user before outward-facing actions (publishing the repo, pushing, Pages).
- Never install dependencies globally. npm installs stay project-local (node_modules);
  any future Python tooling must run inside a venv.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint` / `npm run typecheck` / `npm run format:check`
- `npm test` (Vitest, jsdom; setup in `src/test/setup.ts`)
