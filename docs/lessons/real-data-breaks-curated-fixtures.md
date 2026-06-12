# The first real-world paste broke five format assumptions the fixture hid

Date: 2026-06-12 (post-release hotfix)

## Mistake

The memo parser was validated against a curated two-week excerpt the user provided
during planning. Their first paste of the FULL year of real notes failed on five
variations the excerpt never showed:

1. Year and month as separate bare lines (`2025`, `6月`) instead of `2025年6月` -
   which also silently dropped the year context, dating everything a year late.
2. Year rollover mid-memo (12月 ... 1月 must become the next year).
3. `号` as the day suffix (`6月9号`), not just `日`.
4. Colon-separated items (`买菜：23.79`, `Cursor: 22.13`).
5. Description-less amounts (`4月5日：18.05`).

The subtotal checksum was also global, but the user's 总 lines are per
blank-line-separated block, and some blocks have no 总 at all - so even correct
parses warned.

## Correct approach

- The complete real memo (about 250 lines, June 2025 to June 2026) is now a
  permanent fixture (`memo.fullYear.test.ts`): all 45 hand-written 总 lines must
  reconcile block-by-block, and the only allowed unparsed line is the genuine typo
  `1213日：无`.
- Subtotal checks are per paragraph, matching how the human actually wrote them.

## Why

A format that a person typed by hand over a year WILL drift: separators, suffixes,
headers, omissions. A curated excerpt validates the parser you wrote; the full
corpus validates the data you actually have. Get the largest real sample into the
test suite as early as the owner can provide it - and when they cannot, treat the
first real import as a scheduled hardening pass, not a surprise.
