/**
 * Cart Drawer Web Component.
 * Optimistic UI: quantity + count badge update instantly on click.
 * Server-authoritative: section re-render reconciles prices, discounts, totals.
 * Uses event delegation for all panel interactions (survives innerHTML replacement).
 * Tracks pending quantities to accumulate rapid clicks correctly.
 */
class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');
    this.isOpen = false;
    this.debounceTimers = {};
    this.pendingQuantities = {};
    this.animatingRemovals = new Set();
    this.pendingRender = null;

    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleEscapeKey = this.handleEscapeKey.bind(this);
    this.closeDrawer = this.closeDrawer.bind(this);
    this.handleApiSuccess = this.handleApiSuccess.bind(this);
    this.handleApiError = this.handleApiError.bind(this);
    this.handlePanelClick = this.handlePanelClick.bind(this);
    this.handleCartTriggerClick = this.handleCartTriggerClick.bind(this);
  }

  connectedCallback() {
    this.overlay?.addEventListener('click', this.handleOverlayClick);
    this.panel?.addEventListener('click', this.handlePanelClick);
    document.addEventListener('keydown', this.handleEscapeKey);
    document.addEventListener('click', this.handleCartTriggerClick);

    this.unsubscribers = [
      cartListen(CART_EVENTS.drawerOpen, () => this.openDrawer()),
      cartListen(CART_EVENTS.apiSuccess, this.handleApiSuccess),
      cartListen(CART_EVENTS.apiError, this.handleApiError),
    ];
  }

  disconnectedCallback() {
    this.overlay?.removeEventListener('click', this.handleOverlayClick);
    this.panel?.removeEventListener('click', this.handlePanelClick);
    document.removeEventListener('keydown', this.handleEscapeKey);
    document.removeEventListener('click', this.handleCartTriggerClick);

    for (const timer of Object.values(this.debounceTimers)) clearTimeout(timer);

    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }
  }

  /* -- Drawer UI -- */

  handleCartTriggerClick(event) {
    const trigger = event.target.closest('[data-cart-trigger]');
    if (trigger) {
      event.preventDefault();
      this.openDrawer();
    }
  }

  handleOverlayClick(event) {
    if (event.target === this.overlay) {
      this.closeDrawer();
    }
  }

  handleEscapeKey(event) {
    if (event.key === 'Escape' && this.isOpen) {
      this.closeDrawer();
    }
  }

  openDrawer() {
    this.isOpen = true;
    if (!this.overlay || !this.panel) return;

    this.overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay.classList.remove('opacity-0');
        this.overlay.classList.add('opacity-100');
        this.panel.classList.remove('translate-x-full');
        this.panel.classList.add('translate-x-0');
      });
    });
  }

  closeDrawer() {
    this.isOpen = false;
    if (!this.overlay || !this.panel) return;

    this.overlay.classList.remove('opacity-100');
    this.overlay.classList.add('opacity-0');
    this.panel.classList.remove('translate-x-0');
    this.panel.classList.add('translate-x-full');

    setTimeout(() => {
      this.overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  /* -- Section Rendering -- */

  handleApiSuccess(event) {
    const { source, sections } = event.detail;
    if (source !== 'add-to-cart' && source !== 'change-item') return;

    const newHTML = sections?.['cart-drawer'];
    if (!newHTML) return;

    if (this.animatingRemovals.size > 0) {
      this.pendingRender = newHTML;
      return;
    }

    this.renderSection(newHTML);
    this.pendingQuantities = {};
  }

  handleApiError(event) {
    const { source } = event.detail;
    if (source !== 'add-to-cart' && source !== 'change-item') return;

    let countDelta = 0;

    for (const [key, { original, current }] of Object.entries(this.pendingQuantities)) {
      countDelta += current - original;

      const item = this.panel?.querySelector(`[data-key="${key}"]`);
      if (!item) continue;

      const qtyDisplay = item.querySelector('[data-item-quantity]');
      if (qtyDisplay) qtyDisplay.textContent = original;

      item.classList.remove('cart-item-removing');
      item.style.removeProperty('max-height');

      const loader = item.querySelector('[data-cart-item-loader]');
      if (loader) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        loader.classList.remove('opacity-100');
      }
    }

    if (countDelta !== 0) {
      CartCount.update(CartCount.getCurrent() - countDelta);
    }

    this.pendingQuantities = {};
    this.animatingRemovals.clear();
    this.pendingRender = null;
  }

  renderSection(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const newPanel = tempDiv.querySelector('[data-cart-panel]');
    if (!newPanel || !this.panel) return;

    const itemsContainer = this.panel.querySelector('[data-cart-items]');
    const scrollTop = itemsContainer?.scrollTop ?? 0;

    this.panel.innerHTML = newPanel.innerHTML;

    const newItemsContainer = this.panel.querySelector('[data-cart-items]');
    if (newItemsContainer) newItemsContainer.scrollTop = scrollTop;
  }

  /* -- Event Delegation -- */

  handlePanelClick(event) {
    const closeButton = event.target.closest('[data-cart-close]');
    if (closeButton) {
      this.closeDrawer();
      return;
    }

    const quantityButton = event.target.closest('[data-action]');
    if (!quantityButton) return;

    const item = quantityButton.closest('[data-key]');
    if (!item) return;

    const key = item.dataset.key;
    const action = quantityButton.dataset.action;

    if (!key || !action) return;

    this.handleQuantityChange(key, action, item);
  }

  handleQuantityChange(key, action, itemEl) {
    const qtyDisplay = itemEl.querySelector('[data-item-quantity]');
    const currentQty = this.pendingQuantities[key]?.current
      ?? (parseInt(qtyDisplay?.textContent) || 0);

    if (!this.pendingQuantities[key]) {
      this.pendingQuantities[key] = {
        original: currentQty,
        current: currentQty,
      };
    }

    const newQty = action === 'increment' ? currentQty + 1 : currentQty - 1;
    this.pendingQuantities[key].current = newQty;

    if (newQty <= 0) {
      this.handleItemRemoval(key, itemEl);
    } else {
      if (qtyDisplay) qtyDisplay.textContent = newQty;

      const loader = itemEl.querySelector('[data-cart-item-loader]');
      if (loader) {
        loader.classList.remove('opacity-0', 'pointer-events-none');
        loader.classList.add('opacity-100');
      }
    }

    const countDelta = action === 'increment' ? 1 : -1;
    CartCount.update(CartCount.getCurrent() + countDelta);

    clearTimeout(this.debounceTimers[key]);
    this.debounceTimers[key] = setTimeout(() => {
      delete this.debounceTimers[key];
      CartAPI.changeItem(key, Math.max(0, this.pendingQuantities[key].current));
    }, 300);
  }

  handleItemRemoval(key, itemEl) {
    if (this.animatingRemovals.has(key)) return;

    this.animatingRemovals.add(key);

    // Set explicit max-height for smooth collapse transition
    itemEl.style.maxHeight = `${itemEl.offsetHeight}px`;

    requestAnimationFrame(() => {
      itemEl.classList.add('cart-item-removing');
    });

    const onDone = () => {
      itemEl.removeEventListener('transitionend', handleTransition);
      clearTimeout(safetyTimer);
      this.animatingRemovals.delete(key);

      if (this.pendingRender && this.animatingRemovals.size === 0) {
        const html = this.pendingRender;
        this.pendingRender = null;
        this.renderSection(html);
        this.pendingQuantities = {};
      }
    };

    const handleTransition = (e) => {
      if (e.propertyName === 'transform') onDone();
    };

    itemEl.addEventListener('transitionend', handleTransition);
    const safetyTimer = setTimeout(onDone, 400);
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}
