/**
 * Main Cart Page Actions.
 * Handles quantity +/-, remove on the /cart page.
 * Uses CartAPI for requests and cart events for coordination.
 * Cart count updates are handled by cart-count.js via events.
 */
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('[data-cart-page]');
  if (!container) return;

  const renderCartSection = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.querySelector('[data-cart-page]');

    if (!newContent || !container) return;

    const scrollY = window.scrollY;
    container.innerHTML = newContent.innerHTML;
    window.scrollTo(0, scrollY);
  };

  const handleClick = (e) => {
    const btn = e.target.closest('[data-cart-change]');
    if (!btn) return;

    e.preventDefault();
    const key = btn.dataset.key;
    const quantity = parseInt(btn.dataset.quantity);

    if (!key || isNaN(quantity)) return;

    const itemEl = container.querySelector(`[data-key="${key}"]`);
    const loader = itemEl?.querySelector('[data-cart-item-loader]');

    if (loader) {
      loader.classList.remove('opacity-0', 'pointer-events-none');
      loader.classList.add('opacity-100');
    }

    CartAPI.changeItem(key, quantity, {
      sections: 'cart,cart-drawer,cart-item-count',
    });
  };

  // Listen for API success to update the cart page section
  cartListen(CART_EVENTS.apiSuccess, (e) => {
    if (e.detail.source !== 'change-item' && e.detail.source !== 'refresh') return;
    const sections = e.detail.sections;

    if (sections?.['cart']) {
      renderCartSection(sections['cart']);
    }
  });

  container.addEventListener('click', handleClick);
});
