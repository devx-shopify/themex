# PRD: 2 — Rewire Modal JS to Semantic /search

**Phase:** 2 — Rewire Modal JS to Semantic /search
**Priority:** P0
**Depends on:** Phase 1 — Compact Modal-Results Section (`docs/roadmap/1-modal-results-section.md`)
**Estimated scope:** Small (1 file)

## Context

After Phase 1, `sections/search-modal-results.liquid` exists and is registered in `templates/search.json`, exposing semantically-capable results (via the `search` object) through the Section Rendering API at `/search?...&section_id=<id>`, wrapped in `#search-modal-section-results`. Currently `assets/predictive-search.js` fetches `/search/suggest?...&section_id=predictive-search` (keyword-only `predictive_search`) and injects `#predictive-search-section-results` into `#predictive-search-results`. This phase repoints that fetch at the semantic route while preserving all existing modal behavior.

## Goal

The search modal returns live, semantically-ranked results as the user types, sourced from the `/search` route via the Section Rendering API, with suggestions / recent searches / recently viewed and all interaction behavior unchanged.

## Requirements

### Functional
- Replace the fetch URL with `/search?q=QUERY&type=product,article,page&options[prefix]=last&section_id=<id>` (id from Phase 1), using `window.Shopify.routes.root` as the base.
- Extract `#search-modal-section-results` from the returned HTML and inject into `#predictive-search-results`.
- Preserve: 300ms debounce, `AbortController` cancellation, min 2-char trigger, loading/results/default state toggling, `window.searchRecentSearches?.trackSearch()` calls, and Enter-to-full-`/search`-page navigation.
- Live-as-you-type: fetch fires on each debounced keystroke (≥2 chars).

### Non-Functional
- No new dependencies; vanilla JS matching existing style.
- Gracefully handle fetch failure / empty results (clear container, restore default content) — no console errors on abort.

## Approach

Edit `assets/performSearch()` in `assets/predictive-search.js`: change the `URLSearchParams` and endpoint from `search/suggest` to `search`, adding `type=product,article,page` and `options[prefix]=last` (note bracket keys — build the query string so brackets are preserved, e.g. append `options[prefix]=last` directly rather than relying on a plain object that mangles it). Update the `DOMParser` extraction to target `#search-modal-section-results` instead of `#predictive-search-section-results`. Read the target `section_id` from a `data-*` attribute on the modal/input container (added in markup) rather than hardcoding, keeping DOM targeting via `data-*` per project convention. Leave the debounce, abort, keydown/Enter, and state-toggle logic intact. Invoke `shopify-theme-toolkit:js-standards` before writing; if a `data-*` attribute must be added to `snippets/search-modal.liquid`, invoke `shopify-theme-toolkit:liquid-standards` too.

## Expected Output

- `assets/predictive-search.js` — fetch repointed to the semantic `/search` route with prefix matching, extraction container updated.
- (If needed) `snippets/search-modal.liquid` — a `data-*` attribute carrying the `section_id`.

## Dependencies

### Upstream (must be done first)
- Phase 1 — provides the section id and `#search-modal-section-results` extraction contract.

### Downstream (unblocked by this phase)
- Phase 3 (`docs/roadmap/3-semantic-verification.md`) — needs the working modal fetch to verify semantic ranking end-to-end.

## Constraints

- Bracketed query params (`options[prefix]`, `type`) must survive URL encoding — verify the emitted URL string.
- Section Rendering API requests count toward storefront rate limits; debounce + abort must stay to avoid request storms.
- Do not modify recent searches, recently viewed, or the default-content flow.

## Acceptance Criteria

- [ ] Typing in the modal fetches `/search?...&section_id=<id>` (verifiable in Network tab), not `/search/suggest`.
- [ ] Results (products/articles/pages) render live in the modal as the user types.
- [ ] Partial words match (e.g. "sho" surfaces "shoes") via `options[prefix]=last`.
- [ ] Debounce, abort-on-new-keystroke, loading state, and Enter-to-full-page all still work.
- [ ] Recent searches and recently viewed still render as default content and on tracking.
- [ ] No console errors on rapid typing or aborted requests.
