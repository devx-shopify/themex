document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("predictive-search-input");
  const triggers = document.querySelectorAll(".search-trigger");
  const closeButtons = modal?.querySelectorAll(".search-modal-close");
  const defaultContent = document.getElementById("search-default-content");

  if (!modal || !input) return;

  const showDefaultContent = () => {
    window.searchRecentSearches?.renderRecentSearches();
    window.searchRecentlyViewed?.renderRecentlyViewedProducts();
  };

  const openModal = () => {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("overflow-hidden");

    showDefaultContent();

    requestAnimationFrame(() => {
      input.focus();
    });
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overflow-hidden");
    input.value = "";

    const results = document.getElementById("predictive-search-results");
    if (results) {
      results.classList.add("hidden");
      results.innerHTML = "";
    }
    if (defaultContent) defaultContent.classList.remove("hidden");
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();
    });
  });

  closeButtons?.forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  modal.addEventListener("click", (e) => {
    if (!e.target.closest(".search-modal-content")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (modal.classList.contains("hidden")) {
        openModal();
      } else {
        closeModal();
      }
    }
  });

  window.searchModal = {
    open: openModal,
    close: closeModal,
    showDefaultContent,
  };
});
