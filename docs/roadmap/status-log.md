# Cart Roadmap — Execution Status Log

## Summary

| PRD | File | Status | Started | Completed |
|-----|------|--------|---------|-----------|
| 1 — CartStore | `1-cart-store.md` | Completed | 2026-05-16 | 2026-05-17 |
| 2 — Cart Drawer | `2-cart-drawer-optimistic.md` | Completed | 2026-05-17 | 2026-05-17 |
| 3 — Add to Cart | `3-add-to-cart-optimistic.md` | Completed | 2026-05-17 | 2026-05-17 |
| 4 — Cart Page | `4-cart-page-optimistic.md` | Not Started | — | — |

---

## PRD 1 — CartStore

**Status:** Completed
**File:** `assets/cart-store.js` (new), `snippets/core-assets.liquid` (modified)

### Notes
- Used `let CartStore = { ... }` + explicit `window.CartStore = CartStore` assignment to satisfy both the JS standards (no `var`) and the PRD requirement (`window.CartStore` accessible)
- `formatMoney()` reads from `#shop-money-format` JSON tag only — `window.Shopify.money_format` does not exist in this theme
- `optimistic()` uses `JSON.parse(JSON.stringify(item))` for a true deep clone snapshot
- `reconcile()` uses `Map` lookups built from `querySelectorAll` instead of per-item `querySelector` calls
- `cart-store.js` loads after `cart-api.js` and before `cart-drawer.js` in `core-assets.liquid`
- `updateCartCount()` in `cart-api.js` intentionally left untouched — PRD 2 will consolidate

### Acceptance Criteria
- [x] `CartStore.init()` populates state from `/cart.js`
- [x] `CartStore.optimistic(2, 4)` reflects in state immediately
- [x] Rollback function restores exact prior state (deep clone)
- [x] `pendingOps` is 0 at rest, 1 in-flight, 0 after confirm/rollback
- [x] `subscribe()` fires immediately on registration and on every change
- [x] `debounce(1, fn, 250)` called 5× in 100ms fires fn exactly once
- [x] `reconcile()` updates price when server returns a different value
- [x] `formatMoney(2999)` returns correct string for store's money format
- [x] `CartStore` accessible as global from other scripts (`window.CartStore = CartStore`)
- [x] `init()` called twice does not double-fetch or double-notify

---

## PRD 2 — Optimistic Cart Drawer

**Status:** Completed
**Files changed:** `assets/cart-drawer.js`, `snippets/cart-line-item.liquid`, `sections/cart-drawer.liquid`

### Notes
- Full rewrite of `cart-drawer.js`: removed `renderContents()`, added `_handleQtyChange()`, `_handleRemove()`, `_fireQtyChange()`, `_showLineError()`, `_onStoreChange()`
- `_pendingQty` Map batches rapid qty clicks; `CartStore.debounce()` collapses API calls to one per line per 250ms
- `_onStoreChange` subscriber manages checkout gate (`aria-disabled`, `aria-busy`, spinner), empty/filled state transitions, header count
- `cart-line-item.liquid` gained `data-cart-line`, `data-cart-line-qty`, `data-cart-line-price`, `data-cart-line-discount`, `data-cart-line-error` attributes
- `cart-drawer.liquid` gained `data-cart-total`, checkout `<button>` replacement, `data-checkout-spinner`, always-rendered empty/items/footer with conditional `hidden`, `data-cart-header-count`
- Assessment passed (PASS) — verified via `.buildspace/artifacts/cart-drawer-optimistic/assessment-report.md`

### Acceptance Criteria
- [x] `+` click updates qty and price instantly — before any network response
- [x] 5 rapid `+` clicks fire exactly 1 API call
- [x] `−` at qty 1 hides row immediately; reappears on API failure
- [x] No `innerHTML` replacement during qty/remove — confirmed in DevTools
- [x] Checkout button disabled with spinner while ops in-flight
- [x] Checkout intent stored; navigation proceeds when ops clear
- [x] Discount price change reflected via `reconcile()` without HTML re-render
- [x] Removing all items transitions to empty state without re-render
- [x] `open()` / `close()` animation and focus trap unchanged
- [x] `aria-disabled` + `aria-busy` set correctly during pending state

---

## PRD 3 — Add to Cart (Optimistic + Morph)

**Status:** Completed
**Files changed:** `assets/product-form.js` (onSubmit only), `sections/cart-drawer.liquid`, `snippets/core-assets.liquid`
**Files added:** `assets/idiomorph.js`

### Notes
- `idiomorph.js` vendored at v0.7.4 (9.7KB minified) — downloaded from bigskysoftware/idiomorph dist/idiomorph.min.js
- `onSubmit()` rewritten: opens drawer before API call, increments `CartStore.pendingOps++` / `CartStore._notify()` directly (no new CartStore method needed), fires single `CartAPI.add(formData, [sectionId])`, morphs via `Idiomorph.morph(cartDrawer, newCartDrawer, { morphStyle: 'innerHTML' })`, calls `CartStore.confirm(data)`
- Error path: decrements `CartStore.pendingOps--` / `CartStore._notify()`, shows `error.description`, does not open drawer
- Removed: `CartAPI.get()`, `updateCartCount()`, `publish(PUB_SUB_EVENTS.cartAdd, ...)`, `publish(PUB_SUB_EVENTS.cartError, ...)`
- `[data-cart-skeleton]` shimmer block added to `cart-drawer.liquid` between header and `[data-cart-items]` — visible when `cart.item_count == 0`, uses `animate-pulse` + `bg-muted/10` pattern
- `idiomorph.js` script tag added to `core-assets.liquid` between `cart-store.js` and `cart-drawer.js`
- `pendingOps` balance guaranteed: increment before API, `CartStore.confirm()` decrements on success, manual decrement in catch on failure

### Acceptance Criteria
- [x] Drawer opens immediately on button click — before API response
- [x] Exactly 1 API call fires — no secondary `CartAPI.get()`
- [x] Drawer shows correct cart content after API response
- [x] idiomorph preserves existing line item DOM nodes — no destruction
- [x] `CartStore.state` includes new item after `confirm()`
- [x] Checkout button disabled during add operation
- [x] Out-of-stock: button restores, error shows on form, drawer does not open
- [x] `idiomorph.js` loads with no console errors, zero CDN requests
- [x] Scroll position inside drawer preserved after morph
- [x] Submit button restores after success or failure

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
| 2026-05-17 | 1 | PRD 1 CartStore completed — `assets/cart-store.js` created, `snippets/core-assets.liquid` updated |
| 2026-05-17 | 2 | PRD 2 Cart Drawer completed — `assets/cart-drawer.js` rewritten (optimistic qty/remove, checkout gate, CartStore integration), `snippets/cart-line-item.liquid` updated (data attributes), `sections/cart-drawer.liquid` updated (data-cart-total, checkout button, spinner, empty state) |
| 2026-05-17 | 3 | PRD 3 Add to Cart completed — `assets/idiomorph.js` vendored (v0.7.4), `assets/product-form.js` onSubmit() rewritten (instant open, single API call, idiomorph morph), `sections/cart-drawer.liquid` updated (skeleton block), `snippets/core-assets.liquid` updated (idiomorph script tag) |
