/**
 * Main Cart Page Actions.
 * Handles quantity +/-, remove on the /cart page.
 * Uses CartAPI for requests and cart events for coordination.
 * Debounces rapid quantity clicks (300ms) to batch into a single API call.
 */
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('[data-cart-page]');
  if (!container) return;

  const debounceTimers = {};

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

    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(() => {
      delete debounceTimers[key];
      CartAPI.changeItem(key, quantity, {
        sections: 'cart,cart-item-count',
      });
    }, 300);
  };

  cartListen(CART_EVENTS.apiSuccess, (e) => {
    if (e.detail.source !== 'change-item') return;
    const sections = e.detail.sections;

    if (sections?.['cart']) {
      renderCartSection(sections['cart']);
    }
  });

  container.addEventListener('click', handleClick);
});
