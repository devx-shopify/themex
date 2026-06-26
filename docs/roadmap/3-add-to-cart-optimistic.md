# PRD: 3 — Add to Cart (Optimistic + Morph)

**Phase:** 3 of 4
**Priority:** P0
**Depends on:** PRD 1 (`docs/roadmap/1-cart-store.md`), PRD 2 (`docs/roadmap/2-cart-drawer-optimistic.md`)
**Estimated scope:** Medium (3 files changed, 1 file vendored)

## Context

After PRD 2, qty/remove in the drawer are fully optimistic and JSON-only. Add to Cart is the one operation that genuinely needs section rendering — it introduces a new line item requiring server-rendered Liquid HTML. Currently `product-form.js` makes two API calls (add + a redundant `CartAPI.get()` for item count), relies on `PUB_SUB_EVENTS.cartAdd` to trigger `renderContents()`, and the drawer replaces its entire innerHTML. This phase eliminates the double API call, opens the drawer instantly with a loading state, and uses `idiomorph` to surgically morph the drawer DOM when the server response arrives — no full innerHTML replacement.

## Goal

When Add to Cart is clicked: the drawer opens immediately, a skeleton loading state is visible, one API call fires (with section rendering), and when the response arrives `idiomorph` patches only what changed in the drawer DOM — preserving scroll position, focus, and unchanged nodes. `CartStore.confirm()` updates state. The submit button restores. One round trip, zero visible wait before drawer opens.

## Requirements

### Functional

**Add to Cart submit**
- Disable submit button, show button loader
- Open `cart-drawer` immediately via `document.querySelector('cart-drawer').open()`
- Show skeleton loading state inside the drawer (a shimmer block, visible while `pendingOps > 0` and drawer has no confirmed items for this session)
- Fire `CartAPI.add(formData, ['cart-drawer'])` — single call, sections included
- On success: call `Idiomorph.morph(drawerElement, parsedNewHTML, { morphStyle: 'innerHTML' })`, then `CartStore.confirm(data)`, restore submit button
- On failure (422 out of stock, variant unavailable): restore submit button, show error from `error.description` in `[data-form-error]` — do not open drawer

**Remove the redundant second call**
- Delete `CartAPI.get()` from `product-form.js` — `data.item_count` is available from the add response JSON directly when no sections are requested, or from `CartStore.state.item_count` after confirm. Use `CartStore.state.item_count` post-confirm.

**Checkout gate**
- `CartStore.pendingOps` increments before the add call (CartStore.confirm handles decrement) — the checkout gate established in PRD 2 applies automatically during Add to Cart

**Morph setup**
- `Idiomorph.morph(target, newHTML, options)` where `target` is `document.querySelector('cart-drawer')` and `newHTML` is the parsed `sections['cart-drawer']` HTML, with `morphStyle: 'innerHTML'`
- idiomorph matches existing elements by `id` before position — `id="CartItem-{n}"` on line items (already present in `cart-line-item.liquid`) ensures items are updated in-place rather than destroyed

**PubSub cleanup**
- Keep `publish(PUB_SUB_EVENTS.cartAdd, ...)` emit for third-party integrations — but `cart-drawer.js` no longer listens to it (removed in PRD 2). The emit is harmless
- Remove the `CartAPI.get()` call and the data assembly that precedes `publish()`

### Non-Functional
- Drawer opens within one animation frame of the button click — before any network activity
- `idiomorph.js` must be vendored in `assets/` — no CDN load (Shopify CSP)
- Morph preserves scroll position inside `[data-cart-panel]`

## Approach

Vendor `idiomorph`: download the latest minified `idiomorph.js` from `https://github.com/bigskysoftware/idiomorph/releases` and place it in `assets/idiomorph.js`. Add it to `snippets/core-assets.liquid` before `cart-drawer.js`.

Rewrite only `onSubmit()` in `assets/product-form.js` — leave `initQuantityStepper()`, `initVariantSubscriber()`, `setLoading()`, `showError()`, `hideError()` untouched. The new `onSubmit()`: (1) `setLoading(true)`, (2) `document.querySelector('cart-drawer')?.open()`, (3) `await CartAPI.add(formData, ['cart-drawer'])`, (4) parse response, (5) morph, (6) `CartStore.confirm(data)`, (7) `setLoading(false)`. Error path: `setLoading(false)`, `showError(message)` — no drawer interaction.

Add a skeleton loading state to `sections/cart-drawer.liquid` inside `[data-cart-panel]`: a `[data-cart-skeleton]` block with CSS shimmer animation, shown when `cart.item_count == 0`. After morph, this element is replaced by real content from the server.

## Expected Output

- `assets/idiomorph.js` — vendored, ~3KB, do not modify
- `assets/product-form.js` — only `onSubmit()` method rewritten (~20 lines changed)
- `sections/cart-drawer.liquid` — adds `[data-cart-skeleton]` shimmer block (shown when empty), adds `data-cart-total` if not already added in PRD 2
- `snippets/core-assets.liquid` — adds `idiomorph.js` script tag before `cart-drawer.js`

## Constraints

- `Idiomorph.morph()` uses `morphStyle: 'innerHTML'` — morphs the children of `cart-drawer`, not the element itself (preserves the Web Component and its event listeners)
- `CartDrawer.open()` must be safe to call when the drawer is already open and when it contains only the skeleton — both cases work with the current open() implementation (idempotent check on `this.isOpen`)
- The `cart-drawer` element's delegated click listeners (from PRD 2) survive the morph because they are on the Web Component element itself, not on morphed children
- Error response shape from Shopify: `{ status: 422, description: "..." }` — use `error.description`
- Do not call `updateCartCount()` directly — `CartStore.confirm()` triggers `reconcile()` which updates `[data-cart-count]`

## Acceptance Criteria

- [ ] Clicking Add to Cart opens the drawer immediately (before API response) with skeleton shimmer visible
- [ ] Exactly 1 API call fires — no secondary `CartAPI.get()` — verified in Network tab
- [ ] After API response, drawer shows correct cart content with newly added item
- [ ] idiomorph preserves existing line item DOM nodes — verify in DevTools (no `CartItem-1` destruction when adding item 2)
- [ ] `CartStore.state` includes the new item after `confirm()`
- [ ] Checkout button is disabled/spinning during the add operation (pendingOps > 0)
- [ ] Adding an out-of-stock item: submit button restores, error shows on form, drawer does not open
- [ ] `idiomorph.js` loads with no console errors; zero CDN requests in Network panel
- [ ] Scroll position inside drawer panel is preserved after morph
- [ ] Submit button returns to its original text and enabled state after success or failure
