# SMS auto-capture is infeasible for this product; import + fast entry replace it

Date: 2026-06-11 (planning phase)

## Finding

Automatic expense capture from SMS was a requested feature but was dropped after
checking the actual constraints:

- iOS forbids third-party SMS access entirely (system-level, no exceptions).
- Web apps (including PWAs) cannot read SMS on any platform; only a native Android app
  with READ_SMS permission could, which forces a native build for one fragile feature.
- US banks (Chase etc.) notify by email/app push, not SMS, and the primary user pays
  with a physical card, so there is usually no SMS to read in the first place.

## What replaced it

Three cheaper paths cover the same need (low-friction recording):

1. One-line natural-language quick entry ("coffee 6.5").
2. Voice input via Web Speech API feeding the same parser.
3. Periodic bank CSV import with dedup, which catches everything missed manually.

## Why this matters

Validate platform capabilities before promising an automation feature. The flashy
feature (auto-capture) lost to boring ones (import + parser) on actual feasibility.
