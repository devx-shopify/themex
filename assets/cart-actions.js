/**
 * Cart Actions Web Component.
 * Handles quantity +/- buttons, item removal, and rollback for each cart item.
 * In themex, <cart-actions> IS the cart item element (wraps the full item).
 * Uses CartAPI for server requests and events for coordination.
 */
class CartActions extends HTMLElement {
  static get MAX_QUANTITY() {
    return CartState.MAX_QUANTITY;
  }

  constructor() {
    super();

    this.decrementButton = this.querySelector('[data-decrement]');
    this.plusButton = this.querySelector('[data-plus]');
    this.notificationTimeout = null;
    this.serverQuantity = null;

    this.handleChange = this.handleChange.bind(this);
    this.handleApiSuccess = this.handleApiSuccess.bind(this);
    this.handleApiError = this.handleApiError.bind(this);
  }

  connectedCallback() {
    this.decrementButton?.addEventListener('click', this.handleChange);
    this.plusButton?.addEventListener('click', this.handleChange);

    const quantityDisplay = this.querySelector('[data-quantity-value]');
    this.serverQuantity = parseInt(quantityDisplay?.textContent) || 1;

    this.unsubscribers = [
      cartListen(CART_EVENTS.apiSuccess, this.handleApiSuccess),
      cartListen(CART_EVENTS.apiError, this.handleApiError),
    ];

    this.updateButtonStates();
  }

  disconnectedCallback() {
    this.decrementButton?.removeEventListener('click', this.handleChange);
    this.plusButton?.removeEventListener('click', this.handleChange);

    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }
  }

  refreshButtons() {
    this.decrementButton?.removeEventListener('click', this.handleChange);
    this.plusButton?.removeEventListener('click', this.handleChange);

    this.decrementButton = this.querySelector('[data-decrement]');
    this.plusButton = this.querySelector('[data-plus]');

    this.decrementButton?.addEventListener('click', this.handleChange);
    this.plusButton?.addEventListener('click', this.handleChange);

    if (this.decrementButton) this.decrementButton.removeAttribute('disabled');
    if (this.plusButton) this.plusButton.removeAttribute('disabled');

    const quantityDisplay = this.querySelector('[data-quantity-value]');
    this.serverQuantity = parseInt(quantityDisplay?.textContent) || 1;

    this.updateButtonStates();
  }

  updateButtonStates() {
    if (this.decrementButton && !this.decrementButton.isConnected) {
      this.decrementButton = this.querySelector('[data-decrement]');
    }
    if (this.plusButton && !this.plusButton.isConnected) {
      this.plusButton = this.querySelector('[data-plus]');
    }

    const quantityDisplay = this.querySelector('[data-quantity-value]');
    const currentQuantity = parseInt(quantityDisplay?.textContent) || 1;
    const maxQuantity = CartActions.MAX_QUANTITY;

    // Cross-variant total check — in themex, `this` has data-product-id
    const productId = this.dataset.productId;
    let totalProductQuantity = currentQuantity;

    if (productId) {
      totalProductQuantity = 0;
      const allProductItems = document.querySelectorAll(`[data-product-id="${productId}"].cart-item`);
      for (const item of allProductItems) {
        totalProductQuantity += parseInt(item.querySelector('[data-quantity-value]')?.textContent) || 0;
      }
    }

    if (this.plusButton) {
      if (totalProductQuantity >= maxQuantity) {
        this.plusButton.classList.add('opacity-50', 'cursor-not-allowed');
        this.plusButton.setAttribute('aria-disabled', 'true');
        this.plusButton.setAttribute('data-at-max', 'true');
      } else {
        this.plusButton.classList.remove('opacity-50', 'cursor-not-allowed');
        this.plusButton.setAttribute('aria-disabled', 'false');
        this.plusButton.removeAttribute('data-at-max');
      }
    }

    if (this.decrementButton) {
      const iconMinus = this.decrementButton.querySelector('[data-icon-minus]');
      const iconDelete = this.decrementButton.querySelector('[data-icon-delete]');

      const labelRemove = this.dataset.labelRemove || 'Remove item';
      const labelDecrease = this.dataset.labelDecrease || 'Decrease quantity';

      if (currentQuantity <= 1) {
        iconMinus?.classList.add('hidden');
        iconMinus?.classList.remove('flex');
        iconDelete?.classList.remove('hidden');
        iconDelete?.classList.add('flex');
        this.decrementButton.setAttribute('data-quantity', '0');
        this.decrementButton.setAttribute('aria-label', labelRemove);
      } else {
        iconMinus?.classList.remove('hidden');
        iconMinus?.classList.add('flex');
        iconDelete?.classList.add('hidden');
        iconDelete?.classList.remove('flex');
        this.decrementButton.setAttribute('data-quantity', String(currentQuantity - 1));
        this.decrementButton.setAttribute('aria-label', labelDecrease);
      }
    }
  }

  updateSiblingButtonStates() {
    const productId = this.dataset.productId;
    if (!productId) return;

    const allProductItems = document.querySelectorAll(`[data-product-id="${productId}"].cart-item`);
    for (const item of allProductItems) {
      if (item !== this && item.updateButtonStates) {
        item.updateButtonStates();
      }
    }
  }

  showItemNotification(message, type = 'warning', duration = 3000) {
    const notification = this.querySelector('[data-item-notification]');
    const notificationContent = this.querySelector('[data-item-notification-content]');

    if (!notification || !notificationContent) return;

    notificationContent.textContent = message;

    const colors = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.warning;
    notificationContent.classList.remove(...NOTIFICATION_BG_CLASSES, 'text-background', 'text-foreground');
    notificationContent.classList.add(...colors);

    notification.classList.remove('max-h-0');
    notification.classList.add('max-h-[100px]');

    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }

    this.notificationTimeout = setTimeout(() => {
      notification.classList.remove('max-h-[100px]');
      notification.classList.add('max-h-0');
    }, duration);
  }

  handleChange(event) {
    const clickedButton = event.target.closest('[data-quantity]');
    if (!clickedButton) return;

    // In themex, `this` IS the cart item
    const itemKey = this.dataset.key;
    const quantityDisplay = this.querySelector('[data-quantity-value]');

    if (!itemKey) return;

    const currentDisplayedQuantity = parseInt(quantityDisplay?.textContent) || 1;
    const maxQuantity = CartActions.MAX_QUANTITY;
    const isPlus = clickedButton.hasAttribute('data-plus');
    const newQuantity = isPlus ? currentDisplayedQuantity + 1 : currentDisplayedQuantity - 1;

    // Cross-variant max quantity check
    if (isPlus) {
      const productId = this.dataset.productId;
      if (productId) {
        const allProductItems = document.querySelectorAll(`[data-product-id="${productId}"].cart-item`);
        let totalProductQuantity = 0;
        for (const item of allProductItems) {
          totalProductQuantity += parseInt(item.querySelector('[data-quantity-value]')?.textContent) || 0;
        }
        if (totalProductQuantity + 1 > maxQuantity) {
          this.showItemNotification('Maximum quantity limit reached for this product.', 'warning', 3000);
          return;
        }
      } else if (newQuantity > maxQuantity) {
        this.showItemNotification('Maximum quantity limit reached for this item.', 'warning', 3000);
        return;
      }
    }

    if (newQuantity < 0) return;

    // Find the cart-items-manager for storing removal snapshot
    const itemsManager = this.closest('cart-items-manager');

    if (newQuantity === 0) {
      const itemsContainer = this.parentElement;
      const snapshot = {
        itemHTML: this.outerHTML,
        itemNextSibling: this.nextElementSibling,
        itemParent: itemsContainer,
        serverQuantity: this.serverQuantity,
        countDelta: -currentDisplayedQuantity,
      };

      this.remove();

      // Store snapshot on cart-items-manager for rollback
      if (itemsManager) {
        itemsManager.lastRemovalSnapshot = snapshot;
      }

      cartDispatch(CART_EVENTS.removeOptimistic, { quantity: currentDisplayedQuantity });

      const remainingItems = itemsManager?.querySelector('[data-cart-items]');
      if (!remainingItems || remainingItems.querySelectorAll('.cart-item').length === 0) {
        snapshot.wasLastItem = true;
        itemsManager?.showOptimisticEmptyCart();
      }

      itemsManager?.updateOptimisticSubtotal();
    } else {
      quantityDisplay.textContent = newQuantity;

      const lineTotalContainer = this.querySelector('[data-line-total-container]') || this.querySelector('[data-line-total]');
      if (lineTotalContainer) {
        lineTotalContainer.classList.add('cart-price-loading');
      }

      itemsManager?.updateOptimisticSubtotal();

      this.updateButtonStates();
      this.updateSiblingButtonStates();

      cartDispatch(CART_EVENTS.changeOptimistic, { delta: isPlus ? 1 : -1 });
    }

    CartAPI.changeItem(itemKey, newQuantity, {
      debounce: newQuantity !== 0,
    });
  }

  handleApiSuccess(event) {
    if (event.detail.source !== 'change-item') return;

    this.serverQuantity = parseInt(this.querySelector('[data-quantity-value]')?.textContent) || this.serverQuantity;
  }

  handleApiError(event) {
    if (event.detail.source !== 'change-item') return;

    // Rollback quantity to server state
    const quantityDisplay = this.querySelector('[data-quantity-value]');
    if (quantityDisplay && this.serverQuantity !== null) {
      quantityDisplay.textContent = this.serverQuantity;
    }

    const lineTotalContainer = this.querySelector('[data-line-total-container]') || this.querySelector('[data-line-total]');
    if (lineTotalContainer) {
      lineTotalContainer.classList.add('cart-price-loading');
    }

    this.updateButtonStates();
    this.updateSiblingButtonStates();

    // Trigger a refresh to get correct state
    CartAPI.refreshCart();
  }
}

if (!customElements.get('cart-actions')) {
  customElements.define('cart-actions', CartActions);
}
