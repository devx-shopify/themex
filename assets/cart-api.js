/**
 * Cart API layer.
 * Single-request architecture: mutation + sections in one POST.
 * Dispatches CART_EVENTS on completion.
 * Aborts stale in-flight requests per operation type (add vs change).
 */
const CartAPI = (() => {
  const rootUrl = () => window.Shopify?.routes?.root || '/';
  const controllers = { add: null, change: null };

  const post = (url, body, type) => {
    if (controllers[type]) controllers[type].abort();
    controllers[type] = new AbortController();

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controllers[type].signal,
    })
      .then((response) => {
        controllers[type] = null;
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.description || 'Cart request failed');
          });
        }
        return response.json();
      });
  };

  /**
   * Add item(s) to cart.
   * POST /cart/add.js with sections bundled.
   */
  const addItem = (formData) => {
    const sections = formData.sections || CART_DEFAULT_SECTIONS;

    return post(`${rootUrl()}cart/add.js`, {
      items: formData.items,
      sections,
    }, 'add')
      .then((data) => {
        cartDispatch(CART_EVENTS.apiSuccess, {
          source: 'add-to-cart',
          cartData: data,
          sections: data.sections,
          items: data.items,
        });
        return data;
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        cartDispatch(CART_EVENTS.apiError, {
          source: 'add-to-cart',
          error,
          message: error.message || 'Failed to add product. Please try again.',
        });
        throw error;
      });
  };

  /**
   * Change a cart line item quantity.
   * POST /cart/change.js with sections bundled.
   */
  const changeItem = (itemKey, quantity, { sections = CART_DEFAULT_SECTIONS } = {}) => {
    return post(`${rootUrl()}cart/change.js`, {
      id: itemKey,
      quantity,
      sections,
    }, 'change')
      .then((data) => {
        cartDispatch(CART_EVENTS.apiSuccess, {
          source: 'change-item',
          cartData: data,
          sections: data.sections,
          items: data.items,
        });
        return data;
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        cartDispatch(CART_EVENTS.apiError, {
          source: 'change-item',
          error,
          message: error.message || 'Failed to update cart. Please try again.',
        });
        throw error;
      });
  };

  return { addItem, changeItem };
})();
