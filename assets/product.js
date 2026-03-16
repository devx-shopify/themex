document.addEventListener('DOMContentLoaded', () => {
  if (typeof subscribe === 'undefined' || typeof PUB_SUB_EVENTS === 'undefined') return;

  const productSection = document.querySelector('[data-product-section]');
  if (!productSection) return;

  const productId = productSection.dataset.productId;
  const variantSelector = productSection.querySelector('variant-selector');
  if (!variantSelector) return;
  const priceEl = document.querySelector('[data-product-price]');
  const comparePriceEl = document.querySelector('[data-product-compare-price]');
  const discountEl = document.querySelector('[data-product-discount]');
  const galleryScrollContainer = document.querySelector('[data-product-gallery-scroll]');

  const updatePrice = (variant) => {
    if (!priceEl) return;

    priceEl.textContent = variant.price_formatted;

    if (comparePriceEl) {
      if (variant.compare_at_price > variant.price) {
        comparePriceEl.textContent = variant.compare_at_price_formatted;
        comparePriceEl.classList.remove('hidden');
      } else {
        comparePriceEl.classList.add('hidden');
      }
    }

    if (discountEl) {
      if (variant.compare_at_price > variant.price) {
        const discount = Math.round(
          ((variant.compare_at_price - variant.price) / variant.compare_at_price) * 100
        );
        discountEl.textContent = `${discount}% off`;
        discountEl.classList.remove('hidden');
      } else {
        discountEl.classList.add('hidden');
      }
    }
  };

  const updateURL = (variant) => {
    const url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);
  };

  const getColorOptionIndex = () => {
    const colorButton = variantSelector.querySelector('[data-is-color="true"]');
    if (!colorButton) return -1;
    return parseInt(colorButton.dataset.optionIndex, 10);
  };

  const filterMediaByVariant = (variant) => {
    const colorIndex = getColorOptionIndex();
    if (colorIndex === -1) return;

    const allMediaItems = [...document.querySelectorAll('[data-media-id]')];
    if (allMediaItems.length === 0) return;

    const mediaOrder = allMediaItems.map((el) => Number(el.dataset.mediaId));

    const allVariants = variantSelector.variants ?? [];
    const allFeaturedIds = new Set(
      allVariants
        .map((v) => v.featured_media_id)
        .filter((id) => id != null)
    );

    const startIndex = mediaOrder.indexOf(variant.featured_media_id);
    if (startIndex === -1) {
      allMediaItems.forEach((item) => {
        item.classList.remove('hidden');
        item.classList.add('col-span-1');
        item.classList.remove('col-span-2');
      });
      return;
    }

    const visibleIds = new Set();
    visibleIds.add(mediaOrder[startIndex]);

    for (let i = startIndex + 1; i < mediaOrder.length; i++) {
      if (allFeaturedIds.has(mediaOrder[i])) break;
      visibleIds.add(mediaOrder[i]);
    }

    allMediaItems.forEach((item) => {
      const mediaId = Number(item.dataset.mediaId);
      if (visibleIds.has(mediaId)) {
        item.classList.remove('hidden');
        if (mediaId === variant.featured_media_id) {
          item.classList.add('col-span-2');
          item.classList.remove('col-span-1');
        } else {
          item.classList.add('col-span-1');
          item.classList.remove('col-span-2');
        }
      } else {
        item.classList.add('hidden');
      }
    });

    const scrollContainer = galleryScrollContainer;
    if (scrollContainer && window.innerWidth < 1024) {
      scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const scrollToMedia = (variant) => {
    if (!variant.featured_media_id) return;

    const mediaEl = document.querySelector(`[data-media-id="${variant.featured_media_id}"]`);
    if (!mediaEl) return;

    const scrollContainer = galleryScrollContainer;
    if (scrollContainer && window.innerWidth < 1024) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const mediaRect = mediaEl.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft + (mediaRect.left - containerRect.left);
      scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      return;
    }

    mediaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  subscribe(PUB_SUB_EVENTS.variantChange, (data) => {
    if (data.productId !== productId) return;

    if (!data.variant) {
      if (discountEl) discountEl.classList.add('hidden');
      return;
    }

    updatePrice(data.variant);
    updateURL(data.variant);
    filterMediaByVariant(data.variant);
    scrollToMedia(data.variant);
  });

  const initialVariant = variantSelector.variants?.find(
    (v) => v.options.every((opt, i) => opt === variantSelector.selectedOptions?.[i])
  );
  if (initialVariant) {
    filterMediaByVariant(initialVariant);
  }
});
