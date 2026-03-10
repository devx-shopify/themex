class ProductForm extends HTMLElement {
    constructor() {
        super();

        this.submitForm = this.querySelector('form[action*="/cart/add"]');
        this.submitButton = null;
        this.variantIdInput = null;

        this.handleSubmit = this.handleSubmit.bind(this);
    }

    connectedCallback() {
        this.submitButton = this.submitForm?.querySelector('button[type="submit"]');
        this.variantIdInput = this.submitForm?.querySelector('input[name="id"]');

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

        const productData = {
            productId: this.dataset.productId,
            title: this.dataset.productTitle,
            url: this.dataset.productUrl,
            image: this.dataset.productImage,
            variantTitle: this.dataset.variantTitle,
            variantPrice: parseInt(this.dataset.variantPrice),
            variantPriceFormatted: this.dataset.variantPriceFormatted || '',
            variantId,
            quantity,
            properties: {}
        };

        const cartDrawer = document.querySelector('cart-drawer');

        if (!cartDrawer) {
            this.submitForm.submit();
            return;
        }

        cartDrawer.openDrawer();
        cartDrawer.addOptimisticItem(productData);

        const formData = {
            items: [
                {
                    id: variantId,
                    quantity,
                },
            ],
            sections: 'cart-drawer,cart-item-count',
        };

        const requestSequenceId = ++cartDrawer.addToCartSequence;

        const performRequest = (retryCount = 0) => {
            return fetch(`${window.Shopify.routes.root}cart/add.js`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })
                .then((response) => {
                    if (response.status === 409) {
                        if (retryCount >= 5) throw new Error('Cart update conflict after retries');
                        return new Promise(resolve => setTimeout(resolve, 150 * (retryCount + 1)))
                            .then(() => performRequest(retryCount + 1));
                    }
                    if (!response.ok) {
                        return response.json().then(err => {
                            throw new Error(err.description || 'Failed to add product to cart');
                        });
                    }
                    return response.json();
                });
        };

        const previousRequest = cartDrawer.pendingAddToCartRequest || Promise.resolve();

        const requestPromise = previousRequest
            .catch(() => { })
            .then(() => performRequest())
            .then((data) => {
                const isLatest = requestSequenceId === cartDrawer.addToCartSequence;

                if (isLatest) {
                    document.documentElement.dispatchEvent(
                        new CustomEvent('cart:rerender', {
                            detail: data,
                            bubbles: true,
                        })
                    );
                }

                return data;
            })
            .catch((error) => {
                const isLatest = requestSequenceId === cartDrawer.addToCartSequence;

                if (isLatest) {
                    cartDrawer.removeOptimisticItem();
                    cartDrawer.showNotification(error.message || 'Failed to add product. Please try again.', 'error');
                }
            })
            .finally(() => {
                if (cartDrawer.pendingAddToCartRequest === requestPromise) {
                    cartDrawer.pendingAddToCartRequest = null;
                }
            });

        cartDrawer.pendingAddToCartRequest = requestPromise;
    }
}

customElements.define('product-form', ProductForm);
