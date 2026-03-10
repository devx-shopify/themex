document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "themex-recent-searches";
  const MAX_RECENT = 5;

  const section = document.getElementById("recent-searches-section");
  const list = document.getElementById("recent-searches-list");
  const loader = document.getElementById("recent-searches-loader");
  const clearButton = document.getElementById("clear-recent-searches");
  const searchInput = document.getElementById("predictive-search-input");

  let abortController = null;

  const getRecentSearches = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveRecentSearch = (query) => {
    const trimmed = query?.trim();
    if (!trimmed || trimmed.length < 1) return;

    let searches = getRecentSearches();

    // Remove exact duplicates (case-insensitive)
    searches = searches.filter(
      (s) => s.toLowerCase() !== trimmed.toLowerCase(),
    );

    // Remove older searches that are substrings of the new query
    // e.g. saving "blue shirt" removes previously saved "blue"
    searches = searches.filter(
      (s) => !trimmed.toLowerCase().includes(s.toLowerCase()),
    );

    searches.unshift(trimmed);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(searches.slice(0, MAX_RECENT)),
    );
  };

  const showLoader = () => {
    if (loader) {
      loader.classList.remove("hidden");
      loader.classList.add("block");
    }
    if (list) list.classList.add("hidden");
  };

  const hideLoader = () => {
    if (loader) {
      loader.classList.add("hidden");
      loader.classList.remove("block");
    }
    if (list) list.classList.remove("hidden");
  };

  const renderRecentSearches = async () => {
    const searches = getRecentSearches();

    if (!section || !list) return;

    if (searches.length === 0) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    showLoader();

    if (abortController) abortController.abort();
    abortController = new AbortController();

    const queriesParam = searches.map(encodeURIComponent).join(",");
    const root = window.Shopify?.routes?.root || "/";

    try {
      const response = await fetch(
        `${root}?sections=recent-searches&queries=${queriesParam}`,
        { signal: abortController.signal },
      );

      if (!response.ok) throw new Error("Failed to fetch recent searches");

      const data = await response.json();
      const html = data["recent-searches"];

      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const results = doc.getElementById("recent-searches-results");

        if (results) {
          list.innerHTML = results.innerHTML;
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

  const trackSearch = (query) => {
    if (!query || query.trim().length < 1) return;
    saveRecentSearch(query.trim());
  };

  list?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-query]");
    if (item && searchInput) {
      e.preventDefault();
      searchInput.value = item.dataset.query;
      searchInput.dispatchEvent(new Event("input"));
    }
  });

  clearButton?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    if (section) section.classList.add("hidden");
    if (list) list.innerHTML = "";
  });

  window.searchRecentSearches = {
    getRecentSearches,
    saveRecentSearch,
    trackSearch,
    renderRecentSearches,
  };
});
