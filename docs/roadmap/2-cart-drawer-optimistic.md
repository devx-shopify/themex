# PRD: 2 — Optimistic Cart Drawer

**Phase:** 2 of 4
**Priority:** P0
**Depends on:** PRD 1 (`docs/roadmap/1-cart-store.md`)
**Estimated scope:** Medium (3 files changed, 1 file added)

## Context

After PRD 1, `CartStore` is live. The existing `assets/cart-drawer.js` fires `CartAPI.change()` with `sections=[sectionId]` on every qty/remove, waits for a server-rendered HTML string, and calls `this.innerHTML = newContent.innerHTML` — destroying and recreating the full DOM on every interaction. There are no data-attributes on `cart-line-item.liquid` or `cart-drawer.liquid` for targeted updates. This phase replaces that entire flow for qty and remove: no section rendering, no innerHTML replacement, zero visible latency.

## Goal

A fully rewritten `CartDrawer` Web Component that subscribes to `CartStore`, applies qty and remove changes optimistically (instant DOM feedback at click time), debounces API calls at 250ms per line, and gates the checkout button with a spinner while any operation is in-flight. The Liquid templates gain the data-attribute contract that allows `CartStore.reconcile()` to do surgical per-node updates.

## Requirements

### Functional

**Qty increment / decrement**
- On `+` or `−` click: read current quantity from `[data-cart-line-qty="{n}"]`, call `CartStore.optimistic(line, newQty)` immediately, then `CartStore.debounce(line, apiCall, 250)`
- When debounce fires: `CartAPI.change(line, qty)` — **no `sections` param**, JSON only
- On success: `CartStore.confirm(data)`
- On failure: `CartStore.rollback(rollbackFn)`, show inline error

**Remove (qty → 0)**
- On remove button or `−` at qty 1: `CartStore.optimistic(line, 0)` immediately (hides the row via CSS, not DOM removal yet), fire `CartAPI.change(line, 0)` without debounce
- On confirm: `CartStore.reconcile()` removes the `[data-cart-line="{n}"]` element from DOM
- On rollback: restore the row (rollback function restores state, reconcile restores visibility)

**Checkout gate**
- The checkout element in `cart-drawer.liquid` must be changed from `<a href="...">` to `<button type="button" data-cart-checkout>` that navigates via `window.location.href` when clicked
- `CartDrawer` subscribes to `CartStore`. When `pendingOps > 0`: disable checkout button, show spinner inside it, set `aria-disabled="true"` and `aria-busy="true"`
- If user clicks checkout while pending: store `_checkoutPending = true`, navigate when subscriber next fires with `pendingOps === 0`
- When `pendingOps === 0`: restore button, navigate if `_checkoutPending`

**Remove `renderContents()`**
- Delete `renderContents()` entirely — the drawer never replaces its own HTML for qty/remove
- Remove `data-section-id` dependency for qty/remove operations
- Keep `open()`, `close()`, focus trap, overlay click — unchanged

**Cart count badge**
- `CartStore.reconcile()` already handles `[data-cart-count]` — no separate `updateCartCount()` call needed from the drawer

**Empty drawer state**
- When `CartStore.state.item_count === 0` after a confirm: swap visibility between `[data-cart-items]` + `[data-cart-footer]` (hide) and `[data-cart-empty]` (show) — no re-render

### Non-Functional
- 0ms perceived latency on qty change — DOM updates before any network activity
- No focus loss, no scroll reset, no animation interruption on qty/remove
- `aria-disabled` + `aria-busy` on checkout button during pending state

## Approach

Rewrite `assets/cart-drawer.js` keeping the `CartDrawer` class shell and all `open()`/`close()`/focus-trap methods verbatim — they are correct. In `connectedCallback()`, call `CartStore.subscribe()` with a handler that manages the checkout gate and empty-state visibility. Replace `handleQuantityChange()` and `updateQuantity()` with a single delegated click handler that calls `CartStore.optimistic()` then `CartStore.debounce()`. For remove, skip debounce. Delete `renderContents()`, `handleNoteChange()`, and the `unsubscribeCartAdd` pub/sub listener — those patterns are gone.

Update `snippets/cart-line-item.liquid` to add the full data-attribute set on every dynamic element (see PRD 1 contract). Update `sections/cart-drawer.liquid` to: (1) add `data-cart-total` to the subtotal span, (2) change the checkout `<a>` to a `<button data-cart-checkout>`, (3) ensure `[data-cart-empty]` is always rendered (currently only rendered in the `else` block — move it inside the panel and toggle visibility via JS).

## Expected Output

- `assets/cart-drawer.js` — full rewrite, ~130 lines, zero section rendering
- `snippets/cart-line-item.liquid` — adds `data-cart-line`, `data-cart-line-qty`, `data-cart-line-price`, `data-cart-line-unit-price`, `data-cart-line-discount` attributes to existing elements
- `sections/cart-drawer.liquid` — adds `data-cart-total`, converts checkout to `<button data-cart-checkout>`, always renders empty state

## Constraints

- `CartAPI.change()` must be called without `sections` param — verify `cart-api.js` default is no sections (it is — `sections = []` default)
- `cart-line-item.liquid` is shared between drawer and cart page — attribute additions here apply to both surfaces
- The `PUB_SUB_EVENTS.cartAdd` subscription in current `cart-drawer.js` is deleted — Add to Cart will use a different mechanism (PRD 3)
- Line items use 1-based index from `forloop.index` in Liquid — keep consistent with CartStore's 1-based convention
- Row hide on optimistic remove: use `hidden` attribute or a CSS utility class, not `display:none` inline style (no inline styles via JS — per project JS standards)

## Acceptance Criteria

- [ ] Clicking `+` updates the qty input value and line price instantly — before any network response
- [ ] Clicking `+` 5× in 150ms fires exactly 1 API call with the final quantity
- [ ] Clicking `−` at qty 1 hides the line item row immediately; item reappears if API fails
- [ ] No `innerHTML` replacement occurs during qty/remove — confirm with DevTools element inspector (no node recreation, no flicker)
- [ ] Checkout button is disabled with spinner while any cart op is in-flight
- [ ] Clicking checkout while pending stores intent; navigation proceeds automatically when ops clear
- [ ] When Automatic Discount changes a price after confirmation, `reconcile()` updates price display without re-rendering HTML
- [ ] Removing all items transitions drawer to empty state without re-rendering drawer HTML
- [ ] `open()` / `close()` animation and focus trap work identically to before this refactor
- [ ] `aria-disabled="true"` and `aria-busy="true"` on checkout button during pending state
