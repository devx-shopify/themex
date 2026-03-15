/**
 * Product Form Web Component.
 * Handles quantity +/- buttons only.
 * Form submits naturally to /cart/add (no AJAX).
 */
class ProductForm extends HTMLElement {
  connectedCallback() {
    this.setupQuantityControls();
  }

  setupQuantityControls() {
    const form = this.querySelector('form[action*="/cart/add"]');
    const minusBtn = this.querySelector('[data-quantity-minus]');
    const plusBtn = this.querySelector('[data-quantity-plus]');
    const quantityInput = form?.querySelector('input[name="quantity"]');

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
  }
}

if (!customElements.get('product-form')) {
  customElements.define('product-form', ProductForm);
}
