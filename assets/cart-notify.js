/**
 * Cart Notification Manager.
 * Shows error/warning/success notifications in the cart drawer.
 * Subscribes to cart:notify and cart:api-error events.
 */
document.addEventListener('DOMContentLoaded', () => {
  let notificationTimeout = null;

  const getElements = () => {
    const drawer = document.querySelector('cart-drawer');
    if (!drawer) return null;
    return {
      notification: drawer.querySelector('[data-cart-notification]'),
      content: drawer.querySelector('[data-notification-content]'),
    };
  };

  const show = (message, type = 'error', duration = 5000) => {
    const els = getElements();
    if (!els?.notification || !els?.content) return;

    if (notificationTimeout) clearTimeout(notificationTimeout);

    els.content.textContent = message;

    const colors = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.error;
    els.content.classList.remove(...NOTIFICATION_BG_CLASSES, 'text-background', 'text-foreground');
    els.content.classList.add(...colors);

    els.notification.classList.remove('max-h-0');
    els.notification.classList.add('max-h-[200px]');

    notificationTimeout = setTimeout(() => {
      els.notification.classList.remove('max-h-[200px]');
      els.notification.classList.add('max-h-0');
    }, duration);
  };

  cartListen(CART_EVENTS.notify, (e) => {
    const { message, type, duration } = e.detail;
    if (message) show(message, type, duration);
  });

  cartListen(CART_EVENTS.apiError, (e) => {
    const { message } = e.detail;
    if (message) show(message, 'error');
  });
});
