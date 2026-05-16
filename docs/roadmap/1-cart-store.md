# PRD: 1 — CartStore (Core Foundation)

**Phase:** 1 of 4
**Priority:** P0
**Depends on:** None — start immediately
**Estimated scope:** Small (1 new file: `assets/cart-store.js`)

## Context

The current cart has no shared client-side state. Every component fetches independently, renders server-side HTML, and replaces its own `innerHTML`. There is no concept of in-flight operations, optimistic state, or DOM reconciliation. This phase builds the single foundation everything else in this roadmap depends on. Nothing else can be built without it.

## Goal

A globally available `CartStore` singleton in `assets/cart-store.js` that owns all cart state, tracks in-flight operations via a `pendingOps` counter, applies optimistic mutations with rollback, confirms or rejects from server responses, and surgically updates the DOM via a data-attribute reconciler — without touching `innerHTML`.

## Requirements

### Functional

**State**
- `CartStore.state` — the full Shopify cart JSON object (`items`, `total_price`, `item_count`, `total_discount`, `cart_level_discount_applications`)
- `CartStore.pendingOps` — integer, 0 at rest, incremented before each API call, decremented on confirm or rollback

**Lifecycle**
- `CartStore.init()` — fetches `/cart.js`, sets `CartStore.state`, notifies subscribers. Safe to call multiple times (no-ops if already initialized)
- `CartStore.optimistic(lineIndex, newQty)` — immediately updates the matching item in `state` (quantity + estimated `final_line_price`), increments `pendingOps`, notifies subscribers, returns a `rollback` function that restores exact prior state
- `CartStore.confirm(serverCartData)` — sets `state = serverCartData`, calls `reconcile(serverCartData)`, decrements `pendingOps`, notifies subscribers
- `CartStore.rollback(rollbackFn)` — calls `rollbackFn()`, decrements `pendingOps`, notifies subscribers

**Subscriptions**
- `CartStore.subscribe(fn)` — registers `fn(state, pendingOps)`, called immediately on registration with current state, and on every change. Returns an unsubscribe function

**Debounce**
- `CartStore.debounce(lineIndex, fn, delay = 250)` — per-line timer: each `lineIndex` has its own slot. Calling again for the same line resets that line's timer only. Other lines are unaffected

**Formatting**
- `CartStore.formatMoney(cents)` — reads `window.Shopify.money_format` and returns a formatted money string. Supports `{{amount}}`, `{{amount_no_decimals}}`, `{{amount_with_comma_separator}}` tokens. Falls back to reading from `#shop-money-format` JSON script tag (which is already in `snippets/global-variables.liquid`)

**Reconciler**
- `CartStore.reconcile(serverCartData)` — after every confirm, walks the server data and updates DOM nodes matched by data-attributes. Only writes when the value actually differs (no unnecessary repaints)

### Reconciler Data-Attribute Contract

These attributes must be present in Liquid templates (added in PRDs 2 and 4):

| Attribute | Updated with |
|-----------|-------------|
| `[data-cart-count]` | `item_count` (already exists in codebase) |
| `[data-cart-total]` | `formatMoney(total_price)` |
| `[data-cart-line="{n}"]` | container element — removed from DOM if item no longer in server state |
| `[data-cart-line-qty="{n}"]` | `items[n-1].quantity` (set as `.value`) |
| `[data-cart-line-price="{n}"]` | `formatMoney(items[n-1].final_line_price)` |
| `[data-cart-line-unit-price="{n}"]` | `formatMoney(items[n-1].final_price)` |
| `[data-cart-line-discount="{n}"]` | `hidden` toggled by whether discount allocations exist |

### Non-Functional
- No external dependencies — pure vanilla JS
- Global variable (no `const`/`let` at top level — must be accessible from all scripts)
- Must be listed first in `snippets/core-assets.liquid` among cart scripts, before `cart-drawer.js` and `product-form.js`

## Approach

Implement as a plain object literal (not a class). Store subscribers in a private `_subscribers` array and timers in a `_timers` object keyed by `lineIndex`. The `optimistic()` method deep-clones only the affected item before mutating, so the rollback closure captures the exact prior value. `reconcile()` uses `document.querySelectorAll` with each attribute pattern; for each match it reads the current DOM value and compares before writing — skipping unchanged nodes. `formatMoney()` reads `window.Shopify.money_format` on first call and caches it. For the `[data-cart-line="{n}"]` removal case: if `serverCartData.items` has fewer items than currently shown, `reconcile()` removes orphaned elements from the DOM.

## Expected Output

- `assets/cart-store.js` — the CartStore singleton, target ~100–130 lines

## Constraints

- `window.Shopify.money_format` is always present on Shopify storefronts — no fallback to `Intl.NumberFormat` needed (which doesn't know the store's currency symbol format)
- Line indices are 1-based (matching Shopify's `cart/change.js` API) — `items[n-1]` in JS
- Reconciler must be null-safe: drawer may be closed (elements not in DOM) when reconcile runs
- Do not use ES modules — no bundler in this theme

## Acceptance Criteria

- [ ] `CartStore.init()` populates `CartStore.state` from `/cart.js` on page load
- [ ] `CartStore.optimistic(2, 4)` immediately reflects `items[1].quantity === 4` in state
- [ ] The returned rollback function restores the exact previous `items[1]` state
- [ ] `CartStore.pendingOps` is `0` at rest, `1` during a call, back to `0` after `confirm()` or `rollback()`
- [ ] `CartStore.subscribe(fn)` fires `fn` immediately on registration and on every state change
- [ ] `CartStore.debounce(1, fn, 250)` called 5× in 100ms fires `fn` exactly once after 250ms; debounce on line 2 is unaffected
- [ ] `CartStore.reconcile()` updates `[data-cart-line-price="2"]` when server returns a price different from the optimistic estimate (e.g. after a discount applies)
- [ ] `CartStore.formatMoney(2999)` returns the correct string for the store's money format
- [ ] `CartStore` is accessible as a global from `cart-drawer.js` and `cart.js`
- [ ] Calling `CartStore.init()` twice does not double-fetch or double-notify
