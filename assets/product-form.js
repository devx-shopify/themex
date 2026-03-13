/**
 * Product Form Web Component.
 * Handles add-to-cart submissions.
 * Opens cart drawer and delegates rendering to CartAPI events.
 */
class ProductForm extends HTMLElement {
  constructor() {
    super();

    this.submitForm = this.querySelector('form[action*="/cart/add"]');
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  connectedCallback() {
    this.submitForm?.addEventListener('submit', this.handleSubmit);
    this.setupQuantityControls();
  }

  disconnectedCallback() {
    this.submitForm?.removeEventListener('submit', this.handleSubmit);
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
