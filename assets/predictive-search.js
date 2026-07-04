document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("predictive-search-input");
  const resultsContainer = document.getElementById("predictive-search-results");
  const loadingIndicator = document.getElementById("predictive-search-loading");
  const defaultContent = document.getElementById("search-default-content");

  if (!input || !resultsContainer) return;

  let debounceTimer = null;
  let abortController = null;

  function showLoading() {
    resultsContainer.classList.add("hidden");
    if (loadingIndicator) {
      loadingIndicator.classList.remove("hidden");
      loadingIndicator.classList.add("flex");
    }
    if (defaultContent) defaultContent.classList.add("hidden");
  }

  function showResults() {
    resultsContainer.classList.remove("hidden");
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
      loadingIndicator.classList.remove("flex");
    }
  }

  function hideAll() {
    resultsContainer.classList.add("hidden");
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
      loadingIndicator.classList.remove("flex");
    }
  }

  async function performSearch(query) {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    showLoading();

    const root = window.Shopify?.routes?.root || "/";
    const sectionId = input.dataset.sectionId;
    const url = `${root}search?q=${encodeURIComponent(query)}&type=product,article,page&options[prefix]=last&section_id=${sectionId}`;

    try {
      const response = await fetch(url, { signal: abortController.signal });

      if (!response.ok) throw new Error("Search failed");

      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      const sectionContent = doc.getElementById("search-modal-section-results");

      if (sectionContent) {
        resultsContainer.innerHTML = sectionContent.innerHTML;
        window.searchRecentSearches?.trackSearch(query);
        showResults();
      } else {
        resultsContainer.innerHTML = "";
        hideAll();
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        resultsContainer.innerHTML = "";
        hideAll();
      }
    }
  }

  function debounce(fn, delay) {
    return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedSearch = debounce((query) => {
    if (query.length >= 2) {
      performSearch(query);
    }
  }, 300);

  input.addEventListener("input", () => {
    const query = input.value.trim();

    if (query.length < 2) {
      hideAll();
      resultsContainer.innerHTML = "";
      if (defaultContent) defaultContent.classList.remove("hidden");
      return;
    }

    debouncedSearch(query);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      window.searchRecentSearches?.trackSearch(input.value.trim());
      const root = window.Shopify?.routes?.root || "/";
      window.location.href = `${root}search?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
});
