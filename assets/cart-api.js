/**
 * Centralized Cart API layer.
 * Handles all Shopify cart AJAX calls with retry logic, debouncing, and request queuing.
 * Publishes CART_EVENTS.apiSuccess / apiError on completion.
 */
const CartAPI = (() => {
  let pendingRequest = null;
  let addToCartSequence = 0;
  let changeDebounceTimer = null;
  let changeAbortController = null;

  const rootUrl = () => window.Shopify?.routes?.root || '/';

  const fetchWithRetry = (url, options, { maxRetries = 3, baseDelay = 100 } = {}) => {
    const attempt = (retryCount = 0) => {
      return fetch(url, options).then((response) => {
        if (response.status === 409) {
          if (retryCount >= maxRetries) {
            throw new Error('Cart update conflict after retries');
          }
          return new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, retryCount)))
            .then(() => {
              if (options.signal?.aborted) throw new Error('Request cancelled');
              return attempt(retryCount + 1);
            });
        }
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.description || 'Cart request failed');
          });
        }
        return response.json();
      });
    };
    return attempt();
  };

  /**
   * Add item(s) to cart.
   * Queues behind any pending add-to-cart request to prevent race conditions.
   * @param {Object} formData - { items: [...], sections: 'cart-drawer,cart-item-count' }
   * @returns {Object} { sequenceId, promise }
   */
  const addItem = (formData) => {
    const sequenceId = ++addToCartSequence;
    const previousRequest = pendingRequest || Promise.resolve();

    const promise = previousRequest
      .catch(() => {})
      .then(() =>
        fetchWithRetry(`${rootUrl()}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }, { maxRetries: 5, baseDelay: 150 })
      )
      .then((data) => {
        const isLatest = sequenceId === addToCartSequence;
        if (isLatest) {
          cartDispatch(CART_EVENTS.apiSuccess, {
            source: 'add-to-cart',
            cartData: data,
            sections: data.sections,
            items: data.items,
          });
        }
        return data;
      })
      .catch((error) => {
        const isLatest = sequenceId === addToCartSequence;
        if (isLatest) {
          cartDispatch(CART_EVENTS.apiError, {
            source: 'add-to-cart',
            error,
            message: error.message || 'Failed to add product. Please try again.',
          });
        }
        throw error;
      })
      .finally(() => {
        if (pendingRequest === promise) {
          pendingRequest = null;
        }
      });

    pendingRequest = promise;
    return { sequenceId, promise };
  };

  /**
   * Change a cart line item quantity.
   * Supports debouncing for rapid +/- clicks.
   * @param {string} itemKey - Cart line item key
   * @param {number} quantity - New quantity (0 = remove)
   * @param {Object} options - { debounce: boolean, sections: string }
   */
  const changeItem = (itemKey, quantity, { debounce = true, sections = CART_DEFAULT_SECTIONS } = {}) => {
    if (changeDebounceTimer) {
      clearTimeout(changeDebounceTimer);
      changeDebounceTimer = null;
    }

    if (changeAbortController) {
      changeAbortController.abort();
    }

    changeAbortController = new AbortController();

    const executeRequest = () => {
      const controller = changeAbortController;

      return fetchWithRetry(`${rootUrl()}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemKey, quantity, sections }),
        signal: controller.signal,
      }, { maxRetries: 3 })
        .then((data) => {
          cartDispatch(CART_EVENTS.apiSuccess, {
            source: 'change-item',
            cartData: data,
            sections: data.sections,
            items: data.items,
            operationType: 'quantity-change',
          });
          return data;
        })
        .catch((error) => {
          if (error.name === 'AbortError') return;

          cartDispatch(CART_EVENTS.apiError, {
            source: 'change-item',
            error,
            message: error.message || 'Failed to update cart. Please try again.',
            itemKey,
            quantity,
          });
        });
    };

    if (!debounce || quantity === 0) {
      return executeRequest();
    }

    return new Promise((resolve) => {
      changeDebounceTimer = setTimeout(() => {
        changeDebounceTimer = null;
        resolve(executeRequest());
      }, 300);
    });
  };

  /**
   * Fetch fresh cart state (used for rollback).
   * @param {string} sections - Sections to request
   */
  const refreshCart = (sections = CART_DEFAULT_SECTIONS) => {
    return fetchWithRetry(`${rootUrl()}cart/update.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections }),
    }, { maxRetries: 1 })
      .then((data) => {
        cartDispatch(CART_EVENTS.apiSuccess, {
          source: 'refresh',
          cartData: data,
          sections: data.sections,
          items: data.items,
          operationType: 'quantity-change',
        });
        return data;
      });
  };

  /**
   * Wait for any pending add-to-cart request to complete.
   * Used by checkout button to ensure cart is up-to-date.
   */
  const waitForPending = () => {
    const waitLoop = () => {
      const current = pendingRequest;
      if (!current) return Promise.resolve();
      return current.catch(() => {}).then(() => {
        if (pendingRequest && pendingRequest !== current) {
          return waitLoop();
        }
      });
    };
    return waitLoop();
  };

  const getAddToCartSequence = () => addToCartSequence;

  return {
    addItem,
    changeItem,
    refreshCart,
    waitForPending,
    getAddToCartSequence,
  };
})();
