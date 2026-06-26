const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const TRANSITION_DURATION = 300;

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.previousActiveElement = null;
    this.isOpen = false;
    this.focusTrapHandler = null;
    this._checkoutPending = false;
    this._checkoutUrl = '';
    this._unsubscribe = null;
    this._pendingQty = new Map();
    this._flushTimer = null;
    this._mutationChain = Promise.resolve();
    this._queuedMutations = 0;
    this._executingMutations = 0;
  }

  connectedCallback() {
    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');
    this._checkoutUrl = this.querySelector('[data-cart-checkout]')?.dataset.checkoutUrl ?? '';

    this.overlay?.addEventListener('click', () => this.close());

    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-cart-close]')) this.close();
    });

    this.handleKeydown = (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    };
    document.addEventListener('keydown', this.handleKeydown);

    this.handleCartTrigger = (event) => {
      if (event.target.closest('[data-cart-trigger]')) {
        event.preventDefault();
        this.open();
      }
    };
    document.addEventListener('click', this.handleCartTrigger);

    this.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-cart-checkout]');
      if (!btn) return;
      if (CartStore.pendingOps > 0) {
        this._checkoutPending = true;
        const spinner = this.querySelector('[data-checkout-spinner]');
        btn.disabled = true;
        if (spinner) spinner.hidden = false;
      } else {
        window.location.href = this._checkoutUrl;
      }
    });

    this.addEventListener('click', (event) => this._handleQtyRemove(event));

    this._unsubscribe = CartStore.subscribe(this._onStoreChange.bind(this));
    CartStore.init();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('click', this.handleCartTrigger);
    this.removeTrapFocus();
  }

  open() {
    this.previousActiveElement = document.activeElement;
    this.hidden = false;
    this.isOpen = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay?.classList.remove('opacity-0');
        this.overlay?.classList.add('opacity-100');
        this.panel?.classList.remove('translate-x-full');
        this.panel?.classList.add('translate-x-0');
        document.body.classList.add('overflow-hidden');
        this.setAttribute('aria-hidden', 'false');
        this.trapFocus();
      });
    });
  }

  close() {
    this.isOpen = false;
    this.removeTrapFocus();
    this.overlay?.classList.remove('opacity-100');
    this.overlay?.classList.add('opacity-0');
    this.panel?.classList.remove('translate-x-0');
    this.panel?.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
    this.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      this.hidden = true;
      this.previousActiveElement?.focus();
    }, TRANSITION_DURATION);
  }

  trapFocus() {
    const focusable = [...this.panel.querySelectorAll(FOCUSABLE_SELECTORS)];
    if (!focusable.length) return;

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    firstFocusable.focus();
    this.removeTrapFocus();

    this.focusTrapHandler = (event) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };
    this.panel.addEventListener('keydown', this.focusTrapHandler);
  }

  removeTrapFocus() {
    if (this.focusTrapHandler && this.panel) {
      this.panel.removeEventListener('keydown', this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }

  _handleQtyRemove(event) {
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
      this._handleRemove(key);
      return;
    }

    const delta = plusBtn ? 1 : -1;
    const newQty = currentQty + delta;
    if (newQty < 1 || newQty > 99) return;

    this._handleQtyChange(key, newQty);
  }

  _handleQtyChange(key, newQty) {
    if (!CartStore.state) return;

    if (this._pendingQty.has(key)) {
      this._pendingQty.get(key).finalQty = newQty;
      CartStore.patchQty(key, newQty);
    } else {
      const stateRollback = CartStore.optimistic(key, newQty);
      this._pendingQty.set(key, { stateRollback, finalQty: newQty });
    }

    const row = this.querySelector(`[data-item-key="${key}"]`);
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

    this._scheduleFlush();
  }

  _morphSection(sectionHtml) {
    const doc = new DOMParser().parseFromString(sectionHtml, 'text/html');

    const newItemsEl = doc.querySelector('[data-cart-items]');
    const existingItemsEl = this.querySelector('[data-cart-items]');
    if (newItemsEl && existingItemsEl) {
      Idiomorph.morph(existingItemsEl, newItemsEl, { morphStyle: 'outerHTML' });
    }

    const newFooterEl = doc.querySelector('[data-cart-footer]');
    const existingFooterEl = this.querySelector('[data-cart-footer]');
    if (newFooterEl && existingFooterEl) {
      Idiomorph.morph(existingFooterEl, newFooterEl, { morphStyle: 'outerHTML' });
    }
  }

  _scheduleFlush() {
    clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => this._flush(), 250);
  }

  _flush() {
    this._flushTimer = null;
    if (this._pendingQty.size === 0) return;

    const snapshot = new Map(this._pendingQty); // key → { stateRollback, finalQty }
    this._pendingQty.clear();

    this._queuedMutations++;
    this._mutationChain = this._mutationChain.then(() => {
      this._queuedMutations--;
      return this._executeMutation(snapshot);
    });
  }

  async _executeMutation(snapshot) {
    const sectionId = this.dataset.sectionId;
    const sections = sectionId ? [sectionId] : [];


    const updates = (CartStore.state?.items ?? []).map((item) =>
      snapshot.has(item.key) ? snapshot.get(item.key).finalQty : item.quantity
    );

    this._executingMutations++;
    try {
      const data = await CartAPI.update({ updates }, sections);

      if (this._queuedMutations === 0 && sectionId && data.sections?.[sectionId]) {
        this._morphSection(data.sections[sectionId]);
      }

      CartStore.confirmBatch(data, snapshot.size);
    } catch (error) {
      const apiMessage = error?.description || error?.message || null;
      for (const [key, { stateRollback }] of snapshot) {
        CartStore.rollback(stateRollback);
        const item = CartStore.state?.items?.find((i) => i.key === key);
        if (item) {
          const row = this.querySelector(`[data-item-key="${key}"]`);
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
        this._showLineError(key, apiMessage);
      }
    } finally {
      this._executingMutations--;
    }
  }

  _handleRemove(key) {
    if (!CartStore.state) return;

    const row = this.querySelector(`[data-item-key="${key}"]`);
    if (!row) return;

    clearTimeout(this._flushTimer);
    this._flushTimer = null;
    for (const [, pendingData] of this._pendingQty) {
      CartStore.rollback(pendingData.stateRollback);
    }
    this._pendingQty.clear();


    const parent = row.parentElement;
    const rowWrapper = parent?.children.length === 1 ? parent : row;
    const rowWrapperParent = rowWrapper.parentElement;
    const rowWrapperNextSibling = rowWrapper.nextSibling;
    rowWrapper.remove();

    const stateRollback = CartStore.optimistic(key, 0);

    const sectionId = this.dataset.sectionId;
    const sections = sectionId ? [sectionId] : [];

    const showLoader = (this._queuedMutations + this._executingMutations) > 0;
    if (showLoader) this.panel?.classList.add('cart-loading');

    this._queuedMutations++;
    this._mutationChain = this._mutationChain.then(async () => {
      this._queuedMutations--;
      this._executingMutations++;
      try {
        const currentLine = (CartStore.state?.items?.findIndex((item) => item.key === key) ?? -1) + 1;

        if (currentLine <= 0) {
          CartStore.settlePendingOp();
          return;
        }

        const data = await CartAPI.change(currentLine, 0, sections);
        if (this._queuedMutations === 0 && sectionId && data.sections?.[sectionId]) {
          this._morphSection(data.sections[sectionId]);
        }
        CartStore.confirm(data);
      } catch (error) {
        console.error('[CartDrawer] remove failed:', error);
        if (rowWrapperParent) rowWrapperParent.insertBefore(rowWrapper, rowWrapperNextSibling);
        CartStore.rollback(stateRollback);
        this._showLineError(key, error?.description || error?.message || null);
      } finally {
        this._executingMutations--;
        if (showLoader) this.panel?.classList.remove('cart-loading');
      }
    });
  }

  showError(message) {
    const errEl = this.querySelector('[data-cart-error]');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.hidden = false;
    setTimeout(() => { errEl.hidden = true; }, 4000);
  }

  _showLineError(key, message = null) {
    const row = this.querySelector(`[data-item-key="${key}"]`);
    const errEl = row?.querySelector('[data-cart-line-error]');
    if (!errEl) return;
    errEl.textContent = message ?? errEl.dataset.errorMessage;
    errEl.hidden = false;
    setTimeout(() => { errEl.hidden = true; }, 3000);
  }

  _onStoreChange(state, pendingOps) {
    if (!state) return;

    const checkoutBtn = this.querySelector('[data-cart-checkout]');
    const spinnerEl = this.querySelector('[data-checkout-spinner]');

    if (checkoutBtn && pendingOps === 0) {
      checkoutBtn.disabled = false;
      checkoutBtn.removeAttribute('aria-disabled');
      checkoutBtn.removeAttribute('aria-busy');
      if (spinnerEl) spinnerEl.hidden = true;

      if (this._checkoutPending) {
        this._checkoutPending = false;
        window.location.href = this._checkoutUrl;
      }
    }

    const isEmpty = state.item_count === 0;

    if (pendingOps === 0 || (isEmpty && CartStore._pendingAdds === 0)) {
      const itemsEl = this.querySelector('[data-cart-items]');
      const footerEl = this.querySelector('[data-cart-footer]');
      const emptyEl = this.querySelector('[data-cart-empty]');

      if (itemsEl) itemsEl.hidden = isEmpty;
      if (footerEl) footerEl.hidden = isEmpty;
      if (emptyEl) emptyEl.hidden = !isEmpty;
    }

    const headerCount = this.querySelector('[data-cart-header-count]');
    if (headerCount) {
      headerCount.textContent = state.item_count > 0 ? `(${state.item_count})` : '';
      headerCount.hidden = isEmpty;
    }

    for (const el of document.querySelectorAll('[data-cart-count]')) {
      el.textContent = state.item_count;
      el.hidden = isEmpty;
    }

    const totalEl = this.querySelector('[data-cart-total]');
    if (totalEl) totalEl.classList.toggle('animate-pulse', pendingOps > 0);
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}
