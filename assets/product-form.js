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

    const cartDrawer = document.querySelector('cart-drawer');
    const sectionId = cartDrawer?.dataset?.sectionId;
    const sections = sectionId ? [sectionId] : [];
    const formData = new FormData(this.form);

    const wasEmpty = (CartStore.state?.item_count ?? 0) === 0;
    cartDrawer?.open();

    // Direct DOM — CartStore.state may still be null if init is in-flight
    const emptyEl = cartDrawer?.querySelector('[data-cart-empty]');
    const itemsEl = cartDrawer?.querySelector('[data-cart-items]');
    const skeletonEl = cartDrawer?.querySelector('[data-cart-skeleton]');
    if (emptyEl) emptyEl.hidden = true;
    if (wasEmpty && itemsEl) itemsEl.hidden = false;
    if (skeletonEl) skeletonEl.hidden = false;

    if (CartStore.state) {
      CartStore.state = { ...CartStore.state, item_count: CartStore.state.item_count + 1 };
    }
    CartStore.pendingOps++;
    CartStore._notify();

    try {
      const data = await CartAPI.add(formData, sections);

      if (sectionId && data.sections?.[sectionId] && cartDrawer) {
        const doc = new DOMParser().parseFromString(data.sections[sectionId], 'text/html');

        const newItemsEl = doc.querySelector('[data-cart-items]');
        const existingItemsEl = cartDrawer.querySelector('[data-cart-items]');
        if (newItemsEl && existingItemsEl) {
          Idiomorph.morph(existingItemsEl, newItemsEl, { morphStyle: 'outerHTML' });
        }

        const newFooterEl = doc.querySelector('[data-cart-footer]');
        const existingFooterEl = cartDrawer.querySelector('[data-cart-footer]');
        if (newFooterEl && existingFooterEl) {
          Idiomorph.morph(existingFooterEl, newFooterEl, { morphStyle: 'outerHTML' });
        }
      }

      const cartData = await CartAPI.get();
      CartStore.state = cartData;
      CartStore.pendingOps--;
      CartStore._notify();
    } catch (error) {
      if (CartStore.state) {
        CartStore.state = { ...CartStore.state, item_count: Math.max(0, CartStore.state.item_count - 1) };
      }
      if (wasEmpty && emptyEl) emptyEl.hidden = false;
      cartDrawer?.close();
      CartStore.pendingOps--;
      CartStore._notify();
      const message = error?.description ?? error?.message ?? window.theme?.strings?.cartError ?? 'Something went wrong.';
      this.showError(message);
    } finally {
      this.setLoading(false);
      const finalSkeletonEl = cartDrawer?.querySelector('[data-cart-skeleton]');
      if (finalSkeletonEl) finalSkeletonEl.hidden = true;
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
