/**
 * Cart Drawer Web Component.
 * Handles only drawer UI: open/close, overlay, escape key, checkout redirect.
 * All item management is handled by cart-items-manager.
 * All quantity changes are handled by cart-actions.
 */
class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');
    this.closeButton = this.querySelector('[data-cart-close]');
    this.checkoutButton = null;
    this.isOpen = false;
    this.checkoutPending = false;
    this.autoCloseTimer = null;

    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleEscapeKey = this.handleEscapeKey.bind(this);
    this.closeDrawer = this.closeDrawer.bind(this);
    this.handleDrawerOpen = this.handleDrawerOpen.bind(this);
    this.handleApiSuccess = this.handleApiSuccess.bind(this);
    this.handleCheckoutClick = this.handleCheckoutClick.bind(this);
    this.handleCartTriggerClick = this.handleCartTriggerClick.bind(this);
  }

  connectedCallback() {
    this.checkoutButton = this.querySelector('[data-cart-checkout]');
    if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
      this.checkoutButton.addEventListener('click', this.handleCheckoutClick);
      this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
    }

    document.addEventListener('click', this.handleCartTriggerClick);

    this.closeButton?.addEventListener('click', this.closeDrawer);
    this.overlay?.addEventListener('click', this.handleOverlayClick);
    document.addEventListener('keydown', this.handleEscapeKey);

    this.unsubscribers = [
      cartListen(CART_EVENTS.drawerOpen, this.handleDrawerOpen),
      cartListen(CART_EVENTS.drawerClose, () => this.closeDrawer()),
      cartListen(CART_EVENTS.apiSuccess, this.handleApiSuccess),
    ];
  }

  disconnectedCallback() {
    this.closeButton?.removeEventListener('click', this.closeDrawer);
    this.overlay?.removeEventListener('click', this.handleOverlayClick);
    document.removeEventListener('keydown', this.handleEscapeKey);
    document.removeEventListener('click', this.handleCartTriggerClick);

    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }

    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
  }

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

  handleApiSuccess(event) {
    const { source } = event.detail;
    if (source !== 'add-to-cart' && source !== 'change-item' && source !== 'refresh') return;

    // Re-bind checkout button after DOM updates (footer innerHTML may have been replaced)
    this.checkoutButton = this.querySelector('[data-cart-checkout]');
    if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
      this.checkoutButton.addEventListener('click', this.handleCheckoutClick);
      this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
    }

    if (source === 'add-to-cart') {
      if (this.autoCloseTimer) {
        clearTimeout(this.autoCloseTimer);
      }
    }

    if (!this.checkoutPending) {
      this.setLoadingState(false);
    }
  }

  handleCheckoutClick(event) {
    const hasPending = CartAPI.waitForPending;
    if (!hasPending) return;

    event.preventDefault();
    this.checkoutPending = true;
    this.setLoadingState(true);

    CartAPI.waitForPending()
      .then(() => {
        this.checkoutPending = false;
        this.setLoadingState(false);
        window.location.href = '/checkout';
      })
      .catch(() => {
        this.checkoutPending = false;
        this.setLoadingState(false);
        window.location.href = '/checkout';
      });
  }

  setLoadingState(isLoading) {
    if (!this.checkoutButton) {
      this.checkoutButton = this.querySelector('[data-cart-checkout]');
    }

    if (!this.checkoutButton) return;

    const checkoutText = this.checkoutButton.querySelector('[data-checkout-text]');
    const checkoutLoader = this.checkoutButton.querySelector('[data-checkout-loader]');

    if (isLoading) {
      this.checkoutButton.classList.add('opacity-50', 'pointer-events-none');
      this.checkoutButton.setAttribute('aria-busy', 'true');
      if (checkoutText) checkoutText.classList.add('invisible');
      if (checkoutLoader) checkoutLoader.classList.remove('hidden');
      return;
    }

    this.checkoutButton.classList.remove('opacity-50', 'pointer-events-none');
    this.checkoutButton.setAttribute('aria-busy', 'false');
    if (checkoutText) checkoutText.classList.remove('invisible');
    if (checkoutLoader) checkoutLoader.classList.add('hidden');
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}
