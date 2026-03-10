document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "themex-recently-viewed";
  const MAX_ITEMS = 10;

  const section = document.getElementById("recently-viewed-section");
  const list = document.getElementById("recently-viewed-list");
  const loader = document.getElementById("recently-viewed-loader");

  let abortController = null;

  const getRecentlyViewed = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveRecentlyViewedProduct = (handle) => {
    if (!handle || handle.trim() === "") return;

    const trimmed = handle.trim();
    let handles = getRecentlyViewed().filter((h) => h !== trimmed);
    handles.unshift(trimmed);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(handles.slice(0, MAX_ITEMS)),
    );
  };

  const getCurrentProductHandle = () => {
    const match = window.location.pathname.match(/\/products\/([^/?]+)/);
    return match ? match[1] : null;
  };

  const trackProductView = () => {
    const handle = getCurrentProductHandle();
    if (handle) {
      saveRecentlyViewedProduct(handle);
    }
  };

  const showLoader = () => {
    if (loader) {
      loader.classList.remove("hidden");
      loader.classList.add("flex");
    }
    if (list) list.classList.add("hidden");
  };

  const hideLoader = () => {
    if (loader) {
      loader.classList.add("hidden");
      loader.classList.remove("flex");
    }
    if (list) list.classList.remove("hidden");
  };

  const renderRecentlyViewedProducts = async () => {
    let handles = getRecentlyViewed();

    if (!section || !list) return;

    const currentHandle = getCurrentProductHandle();
    if (currentHandle) {
      handles = handles.filter((h) => h !== currentHandle);
    }

    if (handles.length === 0) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    showLoader();

    if (abortController) abortController.abort();
    abortController = new AbortController();

    const handlesParam = handles.map(encodeURIComponent).join(",");
    const root = window.Shopify?.routes?.root || "/";

    try {
      const response = await fetch(
        `${root}?sections=recently-viewed-products&handles=${handlesParam}`,
        { signal: abortController.signal },
      );

      if (!response.ok)
        throw new Error("Failed to fetch recently viewed products");

      const data = await response.json();
      const html = data["recently-viewed-products"];

      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const content = doc.getElementById("recently-viewed-products-content");

        if (content && content.children.length > 0) {
          list.innerHTML = content.innerHTML;
          section.classList.remove("hidden");
        } else {
          section.classList.add("hidden");
        }
      }

      hideLoader();
    } catch (error) {
      if (error.name !== "AbortError") {
        hideLoader();
        section.classList.add("hidden");
      }
    }
  };

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-product-card]");
    if (!card) return;

    const link = card.querySelector('a[href*="/products/"]');
    if (!link) return;

    const match = link.href.match(/\/products\/([^/?]+)/);
    if (match) {
      saveRecentlyViewedProduct(match[1]);
    }
  });

  if (getCurrentProductHandle()) {
    trackProductView();
  }

  window.searchRecentlyViewed = {
    getRecentlyViewed,
    saveRecentlyViewedProduct,
    trackProductView,
    renderRecentlyViewedProducts,
  };
});
