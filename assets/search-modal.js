document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('predictive-search-input');
  const triggers = document.querySelectorAll('.search-trigger');
  const closeButtons = modal?.querySelectorAll('.search-modal-close');

  if (!modal || !input) return;

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');

    requestAnimationFrame(() => {
      input.focus();
    });
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    input.value = '';

    const results = document.getElementById('predictive-search-results');
    const defaultContent = document.getElementById('search-default-content');
    if (results) results.classList.add('hidden');
    if (defaultContent) defaultContent.classList.remove('hidden');
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  closeButtons?.forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (modal.classList.contains('hidden')) {
        openModal();
      } else {
        closeModal();
      }
    }
  });

  const STORAGE_KEY = 'themex-recent-searches';
  const MAX_RECENT = 5;
  const recentContainer = document.getElementById('recent-searches-container');
  const recentList = document.getElementById('recent-searches-list');
  const clearButton = document.getElementById('clear-recent-searches');

  function getRecentSearches() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveSearch(term) {
    if (!term || term.length < 2) return;
    const searches = getRecentSearches().filter((s) => s !== term);
    searches.unshift(term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
    renderRecentSearches();
  }

  function renderRecentSearches() {
    const searches = getRecentSearches();
    if (!recentContainer || !recentList) return;

    if (searches.length === 0) {
      recentContainer.classList.add('hidden');
      return;
    }

    recentContainer.classList.remove('hidden');
    recentList.innerHTML = '';
    searches.forEach((term) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recent-search-item w-full text-left text-sm py-1 transition-colors hover:text-primary';
      btn.dataset.searchTerm = term;
      btn.textContent = term;
      li.appendChild(btn);
      recentList.appendChild(li);
    });
  }

  recentList?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-search-term]');
    if (item) {
      input.value = item.dataset.searchTerm;
      input.dispatchEvent(new Event('input'));
    }
  });

  clearButton?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    renderRecentSearches();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      saveSearch(input.value.trim());
    }
  });

  renderRecentSearches();
});
