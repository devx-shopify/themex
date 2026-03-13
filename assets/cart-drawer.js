/**
 * Cart Drawer Web Component.
 * Handles drawer UI, section rendering, loading overlay, and quantity changes.
 * Uses event delegation for quantity buttons (survives full panel replacement).
 */
class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');
    this.closeButton = this.querySelector('[data-cart-close]');
    this.loadingOverlay = this.querySelector('[data-cart-loading]');
    this.isOpen = false;

    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleEscapeKey = this.handleEscapeKey.bind(this);
    this.closeDrawer = this.closeDrawer.bind(this);
    this.handleDrawerOpen = this.handleDrawerOpen.bind(this);
    this.handleLoading = this.handleLoading.bind(this);
    this.handleApiSuccess = this.handleApiSuccess.bind(this);
    this.handleApiError = this.handleApiError.bind(this);
    this.handlePanelClick = this.handlePanelClick.bind(this);
    this.handleCartTriggerClick = this.handleCartTriggerClick.bind(this);
  }

  connectedCallback() {
    this.closeButton?.addEventListener('click', this.closeDrawer);
    this.overlay?.addEventListener('click', this.handleOverlayClick);
    this.panel?.addEventListener('click', this.handlePanelClick);
    document.addEventListener('keydown', this.handleEscapeKey);
    document.addEventListener('click', this.handleCartTriggerClick);

    this.unsubscribers = [
      cartListen(CART_EVENTS.drawerOpen, this.handleDrawerOpen),
      cartListen(CART_EVENTS.drawerClose, () => this.closeDrawer()),
      cartListen(CART_EVENTS.loading, this.handleLoading),
      cartListen(CART_EVENTS.apiSuccess, this.handleApiSuccess),
      cartListen(CART_EVENTS.apiError, this.handleApiError),
    ];
  }

  disconnectedCallback() {
    this.closeButton?.removeEventListener('click', this.closeDrawer);
    this.overlay?.removeEventListener('click', this.handleOverlayClick);
    this.panel?.removeEventListener('click', this.handlePanelClick);
    document.removeEventListener('keydown', this.handleEscapeKey);
    document.removeEventListener('click', this.handleCartTriggerClick);

    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }
  }

  /* ── Drawer UI ── */

  handleDrawerOpen() {
    this.openDrawer();
  }

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

  /* ── Loading Overlay ── */

  handleLoading() {
    this.showLoading();
  }

  showLoading() {
    this.loadingOverlay = this.querySelector('[data-cart-loading]');
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('hidden');
    }
  }

  hideLoading() {
    this.loadingOverlay = this.querySelector('[data-cart-loading]');
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  /* ── Section Rendering ── */

  handleApiSuccess(event) {
    const { source, sections } = event.detail;
    if (source !== 'add-to-cart' && source !== 'change-item' && source !== 'refresh') return;

    const newCartDrawerHTML = sections?.['cart-drawer'];
    if (newCartDrawerHTML) {
      this.renderSection(newCartDrawerHTML);
    }

    this.hideLoading();
  }

  handleApiError() {
    this.hideLoading();
  }

  renderSection(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const newPanel = tempDiv.querySelector('[data-cart-panel]');
    if (!newPanel || !this.panel) return;

    this.panel.innerHTML = newPanel.innerHTML;

    // Re-query elements that were replaced
    this.closeButton = this.querySelector('[data-cart-close]');
    this.loadingOverlay = this.querySelector('[data-cart-loading]');

    // Re-bind close button
    this.closeButton?.addEventListener('click', this.closeDrawer);
  }

  /* ── Event Delegation for Quantity Changes ── */

  handlePanelClick(event) {
    const quantityButton = event.target.closest('[data-quantity]');
    if (!quantityButton) return;

    const item = quantityButton.closest('[data-key]');
    if (!item) return;

    const key = item.dataset.key;
    const quantity = parseInt(quantityButton.dataset.quantity);

    if (!key || isNaN(quantity)) return;

    CartAPI.changeItem(key, quantity);
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}
