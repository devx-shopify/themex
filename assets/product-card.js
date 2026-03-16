document.addEventListener('DOMContentLoaded', () => {
  if (typeof subscribe === 'undefined' || typeof PUB_SUB_EVENTS === 'undefined') return;

  subscribe(PUB_SUB_EVENTS.variantChange, (data) => {
    const { productId, variant } = data;
    if (!productId || !variant) return;

    const cards = document.querySelectorAll(`[data-product-card][data-product-id="${productId}"]`);
    if (!cards.length) return;

    cards.forEach((card) => {
      const image = card.querySelector('[data-product-card-image]');
      const titleLink = card.querySelector('[data-product-card-title-link]');
      const priceEl = card.querySelector('[data-product-card-price]');
      const comparePriceEl = card.querySelector('[data-product-card-compare-price]');

      if (image && variant.image) {
        image.src = variant.image;
      }

      if (titleLink) {
        const url = new URL(titleLink.href);
        url.searchParams.set('variant', variant.id);
        titleLink.href = url.toString();
      }

      if (priceEl) {
        priceEl.textContent = variant.price_formatted;
      }

      if (comparePriceEl) {
        if (variant.compare_at_price > variant.price) {
          comparePriceEl.textContent = variant.compare_at_price_formatted;
          comparePriceEl.classList.remove('hidden');
        } else {
          comparePriceEl.classList.add('hidden');
        }
      }
    });
  });
});
