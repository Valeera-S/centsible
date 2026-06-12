# Contributing to Centsible

Thanks for considering a contribution. A few ground rules keep the project easy to
maintain:

## Principles

- **Local-first is non-negotiable.** No feature may send user data to a server,
  add telemetry, or fetch third-party resources at runtime. Fonts and all assets
  are bundled.
- **Money is integer cents.** Never put an amount through floating-point math;
  parse strings with `parseAmount` and format with `formatCents`.
- **Business logic lives in `src/domain/`** with zero browser dependencies and
  unit tests. Only `src/db/` touches IndexedDB. UI components stay thin.
- **All user-facing strings** go through `src/i18n/strings.ts`.
- **No emoji** anywhere in the codebase, UI, or docs.

## Workflow

1. Write a failing test first (vitest; jsdom and fake-indexeddb are set up).
2. Make it pass, keep the change minimal.
3. Run the full gate locally before pushing:

   ```sh
   npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
   ```

4. CI runs the same gate on every push and pull request.

## Commit messages

Plain, descriptive commit messages. No attribution trailers.

## Bug reports

Include the input that misbehaved (a memo line, a CSV row, a quick-entry string)
and what you expected; parser issues are usually one failing test away from a fix.
