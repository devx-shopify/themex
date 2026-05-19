document.addEventListener('DOMContentLoaded', () => {
  const cartPage = document.querySelector('[data-cart-page]');
  if (!cartPage) return;

  const checkoutLink = document.querySelector('[data-cart-checkout]');
  let _checkoutPending = false;
  const _checkoutUrl = checkoutLink?.href ?? '';
  const _pendingQty = new Map();
  let _flushTimer = null;
  let _mutationChain = Promise.resolve();
  let _queuedMutations = 0;
  let _executingMutations = 0;
  let _noteTimer = null;

  const _showLineError = (key, message = null) => {
    const row = cartPage.querySelector(`[data-item-key="${key}"]`);
    const errEl = row?.querySelector('[data-cart-line-error]');
    if (!errEl) return;
    errEl.textContent = message ?? errEl.dataset.errorMessage;
    errEl.hidden = false;
    setTimeout(() => { errEl.hidden = true; }, 3000);
  };

  const _handleQtyChange = (key, newQty) => {
    if (!CartStore.state) return;

    if (_pendingQty.has(key)) {
      _pendingQty.get(key).finalQty = newQty;
      CartStore.patchQty(key, newQty);
    } else {
      const stateRollback = CartStore.optimistic(key, newQty);
      _pendingQty.set(key, { stateRollback, finalQty: newQty });
    }

    const row = cartPage.querySelector(`[data-item-key="${key}"]`);
    if (!row) return;

    const input = row.querySelector('[data-cart-line-qty]');
    if (input) input.value = newQty;

    const item = CartStore.state?.items?.find((i) => i.key === key);
    if (item) {
      const priceEl = row.querySelector('[data-cart-line-price]');
      if (priceEl) priceEl.textContent = CartStore.formatMoney(newQty * item.final_price);

      const compareEl = row.querySelector('[data-cart-line-compare-price]');
      if (compareEl) compareEl.textContent = CartStore.formatMoney(item.original_price * newQty);
    }

    const minusBtnEl = row.querySelector('[data-quantity-minus]');
    if (minusBtnEl) {
      const deleteIcon = minusBtnEl.querySelector('[data-icon-delete]');
      const minusIcon = minusBtnEl.querySelector('[data-icon-minus]');
      if (deleteIcon) deleteIcon.hidden = newQty !== 1;
      if (minusIcon) minusIcon.hidden = newQty === 1;
    }

    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(_flush, 250);
  };

  const _flush = () => {
    _flushTimer = null;
    if (_pendingQty.size === 0) return;

    const snapshot = new Map(_pendingQty);
    _pendingQty.clear();

    _queuedMutations++;
    _mutationChain = _mutationChain.then(() => {
      _queuedMutations--;
      return _executeMutation(snapshot);
    });
  };

  const _executeMutation = async (snapshot) => {
    const updates = (CartStore.state?.items ?? []).map((item) =>
      snapshot.has(item.key) ? snapshot.get(item.key).finalQty : item.quantity
    );

    _executingMutations++;
    try {
      const data = await CartAPI.update({ updates });
      CartStore.confirmBatch(data, snapshot.size);
    } catch (error) {
      const apiMessage = error?.description || error?.message || null;
      for (const [key, { stateRollback }] of snapshot) {
        CartStore.rollback(stateRollback);
        const item = CartStore.state?.items?.find((i) => i.key === key);
        if (item) {
          const row = cartPage.querySelector(`[data-item-key="${key}"]`);
          if (row) {
            const input = row.querySelector('[data-cart-line-qty]');
            if (input) input.value = item.quantity;
            const priceEl = row.querySelector('[data-cart-line-price]');
            if (priceEl) priceEl.textContent = CartStore.formatMoney(item.quantity * item.final_price);
            const compareEl = row.querySelector('[data-cart-line-compare-price]');
            if (compareEl) compareEl.textContent = CartStore.formatMoney(item.original_price * item.quantity);
            const minusBtnEl = row.querySelector('[data-quantity-minus]');
            if (minusBtnEl) {
              const deleteIcon = minusBtnEl.querySelector('[data-icon-delete]');
              const minusIcon = minusBtnEl.querySelector('[data-icon-minus]');
              if (deleteIcon) deleteIcon.hidden = item.quantity !== 1;
              if (minusIcon) minusIcon.hidden = item.quantity === 1;
            }
          }
        }
        _showLineError(key, apiMessage);
      }
    } finally {
      _executingMutations--;
    }
  };

  const _handleRemove = (key) => {
    if (!CartStore.state) return;
    const row = cartPage.querySelector(`[data-item-key="${key}"]`);
    if (!row) return;

    clearTimeout(_flushTimer);
    _flushTimer = null;
    for (const [, pendingData] of _pendingQty) {
      CartStore.rollback(pendingData.stateRollback);
    }
    _pendingQty.clear();


    const parent = row.parentElement;
    const rowWrapper = parent?.children.length === 1 ? parent : row;
    const rowWrapperParent = rowWrapper.parentElement;
    const rowWrapperNextSibling = rowWrapper.nextSibling;
    rowWrapper.remove();

    const stateRollback = CartStore.optimistic(key, 0);

    _queuedMutations++;
    _mutationChain = _mutationChain.then(async () => {
      _queuedMutations--;
      _executingMutations++;
      try {
        const currentLine = (CartStore.state?.items?.findIndex((item) => item.key === key) ?? -1) + 1;
        if (currentLine <= 0) {
          CartStore.settlePendingOp();
          return;
        }
        const data = await CartAPI.change(currentLine, 0);
        CartStore.confirm(data);
      } catch (error) {
        console.error('[Cart] remove failed:', error);
        if (rowWrapperParent) rowWrapperParent.insertBefore(rowWrapper, rowWrapperNextSibling);
        CartStore.rollback(stateRollback);
        _showLineError(key, error?.description || error?.message || null);
      } finally {
        _executingMutations--;
      }
    });
  };

  const _handleQtyRemove = (event) => {
    const minusBtn = event.target.closest('[data-quantity-minus]');
    const plusBtn = event.target.closest('[data-quantity-plus]');
    if (!minusBtn && !plusBtn) return;

    const btn = minusBtn ?? plusBtn;
    const row = btn.closest('[data-item-key]');
    if (!row) return;
    const key = row.dataset.itemKey;

    const input = row.querySelector('[data-cart-line-qty]');
    if (!input) return;

    const currentQty = parseInt(input.value, 10);

    if (minusBtn && currentQty === 1) {
      _handleRemove(key);
      return;
    }

    const delta = plusBtn ? 1 : -1;
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > 99) return;

    _handleQtyChange(key, newQty);
  };

  const _handleNoteChange = (textarea) => {
    clearTimeout(_noteTimer);
    _noteTimer = setTimeout(async () => {
      try { await CartAPI.update({ note: textarea.value }); } catch (error) { console.error('[Cart] note update failed:', error); }
    }, 500);
  };

  const _onStoreChange = (state, pendingOps) => {
    if (!state) return;

    const isEmpty = state.item_count === 0;
    if (pendingOps === 0 || (isEmpty && CartStore._pendingAdds === 0)) {
      const cartItemsEl = cartPage.querySelector('[data-cart-items]');
      const cartEmptyEl = cartPage.querySelector('[data-cart-empty]');
      if (cartItemsEl) cartItemsEl.hidden = isEmpty;
      if (cartEmptyEl) cartEmptyEl.hidden = !isEmpty;
    }

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
