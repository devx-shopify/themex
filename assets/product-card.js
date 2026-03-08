document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const swatch = e.target.closest('.product-card__swatch');
    if (!swatch) return;

    const card = swatch.closest('[data-product-card]');
    if (!card) return;

    const image = card.querySelector('[data-product-card-image]');
    const link = card.querySelector('[data-product-card-link]');
    const titleLink = card.querySelector('[data-product-card-title-link]');
    const priceEl = card.querySelector('[data-product-card-price]');
    const comparePriceEl = card.querySelector('[data-product-card-compare-price]');

    const allSwatches = card.querySelectorAll('.product-card__swatch');
    allSwatches.forEach((s) => {
      s.classList.remove('border-foreground');
      s.classList.add('border-border');
      s.setAttribute('aria-pressed', 'false');
    });
    swatch.classList.remove('border-border');
    swatch.classList.add('border-foreground');
    swatch.setAttribute('aria-pressed', 'true');

    const newImage = swatch.dataset.swatchImage;
    if (image && newImage) {
      image.src = newImage;
    }

    const newUrl = swatch.dataset.swatchUrl;
    if (newUrl) {
      if (link) link.href = newUrl;
      if (titleLink) titleLink.href = newUrl;
    }

    const newPrice = swatch.dataset.swatchPrice;
    if (priceEl && newPrice) {
      priceEl.textContent = newPrice;
    }

    const newComparePrice = swatch.dataset.swatchComparePrice;
    if (comparePriceEl) {
      if (newComparePrice) {
        comparePriceEl.textContent = newComparePrice;
        comparePriceEl.classList.remove('hidden');
      } else {
        comparePriceEl.classList.add('hidden');
      }
    }
  });
});
