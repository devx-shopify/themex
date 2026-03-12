/**
 * Cart Event System — Foundation Module.
 * Defines all cart event names, dispatch/listen helpers, and shared constants.
 * Must load before all other cart modules.
 */
const CART_EVENTS = {
  addOptimistic: 'cart:add-optimistic',
  changeOptimistic: 'cart:change-optimistic',
  removeOptimistic: 'cart:remove-optimistic',
  apiSuccess: 'cart:api-success',
  apiError: 'cart:api-error',
  notify: 'cart:notify',
  drawerOpen: 'cart:drawer-open',
  drawerClose: 'cart:drawer-close',
};

const CART_DEFAULT_SECTIONS = 'cart-drawer,cart-item-count';

const NOTIFICATION_BG_CLASSES = ['bg-success', 'bg-error', 'bg-accent', 'bg-foreground'];
const NOTIFICATION_STYLES = {
  success: ['bg-success', 'text-background'],
  error: ['bg-error', 'text-background'],
  warning: ['bg-accent', 'text-foreground'],
  info: ['bg-foreground', 'text-background'],
};

const cartDispatch = (eventName, detail = {}) => {
  document.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
};

const cartListen = (eventName, callback) => {
  document.addEventListener(eventName, callback);
  return () => document.removeEventListener(eventName, callback);
};
