/**
 * Cart Count Badge Manager.
 * Updates all [data-cart-count] elements and [data-cart-heading-count] in the drawer.
 * Handles both optimistic deltas and absolute server counts.
 */
document.addEventListener('DOMContentLoaded', () => {
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

  const applyDelta = (delta) => {
    const badges = document.querySelectorAll('[data-cart-count]');
    for (const badge of badges) {
      const currentCount = parseInt(badge.getAttribute('data-cart-count')) || 0;
      const newCount = currentCount + delta;
      badge.textContent = newCount > 0 ? newCount : '';
      badge.setAttribute('data-cart-count', newCount);
      if (newCount > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    const headingCount = document.querySelector('[data-cart-heading-count]');
    if (headingCount) {
      const currentCount = parseInt(headingCount.textContent) || 0;
      headingCount.textContent = currentCount + delta;
    }
  };

  // Optimistic: apply delta immediately
  cartListen(CART_EVENTS.addOptimistic, (e) => {
    const qty = e.detail.productData?.quantity || 1;
    applyDelta(qty);
  });

  cartListen(CART_EVENTS.changeOptimistic, (e) => {
    const delta = e.detail.delta || 0;
    if (delta !== 0) applyDelta(delta);
  });

  cartListen(CART_EVENTS.removeOptimistic, (e) => {
    const qty = e.detail.quantity || 1;
    applyDelta(-qty);
  });

  // Server: absolute count from section rendering
  cartListen(CART_EVENTS.apiSuccess, (e) => {
    const sections = e.detail.sections;
    if (!sections?.['cart-item-count']) return;

    const temp = document.createElement('div');
    temp.innerHTML = sections['cart-item-count'];
    const newCountElement = temp.querySelector('[data-cart-count]');

    if (newCountElement) {
      const count = parseInt(newCountElement.getAttribute('data-cart-count')) || 0;
      updateAllBadges(count);
    }
  });
});
