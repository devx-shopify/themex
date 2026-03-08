class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form[action*="/cart/add"]');
    this.submitButton = this.form?.querySelector('button[type="submit"]');
    this.buttonText = this.submitButton?.querySelector('[data-button-text]');
    this.buttonLoading = this.submitButton?.querySelector('[data-button-loading]');
    this.errorContainer = this.querySelector('[data-form-error]');
    this.quantityInput = this.form?.querySelector('input[name="quantity"]');

    this.form?.addEventListener('submit', this.handleSubmit.bind(this));
    this.setupQuantityControls();
  }

  setupQuantityControls() {
    const minusBtn = this.querySelector('[data-quantity-minus]');
    const plusBtn = this.querySelector('[data-quantity-plus]');

    if (!this.quantityInput) return;

    minusBtn?.addEventListener('click', () => {
      const current = parseInt(this.quantityInput.value) || 1;
      if (current > 1) {
        this.quantityInput.value = current - 1;
        minusBtn.disabled = current - 1 <= 1;
      }
    });

    plusBtn?.addEventListener('click', () => {
      const current = parseInt(this.quantityInput.value) || 1;
      const max = parseInt(this.quantityInput.max) || 99;
      if (current < max) {
        this.quantityInput.value = current + 1;
        if (minusBtn) minusBtn.disabled = false;
      }
    });

    if (minusBtn) minusBtn.disabled = true;
  }

  setLoading(loading) {
    if (!this.submitButton) return;

    this.submitButton.disabled = loading;

    if (this.buttonText) {
      this.buttonText.classList.toggle('hidden', loading);
    }

    if (this.buttonLoading) {
      this.buttonLoading.classList.toggle('hidden', !loading);
    }
  }

  showError(message) {
    if (!this.errorContainer) return;
    this.errorContainer.textContent = message;
    this.errorContainer.classList.remove('hidden');

    setTimeout(() => {
      this.errorContainer.classList.add('hidden');
    }, 5000);
  }

  async handleSubmit(event) {
    event.preventDefault();

    const variantInput = this.form.querySelector('input[name="id"]');
    const quantityInput = this.form.querySelector('input[name="quantity"]');

    if (!variantInput) return;

    this.setLoading(true);
    if (this.errorContainer) this.errorContainer.classList.add('hidden');

    const body = {
      items: [
        {
          id: parseInt(variantInput.value),
          quantity: parseInt(quantityInput?.value || 1),
        },
      ],
      sections: 'cart-drawer',
    };

    try {
      const response = await fetch(
        `${window.Shopify?.routes?.root || '/'}cart/add.js`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.description || 'Failed to add product to cart'
        );
      }

      const data = await response.json();

      document.dispatchEvent(
        new CustomEvent('cart:refresh', {
          detail: {
            sections: data.sections,
            itemCount: data.items?.reduce((sum, item) => sum + item.quantity, 0),
          },
        })
      );

      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) cartDrawer.openDrawer();

    } catch (error) {
      this.showError(error.message);
    } finally {
      this.setLoading(false);
    }
  }
}

customElements.define('product-form', ProductForm);
