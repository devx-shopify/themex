class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('[data-product-form]');
    if (!this.form) return;

    this.submitButton = this.form.querySelector('[type="submit"]');
    this.errorContainer = this.querySelector('[data-form-error]');

    this.form.addEventListener('submit', (event) => this.onSubmit(event));
    this.initQuantityStepper();
    this.initVariantSubscriber();
  }

  disconnectedCallback() {
    this.unsubscribeVariant?.();
  }

  initVariantSubscriber() {
    if (typeof subscribe === 'undefined' || typeof PUB_SUB_EVENTS === 'undefined') return;

    this.unsubscribeVariant = subscribe(PUB_SUB_EVENTS.variantChange, (data) => {
      if (data.productId !== this.dataset.productId) return;

      const variantInput = this.form.querySelector('input[name="id"]');
      const buttonText = this.submitButton?.querySelector('[data-button-text]');

      if (data.variant) {
        if (variantInput) variantInput.value = data.variant.id;

        if (this.submitButton && buttonText) {
          if (data.variant.available) {
            this.submitButton.disabled = false;
            buttonText.textContent = window.theme?.strings?.addToCart ?? 'Add to cart';
          } else {
            this.submitButton.disabled = true;
            buttonText.textContent = window.theme?.strings?.soldOut ?? 'Sold out';
          }
        }
      } else {
        if (this.submitButton && buttonText) {
          this.submitButton.disabled = true;
          buttonText.textContent = window.theme?.strings?.unavailable ?? 'Unavailable';
        }
      }
    });
  }

  initQuantityStepper() {
    this.addEventListener('click', (event) => {
      const minusBtn = event.target.closest('[data-quantity-minus]');
      const plusBtn = event.target.closest('[data-quantity-plus]');

      if (!minusBtn && !plusBtn) return;

      const input = this.querySelector('input[name="quantity"]');
      if (!input) return;

      const currentQty = parseInt(input.value, 10) || 1;
      const min = parseInt(input.min, 10) || 1;
      const max = parseInt(input.max, 10) || 99;

      if (minusBtn) {
        input.value = Math.max(min, currentQty - 1);
      } else if (plusBtn) {
        input.value = Math.min(max, currentQty + 1);
      }
    });
  }

  async onSubmit(event) {
    event.preventDefault();

    if (this.submitButton?.disabled) return;
    this.setLoading(true);
    this.hideError();

    const formData = new FormData(this.form);
    const sectionId = document.querySelector('cart-drawer')?.dataset?.sectionId;
    const sections = sectionId ? [sectionId] : [];

    try {
      const data = await CartAPI.add(formData, sections);
      const cart = await CartAPI.get();
      data.item_count = cart.item_count;
      publish(PUB_SUB_EVENTS.cartAdd, {
        source: 'product-form',
        productId: this.dataset.productId,
        sections: data.sections,
        item_count: cart.item_count,
      });
      updateCartCount(cart.item_count);
    } catch (error) {
      const message = error?.description ?? error?.message ?? window.theme?.strings?.cartError ?? 'Something went wrong.';
      this.showError(message);
      publish(PUB_SUB_EVENTS.cartError, { source: 'product-form', error });
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading) {
    if (!this.submitButton) return;
    this.submitButton.disabled = isLoading;

    const buttonText = this.submitButton.querySelector('[data-button-text]');
    const buttonLoader = this.submitButton.querySelector('[data-button-loader]');

    if (buttonText) buttonText.classList.toggle('invisible', isLoading);
    if (buttonLoader) {
      buttonLoader.classList.toggle('hidden', !isLoading);
      buttonLoader.classList.toggle('flex', isLoading);
    }
  }

  showError(message) {
    if (!this.errorContainer) return;
    this.errorContainer.textContent = message;
    this.errorContainer.hidden = false;
  }

  hideError() {
    if (!this.errorContainer) return;
    this.errorContainer.textContent = '';
    this.errorContainer.hidden = true;
  }
}

if (!customElements.get('product-form')) {
  customElements.define('product-form', ProductForm);
}
