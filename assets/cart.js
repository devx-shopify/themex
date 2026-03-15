document.addEventListener('DOMContentLoaded', () => {
  const sectionContainer = document.querySelector('[data-cart-page]');
  if (!sectionContainer) return;

  const sectionId = sectionContainer.dataset.sectionId;
  const debounceTimers = {};
  let noteTimer = null;

  const getSectionHtml = (sectionHtml) => {
    const parsed = new DOMParser().parseFromString(sectionHtml, 'text/html');
    return parsed.querySelector('[data-cart-page]');
  };

  const renderSection = (data) => {
    const html = data.sections?.[sectionId];
    if (!html) return;

    const newContent = getSectionHtml(html);
    if (!newContent) return;

    sectionContainer.innerHTML = newContent.innerHTML;
    updateCartCount(data.item_count ?? 0);
  };

  const showLineLoading = (line) => {
    const overlay = sectionContainer.querySelector(`[data-line-loading="${line}"]`);
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    }
  };

  const hideLineLoading = (line) => {
    const overlay = sectionContainer.querySelector(`[data-line-loading="${line}"]`);
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  };

  const handleQuantityChange = (button, delta) => {
    const line = parseInt(button.dataset.lineIndex, 10);
    const input = sectionContainer.querySelector(`[data-quantity-input][data-line-index="${line}"]`);
    if (!input) return;

    const currentQty = parseInt(input.value, 10);
    const newQty = Math.max(0, Math.min(99, currentQty + delta));
    if (newQty === currentQty) return;

    clearTimeout(debounceTimers[line]);
    debounceTimers[line] = setTimeout(async () => {
      showLineLoading(line);
      try {
        const data = await CartAPI.change(line, newQty, [sectionId]);
        renderSection(data);
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-page', cartData: data });
      } catch (error) {
        hideLineLoading(line);
        publish(PUB_SUB_EVENTS.cartError, { source: 'cart-page', error });
      }
    }, 300);
  };

  const handleRemove = async (button) => {
    const line = parseInt(button.dataset.lineIndex, 10);
    showLineLoading(line);
    try {
      const data = await CartAPI.change(line, 0, [sectionId]);
      renderSection(data);
      publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-page', cartData: data });
    } catch (error) {
      hideLineLoading(line);
      publish(PUB_SUB_EVENTS.cartError, { source: 'cart-page', error });
    }
  };

  const handleNoteChange = (textarea) => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(async () => {
      try {
        await CartAPI.update({ note: textarea.value });
      } catch (error) {
        publish(PUB_SUB_EVENTS.cartError, { source: 'cart-page', error });
      }
    }, 500);
  };

  sectionContainer.addEventListener('click', (event) => {
    const minusBtn = event.target.closest('[data-quantity-minus]');
    const plusBtn = event.target.closest('[data-quantity-plus]');
    const removeBtn = event.target.closest('[data-remove-item]');

    if (minusBtn) {
      handleQuantityChange(minusBtn, -1);
    } else if (plusBtn) {
      handleQuantityChange(plusBtn, 1);
    } else if (removeBtn) {
      handleRemove(removeBtn);
    }
  });

  sectionContainer.addEventListener('input', (event) => {
    if (event.target.closest('[data-cart-note]')) {
      handleNoteChange(event.target);
    }
  });

  subscribe(PUB_SUB_EVENTS.cartUpdate, (data) => {
    if (data.source === 'cart-page') return;
    CartAPI.get()
      .then((cartData) => {
        updateCartCount(cartData.item_count ?? 0);
      })
      .catch(() => {});
  });
});
