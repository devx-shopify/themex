/**
 * Main Cart Page
 *
 * Handles quantity changes and removals on the /cart page
 * via the Cart API with section rendering.
 */
class MainCart {
  constructor() {
    this.container = document.querySelector('[data-cart-page]');
    if (!this.container) return;

    this.abortController = null;
    this.bindEvents();
  }

  bindEvents() {
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-change]');
      if (!btn) return;

      e.preventDefault();
      const key = btn.dataset.key;
      const quantity = parseInt(btn.dataset.quantity);

      if (key && !isNaN(quantity)) {
        this.updateItem(key, quantity);
      }
    });
  }

  /**
   * Update item quantity via Cart API + section rendering
   */
  async updateItem(key, quantity) {
    const itemEl = this.container.querySelector(`[data-key="${key}"]`);
    const loader = itemEl?.querySelector('[data-cart-item-loader]');

    if (loader) {
      loader.classList.remove('opacity-0', 'pointer-events-none');
      loader.classList.add('opacity-100');
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const root = window.Shopify?.routes?.root || '/';
      const response = await fetch(`${root}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: key,
          quantity,
          sections: 'cart,cart-drawer',
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) throw new Error('Failed to update cart');

      const data = await response.json();

      if (data.sections?.['cart']) {
        this.renderCartSection(data.sections['cart']);
      }

      // Keep cart drawer in sync
      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer && data.sections?.['cart-drawer']) {
        cartDrawer.renderSection(data.sections['cart-drawer']);
      }

      this.updateCartCount(data.item_count);
    } catch (error) {
      if (error.name === 'AbortError') return;

      if (loader) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        loader.classList.remove('opacity-100');
      }
    }
  }

  /**
   * Replace cart page content with new section HTML
   */
  renderCartSection(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.querySelector('[data-cart-page]');

    if (!newContent || !this.container) return;

    const scrollY = window.scrollY;
    this.container.innerHTML = newContent.innerHTML;
    window.scrollTo(0, scrollY);

    // Re-bind events since DOM was replaced
    this.bindEvents();
  }

  /**
   * Update cart count badges across the page
   */
  updateCartCount(count) {
    if (count === undefined) return;

    const badges = document.querySelectorAll('[data-cart-count]');
    badges.forEach((badge) => {
      badge.dataset.cartCount = count;
      badge.textContent = count > 0 ? count : '';
      badge.classList.toggle('hidden', count === 0);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MainCart();
});
