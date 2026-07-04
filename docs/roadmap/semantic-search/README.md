# Semantic Search in Search Modal — Roadmap

**Generated:** 2026-07-01
**Total phases:** 3
**Total PRDs:** 3

## Overview

Bring Shopify's native semantic search into the themex search modal by swapping the modal's results data source from the keyword-only predictive search endpoint (`/search/suggest`, `predictive_search` object) to the `/search` route (`search` object) via the Section Rendering API. Semantic is the only mode: because `/search` works on every plan — keyword-ranked on ineligible plans, semantically ranked on eligible ones (Search & Discovery) — it degrades gracefully with no runtime plan detection or theme-setting toggle. Suggestions, recent searches, and recently viewed are preserved exactly as-is. This is a reusable feature for the internal boilerplate theme.

## Phase Tree

```
1. Compact Modal-Results Section ............ [PRD]
2. Rewire Modal JS to Semantic /search ...... [PRD]
3. Semantic Verification & Usage Doc ........ [PRD]
```

## Execution Order

| Order | PRD | Path | Depends On | Can Parallel With | Status |
|-------|-----|------|------------|-------------------|--------|
| 1 | Compact Modal-Results Section | `docs/roadmap/semantic-search/1-modal-results-section.md` | None | — | Not Started |
| 2 | Rewire Modal JS to Semantic /search | `docs/roadmap/semantic-search/2-modal-js-rewire.md` | #1 | — | Not Started |
| 3 | Semantic Verification & Usage Doc | `docs/roadmap/semantic-search/3-semantic-verification.md` | #1, #2 | — | Not Started |

## How to Use This Roadmap

Each `.md` file marked [PRD] is a self-contained specification. Hand any PRD
to a developer or AI development pipeline — it contains full context,
requirements, approach, and acceptance criteria.

**Start here:** `docs/roadmap/semantic-search/1-modal-results-section.md`
