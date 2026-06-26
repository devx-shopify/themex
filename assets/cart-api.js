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

  async _fetch(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      let data;
      try {
        data = await response.json();
      } catch {
        throw { message: 'Invalid server response', description: 'Invalid server response' };
      }
      if (!response.ok) throw data;
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw { message: 'Request timed out. Please try again.', description: 'Request timed out. Please try again.' };
      }
      if (error.message && !error.description) {
        throw { message: error.message, description: error.message };
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  },

  async add(formData, sections = []) {
    if (sections.length) {
      formData.append('sections', sections.join(','));
      formData.append('sections_url', window.location.pathname);
    }
    return this._fetch(`${this.getRoot()}${this.routes.add}`, {
      method: 'POST',
      body: formData,
    });
  },

  async change(line, quantity, sections = []) {
    const body = { line, quantity };
    if (sections.length) {
      body.sections = sections.join(',');
      body.sections_url = window.location.pathname;
    }
    return this._fetch(`${this.getRoot()}${this.routes.change}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async update(body, sections = []) {
    if (sections.length) {
      body.sections = sections.join(',');
      body.sections_url = window.location.pathname;
    }
    return this._fetch(`${this.getRoot()}${this.routes.update}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async get() {
    return this._fetch(`${this.getRoot()}${this.routes.get}`);
  },

  async clear(sections = []) {
    const body = {};
    if (sections.length) {
      body.sections = sections.join(',');
      body.sections_url = window.location.pathname;
    }
    return this._fetch(`${this.getRoot()}${this.routes.clear}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};
