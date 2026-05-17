let CartStore = {
  state: null,
  pendingOps: 0,

  _subscribers: [],
  _timers: {},
  _initialized: false,
  _moneyFormat: null,

  _notify() {
    for (const fn of this._subscribers) fn(this.state, this.pendingOps);
  },

  async init() {
    if (this._initialized) return;
    this._initialized = true;
    try {
      const data = await CartAPI.get();
      this.state = data;
      this._notify();
    } catch (error) {
      console.error('[CartStore] init failed:', error);
    }
  },

  optimistic(lineIndex, newQty) {
    const item = this.state.items[lineIndex - 1];
    const prior = JSON.parse(JSON.stringify(item));
    item.quantity = newQty;
    item.final_line_price = newQty * item.final_price;
    this.pendingOps++;
    this._notify();
    return () => {
      this.state.items[lineIndex - 1] = prior;
    };
  },

  confirm(serverCartData) {
    this.state = serverCartData;
    this.reconcile(serverCartData);
    this.pendingOps--;
    this._notify();
  },

  rollback(rollbackFn) {
    rollbackFn();
    this.pendingOps--;
    this._notify();
  },

  subscribe(fn) {
    this._subscribers.push(fn);
    fn(this.state, this.pendingOps);
    return () => {
      this._subscribers = this._subscribers.filter((s) => s !== fn);
    };
  },

  debounce(lineIndex, fn, delay = 250) {
    clearTimeout(this._timers[lineIndex]);
    this._timers[lineIndex] = setTimeout(fn, delay);
  },

  formatMoney(cents) {
    if (!this._moneyFormat) {
      try {
        const el = document.getElementById('shop-money-format');
        this._moneyFormat = JSON.parse(el?.textContent ?? '{}').money_format ?? '{{amount}}';
      } catch (_) {
        this._moneyFormat = '{{amount}}';
      }
    }
    const amount = (cents / 100).toFixed(2);
    if (this._moneyFormat.includes('{{amount_no_decimals}}')) {
      return this._moneyFormat.replace('{{amount_no_decimals}}', Math.round(cents / 100));
    }
    if (this._moneyFormat.includes('{{amount_with_comma_separator}}')) {
      return this._moneyFormat.replace('{{amount_with_comma_separator}}', amount.replace('.', ','));
    }
    return this._moneyFormat.replace('{{amount}}', amount);
  },

  reconcile(serverCartData) {
    const { item_count, total_price, items } = serverCartData;

    for (const el of document.querySelectorAll('[data-cart-count]')) {
      if (el.textContent !== String(item_count)) el.textContent = item_count;
    }

    const totalFormatted = this.formatMoney(total_price);
    for (const el of document.querySelectorAll('[data-cart-total]')) {
      if (el.textContent !== totalFormatted) el.textContent = totalFormatted;
    }

    const qtyEls = new Map(
      [...document.querySelectorAll('[data-cart-line-qty]')].map((el) => [el.dataset.cartLineQty, el])
    );
    const priceEls = new Map(
      [...document.querySelectorAll('[data-cart-line-price]')].map((el) => [el.dataset.cartLinePrice, el])
    );
    const unitPriceEls = new Map(
      [...document.querySelectorAll('[data-cart-line-unit-price]')].map((el) => [el.dataset.cartLineUnitPrice, el])
    );
    const discountEls = new Map(
      [...document.querySelectorAll('[data-cart-line-discount]')].map((el) => [el.dataset.cartLineDiscount, el])
    );

    items.forEach((item, i) => {
      const n = String(i + 1);

      const qtyEl = qtyEls.get(n);
      if (qtyEl && qtyEl.value !== String(item.quantity)) qtyEl.value = item.quantity;

      const priceEl = priceEls.get(n);
      if (priceEl) {
        const formatted = this.formatMoney(item.final_line_price);
        if (priceEl.textContent !== formatted) priceEl.textContent = formatted;
      }

      const unitPriceEl = unitPriceEls.get(n);
      if (unitPriceEl) {
        const formatted = this.formatMoney(item.final_price);
        if (unitPriceEl.textContent !== formatted) unitPriceEl.textContent = formatted;
      }

      const discountEl = discountEls.get(n);
      if (discountEl) {
        const hasDiscount = (item.line_level_discount_allocations || []).length > 0;
        if (discountEl.hidden === hasDiscount) discountEl.hidden = !hasDiscount;
      }
    });

    for (const el of document.querySelectorAll('[data-cart-line]')) {
      if (parseInt(el.dataset.cartLine, 10) > items.length) el.remove();
    }
  },
};

window.CartStore = CartStore;
