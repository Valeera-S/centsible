# Testing Library needs manual cleanup when vitest globals are off

Date: 2026-06-11 (phase 2)

## Mistake

Component tests failed with "Found multiple elements with the role textbox": every
test rendered into a DOM still holding the previous test's tree. React Testing
Library auto-registers its afterEach cleanup ONLY when the test runner exposes
global hooks; this project runs vitest without `globals: true`, so no cleanup was
ever registered. The first component test file (single test) masked the problem.

## Correct approach

Register cleanup explicitly in the shared setup file (src/test/setup.ts):

    import { cleanup } from '@testing-library/react';
    import { afterEach } from 'vitest';
    afterEach(cleanup);

## Why

Explicit-imports style (no test globals) is worth keeping for lint-able, traceable
tests, but it opts out of RTL's convenience hook. One line in the setup file restores
it for every test file at once; fixing it per-file would invite recurrence.
