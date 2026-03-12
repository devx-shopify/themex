/**
 * Product Form Web Component.
 * Handles add-to-cart submissions.
 * Uses CartAPI for requests and cart events for coordination.
 */
class ProductForm extends HTMLElement {
  constructor() {
    super();

    this.submitForm = this.querySelector('form[action*="/cart/add"]');
    this.submitButton = null;
    this.variantIdInput = null;

    this.handleSubmit = this.handleSubmit.bind(this);
    this.onCartUpdate = this.onCartUpdate.bind(this);
  }

  connectedCallback() {
    this.submitButton = this.submitForm?.querySelector('button[type="submit"]');
    this.variantIdInput = this.submitForm?.querySelector('input[name="id"]');

    this.submitForm?.addEventListener('submit', this.handleSubmit);
    this.setupQuantityControls();

    this.unsubscribers = [
      cartListen(CART_EVENTS.apiSuccess, this.onCartUpdate),
      cartListen(CART_EVENTS.apiError, this.onCartUpdate),
    ];
  }

  disconnectedCallback() {
    this.submitForm?.removeEventListener('submit', this.handleSubmit);
    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }
  }

  setupQuantityControls() {
    const minusBtn = this.querySelector('[data-quantity-minus]');
    const plusBtn = this.querySelector('[data-quantity-plus]');
    const quantityInput = this.submitForm?.querySelector('input[name="quantity"]');

    if (!quantityInput) return;

    minusBtn?.addEventListener('click', () => {
      const current = parseInt(quantityInput.value) || 1;
      if (current > 1) {
        quantityInput.value = current - 1;
        minusBtn.disabled = current - 1 <= 1;
      }
    });

    plusBtn?.addEventListener('click', () => {
      const current = parseInt(quantityInput.value) || 1;
      const max = parseInt(quantityInput.max) || 99;
      if (current < max) {
        quantityInput.value = current + 1;
        if (minusBtn) minusBtn.disabled = false;
      }
    });

    if (minusBtn) minusBtn.disabled = true;

    // Prevent re-initialization
    this.setupQuantityControls = () => {};
  }

  onCartUpdate() {
    if (!this.submitButton) return;

    const originalText = this.submitButton.dataset.originalText || this.submitButton.textContent.trim();
    if (!this.submitButton.dataset.originalText) {
      this.submitButton.dataset.originalText = originalText;
    }

    requestAnimationFrame(() => {
      const productId = this.dataset.productId;
      if (!productId) return;

      const { allowed } = CartState.validateQuantityLimit(productId, 0);

      if (!allowed) {
        this.submitButton.disabled = true;
        this.submitButton.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        this.submitButton.setAttribute('aria-disabled', 'true');
        this.submitButton.textContent = 'Maximum Quantity Reached';
        return;
      }

      this.submitButton.disabled = false;
      this.submitButton.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
      this.submitButton.setAttribute('aria-disabled', 'false');
      this.submitButton.textContent = this.submitButton.dataset.originalText;
    });
  }

  handleSubmit(event) {
    event.preventDefault();

    const variantIdInput = this.submitForm.querySelector('input[name="id"]');
    const quantityInput = this.submitForm.querySelector('input[name="quantity"]');

    if (!variantIdInput || !quantityInput) return;

    const variantId = variantIdInput.value;
    const quantity = parseInt(quantityInput.value) || 1;
    const productId = this.dataset.productId;

    // Cross-variant max quantity pre-check
    if (productId) {
      const { allowed, message } = CartState.validateQuantityLimit(productId, quantity);
      if (!allowed) {
        cartDispatch(CART_EVENTS.drawerOpen);
        cartDispatch(CART_EVENTS.notify, { message, type: 'warning' });
        return;
      }
    }

    const productData = {
      productId,
      title: this.dataset.productTitle,
      url: this.dataset.productUrl,
      image: this.dataset.productImage,
      variantTitle: this.dataset.variantTitle,
      variantPrice: parseInt(this.dataset.variantPrice),
      variantPriceFormatted: this.dataset.variantPriceFormatted || '',
      variantId,
      quantity,
      properties: {},
    };

    // Dispatch optimistic events
    cartDispatch(CART_EVENTS.drawerOpen);
    cartDispatch(CART_EVENTS.addOptimistic, { productData });

    // Send API request
    CartAPI.addItem({
      items: [{ id: variantId, quantity }],
      sections: CART_DEFAULT_SECTIONS,
    });
  }
}

if (!customElements.get('product-form')) {
  customElements.define('product-form', ProductForm);
}
