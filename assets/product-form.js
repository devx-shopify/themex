/**
 * Product Form Web Component.
 * Handles add-to-cart submissions with button loading state.
 * Opens cart drawer and delegates rendering to CartAPI events.
 */
class ProductForm extends HTMLElement {
  constructor() {
    super();

    this.submitForm = this.querySelector('form[action*="/cart/add"]');
    this.submitButton = this.querySelector('[type="submit"]');
    this.buttonText = this.querySelector('[data-button-text]');
    this.buttonLoading = this.querySelector('[data-button-loading]');
    this.isSubmitting = false;
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleCartResponse = this.handleCartResponse.bind(this);
  }

  connectedCallback() {
    this.submitForm?.addEventListener('submit', this.handleSubmit);
    this.setupQuantityControls();

    this.unsubscribers = [
      cartListen(CART_EVENTS.apiSuccess, this.handleCartResponse),
      cartListen(CART_EVENTS.apiError, this.handleCartResponse),
    ];
  }

  disconnectedCallback() {
    this.submitForm?.removeEventListener('submit', this.handleSubmit);

    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }
  }

  handleCartResponse(event) {
    const { source } = event.detail;
    if (source !== 'add-to-cart' || !this.isSubmitting) return;
    this.resetButton();
  }

  setButtonLoading() {
    this.isSubmitting = true;
    if (this.submitButton) this.submitButton.disabled = true;
    this.buttonText?.classList.add('hidden');
    this.buttonLoading?.classList.remove('hidden');
  }

  resetButton() {
    this.isSubmitting = false;
    if (this.submitButton) this.submitButton.disabled = false;
    this.buttonText?.classList.remove('hidden');
    this.buttonLoading?.classList.add('hidden');
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

    this.setupQuantityControls = () => {};
  }

  handleSubmit(event) {
    event.preventDefault();

    const variantIdInput = this.submitForm.querySelector('input[name="id"]');
    const quantityInput = this.submitForm.querySelector('input[name="quantity"]');

    if (!variantIdInput || !quantityInput) return;

    const variantId = variantIdInput.value;
    const quantity = parseInt(quantityInput.value) || 1;

    this.setButtonLoading();
    cartDispatch(CART_EVENTS.drawerOpen);

    CartAPI.addItem({
      items: [{ id: variantId, quantity }],
      sections: CART_DEFAULT_SECTIONS,
    });
  }
}

if (!customElements.get('product-form')) {
  customElements.define('product-form', ProductForm);
}
