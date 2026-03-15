document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('change', (event) => {
    const radio = event.target.closest('[data-selling-plan-radio]');
    if (!radio) return;

    const form = radio.closest('product-form');
    if (!form) return;

    const hiddenInput = form.querySelector('[data-selling-plan-input]');
    if (!hiddenInput) return;

    hiddenInput.value = radio.value;
  });
});
