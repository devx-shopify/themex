/**
 * Cart Items Manager Web Component.
 * Handles all DOM updates for cart items: optimistic rendering,
 * selective diffing, price loading states, and rollback.
 * In themex, <cart-actions> IS the cart item element.
 */
class CartItemsManager extends HTMLElement {
  constructor() {
    super();

    this.lastRemovalSnapshot = null;

    this.handleAddOptimistic = this.handleAddOptimistic.bind(this);
    this.handleApiSuccess = this.handleApiSuccess.bind(this);
    this.handleApiError = this.handleApiError.bind(this);
  }

  connectedCallback() {
    this.unsubscribers = [
      cartListen(CART_EVENTS.addOptimistic, this.handleAddOptimistic),
      cartListen(CART_EVENTS.apiSuccess, this.handleApiSuccess),
      cartListen(CART_EVENTS.apiError, this.handleApiError),
    ];
  }

  disconnectedCallback() {
    if (this.unsubscribers) {
      for (const unsub of this.unsubscribers) unsub();
    }
  }

  // ── Optimistic Add ──

  handleAddOptimistic(event) {
    const { productData } = event.detail;
    if (!productData) return;

    const cartItemsContainer = this.querySelector('[data-cart-items]');
    if (!cartItemsContainer) return;

    // Remove empty cart message if present
    const emptyMessage = cartItemsContainer.querySelector('[data-cart-empty]');
    if (emptyMessage) {
      emptyMessage.remove();
    }

    const wasCartEmpty = cartItemsContainer.querySelectorAll('.cart-item').length === 0;

    // Check for existing item with same variant + properties
    const candidateItems = cartItemsContainer.querySelectorAll(`[data-variant-id="${productData.variantId}"]`);
    const productProps = productData.properties || {};
    let existingItem = null;

    for (const candidate of candidateItems) {
      const candidateProps = this.getItemProperties(candidate);
      if (CartState.propertiesMatch(productProps, candidateProps)) {
        existingItem = candidate;
        break;
      }
    }

    if (existingItem) {
      this.updateExistingItemOptimistically(existingItem, productData);
    } else {
      this.addNewOptimisticItem(cartItemsContainer, productData, wasCartEmpty);
    }
  }

  updateExistingItemOptimistically(existingItem, productData) {
    const quantityDisplay = existingItem.querySelector('[data-quantity-value]');
    if (!quantityDisplay) return;

    const currentQuantity = parseInt(quantityDisplay.textContent) || 0;
    const newQuantity = currentQuantity + productData.quantity;

    CartState.trackOptimistic(productData.variantId, newQuantity, productData.properties, false);

    quantityDisplay.dataset.oldQuantity = currentQuantity.toString();
    quantityDisplay.textContent = newQuantity;

    const lineTotalValue = existingItem.querySelector('[data-line-total-value]');
    if (lineTotalValue) {
      lineTotalValue.dataset.oldValue = lineTotalValue.textContent.trim();
    }

    const lineTotalContainer = existingItem.querySelector('[data-line-total-container]') || existingItem.querySelector('[data-line-total]');
    if (lineTotalContainer) {
      lineTotalContainer.classList.add('cart-price-loading');
    }

    existingItem.classList.add('optimistic-update');

    // In themex, cart-actions IS the cart item — update button states
    if (existingItem.updateButtonStates) {
      existingItem.updateButtonStates();
    }

    this.updateOptimisticSubtotal();
  }

  addNewOptimisticItem(cartItemsContainer, productData, wasCartEmpty) {
    CartState.trackOptimistic(productData.variantId, productData.quantity, productData.properties, true);

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
      const propTemplate = this.querySelector('[data-cart-property-template]');
      for (const [key, value] of Object.entries(productData.properties)) {
        if (!(value != null && value !== '')) continue;
        if (propTemplate) {
          const propEl = propTemplate.content.cloneNode(true).firstElementChild;
          propEl.textContent = `${key}: ${value}`;
          itemPropertiesContainer.appendChild(propEl);
        }
      }
    }

    if (quantityValue) quantityValue.textContent = productData.quantity;

    const lineTotalValueEl = optimisticItem.querySelector('[data-line-total-value]');
    if (lineTotalValueEl && productData.variantPriceFormatted) {
      lineTotalValueEl.textContent = productData.variantPriceFormatted;
    }

    cartItemsContainer.insertBefore(optimisticItem, cartItemsContainer.firstChild);

    if (wasCartEmpty) {
      this.createOptimisticFooter();
    }
  }

  // ── Server Response Handling ──

  handleApiSuccess(event) {
    const { source, sections, items } = event.detail;

    if (source === 'add-to-cart') {
      this.lastRemovalSnapshot = null;
      this.handleAddToCartSuccess(sections, items);
    } else if (source === 'change-item' || source === 'refresh') {
      this.lastRemovalSnapshot = null;
      this.handleQuantityChangeSuccess(sections, items);
    }
  }

  handleAddToCartSuccess(sections, items) {
    const newCartDrawerHTML = sections?.['cart-drawer'];
    if (!newCartDrawerHTML) return;

    const optimisticItem = this.querySelector('.optimistic-item');
    const optimisticUpdate = this.querySelector('.optimistic-update');

    if (optimisticItem) optimisticItem.classList.remove('optimistic-item');
    if (optimisticUpdate) optimisticUpdate.classList.remove('optimistic-update');

    const actualCart = items || [];
    const updateSuccess = this.updateCartSelectively(newCartDrawerHTML, actualCart);

    this.clearPriceLoadingStates();

    if (!updateSuccess) {
      this.fullPanelReplacement(newCartDrawerHTML, actualCart);
    }
  }

  handleQuantityChangeSuccess(sections, items) {
    const newCartDrawerHTML = sections?.['cart-drawer'];
    if (!newCartDrawerHTML) return;

    const actualCart = items || [];
    const updateSuccess = this.updateCartSelectively(newCartDrawerHTML, actualCart);

    this.clearPriceLoadingStates();

    if (!updateSuccess) {
      this.fullPanelReplacement(newCartDrawerHTML, actualCart);
    }
  }

  handleApiError(event) {
    if (event.detail.source === 'add-to-cart') {
      this.removeOptimisticItem();
    } else if (event.detail.source === 'change-item') {
      this.handleRemovalRollback();
    }
  }

  // ── Selective Diffing ──

  updateCartSelectively(newCartDrawerHTML, actualCart) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newCartDrawerHTML;

    const newPanel = tempDiv.querySelector('[data-cart-panel]');
    if (!newPanel) return false;

    const newCartItemsContainer = newPanel.querySelector('[data-cart-items]');
    if (!newCartItemsContainer) return false;

    const newCartItemElements = Array.from(newCartItemsContainer.querySelectorAll('.cart-item, [data-variant-id]'));
    const newCartItems = newCartItemElements.map((itemEl) => ({
      element: itemEl,
      data: this.extractCartItemData(itemEl),
    }));

    const currentCartItemsContainer = this.querySelector('[data-cart-items]');
    if (!currentCartItemsContainer) return false;

    const currentCartItems = Array.from(currentCartItemsContainer.querySelectorAll('.cart-item, [data-variant-id]'))
      .map((itemEl) => this.extractCartItemData(itemEl));

    const matchedNewItems = new Set();

    for (const currentItem of currentCartItems) {
      const matchedNewItem = newCartItems.find((newItem) => {
        const match = this.matchCartItems(currentItem, [newItem.data]);
        return match === newItem.data;
      });

      if (matchedNewItem) {
        matchedNewItems.add(matchedNewItem);
        this.updateCartItemElement(currentItem.element, matchedNewItem.data, matchedNewItem.element);
      }
    }

    // Add items that exist in server but not in current DOM
    const newItemsToAdd = newCartItems.filter((item) => !matchedNewItems.has(item));
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

    // Remove items that no longer exist on server (keep optimistic items)
    const newItemKeys = new Set(newCartItems.map((item) => item.data.key).filter(Boolean));
    const newItemVariantIds = new Set(newCartItems.map((item) => item.data.variantId).filter(Boolean));

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
    const currentFooter = this.closest('cart-drawer')?.querySelector('.cart-drawer-footer');
    const newFooter = newPanel.querySelector('.cart-drawer-footer');
    if (newFooter) {
      if (currentFooter) {
        currentFooter.innerHTML = newFooter.innerHTML;
        currentFooter.classList.remove('hidden');
      } else {
        const panel = this.closest('[data-cart-panel]');
        if (panel) {
          const clonedFooter = newFooter.cloneNode(true);
          panel.appendChild(clonedFooter);
        }
      }
    }

    // Re-init button states on all cart-actions
    const allCartActions = this.querySelectorAll('cart-actions');
    for (const actions of allCartActions) {
      if (actions.updateButtonStates) {
        actions.updateButtonStates();
      }
    }

    if (actualCart && actualCart.length > 0) {
      this.restoreItemProperties(actualCart);
    }

    return true;
  }

  fullPanelReplacement(newCartDrawerHTML, actualCart) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newCartDrawerHTML;
    const newPanel = tempDiv.querySelector('[data-cart-panel]');
    const panel = this.closest('[data-cart-panel]');

    if (newPanel && panel) {
      panel.innerHTML = newPanel.innerHTML;

      if (actualCart && actualCart.length > 0) {
        this.restoreItemProperties(actualCart);
      }
    }
  }

  // ── Item Data Extraction ──

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
      lineTotal: null,
    };

    const imageContainer = itemElement.querySelector('.cart-item-image');
    if (imageContainer) {
      const imageEl = imageContainer.querySelector('[data-item-image]') || imageContainer.querySelector('img');
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
        data.properties = CartState.extractPropertiesFromDOM(itemElement);
      }
    } else {
      data.properties = CartState.extractPropertiesFromDOM(itemElement);
    }

    return data;
  }

  matchCartItems(currentItem, newItems) {
    if (currentItem.key) {
      const matchByKey = newItems.find((item) => item.key === currentItem.key);
      if (matchByKey) return matchByKey;
    }

    if (currentItem.variantId) {
      const itemsWithVariant = newItems.filter((item) => item.variantId === currentItem.variantId);
      for (const newItem of itemsWithVariant) {
        if (CartState.propertiesMatch(currentItem.properties, newItem.properties)) {
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

      // Update discount allocations using data attribute
      const newDiscountEls = newElement.querySelectorAll('[data-discount-allocation]');
      const currentDiscountEls = currentElement.querySelectorAll('[data-discount-allocation]');
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
      const attrs = ['data-item-price', 'data-item-price-formatted', 'data-line-price-formatted', 'data-has-discount', 'data-product-id'];
      for (const attr of attrs) {
        const val = newElement.getAttribute(attr);
        if (val !== null) {
          currentElement.setAttribute(attr, val);
        }
      }
    }

    const imageContainer = currentElement.querySelector('.cart-item-image');
    if (imageContainer && newData.image) {
      const imageEl = imageContainer.querySelector('[data-item-image]') || imageContainer.querySelector('img');
      if (imageEl) {
        const currentSrc = imageEl.src || imageEl.getAttribute('src');
        if (currentSrc !== newData.image) {
          imageEl.src = newData.image;
          if (newData.imageAlt) imageEl.alt = newData.imageAlt;
        }
      }
    }

    const titleLink = currentElement.querySelector('[data-item-title]');
    if (titleLink && newData.title) {
      if (titleLink.textContent.trim() !== newData.title) {
        titleLink.textContent = newData.title;
      }
      if (newData.titleUrl) titleLink.href = newData.titleUrl;
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

    // Update properties if changed
    const currentProps = CartState.extractPropertiesFromDOM(currentElement);
    if (!CartState.propertiesMatch(currentProps, newData.properties)) {
      currentElement.setAttribute('data-item-properties', JSON.stringify(newData.properties || {}));

      const propertiesContainer = currentElement.querySelector('[data-item-properties-container]');
      if (propertiesContainer) {
        const existingProps = propertiesContainer.querySelectorAll('.cart-item-property');
        for (const p of existingProps) p.remove();

        if (newData.properties && Object.keys(newData.properties).length > 0) {
          const propTemplate = this.querySelector('[data-cart-property-template]');
          for (const [key, value] of Object.entries(newData.properties)) {
            if (value != null && value !== '') {
              if (propTemplate) {
                const propEl = propTemplate.content.cloneNode(true).firstElementChild;
                propEl.textContent = `${key}: ${value}`;
                propertiesContainer.appendChild(propEl);
              }
            }
          }
        }
      }
    }
  }

  // ── Helpers ──

  getItemProperties(itemElement) {
    const storedPropsJson = itemElement.getAttribute('data-item-properties');
    if (storedPropsJson && storedPropsJson !== '{}') {
      try {
        return JSON.parse(storedPropsJson);
      } catch (e) {
        return CartState.extractPropertiesFromDOM(itemElement);
      }
    }
    return CartState.extractPropertiesFromDOM(itemElement);
  }

  restoreItemProperties(cartItems) {
    const itemsContainer = this.querySelector('[data-cart-items]');
    if (!itemsContainer) return;

    for (const cartItem of cartItems) {
      if (!cartItem.variant_id) continue;

      const itemsWithVariant = itemsContainer.querySelectorAll(`[data-variant-id="${cartItem.variant_id}"]`);
      if (itemsWithVariant.length === 0) continue;

      const hasProperties = cartItem.properties && Object.keys(cartItem.properties).length > 0;
      const cartItemPropsJson = hasProperties ? JSON.stringify(cartItem.properties) : '{}';

      for (const itemElement of itemsWithVariant) {
        const storedPropsObj = this.getItemProperties(itemElement);
        const cartItemProps = cartItem.properties || {};

        if (CartState.propertiesMatch(cartItemProps, storedPropsObj)) {
          itemElement.setAttribute('data-item-properties', cartItemPropsJson);
          break;
        }
      }
    }
  }

  clearPriceLoadingStates() {
    const containers = this.querySelectorAll('[data-line-total-container], [data-line-total]');
    for (const container of containers) {
      container.classList.remove('cart-price-loading');
    }

    const drawer = this.closest('cart-drawer');
    const subtotalEl = drawer?.querySelector('[data-cart-subtotal]');
    if (subtotalEl) {
      subtotalEl.classList.remove('cart-price-loading');
    }
  }

  removeOptimisticItem() {
    const optimisticItem = this.querySelector('.optimistic-item');
    if (optimisticItem) {
      optimisticItem.remove();
    }

    const optimisticUpdate = this.querySelector('.optimistic-update');
    if (!optimisticUpdate) return;

    const quantityDisplay = optimisticUpdate.querySelector('[data-quantity-value]');
    const lineTotal = optimisticUpdate.querySelector('[data-line-total]');
    const lineTotalValue = lineTotal?.querySelector('[data-line-total-value]') || lineTotal;

    if (quantityDisplay?.dataset.oldQuantity) {
      quantityDisplay.textContent = quantityDisplay.dataset.oldQuantity;
      delete quantityDisplay.dataset.oldQuantity;
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

    const drawer = this.closest('cart-drawer');
    const subtotalEl = drawer?.querySelector('[data-cart-subtotal]');
    if (subtotalEl) {
      subtotalEl.classList.remove('cart-price-loading');
    }
  }

  handleRemovalRollback() {
    const snapshot = this.lastRemovalSnapshot;
    if (!snapshot) return;

    const drawer = this.closest('cart-drawer');

    if (snapshot.wasLastItem) {
      const itemsContainer = this.querySelector('[data-cart-items]');
      if (itemsContainer) {
        itemsContainer.innerHTML = snapshot.itemHTML;
      }

      const footer = drawer?.querySelector('.cart-drawer-footer');
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
      cartDispatch(CART_EVENTS.changeOptimistic, { delta: -snapshot.countDelta });
    }

    this.updateOptimisticSubtotal();
    this.lastRemovalSnapshot = null;
  }

  showOptimisticEmptyCart() {
    const itemsContainer = this.querySelector('[data-cart-items]');
    if (!itemsContainer) return;

    const emptyTemplate = this.querySelector('[data-empty-cart-template]');
    if (!emptyTemplate) return;

    const emptyContent = emptyTemplate.content.cloneNode(true);
    itemsContainer.innerHTML = '';
    itemsContainer.appendChild(emptyContent);

    const drawer = this.closest('cart-drawer');
    const footer = drawer?.querySelector('.cart-drawer-footer');
    if (footer) {
      footer.classList.add('hidden');
    }
  }

  createOptimisticFooter() {
    const drawer = this.closest('cart-drawer');
    if (!drawer) return;

    let footer = drawer.querySelector('.cart-drawer-footer');
    if (footer) {
      footer.classList.remove('hidden');
      const subtotalElement = footer.querySelector('[data-cart-subtotal]');
      if (subtotalElement) {
        subtotalElement.classList.add('cart-price-loading');
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

    const panel = drawer.querySelector('[data-cart-panel]');
    if (panel) {
      panel.appendChild(footer);
    }
  }

  updateOptimisticSubtotal() {
    const drawer = this.closest('cart-drawer');
    const footer = drawer?.querySelector('.cart-drawer-footer');
    if (!footer) return;

    const subtotalElement = footer.querySelector('[data-cart-subtotal]');
    if (subtotalElement) {
      subtotalElement.classList.add('cart-price-loading');
    }
  }
}

if (!customElements.get('cart-items-manager')) {
  customElements.define('cart-items-manager', CartItemsManager);
}
