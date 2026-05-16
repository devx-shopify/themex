# PRD: 4 — Cart Page (Optimistic)

**Phase:** 4 of 4
**Priority:** P1
**Depends on:** PRD 1 (`docs/roadmap/1-cart-store.md`), PRD 2 (`docs/roadmap/2-cart-drawer-optimistic.md`)
**Estimated scope:** Small (2 files changed)

## Context

After PRDs 1–3, CartStore is the shared state engine, the drawer is fully optimistic, and Add to Cart uses idiomorph. The `/cart` page still uses the old `assets/cart.js` — section rendering on every qty/remove, full `innerHTML` replacement on `[data-cart-page]`, and a redundant `CartAPI.get()` call when it receives a `cartUpdate` pub/sub event from an external source. One important difference from the drawer: `theme.liquid` explicitly excludes `{% section 'cart-drawer' %}` on the cart template (`unless template.name == 'cart'`), so `CartStore.init()` must run independently here.

## Goal

A rewritten `assets/cart.js` that uses CartStore for all state — same optimistic debounce pattern as the drawer, zero section rendering for qty/remove, and a checkout gate on the checkout anchor. When the last item is removed, the page transitions to the empty state without a reload.

## Requirements

### Functional

**Initialization**
- `CartStore.init()` on `DOMContentLoaded` — fetches cart state independently (drawer is not present on this page)
- Subscribe to `CartStore` for all reactive updates

**Qty increment / decrement**
- Identical to the drawer: `CartStore.optimistic()` immediately, `CartStore.debounce(line, apiCall, 250)`, `CartAPI.change()` JSON-only, `CartStore.confirm()` or `CartStore.rollback()`
- Event delegation on `[data-cart-page]` using the same `data-quantity-minus`, `data-quantity-plus`, `data-remove-item` selectors

**Remove**
- `CartStore.optimistic(line, 0)` hides row immediately, `CartAPI.change(line, 0)` fires without debounce, confirm removes element, rollback restores it

**Empty state transition**
- `sections/cart.liquid` must always render both the items grid (`[data-cart-items]`, `[data-cart-summary]`) and the empty state (`[data-cart-empty]`) — the empty block is `hidden` when `cart.item_count > 0`, visible otherwise
- When `CartStore.state.item_count === 0` after a confirm: set `[data-cart-items]` and `[data-cart-summary]` to `hidden`, remove `hidden` from `[data-cart-empty]`
- No page reload, no navigation

**Checkout gate**
- The checkout `<a href="...">` must be intercepted via a `click` listener — `event.preventDefault()` when `pendingOps > 0`, store `_checkoutPending = true`
- CartStore subscriber: when `pendingOps === 0` and `_checkoutPending`, navigate via `window.location.href = checkoutUrl`
- Do not change the Liquid element to a `<button>` — intercept in JS only (cart page checkout link differs from drawer)

**Remove the pub/sub dependency**
- Delete the `subscribe(PUB_SUB_EVENTS.cartUpdate, ...)` handler that fires `CartAPI.get()` — CartStore is now the source of truth; external updates (e.g. from a drawer on another tab) are out of scope for this page

### Non-Functional
- Zero section rendering for qty/remove — verified in Network tab
- Empty state transition has no layout flash or reload
- Same perceived latency as drawer: instant DOM update before API response

## Approach

Replace the entire contents of `assets/cart.js` with a lean `DOMContentLoaded` block: call `CartStore.init()`, subscribe, delegate qty/remove click events on `document.querySelector('[data-cart-page]')`. The CartStore subscriber checks two things: (1) if `item_count === 0`, transition to empty state; (2) if `pendingOps === 0` and `_checkoutPending`, navigate. `CartStore.reconcile()` handles all price/qty DOM updates automatically — no additional reconcile logic in cart.js.

Update `sections/cart.liquid` in two places: (1) always render `[data-cart-empty]` but conditionally `hidden` based on `cart.item_count > 0`; (2) verify `data-cart-items` and `data-cart-summary` are on the correct container elements (they already exist — confirm attribute names match). The `data-cart-line`, `data-cart-line-qty`, `data-cart-line-price` attributes come from `cart-line-item.liquid` updated in PRD 2 — the cart page uses the same snippet, so no duplicate work.

## Expected Output

- `assets/cart.js` — full rewrite, ~70–80 lines, zero section rendering
- `sections/cart.liquid` — always renders empty state block (conditionally `hidden`), verify data-attributes on containers

## Constraints

- `cart.js` loads only on the cart template (via `<script>` tag at bottom of `sections/cart.liquid`) — `CartStore.init()` inside it is safe, runs once
- No `<cart-drawer>` element on this page — `CartStore.reconcile()` null-checks already handle missing elements (per PRD 1 constraints)
- The checkout element stays as an `<a>` tag in Liquid — JS intercepts it, does not replace it
- `cart-line-item.liquid` data-attributes are already in place from PRD 2 — no additional Liquid changes to the snippet
- Remove the `subscribe(PUB_SUB_EVENTS.cartUpdate, ...)` block entirely — do not replace it with anything

## Acceptance Criteria

- [ ] Clicking `+` on the cart page updates qty and price instantly — before API response
- [ ] Clicking `+` 5× in 150ms fires exactly 1 API call
- [ ] Clicking remove hides the row immediately; row reappears if API fails
- [ ] Removing the last item transitions to empty state — no page reload, no flash
- [ ] Checkout link is blocked while ops are pending; navigates automatically when clear
- [ ] Zero section rendering for any qty/remove operation — verified in Network tab
- [ ] `CartStore.state` is correctly initialized on the cart page without the drawer being present
- [ ] When Automatic Discount changes a price after confirmation, the cart page price updates via `reconcile()` — no re-render
- [ ] No `CartAPI.get()` fires at any point during normal cart page interactions
