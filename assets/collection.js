class CollectionSection {
  constructor() {
    this.section = document.querySelector('[data-collection-section]');
    if (!this.section) return;

    this.sectionId = this.section.dataset.sectionId;
    this.filterDrawer = document.querySelector('[data-filter-drawer]');
    this.abortController = null;

    this.bindSort();
    this.bindFilters();
    this.bindPriceSliders();
    this.bindFilterDrawer();
    this.bindActiveFilterLinks();
  }

  bindSort() {
    const sortSelect = this.section.querySelector('[data-collection-sort]');
    if (!sortSelect) return;

    sortSelect.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      url.searchParams.delete('page');
      this.fetchAndRender(url);
    });
  }

  bindFilters() {
    document.addEventListener('change', (e) => {
      const checkbox = e.target.closest('[data-filter-checkbox]');
      if (!checkbox) return;
      this.applyFilters();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.closest('[data-filter-price]')) {
        e.preventDefault();
        this.applyFilters();
      }
    });

    document.addEventListener('focusout', (e) => {
      if (e.target.closest('[data-filter-price]')) {
        this.applyFilters();
      }
    });
  }

  bindPriceSliders() {
    const sliders = document.querySelectorAll('[data-price-slider]');

    for (const slider of sliders) {
      const sliderMin = slider.querySelector('[data-slider-min]');
      const sliderMax = slider.querySelector('[data-slider-max]');
      const inputMin = slider.querySelector('[data-price-input-min]');
      const inputMax = slider.querySelector('[data-price-input-max]');
      const fill = slider.querySelector('[data-slider-fill]');

      if (!sliderMin || !sliderMax || !inputMin || !inputMax || !fill) continue;

      const rangeMax = parseFloat(slider.dataset.rangeMax) || 1;
      const MIN_GAP = 100;

      const updateFill = () => {
        const minVal = parseFloat(sliderMin.value);
        const maxVal = parseFloat(sliderMax.value);
        const minPercent = (minVal / rangeMax) * 100;
        const maxPercent = (maxVal / rangeMax) * 100;
        fill.style.setProperty('left', `${minPercent}%`);
        fill.style.setProperty('width', `${Math.max(0, maxPercent - minPercent)}%`);
      };

      updateFill();

      sliderMin.addEventListener('input', () => {
        if (parseFloat(sliderMin.value) > parseFloat(sliderMax.value) - MIN_GAP) {
          sliderMin.value = parseFloat(sliderMax.value) - MIN_GAP;
        }
        inputMin.value = sliderMin.value;
        updateFill();
      });

      sliderMax.addEventListener('input', () => {
        if (parseFloat(sliderMax.value) < parseFloat(sliderMin.value) + MIN_GAP) {
          sliderMax.value = parseFloat(sliderMin.value) + MIN_GAP;
        }
        inputMax.value = sliderMax.value;
        updateFill();
      });

      sliderMin.addEventListener('change', () => {
        this.applyFilters();
      });

      sliderMax.addEventListener('change', () => {
        this.applyFilters();
      });

      inputMin.addEventListener('input', () => {
        const val = Math.min(parseFloat(inputMin.value) || 0, parseFloat(sliderMax.value) - MIN_GAP);
        sliderMin.value = val;
        updateFill();
      });

      inputMax.addEventListener('input', () => {
        const val = Math.max(parseFloat(inputMax.value) || 0, parseFloat(sliderMin.value) + MIN_GAP);
        sliderMax.value = val;
        updateFill();
      });
    }
  }

  applyFilters() {
    const url = new URL(window.location.href);

    const keysToDelete = [];
    url.searchParams.forEach((_, key) => {
      if (key.startsWith('filter.')) keysToDelete.push(key);
    });
    keysToDelete.forEach((key) => url.searchParams.delete(key));
    url.searchParams.delete('page');

    const sidebar = this.section.querySelector('[data-filters-sidebar]');
    const source = sidebar || document;

    const checkboxes = source.querySelectorAll('[data-filter-checkbox]:checked');
    checkboxes.forEach((cb) => {
      url.searchParams.append(cb.name, cb.value);
    });

    const priceInputs = source.querySelectorAll('[data-filter-price]');
    priceInputs.forEach((input) => {
      if (input.value) {
        const price = parseFloat(input.value);
        if (!isNaN(price) && price > 0) {
          url.searchParams.set(input.name, price);
        }
      }
    });

    this.fetchAndRender(url);
  }

  bindActiveFilterLinks() {
    document.addEventListener('click', (e) => {
      const filterLink = e.target.closest('[data-active-filter]');
      const clearLink = e.target.closest('[data-clear-filters]');

      if (filterLink) {
        e.preventDefault();
        this.fetchAndRender(new URL(filterLink.href));
      } else if (clearLink) {
        e.preventDefault();
        this.fetchAndRender(new URL(clearLink.href));
        this.closeFilterDrawer();
      }
    });
  }

  async fetchAndRender(url) {
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();

    const grid = this.section.querySelector('[data-collection-products]');
    if (grid) grid.classList.add('opacity-50', 'pointer-events-none');

    const fetchUrl = new URL(url);
    fetchUrl.searchParams.set('sections', this.sectionId);

    try {
      const response = await fetch(fetchUrl.toString(), {
        signal: this.abortController.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch collection');

      const data = await response.json();
      const html = data[this.sectionId];

      if (!html) throw new Error('No section HTML returned');

      this.renderSection(html);
      window.history.pushState({}, '', url.toString());
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (grid) grid.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  renderSection(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newSection = doc.querySelector('[data-collection-section]');
    if (!newSection) return;

    const scrollY = window.scrollY;

    const newToolbar = newSection.querySelector('[data-collection-toolbar]');
    const currentToolbar = this.section.querySelector('[data-collection-toolbar]');
    if (newToolbar && currentToolbar) {
      currentToolbar.innerHTML = newToolbar.innerHTML;
    }

    const newActiveFilters = newSection.querySelector('[data-active-filters-container]');
    const currentActiveFilters = this.section.querySelector('[data-active-filters-container]');
    if (newActiveFilters && currentActiveFilters) {
      currentActiveFilters.innerHTML = newActiveFilters.innerHTML;
    }

    const newSidebar = newSection.querySelector('[data-filters-sidebar]');
    const currentSidebar = this.section.querySelector('[data-filters-sidebar]');
    if (newSidebar && currentSidebar) {
      currentSidebar.innerHTML = newSidebar.innerHTML;
    }

    const newProducts = newSection.querySelector('[data-collection-products]');
    const currentProducts = this.section.querySelector('[data-collection-products]');
    if (newProducts && currentProducts) {
      currentProducts.innerHTML = newProducts.innerHTML;
      currentProducts.classList.remove('opacity-50', 'pointer-events-none');
    }

    const newDrawerDoc = doc.querySelector('[data-filter-drawer]');
    if (newDrawerDoc && this.filterDrawer) {
      const newDrawerFilters = newDrawerDoc.querySelector('[data-filter-panel]');
      const currentDrawerPanel = this.filterDrawer.querySelector('[data-filter-panel]');
      if (newDrawerFilters && currentDrawerPanel) {
        currentDrawerPanel.innerHTML = newDrawerFilters.innerHTML;
      }
    }

    window.scrollTo(0, scrollY);
    this.bindSort();
    this.bindPriceSliders();
  }

  bindFilterDrawer() {
    if (!this.filterDrawer) return;

    const overlay = this.filterDrawer.querySelector('[data-filter-overlay]');
    const panel = this.filterDrawer.querySelector('[data-filter-panel]');

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-filter-toggle]')) {
        this.filterDrawer.classList.remove('hidden');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            overlay?.classList.remove('opacity-0');
            overlay?.classList.add('opacity-100');
            panel?.classList.remove('-translate-x-full');
            panel?.classList.add('translate-x-0');
          });
        });
        document.body.classList.add('overflow-hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (
        e.target.closest('[data-filter-close]') ||
        e.target.closest('[data-filter-overlay]')
      ) {
        this.closeFilterDrawer();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.filterDrawer.classList.contains('hidden')) {
        this.closeFilterDrawer();
      }
    });
  }

  closeFilterDrawer() {
    if (!this.filterDrawer) return;

    const overlay = this.filterDrawer.querySelector('[data-filter-overlay]');
    const panel = this.filterDrawer.querySelector('[data-filter-panel]');

    overlay?.classList.remove('opacity-100');
    overlay?.classList.add('opacity-0');
    panel?.classList.remove('translate-x-0');
    panel?.classList.add('-translate-x-full');

    setTimeout(() => {
      this.filterDrawer.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }
}

window.addEventListener('popstate', () => {
  window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
  new CollectionSection();
});
