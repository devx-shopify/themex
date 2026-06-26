# Themex — Fastest Cart Roadmap

**Generated:** 2026-05-16
**Total PRDs:** 4

## What This Builds

A complete replacement of the Shopify cart system. Current architecture: section rendering on every operation, full `innerHTML` replacement, no shared state, race conditions on rapid clicks, double API call on Add to Cart. New architecture: client-side CartStore as the single source of truth, optimistic DOM updates at click time, JSON-only API for qty/remove, idiomorph surgical morph for Add to Cart, checkout gate until all ops clear.

## Design Principles

- **Optimistic first** — UI updates before the API responds, every time
- **JSON-only for mutations** — section rendering only where genuinely needed (Add to Cart)
- **One source of truth** — CartStore owns all state; components subscribe, never own state
- **Simple** — no framework, no bundler change, no new abstractions beyond what's required

## Phase Tree

```
1. CartStore — Core Foundation .............. [PRD]  1-cart-store.md
2. Optimistic Cart Drawer ................... [PRD]  2-cart-drawer-optimistic.md
3. Add to Cart — Optimistic + Morph ......... [PRD]  3-add-to-cart-optimistic.md
4. Cart Page — Optimistic ................... [PRD]  4-cart-page-optimistic.md
```

## Execution Order

| # | PRD | Depends On | Parallel With |
|---|-----|------------|---------------|
| 1 | CartStore | — | — |
| 2 | Cart Drawer | #1 | — |
| 3 | Add to Cart | #1, #2 | #4 |
| 4 | Cart Page | #1, #2 | #3 |

## Files Changed

| File | Change |
|------|--------|
| `assets/cart-store.js` | **New** — CartStore singleton |
| `assets/idiomorph.js` | **New** — vendored morph library (~3KB) |
| `assets/cart-drawer.js` | **Rewrite** — CartStore subscriber, zero section rendering |
| `assets/cart.js` | **Rewrite** — CartStore subscriber, zero section rendering |
| `assets/product-form.js` | **Partial** — only `onSubmit()` rewritten |
| `snippets/cart-line-item.liquid` | **Update** — add full data-attribute contract |
| `sections/cart-drawer.liquid` | **Update** — data-cart-total, checkout button, skeleton |
| `sections/cart.liquid` | **Update** — always render empty state, verify data-attributes |
| `snippets/core-assets.liquid` | **Update** — add idiomorph.js before cart-drawer.js |

## Files Unchanged

| File | Reason |
|------|--------|
| `assets/cart-api.js` | Clean network layer — kept as-is |
| `assets/pubsub.js` | Still used for variant change events |

## Start Here

`docs/roadmap/1-cart-store.md`

Build phases in order. Phases 3 and 4 can be built in parallel once phase 2 is complete.
