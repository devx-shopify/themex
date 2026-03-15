/**
 * Cart Count Badge Manager.
 * Updates all [data-cart-count] and [data-cart-heading-count] elements.
 * Exposes CartCount.update() for optimistic count updates.
 * Reconciles with server truth via apiSuccess listener.
 */
const CartCount = (() => {
  const updateAllBadges = (count) => {
    const badges = document.querySelectorAll('[data-cart-count]');
    for (const badge of badges) {
      badge.textContent = count > 0 ? count : '';
      badge.setAttribute('data-cart-count', count);
      if (count > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    const headingCount = document.querySelector('[data-cart-heading-count]');
    if (headingCount) {
      headingCount.textContent = count;
    }
  };

  const getCurrent = () => {
    const badge = document.querySelector('[data-cart-count]');
    return badge ? parseInt(badge.getAttribute('data-cart-count')) || 0 : 0;
  };

  document.addEventListener('DOMContentLoaded', () => {
    cartListen(CART_EVENTS.apiSuccess, (e) => {
      const { source, cartData, sections } = e.detail;

      if (source === 'change-item' && cartData?.item_count != null) {
        updateAllBadges(cartData.item_count);
        return;
      }

      if (source === 'add-to-cart' && sections?.['cart-drawer']) {
        const temp = document.createElement('div');
        temp.innerHTML = sections['cart-drawer'];
        const countEl = temp.querySelector('[data-cart-heading-count]');
        if (countEl) {
          updateAllBadges(parseInt(countEl.textContent) || 0);
        }
      }
    });
  });

  return { update: updateAllBadges, getCurrent };
})();
