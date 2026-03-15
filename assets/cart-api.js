const CartAPI = {
  routes: {
    add: 'cart/add.js',
    change: 'cart/change.js',
    update: 'cart/update.js',
    get: 'cart.js',
    clear: 'cart/clear.js',
  },

  getRoot() {
    return window.Shopify?.routes?.root || '/';
  },

  async add(formData, sections = []) {
    if (sections.length) {
      formData.append('sections', sections.join(','));
      formData.append('sections_url', window.location.pathname);
    }

    const response = await fetch(`${this.getRoot()}${this.routes.add}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) throw data;
    return data;
  },

  async change(line, quantity, sections = []) {
    const body = { line, quantity };

    if (sections.length) {
      body.sections = sections.join(',');
      body.sections_url = window.location.pathname;
    }

    const response = await fetch(`${this.getRoot()}${this.routes.change}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) throw data;
    return data;
  },

  async update(body, sections = []) {
    if (sections.length) {
      body.sections = sections.join(',');
      body.sections_url = window.location.pathname;
    }

    const response = await fetch(`${this.getRoot()}${this.routes.update}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) throw data;
    return data;
  },

  async get() {
    const response = await fetch(`${this.getRoot()}${this.routes.get}`);
    const data = await response.json();
    if (!response.ok) throw data;
    return data;
  },

  async clear(sections = []) {
    const body = {};

    if (sections.length) {
      body.sections = sections.join(',');
      body.sections_url = window.location.pathname;
    }

    const response = await fetch(`${this.getRoot()}${this.routes.clear}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) throw data;
    return data;
  },
};

const updateCartCount = (count) => {
  const safeCount = Number(count) || 0;
  document.querySelectorAll('[data-cart-count]').forEach((badge) => {
    badge.textContent = safeCount;
    badge.dataset.cartCount = safeCount;
    badge.hidden = safeCount === 0;
  });
};
