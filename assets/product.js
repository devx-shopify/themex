document.addEventListener('DOMContentLoaded', () => {
  const dataScript = document.getElementById('product-variant-data');
  if (!dataScript) return;

  let productData;
  try {
    productData = JSON.parse(dataScript.textContent);
  } catch {
    return;
  }

  const priceEl = document.querySelector('[data-product-price]');
  const comparePriceEl = document.querySelector('[data-product-compare-price]');
  const discountEl = document.querySelector('[data-product-discount]');
  const variantInput = document.querySelector(
    'product-form input[name="id"]'
  );
  const submitButton = document.querySelector(
    'product-form button[type="submit"]'
  );
  const buttonText = submitButton?.querySelector('[data-button-text]');
  const optionButtons = document.querySelectorAll('.variant-option');
  const selectedOptionLabels = document.querySelectorAll(
    '[data-selected-option]'
  );

  let selectedOptions = [];
  const currentVariant = productData.variants.find(
    (v) => v.id === parseInt(variantInput?.value)
  );
  if (currentVariant) {
    selectedOptions = [...currentVariant.options];
  }

  function findVariant(options) {
    return productData.variants.find((v) =>
      v.options.every((opt, i) => opt === options[i])
    );
  }

  function updatePrice(variant) {
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
          ((variant.compare_at_price - variant.price) /
            variant.compare_at_price) *
            100
        );
        discountEl.textContent = `${discount}% off`;
        discountEl.classList.remove('hidden');
      } else {
        discountEl.classList.add('hidden');
      }
    }
  }

  function updateForm(variant) {
    if (variantInput) {
      variantInput.value = variant.id;
    }

    if (submitButton && buttonText) {
      if (!variant.available) {
        submitButton.disabled = true;
        buttonText.textContent =
          window.theme?.strings?.soldOut || 'Sold out';
      } else {
        submitButton.disabled = false;
        buttonText.textContent =
          window.theme?.strings?.addToCart || 'Add to cart';
      }
    }
  }

  function updateURL(variantId) {
    const url = new URL(window.location);
    url.searchParams.set('variant', variantId);
    window.history.replaceState({}, '', url);
  }

  function getColorOptionIndex() {
    if (!productData.options) return -1;
    return productData.options.findIndex((opt) => {
      const name = opt.name.toLowerCase();
      return name === 'color' || name === 'colour';
    });
  }

  function filterMediaByVariant(variant) {
    const colorIndex = getColorOptionIndex();
    if (colorIndex === -1) return;

    const allMediaItems = [...document.querySelectorAll('[data-media-id]')];
    if (allMediaItems.length === 0) return;

    const mediaOrder = allMediaItems.map((el) => Number(el.dataset.mediaId));

    const allFeaturedIds = new Set(
      productData.variants
        .map((v) => v.featured_media_id)
        .filter((id) => id != null)
    );

    const startIndex = mediaOrder.indexOf(variant.featured_media_id);
    if (startIndex === -1) {
      allMediaItems.forEach((item) => {
        item.classList.remove('hidden');
        const mediaId = Number(item.dataset.mediaId);
        if (mediaId === variant.featured_media_id) {
          item.classList.add('col-span-2');
          item.classList.remove('col-span-1');
        } else {
          item.classList.add('col-span-1');
          item.classList.remove('col-span-2');
        }
      });
      return;
    }

    // Show media from featured image until the next variant's featured image
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

    const scrollContainer = document.querySelector(
      '[data-product-gallery-scroll]'
    );
    if (scrollContainer && window.innerWidth < 1024) {
      scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  function scrollToMedia(variant) {
    if (!variant.featured_media_id) return;

    const mediaEl = document.querySelector(
      `[data-media-id="${variant.featured_media_id}"]`
    );
    if (!mediaEl) return;

    const scrollContainer = document.querySelector(
      '[data-product-gallery-scroll]'
    );
    if (scrollContainer && window.innerWidth < 1024) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const mediaRect = mediaEl.getBoundingClientRect();
      const scrollLeft =
        scrollContainer.scrollLeft + (mediaRect.left - containerRect.left);
      scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      return;
    }

    mediaEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateOptionButtons(options) {
    optionButtons.forEach((btn) => {
      const index = parseInt(btn.dataset.optionIndex);
      const value = btn.dataset.optionValue;
      const isSelected = options[index] === value;
      const isColor = btn.classList.contains('variant-option--color');

      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      if (isColor) {
        if (isSelected) {
          btn.classList.add('border-foreground', 'ring-2', 'ring-foreground/20');
          btn.classList.remove('border-border');
        } else {
          btn.classList.remove('border-foreground', 'ring-2', 'ring-foreground/20');
          btn.classList.add('border-border');
        }
      } else {
        if (isSelected) {
          btn.classList.add('border-foreground', 'bg-foreground', 'text-background');
          btn.classList.remove('border-border');
        } else {
          btn.classList.remove('border-foreground', 'bg-foreground', 'text-background');
          btn.classList.add('border-border');
        }
      }
    });

    selectedOptionLabels.forEach((label) => {
      const index = parseInt(label.dataset.selectedOption);
      if (options[index]) {
        label.textContent = options[index];
      }
    });
  }

  function updateAvailability(options) {
    optionButtons.forEach((btn) => {
      const index = parseInt(btn.dataset.optionIndex);
      const value = btn.dataset.optionValue;

      const testOptions = [...options];
      testOptions[index] = value;
      const variant = findVariant(testOptions);

      btn.classList.remove('variant-unavailable', 'variant-sold-out');

      if (!variant) {
        btn.classList.add('variant-unavailable');
      } else if (!variant.available) {
        btn.classList.add('variant-sold-out');
      }
    });
  }

  optionButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.optionIndex);
      const value = btn.dataset.optionValue;

      selectedOptions[index] = value;

      const variant = findVariant(selectedOptions);
      if (!variant) return;

      updateOptionButtons(selectedOptions);
      updateAvailability(selectedOptions);
      updatePrice(variant);
      updateForm(variant);
      updateURL(variant.id);
      filterMediaByVariant(variant);
      scrollToMedia(variant);
    });
  });

  updateAvailability(selectedOptions);
  if (currentVariant) {
    filterMediaByVariant(currentVariant);
  }
});
