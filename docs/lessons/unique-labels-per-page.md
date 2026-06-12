# Keep form labels unique per page, or accessible queries turn ambiguous

Date: 2026-06-11 (phase 4)

## Mistake

Adding the recurring-rule form to the settings page introduced a second "Name" label
(the category form already had one), and the rule's category dropdown put every
category name into the DOM a second time. Three existing tests broke at once with
"Found multiple elements" - and a screen-reader user would have faced the same
ambiguity the test runner did.

## Correct approach

- Give each form on a page distinct label text ("Name" vs "Rule name"); the
  accessibility tree is page-global, not per-form.
- In tests, treat a category/entity name as non-unique by construction once any
  select lists it; scope queries to the row (`within(li)`) or use a helper like
  `findCategoryRow()` instead of `getByText`.

## Why

Testing Library queries fail on ambiguity precisely because assistive technology
suffers from it. When a test breaks this way, the right fix is usually in the
markup (better labels) first and the query second; here it was one of each.
