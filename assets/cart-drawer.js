const NOTIFICATION_BG_CLASSES = ['bg-success', 'bg-error', 'bg-accent', 'bg-foreground'];
const NOTIFICATION_STYLES = {
    success: ['bg-success', 'text-background'],
    error: ['bg-error', 'text-background'],
    warning: ['bg-accent', 'text-foreground'],
    info: ['bg-foreground', 'text-background'],
};

class CartDrawer extends HTMLElement {
    constructor() {
        super();

        this.overlay = this.querySelector('[data-cart-overlay]');
        this.panel = this.querySelector('[data-cart-panel]');
        this.closeButton = this.querySelector('[data-cart-close]');
        this.checkoutButton = null;
        this.notification = null;
        this.notificationContent = null;
        this.notificationTimeout = null;

        this.handleOpen = this.handleOpen.bind(this);
        this.closeDrawer = this.closeDrawer.bind(this);
        this.cartRerender = this.cartRerender.bind(this);

        this.handleOverlayClick = (event) => {
            if (event.target === this.overlay) {
                this.closeDrawer();
            }
        };

        this.optimisticStateMap = new Map();
        this.stateSequence = 0;

        this.pendingAddToCartRequest = null;
        this.checkoutPending = false;
        this.addToCartSequence = 0;
    }

    extractPropertiesFromDOM(itemElement) {
        const properties = {};
        const detailsContainer = itemElement.querySelector('.cart-item-details');
        if (detailsContainer) {
            const propertyElements = detailsContainer.querySelectorAll('.cart-item-property');
            propertyElements.forEach(propEl => {
                const text = propEl.textContent.trim();
                const colonIndex = text.indexOf(':');
                if (colonIndex > 0) {
                    const key = text.substring(0, colonIndex).trim();
                    const value = text.substring(colonIndex + 1).trim();
                    if (key && value) {
                        properties[key] = value;
                    }
                }
            });
        }
        return properties;
    }

    propertiesMatch(props1, props2) {
        const p1 = props1 || {};
        const p2 = props2 || {};

        const normalizeProps = (props) => {
            const normalized = {};
            for (const key in props) {
                if (props[key] != null && props[key] !== '') {
                    const value = String(props[key]).trim();
                    if (value) {
                        normalized[key.trim()] = value;
                    }
                }
            }
            return normalized;
        };

        const normalized1 = normalizeProps(p1);
        const normalized2 = normalizeProps(p2);

        const keys1 = Object.keys(normalized1);
        const keys2 = Object.keys(normalized2);

        if (keys1.length !== keys2.length) return false;
        if (keys1.length === 0) return true;

        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (normalized1[key] !== normalized2[key]) return false;
        }

        return true;
    }

    createStateKey(variantId, properties) {
        if (!properties || Object.keys(properties).length === 0) {
            return `${variantId}:no-props`;
        }
        const sortedProps = Object.keys(properties)
            .filter(k => properties[k] && properties[k] !== '')
            .sort()
            .map(k => `${k}=${properties[k]}`)
            .join('|');
        return `${variantId}:${sortedProps}`;
    }

    restoreItemProperties(cartItems) {
        const itemsContainer = this.querySelector('[data-cart-items]');
        if (!itemsContainer) return;

        cartItems.forEach((cartItem) => {
            if (!cartItem.variant_id) return;

            const itemsWithVariant = itemsContainer.querySelectorAll(`[data-variant-id="${cartItem.variant_id}"]`);
            if (itemsWithVariant.length === 0) return;

            const hasProperties = cartItem.properties && Object.keys(cartItem.properties).length > 0;
            const cartItemPropsJson = hasProperties ? JSON.stringify(cartItem.properties) : '{}';

            for (const itemElement of itemsWithVariant) {
                let storedPropsObj = {};
                const storedProps = itemElement.getAttribute('data-item-properties');

                if (storedProps && storedProps !== '{}') {
                    try {
                        storedPropsObj = JSON.parse(storedProps);
                    } catch (e) {
                        storedPropsObj = this.extractPropertiesFromDOM(itemElement);
                    }
                } else {
                    storedPropsObj = this.extractPropertiesFromDOM(itemElement);
                }

                const cartItemProps = cartItem.properties || {};
                if (this.propertiesMatch(cartItemProps, storedPropsObj)) {
                    itemElement.setAttribute('data-item-properties', cartItemPropsJson);
                    return;
                }
            }
        });
    }

    connectedCallback() {
        this.checkoutButton = this.querySelector('[data-cart-checkout]');
        if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
            this.checkoutButton.addEventListener('click', this.handleCheckoutClick.bind(this));
            this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
        }

        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-cart-trigger]');
            if (trigger) {
                e.preventDefault();
                this.openDrawer();
            }
        });

        this.closeButton?.addEventListener('click', this.closeDrawer);
        this.overlay?.addEventListener('click', this.handleOverlayClick);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDrawer();
            }
        });

        document.addEventListener('cart:rerender', this.cartRerender);
    }

    disconnectedCallback() {
        this.closeButton?.removeEventListener('click', this.closeDrawer);
        this.overlay?.removeEventListener('click', this.handleOverlayClick);
        document.removeEventListener('cart:rerender', this.cartRerender);
    }

    handleOpen(event) {
        event.preventDefault();
        this.openDrawer();
    }

    openDrawer() {
        this.isOpen = true;

        if (!this.overlay || !this.panel) return;

        this.overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.overlay.classList.remove('opacity-0');
                this.overlay.classList.add('opacity-100');
                this.panel.classList.remove('translate-x-full');
                this.panel.classList.add('translate-x-0');
            });
        });
    }

    closeDrawer() {
        this.isOpen = false;

        if (!this.overlay || !this.panel) return;

        this.overlay.classList.remove('opacity-100');
        this.overlay.classList.add('opacity-0');
        this.panel.classList.remove('translate-x-0');
        this.panel.classList.add('translate-x-full');

        setTimeout(() => {
            this.overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }, 300);
    }

    addOptimisticItem(productData) {
        const cartItemsContainer = this.querySelector('[data-cart-items]');

        if (!cartItemsContainer) return;

        // Remove empty cart message if present
        const emptyMessage = cartItemsContainer.querySelector('[data-cart-empty]');
        if (emptyMessage) {
            emptyMessage.remove();
        }

        const wasCartEmpty = cartItemsContainer.querySelectorAll('.cart-item').length === 0;

        const candidateItems = cartItemsContainer.querySelectorAll(`[data-variant-id="${productData.variantId}"]`);

        let existingItem = null;
        const productProps = productData.properties || {};

        for (const candidate of candidateItems) {
            let candidateProps = {};

            const storedPropsJson = candidate.getAttribute('data-item-properties');
            if (storedPropsJson && storedPropsJson !== '{}') {
                try {
                    candidateProps = JSON.parse(storedPropsJson);
                } catch (e) {
                    candidateProps = this.extractPropertiesFromDOM(candidate);
                }
            } else {
                candidateProps = this.extractPropertiesFromDOM(candidate);
            }

            if (this.propertiesMatch(productProps, candidateProps)) {
                existingItem = candidate;
                break;
            }
        }

        if (existingItem) {
            const quantityDisplay = existingItem.querySelector('[data-quantity-value]');
            const lineTotalValue = existingItem.querySelector('[data-line-total-value]') || existingItem.querySelector('[data-line-total]');

            if (quantityDisplay) {
                const currentQuantity = parseInt(quantityDisplay.textContent) || 0;
                const newQuantity = currentQuantity + productData.quantity;

                const stateId = ++this.stateSequence;
                const stateKey = this.createStateKey(productData.variantId, productData.properties);
                const state = {
                    id: stateId,
                    variantId: productData.variantId,
                    expectedQuantity: newQuantity,
                    quantityAdded: productData.quantity,
                    properties: productData.properties
                };

                if (!this.optimisticStateMap.has(stateKey)) {
                    this.optimisticStateMap.set(stateKey, []);
                }
                this.optimisticStateMap.get(stateKey).push(state);

                quantityDisplay.dataset.oldQuantity = currentQuantity.toString();
                quantityDisplay.textContent = newQuantity;

                if (lineTotalValue) {
                    lineTotalValue.dataset.oldValue = lineTotalValue.textContent.trim();
                }

                const lineTotalContainer = existingItem.querySelector('[data-line-total-container]') || existingItem.querySelector('[data-line-total]');
                if (lineTotalContainer) {
                    lineTotalContainer.classList.add('cart-price-loading');
                }
            }

            existingItem.classList.add('optimistic-update');

            // In themex, cart-actions IS the cart item
            if (existingItem.updateButtonStates) {
                existingItem.updateButtonStates();
            }

            this.updateCartCountOptimistically(productData.quantity);
            this.updateOptimisticSubtotal();

            return;
        }

        // New item — clone from template
        const stateId = ++this.stateSequence;
        const stateKey = this.createStateKey(productData.variantId, productData.properties);
        const state = {
            id: stateId,
            variantId: productData.variantId,
            expectedQuantity: productData.quantity,
            quantityAdded: productData.quantity,
            isNewItem: true,
            properties: productData.properties
        };

        if (!this.optimisticStateMap.has(stateKey)) {
            this.optimisticStateMap.set(stateKey, []);
        }
        this.optimisticStateMap.get(stateKey).push(state);

        const template = this.querySelector('[data-optimistic-item-template]');
        if (!template) return;

        const optimisticItem = template.content.cloneNode(true).firstElementChild;

        optimisticItem.setAttribute('data-product-id', productData.productId);
        optimisticItem.setAttribute('data-variant-id', productData.variantId);
        optimisticItem.setAttribute('data-item-price', productData.variantPrice);
        if (productData.variantPriceFormatted) {
            optimisticItem.setAttribute('data-item-price-formatted', productData.variantPriceFormatted);
        }

        const propertiesToStore = productData.properties || {};
        optimisticItem.setAttribute('data-item-properties', JSON.stringify(propertiesToStore));

        const itemUrl = optimisticItem.querySelector('[data-item-url]');
        const itemImage = optimisticItem.querySelector('[data-item-image]');
        const itemTitle = optimisticItem.querySelector('[data-item-title]');
        const itemVariant = optimisticItem.querySelector('[data-item-variant]');
        const itemPropertiesContainer = optimisticItem.querySelector('[data-item-properties-container]');
        const quantityValue = optimisticItem.querySelector('[data-quantity-value]');

        if (itemUrl) itemUrl.href = productData.url;
        if (itemImage) {
            itemImage.src = productData.image;
            itemImage.alt = productData.title;
        }
        if (itemTitle) {
            itemTitle.textContent = productData.title;
            itemTitle.href = productData.url;
        }
        if (itemVariant && productData.variantTitle && productData.variantTitle !== 'Default Title') {
            itemVariant.textContent = productData.variantTitle;
            itemVariant.classList.remove('hidden');
        }

        if (itemPropertiesContainer && productData.properties && Object.keys(productData.properties).length > 0) {
            itemPropertiesContainer.innerHTML = '';
            Object.entries(productData.properties).forEach(([key, value]) => {
                if (!(value != null && value !== '')) return;
                const propElement = document.createElement('p');
                propElement.className = 'cart-item-property mt-0.5 text-xs text-muted';
                propElement.textContent = `${key}: ${value}`;
                itemPropertiesContainer.appendChild(propElement);
            });
        }

        if (quantityValue) quantityValue.textContent = productData.quantity;

        const lineTotalValueEl = optimisticItem.querySelector('[data-line-total-value]');
        if (lineTotalValueEl && productData.variantPriceFormatted) {
            lineTotalValueEl.textContent = productData.variantPriceFormatted;
        }

        cartItemsContainer.insertBefore(optimisticItem, cartItemsContainer.firstChild);

        this.updateCartCountOptimistically(productData.quantity);

        if (wasCartEmpty) {
            this.createOptimisticFooter(productData);
        }
    }

    createOptimisticFooter(productData) {
        let footer = this.querySelector('.cart-drawer-footer');
        if (footer) {
            footer.classList.remove('hidden');
            const subtotalElement = footer.querySelector('[data-cart-subtotal]');
            if (subtotalElement) {
                subtotalElement.classList.add('cart-price-loading');
            }
            this.checkoutButton = footer.querySelector('[data-cart-checkout]');
            if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
                this.checkoutButton.addEventListener('click', this.handleCheckoutClick.bind(this));
                this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
            }
            return;
        }

        const footerTemplate = this.querySelector('[data-optimistic-footer-template]');
        if (!footerTemplate) return;

        footer = footerTemplate.content.cloneNode(true).firstElementChild;

        const subtotalElement = footer.querySelector('[data-cart-subtotal]');
        if (subtotalElement) {
            subtotalElement.classList.add('cart-price-loading');
        }

        this.panel.appendChild(footer);

        this.checkoutButton = footer.querySelector('[data-cart-checkout]');
        if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
            this.checkoutButton.addEventListener('click', this.handleCheckoutClick.bind(this));
            this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
        }
    }

    updateOptimisticSubtotal() {
        const footer = this.querySelector('.cart-drawer-footer');
        if (!footer) return;

        const subtotalElement = footer.querySelector('[data-cart-subtotal]');
        if (!subtotalElement) return;

        subtotalElement.classList.add('cart-price-loading');
    }

    clearPriceLoadingStates() {
        const containers = this.querySelectorAll('[data-line-total-container], [data-line-total]');
        for (const container of containers) {
            container.classList.remove('cart-price-loading');
        }

        const subtotalEl = this.querySelector('[data-cart-subtotal]');
        if (subtotalEl) {
            subtotalEl.classList.remove('cart-price-loading');
        }
    }

    removeOptimisticItem() {
        const optimisticItem = this.querySelector('.optimistic-item');
        if (optimisticItem) {
            const quantityDisplay = optimisticItem.querySelector('[data-quantity-value]');
            const quantity = parseInt(quantityDisplay?.textContent) || 1;
            optimisticItem.remove();
            this.updateCartCountOptimistically(-quantity);
        }

        const optimisticUpdate = this.querySelector('.optimistic-update');
        if (!optimisticUpdate) return;

        const quantityDisplay = optimisticUpdate.querySelector('[data-quantity-value]');
        const lineTotal = optimisticUpdate.querySelector('[data-line-total]');
        const lineTotalValue = lineTotal?.querySelector('[data-line-total-value]') || lineTotal;

        if (quantityDisplay?.dataset.oldQuantity) {
            const oldQuantity = parseInt(quantityDisplay.dataset.oldQuantity);
            const currentQuantity = parseInt(quantityDisplay.textContent);
            const quantityDelta = oldQuantity - currentQuantity;

            quantityDisplay.textContent = quantityDisplay.dataset.oldQuantity;
            delete quantityDisplay.dataset.oldQuantity;

            this.updateCartCountOptimistically(quantityDelta);
        }

        if (lineTotalValue?.dataset.oldValue) {
            lineTotalValue.textContent = lineTotalValue.dataset.oldValue;
            lineTotalValue.classList.remove('hidden');
            delete lineTotalValue.dataset.oldValue;
        }

        const lineTotalContainer = optimisticUpdate.querySelector('[data-line-total-container]') || optimisticUpdate.querySelector('[data-line-total]');
        if (lineTotalContainer) {
            lineTotalContainer.classList.remove('cart-price-loading');
        }

        optimisticUpdate.classList.remove('optimistic-update');

        const subtotalEl = this.querySelector('[data-cart-subtotal]');
        if (subtotalEl) {
            subtotalEl.classList.remove('cart-price-loading');
        }
    }

    showOptimisticEmptyCart() {
        const itemsContainer = this.querySelector('[data-cart-items]');
        if (!itemsContainer) return;

        const emptyTemplate = this.querySelector('[data-empty-cart-template]');
        if (!emptyTemplate) return;

        const emptyContent = emptyTemplate.content.cloneNode(true);
        itemsContainer.innerHTML = '';
        itemsContainer.appendChild(emptyContent);

        const footer = this.querySelector('.cart-drawer-footer');
        if (footer) {
            footer.classList.add('hidden');
        }
    }

    updateCartCountOptimistically(delta) {
        const cartCountElements = document.querySelectorAll('[data-cart-count]');

        cartCountElements.forEach(countElement => {
            const currentCount = parseInt(countElement.getAttribute('data-cart-count')) || 0;
            const newCount = currentCount + delta;

            countElement.textContent = newCount > 0 ? newCount : '';
            countElement.setAttribute('data-cart-count', newCount);

            if (newCount > 0) {
                countElement.classList.remove('hidden');
            } else {
                countElement.classList.add('hidden');
            }
        });

        const headingCount = this.querySelector('[data-cart-heading-count]');
        if (headingCount) {
            const currentCount = parseInt(headingCount.textContent) || 0;
            headingCount.textContent = currentCount + delta;
        }
    }

    extractCartItemData(itemElement) {
        const data = {
            element: itemElement,
            key: itemElement.getAttribute('data-key') || null,
            variantId: itemElement.getAttribute('data-variant-id') || null,
            image: null,
            imageAlt: null,
            title: null,
            titleUrl: null,
            variantTitle: null,
            price: null,
            quantity: null,
            properties: {},
            lineTotal: null
        };

        const imageContainer = itemElement.querySelector('.cart-item-image');
        if (imageContainer) {
            let imageEl = imageContainer.querySelector('[data-item-image]');
            if (!imageEl) {
                imageEl = imageContainer.querySelector('img');
            }
            if (imageEl) {
                data.image = imageEl.src || imageEl.getAttribute('src');
                data.imageAlt = imageEl.alt || '';
            }
        }

        const titleLink = itemElement.querySelector('[data-item-title]');
        if (titleLink) {
            data.title = titleLink.textContent.trim();
            data.titleUrl = titleLink.href || titleLink.getAttribute('href');
        }

        const variantEl = itemElement.querySelector('[data-item-variant]');
        if (variantEl && !variantEl.classList.contains('hidden')) {
            data.variantTitle = variantEl.textContent.trim();
        }

        const priceEl = itemElement.querySelector('[data-line-total-value]');
        if (priceEl) {
            data.price = priceEl.textContent.trim();
            data.lineTotal = data.price;
        }

        const quantityEl = itemElement.querySelector('[data-quantity-value]');
        if (quantityEl) {
            data.quantity = parseInt(quantityEl.textContent.trim()) || 0;
        }

        const storedProps = itemElement.getAttribute('data-item-properties');
        if (storedProps && storedProps !== '{}') {
            try {
                data.properties = JSON.parse(storedProps);
            } catch (e) {
                data.properties = this.extractPropertiesFromDOM(itemElement);
            }
        } else {
            data.properties = this.extractPropertiesFromDOM(itemElement);
        }

        return data;
    }

    extractCartItemFromHTML(htmlElement) {
        return this.extractCartItemData(htmlElement);
    }

    matchCartItems(currentItem, newItems) {
        if (currentItem.key) {
            const matchByKey = newItems.find(item => item.key === currentItem.key);
            if (matchByKey) return matchByKey;
        }

        if (currentItem.variantId) {
            const itemsWithVariant = newItems.filter(item => item.variantId === currentItem.variantId);
            for (const newItem of itemsWithVariant) {
                if (this.propertiesMatch(currentItem.properties, newItem.properties)) {
                    return newItem;
                }
            }
        }

        return null;
    }

    updateCartItemElement(currentElement, newData, newElement = null) {
        if (newElement) {
            const newPriceContainer = newElement.querySelector('[data-line-total-container]') || newElement.querySelector('[data-line-total]');
            const currentPriceContainer = currentElement.querySelector('[data-line-total-container]') || currentElement.querySelector('[data-line-total]');
            if (newPriceContainer && currentPriceContainer) {
                currentPriceContainer.innerHTML = newPriceContainer.innerHTML;
                currentPriceContainer.classList.remove('cart-price-loading');
            }

            const newDiscountEls = newElement.querySelectorAll('.text-xs.text-success');
            const currentDiscountEls = currentElement.querySelectorAll('.text-xs.text-success');
            for (const el of currentDiscountEls) {
                el.remove();
            }
            const priceContainer = currentElement.querySelector('[data-line-total-container]') || currentElement.querySelector('[data-line-total]');
            if (priceContainer) {
                for (const el of newDiscountEls) {
                    priceContainer.parentNode.insertBefore(el.cloneNode(true), priceContainer.nextSibling);
                }
            }
        } else {
            const priceEl = currentElement.querySelector('[data-line-total-value]');
            if (priceEl && newData.price) {
                priceEl.textContent = newData.price;
            }
        }

        const quantityEl = currentElement.querySelector('[data-quantity-value]');
        if (quantityEl && newData.quantity !== null) {
            quantityEl.textContent = newData.quantity.toString();
        }

        if (newElement) {
            // Update quantity controls from server HTML
            const newDecrement = newElement.querySelector('[data-decrement]');
            const currentDecrement = currentElement.querySelector('[data-decrement]');
            if (newDecrement && currentDecrement) {
                currentDecrement.setAttribute('data-quantity', newDecrement.getAttribute('data-quantity') || '0');
            }

            const newPlus = newElement.querySelector('[data-plus]');
            const currentPlus = currentElement.querySelector('[data-plus]');
            if (newPlus && currentPlus) {
                currentPlus.setAttribute('data-quantity', newPlus.getAttribute('data-quantity') || '0');
            }

            // Update data-key from server
            const newKey = newElement.getAttribute('data-key');
            if (newKey) {
                currentElement.setAttribute('data-key', newKey);
                currentElement.setAttribute('data-line-key', newKey);
            }
        }

        if (newData.variantId) {
            currentElement.setAttribute('data-variant-id', newData.variantId);
        }
        if (newData.key) {
            currentElement.setAttribute('data-key', newData.key);
            currentElement.setAttribute('data-line-key', newData.key);
        }
        if (newData.lineTotal) {
            currentElement.setAttribute('data-line-price-formatted', newData.lineTotal);
        }

        if (newElement) {
            const serverItemPrice = newElement.getAttribute('data-item-price');
            if (serverItemPrice) {
                currentElement.setAttribute('data-item-price', serverItemPrice);
            }
            const serverItemPriceFormatted = newElement.getAttribute('data-item-price-formatted');
            if (serverItemPriceFormatted) {
                currentElement.setAttribute('data-item-price-formatted', serverItemPriceFormatted);
            }
            const serverLinePriceFormatted = newElement.getAttribute('data-line-price-formatted');
            if (serverLinePriceFormatted) {
                currentElement.setAttribute('data-line-price-formatted', serverLinePriceFormatted);
            }
            const serverHasDiscount = newElement.getAttribute('data-has-discount');
            if (serverHasDiscount !== null) {
                currentElement.setAttribute('data-has-discount', serverHasDiscount);
            }
            const serverProductId = newElement.getAttribute('data-product-id');
            if (serverProductId) {
                currentElement.setAttribute('data-product-id', serverProductId);
            }
        }

        const imageContainer = currentElement.querySelector('.cart-item-image');
        if (imageContainer && newData.image) {
            let imageEl = imageContainer.querySelector('[data-item-image]');
            if (!imageEl) {
                imageEl = imageContainer.querySelector('img');
            }
            if (imageEl) {
                const currentSrc = imageEl.src || imageEl.getAttribute('src');
                if (currentSrc !== newData.image) {
                    imageEl.src = newData.image;
                    if (newData.imageAlt) {
                        imageEl.alt = newData.imageAlt;
                    }
                }
            }
        }

        const titleLink = currentElement.querySelector('[data-item-title]');
        if (titleLink && newData.title) {
            const currentTitle = titleLink.textContent.trim();
            if (currentTitle !== newData.title) {
                titleLink.textContent = newData.title;
            }
            if (newData.titleUrl) {
                titleLink.href = newData.titleUrl;
            }
        }

        const variantEl = currentElement.querySelector('[data-item-variant]');
        if (newData.variantTitle) {
            if (variantEl) {
                variantEl.textContent = newData.variantTitle;
                variantEl.classList.remove('hidden');
            }
        } else if (variantEl) {
            variantEl.classList.add('hidden');
        }

        const currentProps = this.extractPropertiesFromDOM(currentElement);
        const propsChanged = !this.propertiesMatch(currentProps, newData.properties);

        if (!propsChanged) return;

        const propsJson = JSON.stringify(newData.properties || {});
        currentElement.setAttribute('data-item-properties', propsJson);

        const propertiesContainer = currentElement.querySelector('[data-item-properties-container]');
        if (propertiesContainer) {
            const existingProps = propertiesContainer.querySelectorAll('.cart-item-property');
            existingProps.forEach(p => p.remove());

            if (newData.properties && Object.keys(newData.properties).length > 0) {
                Object.entries(newData.properties).forEach(([key, value]) => {
                    if (value != null && value !== '') {
                        const propElement = document.createElement('p');
                        propElement.className = 'cart-item-property mt-0.5 text-xs text-muted';
                        propElement.textContent = `${key}: ${value}`;
                        propertiesContainer.appendChild(propElement);
                    }
                });
            }
        }
    }

    updateCartSubtotal(newSubtotal) {
        const footer = this.querySelector('.cart-drawer-footer');
        if (!footer) return;

        const subtotalElement = footer.querySelector('[data-cart-subtotal]');
        if (subtotalElement && newSubtotal) {
            subtotalElement.textContent = newSubtotal;
        }
    }

    updateCartSelectively(newCartDrawerHTML, actualCart) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCartDrawerHTML;

        const newPanel = tempDiv.querySelector('[data-cart-panel]');
        if (!newPanel || !this.panel) return false;

        const newCartItemsContainer = newPanel.querySelector('[data-cart-items]');
        if (!newCartItemsContainer) return false;

        const newCartItemElements = Array.from(newCartItemsContainer.querySelectorAll('.cart-item, [data-variant-id]'));
        const newCartItems = newCartItemElements.map(itemEl => ({
            element: itemEl,
            data: this.extractCartItemFromHTML(itemEl)
        }));

        const currentCartItemsContainer = this.querySelector('[data-cart-items]');
        if (!currentCartItemsContainer) return false;

        const currentCartItems = Array.from(currentCartItemsContainer.querySelectorAll('.cart-item, [data-variant-id]'))
            .map(itemEl => this.extractCartItemData(itemEl));

        const matchedNewItems = new Set();
        currentCartItems.forEach(currentItem => {
            const matchedNewItem = newCartItems.find(newItem => {
                const match = this.matchCartItems(currentItem, [newItem.data]);
                return match === newItem.data;
            });
            if (matchedNewItem) {
                matchedNewItems.add(matchedNewItem);
                this.updateCartItemElement(currentItem.element, matchedNewItem.data, matchedNewItem.element);
            }
        });

        // Add items that exist in server but not in current DOM
        const newItemsToAdd = newCartItems.filter(item => !matchedNewItems.has(item));
        if (newItemsToAdd.length > 0) {
            const fragment = document.createDocumentFragment();
            for (const newItem of newItemsToAdd) {
                if (newItem.element) {
                    const clonedItem = newItem.element.cloneNode(true);
                    clonedItem.classList.add('opacity-0');
                    fragment.appendChild(clonedItem);
                }
            }

            if (fragment.children.length > 0) {
                currentCartItemsContainer.appendChild(fragment);
                requestAnimationFrame(() => {
                    const addedItems = currentCartItemsContainer.querySelectorAll('.cart-item.opacity-0');
                    for (const item of addedItems) {
                        item.classList.remove('opacity-0');
                    }
                });
            }
        }

        // Remove items that no longer exist on server (but keep optimistic items)
        const newItemKeys = new Set(newCartItems.map(item => item.data.key).filter(Boolean));
        const newItemVariantIds = new Set(newCartItems.map(item => item.data.variantId).filter(Boolean));
        for (const currentItem of currentCartItems) {
            const isInServerResponse = (currentItem.key && newItemKeys.has(currentItem.key))
                || (!currentItem.key && currentItem.variantId && newItemVariantIds.has(currentItem.variantId));

            if (!isInServerResponse) {
                if (currentItem.element.classList.contains('optimistic-item')) continue;
                currentItem.element.classList.add('opacity-0');
                setTimeout(() => currentItem.element.remove(), 300);
            }
        }

        // Update footer
        const currentFooter = this.querySelector('.cart-drawer-footer');
        const newFooter = newPanel.querySelector('.cart-drawer-footer');
        if (newFooter) {
            if (currentFooter) {
                currentFooter.innerHTML = newFooter.innerHTML;
                currentFooter.classList.remove('hidden');
            } else {
                const clonedFooter = newFooter.cloneNode(true);
                this.panel.appendChild(clonedFooter);
            }
        }

        this.checkoutButton = this.querySelector('[data-cart-checkout]');
        if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
            this.checkoutButton.addEventListener('click', this.handleCheckoutClick.bind(this));
            this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
        }

        // Re-init button states on all cart-actions
        const allCartActions = this.querySelectorAll('cart-actions');
        allCartActions.forEach(actions => {
            if (actions.updateButtonStates) {
                actions.updateButtonStates();
            }
        });

        if (actualCart && actualCart.length > 0) {
            this.restoreItemProperties(actualCart);
        }

        return true;
    }

    cartRerender(event) {
        if (!event.detail || !event.detail.sections) return;

        const actualCart = event.detail.items || [];

        // Process optimistic state — check server response against expected quantities
        const stateKeysToCheck = Array.from(this.optimisticStateMap.keys());
        stateKeysToCheck.forEach(stateKey => {
            const states = this.optimisticStateMap.get(stateKey) || [];
            if (states.length === 0) return;

            const firstState = states[0];
            const variantId = firstState.variantId;
            const stateProperties = firstState.properties || {};

            const cartItemsWithVariant = actualCart.filter(item => item.variant_id == variantId);

            let targetItem = null;
            for (const cartItem of cartItemsWithVariant) {
                const cartItemProps = cartItem.properties || {};
                if (this.propertiesMatch(stateProperties, cartItemProps)) {
                    targetItem = cartItem;
                    break;
                }
            }

            const processedStates = [];
            for (const state of states) {
                if (targetItem) {
                    const actualQuantity = targetItem.quantity;
                    const expectedQuantity = state.expectedQuantity;

                    if (actualQuantity < expectedQuantity) {
                        const limitedQuantity = actualQuantity - (expectedQuantity - state.quantityAdded);
                        if (limitedQuantity > 0) {
                            this.showNotification(`Only ${limitedQuantity} item${limitedQuantity > 1 ? 's' : ''} could be added. Quantity limit reached.`, 'warning');
                        } else {
                            this.showNotification('Cannot add more items. Maximum quantity limit reached.', 'error');
                        }
                    }

                    const domCandidates = this.querySelectorAll(`[data-variant-id="${variantId}"]`);
                    let domItem = null;
                    for (const candidate of domCandidates) {
                        let candidateProps = {};
                        const storedPropsJson = candidate.getAttribute('data-item-properties');
                        if (storedPropsJson && storedPropsJson !== '{}') {
                            try {
                                candidateProps = JSON.parse(storedPropsJson);
                            } catch (e) {
                                candidateProps = this.extractPropertiesFromDOM(candidate);
                            }
                        } else {
                            candidateProps = this.extractPropertiesFromDOM(candidate);
                        }
                        if (this.propertiesMatch(stateProperties, candidateProps)) {
                            domItem = candidate;
                            break;
                        }
                    }
                    if (domItem && targetItem.final_price !== undefined) {
                        const currentStoredPrice = parseInt(domItem.getAttribute('data-item-price')) || 0;
                        if (currentStoredPrice !== targetItem.final_price) {
                            domItem.setAttribute('data-item-price', targetItem.final_price);
                        }
                    }

                    processedStates.push(state.id);
                } else if (!state.isNewItem) {
                    this.showNotification('Unable to add item to cart. Please try again.', 'error');
                    processedStates.push(state.id);
                }
            }

            if (processedStates.length > 0) {
                const remainingStates = states.filter(state => !processedStates.includes(state.id));
                if (remainingStates.length === 0) {
                    this.optimisticStateMap.delete(stateKey);
                } else {
                    this.optimisticStateMap.set(stateKey, remainingStates);
                }
            }
        });

        let domWasUpdated = true;

        const newCartDrawerHTML = event.detail.sections['cart-drawer'];

        if (newCartDrawerHTML) {
            const optimisticItem = this.querySelector('.optimistic-item');
            const optimisticUpdate = this.querySelector('.optimistic-update');
            const isAddToCartOperation = optimisticItem || optimisticUpdate;
            const isQuantityChange = event.detail.operationType === 'quantity-change';

            if (optimisticItem) {
                optimisticItem.classList.remove('optimistic-item');
            }

            if (optimisticUpdate) {
                optimisticUpdate.classList.remove('optimistic-update');
            }

            if (isAddToCartOperation || isQuantityChange) {
                const updateSuccess = this.updateCartSelectively(newCartDrawerHTML, actualCart);
                domWasUpdated = updateSuccess || !isQuantityChange;

                this.clearPriceLoadingStates();

                if (!updateSuccess && !isQuantityChange) {
                    // Fallback: full panel replacement
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newCartDrawerHTML;
                    const newPanel = tempDiv.querySelector('[data-cart-panel]');

                    if (newPanel && this.panel) {
                        this.panel.innerHTML = newPanel.innerHTML;

                        if (actualCart && actualCart.length > 0) {
                            this.restoreItemProperties(actualCart);
                        }

                        this.closeButton = this.querySelector('[data-cart-close]');
                        this.closeButton?.addEventListener('click', this.closeDrawer);

                        this.checkoutButton = this.querySelector('[data-cart-checkout]');
                        if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
                            this.checkoutButton.addEventListener('click', this.handleCheckoutClick.bind(this));
                            this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
                        }
                    }
                }

                this.notification = null;
                this.notificationContent = null;
            } else {
                // Non-optimistic update — full replacement
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newCartDrawerHTML;

                const newPanel = tempDiv.querySelector('[data-cart-panel]');

                if (newPanel && this.panel) {
                    requestAnimationFrame(() => {
                        this.panel.innerHTML = newPanel.innerHTML;

                        if (actualCart && actualCart.length > 0) {
                            this.restoreItemProperties(actualCart);
                        }

                        this.closeButton = this.querySelector('[data-cart-close]');
                        this.closeButton?.addEventListener('click', this.closeDrawer);

                        this.checkoutButton = this.querySelector('[data-cart-checkout]');
                        if (this.checkoutButton && !this.checkoutButton.hasAttribute('data-checkout-handler-attached')) {
                            this.checkoutButton.addEventListener('click', this.handleCheckoutClick.bind(this));
                            this.checkoutButton.setAttribute('data-checkout-handler-attached', 'true');
                        }

                        this.notification = null;
                        this.notificationContent = null;
                    });
                }
            }
        }

        // Update cart count from section rendering
        const newCartCountHTML = event.detail.sections['cart-item-count'];
        if (newCartCountHTML && domWasUpdated) {
            const tempCount = document.createElement('div');
            tempCount.innerHTML = newCartCountHTML;
            const newCountElement = tempCount.querySelector('[data-cart-count]');

            if (newCountElement) {
                const cartCount = parseInt(newCountElement.getAttribute('data-cart-count')) || 0;
                const cartCountElements = document.querySelectorAll('[data-cart-count]');

                cartCountElements.forEach(countElement => {
                    countElement.innerHTML = newCountElement.innerHTML;
                    countElement.setAttribute('data-cart-count', cartCount);

                    if (cartCount > 0) {
                        countElement.classList.remove('hidden');
                    } else {
                        countElement.classList.add('hidden');
                    }
                });

                const headingCount = this.querySelector('[data-cart-heading-count]');
                if (headingCount) {
                    headingCount.textContent = cartCount;
                }
            }
        }

        if (!this.checkoutPending) {
            this.setLoadingState(false);
        }

        const isQuantityChangeOp = event.detail.operationType === 'quantity-change';
        if (!isQuantityChangeOp && this.isOpen) {
            this.openDrawer();
        }
    }

    handleCheckoutClick(event) {
        if (!this.pendingAddToCartRequest) return;

        event.preventDefault();
        this.checkoutPending = true;
        this.setLoadingState(true);

        const waitForAllRequests = () => {
            const currentRequest = this.pendingAddToCartRequest;
            if (!currentRequest) return Promise.resolve();
            return currentRequest
                .catch(() => { })
                .then(() => {
                    if (this.pendingAddToCartRequest && this.pendingAddToCartRequest !== currentRequest) {
                        return waitForAllRequests();
                    }
                });
        };

        waitForAllRequests()
            .then(() => {
                this.checkoutPending = false;
                this.setLoadingState(false);
                window.location.href = '/checkout';
            })
            .catch(() => {
                this.checkoutPending = false;
                this.setLoadingState(false);
                window.location.href = '/checkout';
            });
    }

    setLoadingState(isLoading) {
        if (!this.checkoutButton) {
            this.checkoutButton = this.querySelector('[data-cart-checkout]');
        }

        if (!this.checkoutButton) return;

        const checkoutText = this.checkoutButton.querySelector('[data-checkout-text]');
        const checkoutLoader = this.checkoutButton.querySelector('[data-checkout-loader]');

        if (isLoading) {
            this.checkoutButton.classList.add('opacity-50', 'pointer-events-none');
            this.checkoutButton.setAttribute('aria-busy', 'true');
            if (checkoutText) checkoutText.classList.add('invisible');
            if (checkoutLoader) checkoutLoader.classList.remove('hidden');
            return;
        }
        this.checkoutButton.classList.remove('opacity-50', 'pointer-events-none');
        this.checkoutButton.setAttribute('aria-busy', 'false');
        if (checkoutText) checkoutText.classList.remove('invisible');
        if (checkoutLoader) checkoutLoader.classList.add('hidden');
    }

    showNotification(message, type = 'error', duration = 5000) {
        if (!this.notification) {
            this.notification = this.querySelector('[data-cart-notification]');
            this.notificationContent = this.querySelector('[data-notification-content]');
        }

        if (!this.notification || !this.notificationContent) return;

        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        this.notificationContent.textContent = message;

        const colors = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.error;
        this.notificationContent.classList.remove(...NOTIFICATION_BG_CLASSES, 'text-background', 'text-foreground');
        this.notificationContent.classList.add(...colors);

        this.notification.classList.remove('max-h-0');
        this.notification.classList.add('max-h-[200px]');

        this.notificationTimeout = setTimeout(() => {
            this.hideNotification();
        }, duration);
    }

    hideNotification() {
        if (!this.notification) {
            this.notification = this.querySelector('[data-cart-notification]');
        }

        if (!this.notification) return;

        this.notification.classList.remove('max-h-[200px]');
        this.notification.classList.add('max-h-0');
    }
}

customElements.define('cart-drawer', CartDrawer);


class CartActions extends HTMLElement {
    static MAX_QUANTITY = 5;

    constructor() {
        super();

        this.decrementButton = this.querySelector('[data-decrement]');
        this.plusButton = this.querySelector('[data-plus]');
        this.notificationTimeout = null;
        this.debounceTimer = null;
        this.abortController = null;
        this.serverQuantity = null;
        this.removalSnapshot = null;

        this.handleChange = this.handleChange.bind(this);
    }

    connectedCallback() {
        this.decrementButton?.addEventListener('click', this.handleChange);
        this.plusButton?.addEventListener('click', this.handleChange);

        const quantityDisplay = this.querySelector('[data-quantity-value]');
        this.serverQuantity = parseInt(quantityDisplay?.textContent) || 1;

        this.updateButtonStates();
    }

    disconnectedCallback() {
        this.decrementButton?.removeEventListener('click', this.handleChange);
        this.plusButton?.removeEventListener('click', this.handleChange);

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    updateButtonStates() {
        const quantityDisplay = this.querySelector('[data-quantity-value]');
        const currentQuantity = parseInt(quantityDisplay?.textContent) || 1;
        const maxQuantity = CartActions.MAX_QUANTITY;

        // Cross-variant total for plus button check
        // In themex, cart-actions IS the cart item, so `this` has data-product-id
        const productId = this.dataset.productId;
        let totalProductQuantity = currentQuantity;

        if (productId) {
            totalProductQuantity = 0;
            const allProductItems = document.querySelectorAll(`[data-product-id="${productId}"].cart-item`);
            allProductItems.forEach(item => {
                totalProductQuantity += parseInt(item.querySelector('[data-quantity-value]')?.textContent) || 0;
            });
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

            if (currentQuantity <= 1) {
                iconMinus?.classList.add('hidden');
                iconMinus?.classList.remove('flex');
                iconDelete?.classList.remove('hidden');
                iconDelete?.classList.add('flex');
                this.decrementButton.setAttribute('data-quantity', '0');
                this.decrementButton.setAttribute('aria-label', 'Remove item');
            } else {
                iconMinus?.classList.remove('hidden');
                iconMinus?.classList.add('flex');
                iconDelete?.classList.add('hidden');
                iconDelete?.classList.remove('flex');
                this.decrementButton.setAttribute('data-quantity', String(currentQuantity - 1));
                this.decrementButton.setAttribute('aria-label', 'Decrease quantity');
            }
        }
    }

    updateSiblingButtonStates() {
        // In themex, cart-actions IS the cart item
        const productId = this.dataset.productId;
        if (!productId) return;

        const allProductItems = document.querySelectorAll(`[data-product-id="${productId}"].cart-item`);
        allProductItems.forEach(item => {
            if (item !== this && item.updateButtonStates) {
                item.updateButtonStates();
            }
        });
    }

    showItemNotification(message, type = 'warning', duration = 3000) {
        // In themex, cart-actions IS the cart item
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

        const cartDrawer = document.querySelector('cart-drawer');
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
                allProductItems.forEach(item => {
                    totalProductQuantity += parseInt(item.querySelector('[data-quantity-value]')?.textContent) || 0;
                });
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

        if (newQuantity === 0) {
            const itemsContainer = this.parentElement;
            this.removalSnapshot = {
                itemHTML: this.outerHTML,
                itemNextSibling: this.nextElementSibling,
                itemParent: itemsContainer,
                serverQuantity: this.serverQuantity,
                countDelta: -currentDisplayedQuantity,
            };

            this.remove();
            cartDrawer?.updateCartCountOptimistically(-currentDisplayedQuantity);
            cartDrawer?.updateOptimisticSubtotal();

            const remainingItems = cartDrawer?.querySelector('[data-cart-items]');
            if (!remainingItems || remainingItems.querySelectorAll('.cart-item').length === 0) {
                this.removalSnapshot.wasLastItem = true;
                cartDrawer?.showOptimisticEmptyCart();
            }
        } else {
            quantityDisplay.textContent = newQuantity;

            const lineTotalContainer = this.querySelector('[data-line-total-container]') || this.querySelector('[data-line-total]');
            if (lineTotalContainer) {
                lineTotalContainer.classList.add('cart-price-loading');
            }

            const subtotalEl = cartDrawer?.querySelector('[data-cart-subtotal]');
            if (subtotalEl) {
                subtotalEl.classList.add('cart-price-loading');
            }

            this.updateButtonStates();
            this.updateSiblingButtonStates();
            cartDrawer?.updateCartCountOptimistically(isPlus ? 1 : -1);
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        if (this.abortController) {
            this.abortController.abort();
        }

        if (newQuantity === 0) {
            this.fireCartUpdate(itemKey, 0, cartDrawer);
        } else {
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
                this.fireCartUpdate(itemKey, newQuantity, cartDrawer);
            }, 300);
        }
    }

    fireCartUpdate(itemKey, quantity, cartDrawer) {
        this.abortController = new AbortController();

        const formData = {
            id: itemKey,
            quantity: String(quantity),
            sections: 'cart-drawer,cart-item-count',
        };

        const performRequest = (retryCount = 0) => {
            return fetch(`${window.Shopify.routes.root}cart/change.js`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                signal: this.abortController.signal,
            })
                .then(response => {
                    if (response.status === 409) {
                        if (retryCount >= 3) throw new Error('Cart update conflict after retries');
                        return new Promise(resolve => setTimeout(resolve, 100))
                            .then(() => {
                                if (this.abortController && !this.abortController.signal.aborted) {
                                    return performRequest(retryCount + 1);
                                }
                                throw new Error('Request cancelled');
                            });
                    }
                    if (!response.ok) {
                        throw new Error('Failed to update cart');
                    }
                    return response.json();
                });
        };

        performRequest()
            .then(data => {
                this.serverQuantity = quantity;
                this.removalSnapshot = null;

                document.documentElement.dispatchEvent(
                    new CustomEvent('cart:rerender', {
                        detail: { ...data, operationType: 'quantity-change' },
                        bubbles: true,
                    })
                );
            })
            .catch(error => {
                if (error.name === 'AbortError') return;

                this.rollbackToServerState(cartDrawer);

                if (cartDrawer) {
                    cartDrawer.showNotification('Failed to update cart. Please try again.', 'error');
                }
            });
    }

    rollbackToServerState(cartDrawer) {
        if (this.removalSnapshot) {
            const snapshot = this.removalSnapshot;

            if (snapshot.wasLastItem) {
                const itemsContainer = cartDrawer?.querySelector('[data-cart-items]');
                if (itemsContainer) {
                    itemsContainer.innerHTML = snapshot.itemHTML;
                }

                const footer = cartDrawer?.querySelector('.cart-drawer-footer');
                if (footer) {
                    footer.classList.remove('hidden');
                }
            } else if (snapshot.itemParent) {
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = snapshot.itemHTML;
                const restoredItem = tempContainer.firstElementChild;

                if (restoredItem) {
                    if (snapshot.itemNextSibling && snapshot.itemParent.contains(snapshot.itemNextSibling)) {
                        snapshot.itemParent.insertBefore(restoredItem, snapshot.itemNextSibling);
                    } else {
                        snapshot.itemParent.appendChild(restoredItem);
                    }
                }
            }

            if (snapshot.countDelta !== 0) {
                cartDrawer?.updateCartCountOptimistically(-snapshot.countDelta);
            }

            cartDrawer?.updateOptimisticSubtotal();
            this.serverQuantity = snapshot.serverQuantity;
            this.removalSnapshot = null;
        } else {
            const quantityDisplay = this.querySelector('[data-quantity-value]');

            if (quantityDisplay) {
                quantityDisplay.textContent = this.serverQuantity;
            }

            const lineTotalContainer = this.querySelector('[data-line-total-container]') || this.querySelector('[data-line-total]');
            if (lineTotalContainer) {
                lineTotalContainer.classList.add('cart-price-loading');
            }

            this.updateButtonStates();
            this.updateSiblingButtonStates();

            fetch(`${window.Shopify.routes.root}cart/update.js`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: 'cart-drawer,cart-item-count' }),
            })
                .then(response => response.json())
                .then(data => {
                    document.documentElement.dispatchEvent(
                        new CustomEvent('cart:rerender', {
                            detail: { ...data, operationType: 'quantity-change' },
                            bubbles: true,
                        })
                    );
                })
                .catch(() => {
                    cartDrawer?.clearPriceLoadingStates();
                });
        }
    }
}

customElements.define('cart-actions', CartActions);
