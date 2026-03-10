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
          sections: 'cart,cart-drawer,cart-item-count',
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) throw new Error('Failed to update cart');

      const data = await response.json();

      if (data.sections?.['cart']) {
        this.renderCartSection(data.sections['cart']);
      }

      // Dispatch cart:rerender so the cart drawer's optimistic system handles reconciliation
      document.documentElement.dispatchEvent(
        new CustomEvent('cart:rerender', {
          detail: { ...data, operationType: 'quantity-change' },
          bubbles: true,
        })
      );
    } catch (error) {
      if (error.name === 'AbortError') return;

      if (loader) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        loader.classList.remove('opacity-100');
      }
    }
  }

  renderCartSection(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.querySelector('[data-cart-page]');

    if (!newContent || !this.container) return;

    const scrollY = window.scrollY;
    this.container.innerHTML = newContent.innerHTML;
    window.scrollTo(0, scrollY);
    this.bindEvents();
  }

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
