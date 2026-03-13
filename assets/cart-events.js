/**
 * Cart Event System.
 * Defines all cart event names, dispatch/listen helpers, and shared constants.
 * Must load before all other cart modules.
 */
const CART_EVENTS = {
  apiSuccess: 'cart:api-success',
  apiError: 'cart:api-error',
  drawerOpen: 'cart:drawer-open',
};

const CART_DEFAULT_SECTIONS = 'cart-drawer,cart-item-count';

const cartDispatch = (eventName, detail = {}) => {
  document.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
};

const cartListen = (eventName, callback) => {
  document.addEventListener(eventName, callback);
  return () => document.removeEventListener(eventName, callback);
};
