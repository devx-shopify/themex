document.addEventListener('DOMContentLoaded', () => {
  const cartPage = document.querySelector('[data-cart-page]');
  if (!cartPage) return;

  const checkoutLink = document.querySelector('[data-cart-checkout]');
  let _checkoutPending = false;
  const _checkoutUrl = checkoutLink?.href ?? '';
  const _pendingQty = new Map();
  let _noteTimer = null;

  const _showLineError = (line) => {
    const errEl = cartPage.querySelector(`[data-cart-line-error="${line}"]`);
    if (!errEl) return;
    errEl.textContent = errEl.dataset.errorMessage;
    errEl.hidden = false;
    setTimeout(() => { errEl.hidden = true; }, 3000);
  };

  const _handleQtyChange = (line, newQty) => {
    if (!CartStore.state) return;

    if (_pendingQty.has(line)) {
      _pendingQty.get(line).finalQty = newQty;
      CartStore.patchQty(line, newQty);
    } else {
      const stateRollback = CartStore.optimistic(line, newQty);
      _pendingQty.set(line, { stateRollback, finalQty: newQty });
    }

    const input = cartPage.querySelector(`[data-cart-line-qty="${line}"]`);
    if (input) input.value = newQty;

    const priceEl = cartPage.querySelector(`[data-cart-line-price="${line}"]`);
    if (priceEl) {
      const item = CartStore.state?.items?.[line - 1];
      if (item) priceEl.textContent = CartStore.formatMoney(newQty * item.final_price);
    }

    const compareEl = cartPage.querySelector(`[data-cart-line-compare-price="${line}"]`);
    if (compareEl) {
      const item = CartStore.state?.items?.[line - 1];
      if (item) compareEl.textContent = CartStore.formatMoney(item.original_price * newQty);
    }

    const minusBtnEl = cartPage.querySelector(`[data-quantity-minus][data-line-index="${line}"]`);
    if (minusBtnEl) {
      const deleteIcon = minusBtnEl.querySelector('[data-icon-delete]');
      const minusIcon = minusBtnEl.querySelector('[data-icon-minus]');
      if (deleteIcon) deleteIcon.hidden = newQty !== 1;
      if (minusIcon) minusIcon.hidden = newQty === 1;
    }

    CartStore.debounce(line, () => _fireQtyChange(line), 250);
  };

  const _fireQtyChange = async (line) => {
    const pending = _pendingQty.get(line);
    if (!pending) return;
    _pendingQty.delete(line);
    try {
      const data = await CartAPI.change(line, pending.finalQty);
      CartStore.confirm(data);
    } catch (error) {
      console.error('[Cart] qty change failed:', error);
      CartStore.rollback(pending.stateRollback);
      _showLineError(line);
    }
  };

  const _handleRemove = async (line) => {
    if (!CartStore.state) return;
    const row = cartPage.querySelector(`[data-cart-line="${line}"]`);
    if (!row) return;

    for (const [pendingLine, pendingData] of _pendingQty) {
      CartStore.debounce(pendingLine, () => {}, 0);
      CartStore.rollback(pendingData.stateRollback);
    }
    _pendingQty.clear();

    const rowWrapper = row.parentElement || row;
    rowWrapper.hidden = true;
    const stateRollback = CartStore.optimistic(line, 0);
    try {
      const data = await CartAPI.change(line, 0);
      CartStore.confirm(data);
    } catch (error) {
      console.error('[Cart] remove failed:', error);
      rowWrapper.hidden = false;
      CartStore.rollback(stateRollback);
      _showLineError(line);
    }
  };

  const _handleQtyRemove = (event) => {
    const minusBtn = event.target.closest('[data-quantity-minus]');
    const plusBtn = event.target.closest('[data-quantity-plus]');
    if (!minusBtn && !plusBtn) return;

    if (CartStore.state?.items?.some((item) => item.quantity === 0)) return;

    const line = parseInt((minusBtn ?? plusBtn).dataset.lineIndex, 10);
    const input = cartPage.querySelector(`[data-cart-line-qty="${line}"]`);
    if (!input) return;

    const currentQty = parseInt(input.value, 10);

    if (minusBtn && currentQty === 1) {
      _handleRemove(line);
      return;
    }

    const delta = plusBtn ? 1 : -1;
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > 99) return;

    _handleQtyChange(line, newQty);
  };

  const _handleNoteChange = (textarea) => {
    clearTimeout(_noteTimer);
    _noteTimer = setTimeout(async () => {
      try { await CartAPI.update({ note: textarea.value }); } catch (error) { console.error('[Cart] note update failed:', error); }
    }, 500);
  };

  const _onStoreChange = (state, pendingOps) => {
    if (!state) return;

    const cartItemsEl = cartPage.querySelector('[data-cart-items]');
    const cartEmptyEl = cartPage.querySelector('[data-cart-empty]');
    if (cartItemsEl) cartItemsEl.hidden = state.item_count === 0;
    if (cartEmptyEl) cartEmptyEl.hidden = state.item_count > 0;

    if (pendingOps === 0 && _checkoutPending) {
      _checkoutPending = false;
      window.location.href = _checkoutUrl;
    }
  };

  checkoutLink?.addEventListener('click', (event) => {
    if (CartStore.pendingOps > 0) {
      event.preventDefault();
      _checkoutPending = true;
    }
  });

  cartPage.addEventListener('click', _handleQtyRemove);

  cartPage.addEventListener('input', (event) => {
    if (event.target.closest('[data-cart-note]')) {
      _handleNoteChange(event.target);
    }
  });

  CartStore.subscribe(_onStoreChange);
  CartStore.init();
});
