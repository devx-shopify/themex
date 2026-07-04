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
    const variantId = parseInt(formData.get('id'), 10);

    await CartStore.init();

    const wasEmpty = (CartStore.state?.item_count ?? 0) === 0;
    cartDrawer?.open();

    const emptyEl = cartDrawer?.querySelector('[data-cart-empty]');
    const itemsEl = cartDrawer?.querySelector('[data-cart-items]');
    const footerEl = cartDrawer?.querySelector('[data-cart-footer]');
    const skeletonEl = cartDrawer?.querySelector('[data-cart-skeleton]');
    if (emptyEl) emptyEl.hidden = true;

    if (footerEl) footerEl.hidden = false;

    let shimmerEl = null;
    let optimisticEl = null;

    const existingItem = wasEmpty
      ? null
      : CartStore.state?.items?.find((item) => item.variant_id === variantId);

    if (existingItem) {
      const row = cartDrawer?.querySelector(`[data-item-key="${existingItem.key}"]`);
      const parent = row?.parentElement;
      shimmerEl = (parent?.children.length === 1 ? parent : row) ?? null;
      shimmerEl?.classList.add('animate-pulse');
    } else {
      if (wasEmpty && itemsEl) itemsEl.hidden = false;

      optimisticEl = this.buildOptimisticLineItem(cartDrawer, variantId);
      if (optimisticEl && itemsEl) {
        if (skeletonEl) skeletonEl.hidden = true;
        optimisticEl.classList.add('animate-pulse');
        itemsEl.prepend(optimisticEl);
      } else if (skeletonEl) {
        skeletonEl.hidden = false;
      }
    }

    CartStore.addPending();

    try {
      const data = await CartAPI.add(formData, sections);

      optimisticEl?.remove();

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
      CartStore.addConfirm(cartData);
    } catch (error) {
      CartStore.addRollback();
      const message = error?.description ?? error?.message ?? window.theme?.strings?.cartError ?? 'Something went wrong.';
      if (cartDrawer) {
        cartDrawer.showError(message);
      } else {
        this.showError(message);
      }
    } finally {
      this.setLoading(false);
      const finalSkeletonEl = cartDrawer?.querySelector('[data-cart-skeleton]');
      if (finalSkeletonEl) finalSkeletonEl.hidden = true;
      shimmerEl?.classList.remove('animate-pulse');
      optimisticEl?.remove();
    }
  }

  getVariantData(variantId) {
    const selector = document.querySelector(
      `variant-selector[data-product-id="${this.dataset.productId}"]`
    );
    const variants = selector?.variants;
    if (!Array.isArray(variants)) return null;
    return variants.find((variant) => variant.id === variantId) ?? null;
  }

  buildOptimisticLineItem(cartDrawer, variantId) {
    const template = cartDrawer?.querySelector('[data-cart-line-optimistic]');
    const root = template?.content?.firstElementChild;
    if (!root) return null;

    const { productTitle, productUrl, productFeaturedImage, productPrice } = this.dataset;


    const variant = this.getVariantData(variantId);
    const imageSrc = variant?.image || productFeaturedImage || '';
    const variantTitle =
      variant?.title && variant.title !== 'Default Title' ? variant.title : '';
    const priceText = variant?.price_formatted || productPrice || '';

    if (!productTitle && !imageSrc && !priceText) return null;

    const node = root.cloneNode(true);

    const imageEl = node.querySelector('[data-optimistic-image]');
    if (imageEl) {
      if (imageSrc) {
        imageEl.src = imageSrc;
        imageEl.alt = productTitle ?? '';
      } else {
        imageEl.closest('[data-optimistic-link]')?.remove();
      }
    }

    const titleEl = node.querySelector('[data-optimistic-title]');
    if (titleEl) titleEl.textContent = productTitle ?? '';

    const variantEl = node.querySelector('[data-optimistic-variant]');
    if (variantEl) {
      if (variantTitle) {
        variantEl.textContent = variantTitle;
      } else {
        variantEl.remove();
      }
    }

    const priceEl = node.querySelector('[data-optimistic-price]');
    if (priceEl) priceEl.textContent = priceText;

    for (const link of node.querySelectorAll('[data-optimistic-link]')) {
      if (productUrl) link.href = productUrl;
    }

    return node;
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
