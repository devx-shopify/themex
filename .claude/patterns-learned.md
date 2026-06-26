# Patterns Learned

### Global Singleton Pattern: `let X = {}; window.X = X`
**Type:** Pattern
**Category:** JavaScript
**Date:** 2026-05-17

In Shopify themes, `const`/`let` at the top level of a classic `<script defer>` tag does NOT create a `window.X` property — only `var` does. To satisfy both "no var" (js-standards) and `window.X` accessibility (cross-context, theme editor, safety guards), use `let X = { ... }` for the declaration and add `window.X = X` as the final line of the file. The two identifiers reference the same object. This is the correct pattern for any global singleton that consumers may access via either bare name or `window.X`.

### `CartStore.optimistic()` Must Be Called Exactly Once Per Debounce Cycle
**Type:** Pattern
**Category:** JavaScript
**Date:** 2026-05-17

`CartStore.optimistic()` increments `pendingOps` by 1 each call, but `CartStore.confirm()` only decrements it by 1 regardless of how many optimistic calls preceded it. Calling `optimistic()` on every rapid click and then a single `confirm()` permanently leaves `pendingOps` elevated, which disables the checkout button forever. The correct pattern for rapid-click handlers: use a per-line `Map` (e.g., `_pendingQty`) to track whether an optimistic call has already been made for a given line in the current debounce window. Only call `optimistic()` on the first click; for subsequent clicks update the map's `finalQty` only. This keeps `pendingOps` balanced — one `optimistic()` per `confirm()`/`rollback()`.

### `CartStore._notify()` Must Not Be Called With Stale State When Subscribers Act on That State

**Type:** Mistake & Fix
**Category:** JavaScript
**Date:** 2026-05-17

Calling `CartStore._notify()` broadcasts `CartStore.state` synchronously to all subscribers. If `CartStore.state` is not updated before `_notify()` fires, subscribers like `_onStoreChange` act on stale data — for example, reporting `isEmpty = true` when the cart actually has items, then re-hiding DOM elements that were just correctly shown by a morph. The pattern "`pendingOps--; _notify()`" is only safe when `CartStore.state` accurately reflects the current cart. When the add endpoint returns a LineItem (not a Cart), state cannot be updated without a second API call — so `_notify()` should be omitted from the success path entirely, or state must be updated from an alternate source before notifying.

### `window.Shopify.money_format` Does Not Exist in This Theme
**Type:** Codebase Context
**Category:** JavaScript
**Date:** 2026-05-17

`window.Shopify.money_format` is not a standard Shopify storefront global. This theme injects money format exclusively via the `#shop-money-format` JSON script tag in `snippets/global-variables.liquid`. Any JS that needs the store's money format string should read: `JSON.parse(document.getElementById('shop-money-format').textContent).money_format`. Do not check `window.Shopify.money_format` — it will always be `undefined` in this theme.
