# Anchor fixture tests to independently computed truth, not re-derived numbers

Date: 2026-06-11 (phase 1)

## Mistake (twice in one phase)

Two domain tests failed not because the code was wrong but because the expected
values I wrote were wrong:

1. Memo fixture: I asserted 13 purchases after miscounting by eye; the parser
   correctly found 14.
2. Budget future-month case: I asserted safe-to-spend assuming zero spend, while the
   fixture month deliberately contained booked transactions.

## What caught it

The memo test also asserted against the user's own hand-computed weekly subtotals
(274.23 and 161.12), which the parser reproduced exactly. That independent anchor
proved the parser right and my count wrong within seconds.

## Effective practice

When writing tests around a data fixture, include at least one assertion tied to a
value computed outside this session (a user's hand total, a bank statement sum). When
a test fails, first decide which is wrong - code or expectation - before "fixing"
either; a failing test with a correct implementation is a test bug and should be
corrected as such, not papered over.
