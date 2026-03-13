/**
 * Cart API layer.
 * Single-request architecture: mutation + sections in one POST.
 * Dispatches CART_EVENTS on completion.
 */
const CartAPI = (() => {
  const rootUrl = () => window.Shopify?.routes?.root || '/';

  const post = (url, body) => {
    cartDispatch(CART_EVENTS.loading);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((response) => {
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
    })
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
    })
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
