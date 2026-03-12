/**
 * Cart State Manager.
 * Tracks optimistic state for add-to-cart operations.
 * Reconciles optimistic expectations with server responses.
 * Provides cross-variant quantity validation.
 */
const CartState = (() => {
  const MAX_QUANTITY = 5;
  const optimisticStateMap = new Map();
  let stateSequence = 0;

  const createStateKey = (variantId, properties) => {
    if (!properties || Object.keys(properties).length === 0) {
      return `${variantId}:no-props`;
    }
    const sortedProps = Object.keys(properties)
      .filter((k) => properties[k] && properties[k] !== '')
      .sort()
      .map((k) => `${k}=${properties[k]}`)
      .join('|');
    return `${variantId}:${sortedProps}`;
  };

  const normalizeProps = (props) => {
    const normalized = {};
    for (const key of Object.keys(props || {})) {
      if (props[key] != null && props[key] !== '') {
        const value = String(props[key]).trim();
        if (value) {
          normalized[key.trim()] = value;
        }
      }
    }
    return normalized;
  };

  const propertiesMatch = (props1, props2) => {
    const normalized1 = normalizeProps(props1);
    const normalized2 = normalizeProps(props2);

    const keys1 = Object.keys(normalized1);
    const keys2 = Object.keys(normalized2);

    if (keys1.length !== keys2.length) return false;
    if (keys1.length === 0) return true;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (normalized1[key] !== normalized2[key]) return false;
    }

    return true;
  };

  /**
   * Track an optimistic add-to-cart.
   */
  const trackOptimistic = (variantId, quantity, properties, isNewItem = false) => {
    const stateId = ++stateSequence;
    const stateKey = createStateKey(variantId, properties);

    const state = {
      id: stateId,
      variantId,
      expectedQuantity: quantity,
      quantityAdded: quantity,
      isNewItem,
      properties,
    };

    if (!optimisticStateMap.has(stateKey)) {
      optimisticStateMap.set(stateKey, []);
    }
    optimisticStateMap.get(stateKey).push(state);

    return { stateId, stateKey };
  };

  /**
   * Update existing tracked state's expected quantity.
   */
  const updateExpectedQuantity = (variantId, properties, newExpectedQuantity) => {
    const stateKey = createStateKey(variantId, properties);
    const states = optimisticStateMap.get(stateKey);
    if (states && states.length > 0) {
      states[states.length - 1].expectedQuantity = newExpectedQuantity;
    }
  };

  /**
   * Reconcile optimistic state with server response.
   * Returns messages for quantity limit warnings.
   */
  const reconcile = (serverItems) => {
    const messages = [];
    const stateKeysToCheck = Array.from(optimisticStateMap.keys());

    for (const stateKey of stateKeysToCheck) {
      const states = optimisticStateMap.get(stateKey) || [];
      if (states.length === 0) continue;

      const firstState = states[0];
      const variantId = firstState.variantId;
      const stateProperties = firstState.properties || {};

      const cartItemsWithVariant = serverItems.filter((item) => item.variant_id == variantId);
      let targetItem = null;

      for (const cartItem of cartItemsWithVariant) {
        const cartItemProps = cartItem.properties || {};
        if (propertiesMatch(stateProperties, cartItemProps)) {
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
              messages.push({
                message: `Only ${limitedQuantity} item${limitedQuantity > 1 ? 's' : ''} could be added. Quantity limit reached.`,
                type: 'warning',
              });
            } else {
              messages.push({
                message: 'Cannot add more items. Maximum quantity limit reached.',
                type: 'error',
              });
            }
          }
          processedStates.push(state.id);
        } else if (!state.isNewItem) {
          messages.push({
            message: 'Unable to add item to cart. Please try again.',
            type: 'error',
          });
          processedStates.push(state.id);
        }
      }

      if (processedStates.length > 0) {
        const remainingStates = states.filter((state) => !processedStates.includes(state.id));
        if (remainingStates.length === 0) {
          optimisticStateMap.delete(stateKey);
        } else {
          optimisticStateMap.set(stateKey, remainingStates);
        }
      }
    }

    return messages;
  };

  /**
   * Validate cross-variant quantity limit before add-to-cart.
   * Checks total quantity of all variants of a product in cart.
   */
  const validateQuantityLimit = (productId, quantityToAdd) => {
    if (!productId) return { allowed: true, message: '' };

    let totalInCart = 0;
    const allProductItems = document.querySelectorAll(`[data-product-id="${productId}"].cart-item`);
    for (const item of allProductItems) {
      totalInCart += parseInt(item.querySelector('[data-quantity-value]')?.textContent) || 0;
    }

    if (totalInCart + quantityToAdd > MAX_QUANTITY) {
      return {
        allowed: false,
        message: `Maximum quantity of ${MAX_QUANTITY} reached for this product.`,
      };
    }

    return { allowed: true, message: '' };
  };

  /**
   * Extract properties from a cart item DOM element.
   */
  const extractPropertiesFromDOM = (itemElement) => {
    const properties = {};
    const detailsContainer = itemElement.querySelector('.cart-item-details');
    if (!detailsContainer) return properties;

    const propertyElements = detailsContainer.querySelectorAll('.cart-item-property');
    for (const propEl of propertyElements) {
      const text = propEl.textContent.trim();
      const colonIndex = text.indexOf(':');
      if (colonIndex > 0) {
        const key = text.substring(0, colonIndex).trim();
        const value = text.substring(colonIndex + 1).trim();
        if (key && value) {
          properties[key] = value;
        }
      }
    }
    return properties;
  };

  // Auto-reconcile on API success
  cartListen(CART_EVENTS.apiSuccess, (e) => {
    if (e.detail.source !== 'add-to-cart') return;
    const serverItems = e.detail.items || [];
    const warnings = reconcile(serverItems);
    for (const warning of warnings) {
      cartDispatch(CART_EVENTS.notify, warning);
    }
  });

  return {
    MAX_QUANTITY,
    trackOptimistic,
    updateExpectedQuantity,
    reconcile,
    validateQuantityLimit,
    propertiesMatch,
    extractPropertiesFromDOM,
    createStateKey,
  };
})();
