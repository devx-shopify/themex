# PRD: 3 — Semantic Verification & Usage Doc

**Phase:** 3 — Semantic Verification & Usage Doc
**Priority:** P1
**Depends on:** Phase 1 (`docs/roadmap/1-modal-results-section.md`), Phase 2 (`docs/roadmap/2-modal-js-rewire.md`)
**Estimated scope:** Small (1 doc file)

## Context

After Phases 1–2, the modal fetches results from the `/search` route via the Section Rendering API. The one unresolved assumption in this whole effort is whether Shopify's native semantic ranking actually applies when `/search` is rendered through the Section Rendering API, versus a normal full-page load — this is undocumented and must be confirmed empirically, not assumed. This phase verifies it against an eligible store and records how the feature behaves across plans for the internal team reusing this boilerplate.

## Goal

Documented, empirical confirmation of whether semantic ranking flows through the Section Rendering API, plus a short reuse/troubleshooting note for the internal team.

## Requirements

### Functional
- Run a meaning-based query (e.g. "party shoes", "something warm for winter") against three paths on an eligible store and compare result ordering:
  1. Normal page load `/search?q=QUERY`
  2. Section Rendering API `/search?q=QUERY&section_id=<id>`
  3. Predictive `/search/suggest?q=QUERY` (keyword baseline)
- Determine whether path 2's ranking matches path 1 (semantic) or path 3 (keyword).
- Document the result, the test queries used, and the date/plan tested.

### Non-Functional
- Doc is concise and reusable — a teammate can re-run the check on their own store.

## Approach

Use the Shopify MCP `graphql_query` / store tools or a live theme preview to execute the three fetches and capture ordered result IDs for each. Compare path 2 against paths 1 and 3 to classify its ranking. Record findings in `docs/semantic-search.md`: (a) the empirical verdict with evidence, (b) plan-eligibility notes (Grow/Advanced/Plus, <200k products, non-Japanese locale, Search & Discovery installed) and that ineligible plans silently fall back to keyword ranking on the same `/search` route, (c) that predictive typeahead is inherently keyword-only per Shopify docs, and (d) a fallback recommendation if verification shows semantic does NOT flow through Section Rendering (e.g. accept keyword ranking in-modal, or explore a third-party/custom vector layer). No standards skills needed (doc only), but confirm claims against Shopify docs before writing.

## Expected Output

- `docs/semantic-search.md` — verification method, empirical verdict, plan matrix, and reuse/troubleshooting notes for the internal team.

## Dependencies

### Upstream (must be done first)
- Phases 1 & 2 — provide the working section and modal fetch to test.

### Downstream (unblocked by this phase)
- None — terminal phase.

## Constraints

- Verification requires an eligible store (Grow/Advanced/Plus with Search & Discovery); note if only an ineligible store is available and defer the semantic-specific assertion.
- Do not claim semantic works through the Section Rendering API unless the test demonstrates it.

## Acceptance Criteria

- [ ] Three-path comparison run with documented queries and captured result orderings.
- [ ] Clear verdict recorded: does path 2 rank semantically (matches path 1) or as keyword (matches path 3)?
- [ ] `docs/semantic-search.md` documents plan eligibility, graceful degradation on ineligible plans, and predictive-typeahead keyword limitation.
- [ ] A fallback recommendation is documented in case semantic does not flow through the Section Rendering API.
