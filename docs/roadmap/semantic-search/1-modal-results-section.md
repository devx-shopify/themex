# PRD: 1 — Compact Modal-Results Section

**Phase:** 1 — Compact Modal-Results Section
**Priority:** P0
**Depends on:** None — can start immediately
**Estimated scope:** Small (2 files)

## Context

The search modal (`snippets/search-modal.liquid`, driven by `assets/search-modal.js` and `assets/predictive-search.js`) currently renders live results by fetching `/search/suggest?...&section_id=predictive-search`, which uses the keyword-only `predictive_search` Liquid object via `sections/predictive-search.liquid`. To bring semantic ranking into the modal we need a results surface backed by the `search` object instead, because Shopify's native semantic search applies to the `/search` route — not to predictive search. `templates/search.json` currently registers a single section: id `main`, type `search`.

## Goal

A compact, modal-friendly results section rendered from the `search` object, registered in `templates/search.json` so it can be fetched in isolation via the Section Rendering API, and hidden on the standalone `/search` page.

## Requirements

### Functional
- New section renders `search.results` grouped by type: products, articles, pages — mirroring the current predictive modal layout in `sections/predictive-search.liquid`.
- Output is wrapped in a single container with a stable id (e.g. `#search-modal-section-results`) that the modal JS can extract.
- Renders a "View all results" link to `{{ routes.search_url }}?q=...` and a no-results message using existing `search.*` translation keys.
- Section is registered in `templates/search.json` but produces no visible output on a normal `/search` page load (hidden via a wrapper so it only serves the Section Rendering API fetch).

### Non-Functional
- Match existing predictive modal styling (Tailwind utilities, `product.featured_image` thumbnails, `money` filter, `line-clamp` for article excerpts).
- All images `loading="lazy"`; titles escaped.

## Approach

Create `sections/search-modal-results.liquid` using the `search` object (`search.performed`, `search.results`, `search.results_count`, `search.terms`). Iterate `search.results` and branch on `result.object_type` (`product` / `article` / `page`) to build three grouped lists, porting the markup and classes from `sections/predictive-search.liquid` lines 26–131. Wrap everything in `<div id="search-modal-section-results">`. Register the section in `templates/search.json` as a second entry (e.g. key `modal_results`, type `search-modal-results`) and add it to the `order` array; to keep it invisible on the real `/search` page, gate the standalone render (e.g. wrap in an element with the `hidden` class that only the modal JS strips when injecting). Keep the `{% schema %}` minimal with no settings. Invoke `shopify-theme-toolkit:section-standards`, `shopify-theme-toolkit:section-schema-standards`, and `shopify-theme-toolkit:liquid-standards` before writing.

## Expected Output

- `sections/search-modal-results.liquid` — compact grouped results from the `search` object, wrapped in `#search-modal-section-results`.
- `templates/search.json` — updated to register the new section so `/search?section_id=<id>` can render it.

## Dependencies

### Upstream (must be done first)
- None.

### Downstream (unblocked by this phase)
- Phase 2 (`docs/roadmap/2-modal-js-rewire.md`) — needs the section id (`section_id`) and the extraction container id as its output contract.

## Constraints

- The Section Rendering API can only render a section that is registered in the requested route's template — hence the `templates/search.json` change is mandatory.
- Must not alter `sections/predictive-search.liquid`, `sections/search.liquid`, recent searches, or recently viewed.
- File naming kebab-case; settings IDs snake_case; use `{% render %}` not `{% include %}`.

## Acceptance Criteria

- [ ] `sections/search-modal-results.liquid` renders products, articles, and pages from `search.results`, grouped with headers.
- [ ] Output is wrapped in a single stable-id container the JS can select.
- [ ] Section registered in `templates/search.json` and renderable via `/search?q=QUERY&section_id=<id>`.
- [ ] Visiting `/search?q=QUERY` in a browser shows no new/duplicate visible results block (section stays hidden on the real page).
- [ ] No-results state and "view all" link render using existing `search.*` translations.
- [ ] Existing predictive section, search page, recent searches, and recently viewed are unchanged.
