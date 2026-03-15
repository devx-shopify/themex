const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.previousActiveElement = null;
    this.isOpen = false;
    this.debounceTimers = {};
    this.noteTimer = null;
    this.focusTrapHandler = null;
  }

  connectedCallback() {
    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');

    this.overlay?.addEventListener('click', () => this.close());

    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-cart-close]')) {
        this.close();
      }
    });

    this.handleKeydown = (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.handleKeydown);

    this.handleCartTrigger = (event) => {
      if (event.target.closest('[data-cart-trigger]')) {
        event.preventDefault();
        this.open();
      }
    };
    document.addEventListener('click', this.handleCartTrigger);

    this.addEventListener('click', (event) => {
      const minusBtn = event.target.closest('[data-quantity-minus]');
      const plusBtn = event.target.closest('[data-quantity-plus]');
      const removeBtn = event.target.closest('[data-remove-item]');

      if (minusBtn) {
        this.handleQuantityChange(minusBtn, -1);
      } else if (plusBtn) {
        this.handleQuantityChange(plusBtn, 1);
      } else if (removeBtn) {
        const line = parseInt(removeBtn.dataset.lineIndex, 10);
        this.updateQuantity(line, 0);
      }
    });

    this.addEventListener('input', (event) => {
      if (event.target.closest('[data-cart-note]')) {
        this.handleNoteChange(event.target);
      }
    });

    this.unsubscribeCartAdd = subscribe(PUB_SUB_EVENTS.cartAdd, (data) => {
      this.renderContents(data);
      this.open();
    });
  }

  disconnectedCallback() {
    this.unsubscribeCartAdd?.();
    document.removeEventListener('keydown', this.handleKeydown);
    document.removeEventListener('click', this.handleCartTrigger);
    this.removeTrapFocus();
  }

  open() {
    this.previousActiveElement = document.activeElement;
    this.hidden = false;
    this.isOpen = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay?.classList.remove('opacity-0');
        this.overlay?.classList.add('opacity-100');
        this.panel?.classList.remove('translate-x-full');
        this.panel?.classList.add('translate-x-0');
        document.body.classList.add('overflow-hidden');
        this.setAttribute('aria-hidden', 'false');
        this.trapFocus();
      });
    });
  }

  close() {
    this.isOpen = false;
    this.removeTrapFocus();
    this.overlay?.classList.remove('opacity-100');
    this.overlay?.classList.add('opacity-0');
    this.panel?.classList.remove('translate-x-0');
    this.panel?.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
    this.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      this.hidden = true;
      this.previousActiveElement?.focus();
    }, 300);
  }

  trapFocus() {
    const focusable = [...this.panel.querySelectorAll(FOCUSABLE_SELECTORS)];
    if (!focusable.length) return;

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    firstFocusable.focus();

    this.removeTrapFocus();

    this.focusTrapHandler = (event) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    this.panel.addEventListener('keydown', this.focusTrapHandler);
  }

  removeTrapFocus() {
    if (this.focusTrapHandler && this.panel) {
      this.panel.removeEventListener('keydown', this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }

  renderContents(data) {
    const sectionId = this.dataset.sectionId;
    const sectionHtml = data.sections?.[sectionId] ?? data.sections?.['cart-drawer'];
    if (!sectionHtml) return;

    const parsed = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const newContent = parsed.querySelector('cart-drawer');
    if (!newContent) return;

    this.overlay = null;
    this.panel = null;

    this.innerHTML = newContent.innerHTML;

    this.overlay = this.querySelector('[data-cart-overlay]');
    this.panel = this.querySelector('[data-cart-panel]');

    this.overlay?.addEventListener('click', () => this.close());

    if (this.isOpen) {
      this.overlay?.classList.remove('opacity-0');
      this.overlay?.classList.add('opacity-100');
      this.panel?.classList.remove('translate-x-full');
      this.panel?.classList.add('translate-x-0');
    }

    updateCartCount(data.item_count ?? 0);
  }

  handleQuantityChange(button, delta) {
    const line = parseInt(button.dataset.lineIndex, 10);
    const input = this.querySelector(`[data-quantity-input][data-line-index="${line}"]`);
    if (!input) return;

    const currentQty = parseInt(input.value, 10);
    const newQty = Math.max(0, Math.min(99, currentQty + delta));
    if (newQty === currentQty) return;

    clearTimeout(this.debounceTimers[line]);
    this.debounceTimers[line] = setTimeout(() => {
      this.updateQuantity(line, newQty);
    }, 300);
  }

  async updateQuantity(line, quantity) {
    const lineItem = this.querySelector(`#CartItem-${line}`);
    const loadingOverlay = this.querySelector(`[data-line-loading="${line}"]`);

    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
      loadingOverlay.classList.add('flex');
    }

    try {
      const sectionId = this.dataset.sectionId;
      const data = await CartAPI.change(line, quantity, [sectionId]);
      this.renderContents(data);
      publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-drawer', cartData: data });
    } catch (error) {
      publish(PUB_SUB_EVENTS.cartError, { source: 'cart-drawer', error });
      if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        loadingOverlay.classList.remove('flex');
      }
    }
  }

  handleNoteChange(textarea) {
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(async () => {
      try {
        await CartAPI.update({ note: textarea.value });
      } catch (error) {
        publish(PUB_SUB_EVENTS.cartError, { source: 'cart-drawer', error });
      }
    }, 500);
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}
