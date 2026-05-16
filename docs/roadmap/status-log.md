# Cart Roadmap — Execution Status Log

## Summary

| PRD | File | Status | Started | Completed |
|-----|------|--------|---------|-----------|
| 1 — CartStore | `1-cart-store.md` | Not Started | — | — |
| 2 — Cart Drawer | `2-cart-drawer-optimistic.md` | Not Started | — | — |
| 3 — Add to Cart | `3-add-to-cart-optimistic.md` | Not Started | — | — |
| 4 — Cart Page | `4-cart-page-optimistic.md` | Not Started | — | — |

---

## PRD 1 — CartStore

**Status:** Not Started
**File:** `assets/cart-store.js` (new)

### Notes
_Add notes here as work progresses — decisions made, deviations from PRD, blockers._

### Acceptance Criteria
- [ ] `CartStore.init()` populates state from `/cart.js`
- [ ] `CartStore.optimistic(2, 4)` reflects in state immediately
- [ ] Rollback function restores exact prior state
- [ ] `pendingOps` is 0 at rest, 1 in-flight, 0 after confirm/rollback
- [ ] `subscribe()` fires immediately on registration and on every change
- [ ] `debounce(1, fn, 250)` called 5× in 100ms fires fn exactly once
- [ ] `reconcile()` updates price when server returns a different value
- [ ] `formatMoney(2999)` returns correct string for store's money format
- [ ] `CartStore` accessible as global from other scripts
- [ ] `init()` called twice does not double-fetch or double-notify

---

## PRD 2 — Optimistic Cart Drawer

**Status:** Not Started
**Files changed:** `assets/cart-drawer.js`, `snippets/cart-line-item.liquid`, `sections/cart-drawer.liquid`

### Notes
_Add notes here as work progresses._

### Acceptance Criteria
- [ ] `+` click updates qty and price instantly — before any network response
- [ ] 5 rapid `+` clicks fire exactly 1 API call
- [ ] `−` at qty 1 hides row immediately; reappears on API failure
- [ ] No `innerHTML` replacement during qty/remove — confirmed in DevTools
- [ ] Checkout button disabled with spinner while ops in-flight
- [ ] Checkout intent stored; navigation proceeds when ops clear
- [ ] Discount price change reflected via `reconcile()` without HTML re-render
- [ ] Removing all items transitions to empty state without re-render
- [ ] `open()` / `close()` animation and focus trap unchanged
- [ ] `aria-disabled` + `aria-busy` set correctly during pending state

---

## PRD 3 — Add to Cart (Optimistic + Morph)

**Status:** Not Started
**Files changed:** `assets/product-form.js` (onSubmit only), `sections/cart-drawer.liquid`
**Files added:** `assets/idiomorph.js`, update to `snippets/core-assets.liquid`

### Notes
_Add notes here as work progresses._

### Acceptance Criteria
- [ ] Drawer opens immediately on button click — before API response
- [ ] Exactly 1 API call fires — no secondary `CartAPI.get()`
- [ ] Drawer shows correct cart content after API response
- [ ] idiomorph preserves existing line item DOM nodes — no destruction
- [ ] `CartStore.state` includes new item after `confirm()`
- [ ] Checkout button disabled during add operation
- [ ] Out-of-stock: button restores, error shows on form, drawer does not open
- [ ] `idiomorph.js` loads with no console errors, zero CDN requests
- [ ] Scroll position inside drawer preserved after morph
- [ ] Submit button restores after success or failure

---

## PRD 4 — Cart Page (Optimistic)

**Status:** Not Started
**Files changed:** `assets/cart.js`, `sections/cart.liquid`

### Notes
_Add notes here as work progresses._

### Acceptance Criteria
- [ ] `+` click updates qty and price instantly
- [ ] 5 rapid `+` clicks fire exactly 1 API call
- [ ] Remove hides row immediately; restores on failure
- [ ] Last item removed transitions to empty state — no reload, no flash
- [ ] Checkout link blocked while pending; navigates automatically when clear
- [ ] Zero section rendering for qty/remove — verified in Network tab
- [ ] `CartStore.state` initializes correctly without drawer present
- [ ] Discount price change reflected via `reconcile()` — no re-render
- [ ] No `CartAPI.get()` fires during normal cart page interactions

---

## Change Log

| Date | PRD | Entry |
|------|-----|-------|
| 2026-05-16 | — | Roadmap created, all PRDs written, execution not started |
