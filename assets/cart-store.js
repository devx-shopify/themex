const CartStore = {
  state: null,
  pendingOps: 0,

  _subscribers: [],
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
    const priorItemCount = this.state.item_count;
    const qtyDelta = newQty - item.quantity;
    item.quantity = newQty;
    item.final_line_price = newQty * item.final_price;
    this.state.item_count = Math.max(0, this.state.item_count + qtyDelta);
    this.pendingOps++;
    this._notify();
    return () => {
      this.state.items[lineIndex - 1] = prior;
      this.state.item_count = priorItemCount;
    };
  },

  confirm(serverCartData) {
    this.state = serverCartData;
    this.reconcile(serverCartData);
    this.pendingOps--;
    this._notify();
  },

  confirmBatch(serverCartData, count) {
    this.state = serverCartData;
    this.reconcile(serverCartData);
    this.pendingOps = Math.max(0, this.pendingOps - count);
    this._notify();
  },

  rollback(rollbackFn) {
    rollbackFn();
    this.pendingOps--;
    this._notify();
  },

  patchQty(lineIndex, newQty) {
    if (!this.state) return;
    const item = this.state.items[lineIndex - 1];
    if (!item) return;
    const delta = newQty - item.quantity;
    if (delta === 0) return;
    item.quantity = newQty;
    item.final_line_price = newQty * item.final_price;
    this.state.item_count = Math.max(0, this.state.item_count + delta);
    this._notify();
  },
  addPending() {
    if (this.state) this.state = { ...this.state, item_count: this.state.item_count + 1 };
    this.pendingOps++;
    this._notify();
  },

  addConfirm(cartData) {
    this.state = cartData;
    this.pendingOps--;
    this._notify();
  },

  addRollback() {
    if (this.state) this.state = { ...this.state, item_count: Math.max(0, this.state.item_count - 1) };
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

  formatMoney(cents) {
    if (!this._moneyFormat) {
      try {
        const el = document.getElementById('shop-money-format');
        this._moneyFormat = JSON.parse(el?.textContent ?? '{}').money_format ?? '{{amount}}';
      } catch (_) {
        this._moneyFormat = '{{amount}}';
      }
    }
    const fmt = this._moneyFormat;
    const value = cents / 100;

    const group = (str, sep) => str.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

    if (fmt.includes('{{amount_no_decimals_with_comma_separator}}')) {
      return fmt.replace('{{amount_no_decimals_with_comma_separator}}', group(String(Math.round(value)), '.'));
    }
    if (fmt.includes('{{amount_with_comma_separator}}')) {
      const [int, dec] = value.toFixed(2).split('.');
      return fmt.replace('{{amount_with_comma_separator}}', `${group(int, '.')},${dec}`);
    }
    if (fmt.includes('{{amount_no_decimals}}')) {
      return fmt.replace('{{amount_no_decimals}}', group(String(Math.round(value)), ','));
    }
    const [int, dec] = value.toFixed(2).split('.');
    return fmt.replace('{{amount}}', `${group(int, ',')}.${dec}`);
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

    for (const el of document.querySelectorAll('[data-cart-line]')) {
      if (parseInt(el.dataset.cartLine, 10) > items.length) {
        (el.parentElement || el).remove();
      }
    }
  },
};

window.CartStore = CartStore;
