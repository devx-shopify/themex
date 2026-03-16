class CollectionSection {
  constructor() {
    this.section = document.querySelector("[data-collection-section]");
    if (!this.section) return;

    this.sectionId = this.section.dataset.sectionId;
    this.filterDrawer = document.querySelector("[data-filter-drawer]");
    this.sortDrawer = document.querySelector("[data-sort-drawer]");
    this.stickyBar = document.querySelector("[data-sticky-bar]");
    this.abortController = null;

    this.bindSort();
    this.bindFilters();
    this.bindPriceSliders();
    this.bindFilterDrawer();
    this.bindActiveFilterLinks();
    this.bindSortDrawer();
    this.bindStickyBar();
  }

  bindSort() {
    const sortSelect = this.section.querySelector("[data-collection-sort]");
    if (!sortSelect) return;

    sortSelect.addEventListener("change", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("sort_by", sortSelect.value);
      url.searchParams.delete("page");
      this.fetchAndRender(url);
    });
  }

  bindFilters() {
    document.addEventListener("change", (e) => {
      const checkbox = e.target.closest("[data-filter-checkbox]");
      if (!checkbox) return;
      this.applyFilters();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.closest("[data-filter-price]")) {
        e.preventDefault();
        this.applyFilters();
      }
    });

    document.addEventListener("focusout", (e) => {
      if (e.target.closest("[data-filter-price]")) {
        this.applyFilters();
      }
    });
  }

  bindPriceSliders() {
    const sliders = document.querySelectorAll("[data-price-slider]");

    for (const slider of sliders) {
      const sliderMin = slider.querySelector("[data-slider-min]");
      const sliderMax = slider.querySelector("[data-slider-max]");
      const inputMin = slider.querySelector("[data-price-input-min]");
      const inputMax = slider.querySelector("[data-price-input-max]");
      const fill = slider.querySelector("[data-slider-fill]");

      if (!sliderMin || !sliderMax || !inputMin || !inputMax || !fill) continue;

      const rangeMax = parseFloat(slider.dataset.rangeMax) || 1;
      const MIN_GAP = 100;

      const updateFill = () => {
        const minVal = parseFloat(sliderMin.value);
        const maxVal = parseFloat(sliderMax.value);
        const minPercent = (minVal / rangeMax) * 100;
        const maxPercent = (maxVal / rangeMax) * 100;
        fill.style.setProperty("left", `${minPercent}%`);
        fill.style.setProperty(
          "width",
          `${Math.max(0, maxPercent - minPercent)}%`,
        );
      };

      updateFill();

      sliderMin.addEventListener("input", () => {
        if (
          parseFloat(sliderMin.value) >
          parseFloat(sliderMax.value) - MIN_GAP
        ) {
          sliderMin.value = parseFloat(sliderMax.value) - MIN_GAP;
        }
        inputMin.value = sliderMin.value;
        updateFill();
      });

      sliderMax.addEventListener("input", () => {
        if (
          parseFloat(sliderMax.value) <
          parseFloat(sliderMin.value) + MIN_GAP
        ) {
          sliderMax.value = parseFloat(sliderMin.value) + MIN_GAP;
        }
        inputMax.value = sliderMax.value;
        updateFill();
      });

      sliderMin.addEventListener("change", () => {
        this.applyFilters();
      });

      sliderMax.addEventListener("change", () => {
        this.applyFilters();
      });

      inputMin.addEventListener("input", () => {
        const val = Math.min(
          parseFloat(inputMin.value) || 0,
          parseFloat(sliderMax.value) - MIN_GAP,
        );
        sliderMin.value = val;
        updateFill();
      });

      inputMax.addEventListener("input", () => {
        const val = Math.max(
          parseFloat(inputMax.value) || 0,
          parseFloat(sliderMin.value) + MIN_GAP,
        );
        sliderMax.value = val;
        updateFill();
      });
    }
  }

  applyFilters() {
    const url = new URL(window.location.href);

    const keysToDelete = [];
    url.searchParams.forEach((_, key) => {
      if (key.startsWith("filter.")) keysToDelete.push(key);
    });
    keysToDelete.forEach((key) => url.searchParams.delete(key));
    url.searchParams.delete("page");

    const sidebar = this.section.querySelector("[data-filters-sidebar]");
    const source = sidebar || document;

    const checkboxes = source.querySelectorAll(
      "[data-filter-checkbox]:checked",
    );
    checkboxes.forEach((cb) => {
      url.searchParams.append(cb.name, cb.value);
    });

    const priceInputs = source.querySelectorAll("[data-filter-price]");
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
    document.addEventListener("click", (e) => {
      const filterLink = e.target.closest("[data-active-filter]");
      const clearLink = e.target.closest("[data-clear-filters]");

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

    const grid = this.section.querySelector("[data-collection-products]");
    const loader = this.section.querySelector("[data-collection-loader]");
    if (grid) grid.classList.add("opacity-50", "pointer-events-none");
    if (loader) {
      loader.classList.remove("hidden");
    }
    document.body.classList.add("overflow-hidden");

    const fetchUrl = new URL(url);
    fetchUrl.searchParams.set("sections", this.sectionId);

    try {
      const response = await fetch(fetchUrl.toString(), {
        signal: this.abortController.signal,
      });

      if (!response.ok) throw new Error("Failed to fetch collection");

      const data = await response.json();
      const html = data[this.sectionId];

      if (!html) throw new Error("No section HTML returned");

      this.renderSection(html);
      window.history.pushState({}, "", url.toString());
    } catch (error) {
      if (error.name === "AbortError") return;
      if (grid) grid.classList.remove("opacity-50", "pointer-events-none");
      if (loader) {
        loader.classList.add("hidden");
      }
      document.body.classList.remove("overflow-hidden");
    }
  }

  renderSection(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const newSection = doc.querySelector("[data-collection-section]");
    if (!newSection) return;

    const scrollY = window.scrollY;

    const newToolbar = newSection.querySelector("[data-collection-toolbar]");
    const currentToolbar = this.section.querySelector(
      "[data-collection-toolbar]",
    );
    if (newToolbar && currentToolbar) {
      currentToolbar.innerHTML = newToolbar.innerHTML;
    }

    const newActiveFilters = newSection.querySelector(
      "[data-active-filters-container]",
    );
    const currentActiveFilters = this.section.querySelector(
      "[data-active-filters-container]",
    );
    if (newActiveFilters && currentActiveFilters) {
      currentActiveFilters.innerHTML = newActiveFilters.innerHTML;
    }

    const newSidebar = newSection.querySelector("[data-filters-sidebar]");
    const currentSidebar = this.section.querySelector("[data-filters-sidebar]");
    if (newSidebar && currentSidebar) {
      currentSidebar.innerHTML = newSidebar.innerHTML;
    }

    const newProducts = newSection.querySelector("[data-collection-products]");
    const currentProducts = this.section.querySelector(
      "[data-collection-products]",
    );
    if (newProducts && currentProducts) {
      currentProducts.innerHTML = newProducts.innerHTML;
      currentProducts.classList.remove("opacity-50", "pointer-events-none");
    }
    document.body.classList.remove("overflow-hidden");

    const newDrawerDoc = doc.querySelector("[data-filter-drawer]");
    if (newDrawerDoc && this.filterDrawer) {
      const newDrawerFilters = newDrawerDoc.querySelector(
        "[data-filter-panel]",
      );
      const currentDrawerPanel = this.filterDrawer.querySelector(
        "[data-filter-panel]",
      );
      if (newDrawerFilters && currentDrawerPanel) {
        currentDrawerPanel.innerHTML = newDrawerFilters.innerHTML;
      }
    }

    // Update sort drawer options from the new HTML
    const newSortDrawer = doc.querySelector("[data-sort-drawer]");
    if (newSortDrawer && this.sortDrawer) {
      const newSortOptions = newSortDrawer.querySelector("[data-sort-options]");
      const currentSortOptions = this.sortDrawer.querySelector(
        "[data-sort-options]",
      );
      if (newSortOptions && currentSortOptions) {
        currentSortOptions.innerHTML = newSortOptions.innerHTML;
      }
    }

    window.scrollTo(0, scrollY);
    this.bindSort();
    this.bindPriceSliders();
    this.updateIndicatorDots();
  }

  // --- Sticky Bar (IntersectionObserver) ---

  bindStickyBar() {
    if (!this.stickyBar) return;

    const toolbar = this.section.querySelector("[data-collection-toolbar]");
    const footer = document.querySelector(".footer");
    if (!toolbar) return;

    const LG_BREAKPOINT = 1024;

    const showBar = () => {
      this.stickyBar.classList.remove(
        "opacity-0",
        "invisible",
        "translate-y-4",
      );
      this.stickyBar.classList.add("opacity-100", "visible", "translate-y-0");
    };

    const hideBar = () => {
      this.stickyBar.classList.add("opacity-0", "invisible", "translate-y-4");
      this.stickyBar.classList.remove(
        "opacity-100",
        "visible",
        "translate-y-0",
      );
    };

    // Show sticky bar only when toolbar is above viewport
    // AND footer is not yet in view
    let toolbarAbove = false;
    let footerVisible = false;

    const updateBar = () => {
      requestAnimationFrame(() => {
        if (toolbarAbove && !footerVisible) {
          showBar();
        } else {
          hideBar();
        }
      });
    };

    const toolbarObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          toolbarAbove =
            !entry.isIntersecting && entry.boundingClientRect.top < 0;
        }
        updateBar();
      },
      { threshold: 0 },
    );

    const footerObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          footerVisible = entry.isIntersecting;
        }
        updateBar();
      },
      { threshold: 0 },
    );

    let isObserving = false;

    const attachObserver = () => {
      if (window.innerWidth < LG_BREAKPOINT && !isObserving) {
        toolbarObserver.observe(toolbar);
        if (footer) footerObserver.observe(footer);
        isObserving = true;
      } else if (window.innerWidth >= LG_BREAKPOINT && isObserving) {
        toolbarObserver.disconnect();
        footerObserver.disconnect();
        isObserving = false;
        hideBar();
      }
    };

    attachObserver();

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(attachObserver, 150);
    });
  }

  // --- Sort Drawer ---

  bindSortDrawer() {
    if (!this.sortDrawer) return;

    const overlay = this.sortDrawer.querySelector("[data-sort-overlay]");
    const panel = this.sortDrawer.querySelector("[data-sort-panel]");

    // Open sort drawer from any sort toggle button
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-sort-toggle]")) {
        this.openSortDrawer();
      }
    });

    // Close sort drawer
    document.addEventListener("click", (e) => {
      if (
        e.target.closest("[data-sort-close]") ||
        e.target.closest("[data-sort-overlay]")
      ) {
        this.closeSortDrawer();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.sortDrawer.classList.contains("hidden")) {
        this.closeSortDrawer();
      }
    });

    // Sort option selection — apply immediately
    document.addEventListener("click", (e) => {
      const optionBtn = e.target.closest("[data-sort-option]");
      if (!optionBtn) return;

      const sortValue = optionBtn.dataset.sortValue;
      if (!sortValue) return;

      this.closeSortDrawer();

      const url = new URL(window.location.href);
      url.searchParams.set("sort_by", sortValue);
      url.searchParams.delete("page");
      this.fetchAndRender(url);
    });
  }

  openSortDrawer() {
    if (!this.sortDrawer) return;

    const overlay = this.sortDrawer.querySelector("[data-sort-overlay]");
    const panel = this.sortDrawer.querySelector("[data-sort-panel]");

    this.sortDrawer.classList.remove("hidden");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay?.classList.remove("opacity-0");
        overlay?.classList.add("opacity-100");
        panel?.classList.remove("translate-y-full");
        panel?.classList.add("translate-y-0");
      });
    });
    document.body.classList.add("overflow-hidden");
  }

  closeSortDrawer() {
    if (!this.sortDrawer) return;

    const overlay = this.sortDrawer.querySelector("[data-sort-overlay]");
    const panel = this.sortDrawer.querySelector("[data-sort-panel]");

    overlay?.classList.remove("opacity-100");
    overlay?.classList.add("opacity-0");
    panel?.classList.remove("translate-y-0");
    panel?.classList.add("translate-y-full");

    setTimeout(() => {
      this.sortDrawer.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }, 300);
  }

  // --- Indicator Dots ---

  updateIndicatorDots() {
    const url = new URL(window.location.href);

    // Check if any filter.* params are present
    let hasActiveFilters = false;
    url.searchParams.forEach((_, key) => {
      if (key.startsWith("filter.")) hasActiveFilters = true;
    });

    // Check if sort differs from default
    const defaultSort = this.stickyBar?.dataset.defaultSort ?? "";
    const currentSort = url.searchParams.get("sort_by") ?? "";
    const isSortActive = currentSort !== "" && currentSort !== defaultSort;

    // Update all filter indicator dots
    const filterDots = document.querySelectorAll("[data-filter-indicator]");
    for (const dot of filterDots) {
      if (hasActiveFilters) {
        dot.classList.remove("hidden");
      } else {
        dot.classList.add("hidden");
      }
    }

    // Update all sort indicator dots
    const sortDots = document.querySelectorAll("[data-sort-indicator]");
    for (const dot of sortDots) {
      if (isSortActive) {
        dot.classList.remove("hidden");
      } else {
        dot.classList.add("hidden");
      }
    }
  }

  // --- Filter Drawer ---

  bindFilterDrawer() {
    if (!this.filterDrawer) return;

    const overlay = this.filterDrawer.querySelector("[data-filter-overlay]");
    const panel = this.filterDrawer.querySelector("[data-filter-panel]");

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-filter-toggle]")) {
        this.filterDrawer.classList.remove("hidden");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            overlay?.classList.remove("opacity-0");
            overlay?.classList.add("opacity-100");
            panel?.classList.remove("-translate-x-full");
            panel?.classList.add("translate-x-0");
          });
        });
        document.body.classList.add("overflow-hidden");

        // Re-initialize accordions now that the drawer is visible
        // (scrollHeight returns 0 inside hidden containers)
        const drawerAccordions = this.filterDrawer.querySelectorAll(
          "[data-accordion-trigger]",
        );
        for (const trigger of drawerAccordions) {
          delete trigger.dataset.accordionInitialized;
        }
        if (typeof initAccordions === "function") initAccordions();
      }
    });

    document.addEventListener("click", (e) => {
      if (
        e.target.closest("[data-filter-close]") ||
        e.target.closest("[data-filter-overlay]")
      ) {
        this.closeFilterDrawer();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !this.filterDrawer.classList.contains("hidden")
      ) {
        this.closeFilterDrawer();
      }
    });
  }

  closeFilterDrawer() {
    if (!this.filterDrawer) return;

    const overlay = this.filterDrawer.querySelector("[data-filter-overlay]");
    const panel = this.filterDrawer.querySelector("[data-filter-panel]");

    overlay?.classList.remove("opacity-100");
    overlay?.classList.add("opacity-0");
    panel?.classList.remove("translate-x-0");
    panel?.classList.add("-translate-x-full");

    setTimeout(() => {
      this.filterDrawer.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }, 300);
  }
}

window.addEventListener("popstate", () => {
  window.location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
  new CollectionSection();
});
