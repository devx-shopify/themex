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

  return { update: updateAllBadges, getCurrent };
})();
