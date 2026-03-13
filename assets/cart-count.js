/**
 * Cart Count Badge Manager.
 * Updates all [data-cart-count] and [data-cart-heading-count] elements
 * from server section response.
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
