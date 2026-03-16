const PUB_SUB_EVENTS = {
  cartAdd: 'cart:add',
  cartUpdate: 'cart:update',
  cartError: 'cart:error',
  variantChange: 'variant:change',
};

const subscribers = {};

const subscribe = (event, callback) => {
  subscribers[event] = subscribers[event] || [];
  subscribers[event].push(callback);

  return () => {
    subscribers[event] = subscribers[event].filter((cb) => cb !== callback);
  };
};

const publish = (event, data) => {
  if (!subscribers[event]?.length) return;
  subscribers[event].forEach((callback) => callback(data));
};
