/**
 * Cart Toast Notification System.
 * Shows toast messages for cart errors (and future success/info).
 * Creates its own DOM container — no Liquid dependency.
 * Listens for CART_EVENTS.apiError automatically.
 */
const CartToast = (() => {
  const MAX_VISIBLE = 3;
  const AUTO_DISMISS_MS = 4000;
  let container = null;

  const init = () => {
    container = document.createElement('div');
    container.className = 'cart-toast-container';
    document.body.appendChild(container);
  };

  const show = (message, type = 'error') => {
    if (!container) init();

    const toast = document.createElement('div');
    toast.className = `cart-toast cart-toast--${type}`;
    toast.setAttribute('role', 'alert');

    const messageEl = document.createElement('span');
    messageEl.className = 'cart-toast__message';
    messageEl.textContent = message;
    toast.appendChild(messageEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cart-toast__close';
    closeBtn.setAttribute('aria-label', window.theme?.strings?.dismiss || 'Dismiss');
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener('click', () => dismiss(toast));
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('cart-toast--visible');
      });
    });

    const timer = setTimeout(() => dismiss(toast), AUTO_DISMISS_MS);
    toast._dismissTimer = timer;

    enforceMaxVisible();
  };

  const dismiss = (toast) => {
    if (!toast.parentNode) return;

    clearTimeout(toast._dismissTimer);
    toast.classList.remove('cart-toast--visible');

    setTimeout(() => {
      toast.remove();
    }, 200);
  };

  const enforceMaxVisible = () => {
    if (!container) return;

    const toasts = container.querySelectorAll('.cart-toast');
    if (toasts.length > MAX_VISIBLE) {
      const excess = toasts.length - MAX_VISIBLE;
      for (let i = 0; i < excess; i++) {
        dismiss(toasts[i]);
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    cartListen(CART_EVENTS.apiError, (e) => {
      const message = e.detail.message
        || window.theme?.strings?.updateCartError
        || 'Something went wrong. Please try again.';
      show(message, 'error');
    });
  });

  return { show };
})();
