/**
 * Product Page — Variant Switcher
 *
 * Handles variant option selection, price updates,
 * media scrolling, URL updates, form state, and
 * unavailable variant indication.
 */
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

  // Current selected options (array matching product.options order)
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

    const selectedColor = variant.options[colorIndex];

    // Collect featured_media_ids from all variants with the same color
    const mediaIds = new Set(
      productData.variants
        .filter((v) => v.options[colorIndex] === selectedColor)
        .map((v) => v.featured_media_id)
        .filter((id) => id != null)
    );

    const allMediaItems = document.querySelectorAll('[data-media-id]');

    // If no media IDs found for this color, show all media
    if (mediaIds.size === 0) {
      allMediaItems.forEach((item) => item.classList.remove('hidden'));
      return;
    }

    allMediaItems.forEach((item) => {
      const mediaId = Number(item.dataset.mediaId);
      if (mediaIds.has(mediaId)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });

    // Reset mobile gallery scroll position
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

    // Mobile: horizontal scroll container
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

    // Desktop: scroll into view
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
      const isColor = btn.classList.contains('variant-option--color');

      // Build test options: current selections but with this button's value
      const testOptions = [...options];
      testOptions[index] = value;
      const variant = findVariant(testOptions);

      // Reset states
      btn.classList.remove('variant-unavailable', 'variant-sold-out');

      if (!variant) {
        // No variant exists for this combination
        btn.classList.add('variant-unavailable');
      } else if (!variant.available) {
        // Variant exists but is sold out
        btn.classList.add('variant-sold-out');
      }
    });
  }

  // Event listeners
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

  // Initial availability check and media filtering
  updateAvailability(selectedOptions);
  if (currentVariant) {
    filterMediaByVariant(currentVariant);
  }
});
