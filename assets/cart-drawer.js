class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');
    this.closeButton = this.querySelector('[data-cart-close]');
    this.notification = this.querySelector('[data-cart-notification]');
    this.notificationTimeout = null;

    this.closeButton?.addEventListener('click', () => this.closeDrawer());
    this.overlay?.addEventListener('click', () => this.closeDrawer());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.closeDrawer();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-trigger]')) {
        e.preventDefault();
        this.openDrawer();
      }
    });

    this.addEventListener('click', (e) => {
      const changeBtn = e.target.closest('[data-cart-change]');
      if (changeBtn) {
        e.preventDefault();
        const key = changeBtn.dataset.lineKey;
        const quantity = parseInt(changeBtn.dataset.quantity);
        this.updateItem(key, quantity);
      }
    });

    document.addEventListener('cart:refresh', (e) => {
      this.onCartRefresh(e.detail);
    });
  }

  isOpen() {
    return this.overlay && !this.overlay.classList.contains('hidden');
  }

  openDrawer() {
    if (!this.overlay || !this.panel) return;

    this.overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay.classList.remove('opacity-0');
        this.overlay.classList.add('opacity-100');
        this.panel.classList.remove('translate-x-full');
        this.panel.classList.add('translate-x-0');
      });
    });
  }

  closeDrawer() {
    if (!this.overlay || !this.panel) return;

    this.overlay.classList.remove('opacity-100');
    this.overlay.classList.add('opacity-0');
    this.panel.classList.remove('translate-x-0');
    this.panel.classList.add('translate-x-full');

    setTimeout(() => {
      this.overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  showNotification(message, type = 'success') {
    if (!this.notification) return;

    clearTimeout(this.notificationTimeout);

    this.notification.textContent = message;
    this.notification.classList.remove('hidden');
    this.notification.dataset.notificationType = type;

    this.notificationTimeout = setTimeout(() => {
      this.notification.classList.add('hidden');
    }, 3000);
  }

  onCartRefresh(detail) {
    if (detail?.sections?.['cart-drawer']) {
      this.renderSection(detail.sections['cart-drawer']);
    }
    this.updateCartCount();
    this.showNotification(
      window.theme?.strings?.addedToCart || 'Product added to cart!'
    );
  }

  renderSection(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newDrawer = doc.querySelector('cart-drawer');

    if (!newDrawer) return;

    const newItems = newDrawer.querySelector('[data-cart-items]');
    const currentItems = this.querySelector('[data-cart-items]');
    if (newItems && currentItems) {
      currentItems.innerHTML = newItems.innerHTML;
    }

    const newFooter = newDrawer.querySelector('[data-cart-footer]');
    const currentFooter = this.querySelector('[data-cart-footer]');
    if (newFooter) {
      if (currentFooter) {
        currentFooter.innerHTML = newFooter.innerHTML;
      } else {
        this.panel?.appendChild(newFooter);
      }
    } else if (currentFooter) {
      currentFooter.remove();
    }
  }

  async updateItem(key, quantity) {
    const itemEl = this.querySelector(`[data-line-key="${key}"]`);
    const loader = itemEl?.querySelector('[data-cart-item-loader]');
    if (itemEl) itemEl.classList.add('pointer-events-none');
    if (loader) {
      loader.classList.remove('hidden');
      loader.classList.add('flex');
    }

    try {
      const response = await fetch(
        `${window.Shopify?.routes?.root || '/'}cart/change.js`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: key,
            quantity,
            sections: 'cart-drawer',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to update cart');

      const data = await response.json();

      if (data.sections?.['cart-drawer']) {
        this.renderSection(data.sections['cart-drawer']);
      }

      this.updateCartCount(data.item_count);

      if (quantity === 0) {
        this.showNotification(window.theme?.strings?.itemRemoved || 'Item removed from cart');
      }
    } catch (error) {
      if (itemEl) {
        itemEl.classList.remove('pointer-events-none');
      }
      if (loader) {
        loader.classList.add('hidden');
        loader.classList.remove('flex');
      }
      this.showNotification(
        window.theme?.strings?.updateCartError || 'Failed to update cart',
        'error'
      );
    }
  }

  async updateCartCount(count) {
    if (count === undefined) {
      try {
        const response = await fetch(
          `${window.Shopify?.routes?.root || '/'}cart.js`
        );
        const cart = await response.json();
        count = cart.item_count;
      } catch {
        return;
      }
    }

    const badges = document.querySelectorAll('[data-cart-count]');
    badges.forEach((badge) => {
      badge.dataset.cartCount = count;
      badge.textContent = count > 0 ? count : '';
      badge.classList.toggle('hidden', count === 0);
    });

    const headingCount = this.querySelector('[data-cart-heading-count]');
    if (headingCount) {
      headingCount.textContent = count;
    }
  }
}

customElements.define('cart-drawer', CartDrawer);
