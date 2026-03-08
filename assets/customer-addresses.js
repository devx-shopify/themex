document.addEventListener('DOMContentLoaded', () => {
  const newAddressForm = document.querySelector('[data-new-address-form]');
  document.querySelectorAll('[data-toggle-new-address]').forEach((btn) => {
    btn.addEventListener('click', () => {
      newAddressForm?.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('[data-edit-address]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editAddress;
      const display = document.querySelector(`[data-address-display="${id}"]`);
      const edit = document.querySelector(`[data-address-edit="${id}"]`);
      display?.classList.add('hidden');
      edit?.classList.remove('hidden');
    });
  });

  document.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cancelEdit;
      const display = document.querySelector(`[data-address-display="${id}"]`);
      const edit = document.querySelector(`[data-address-edit="${id}"]`);
      edit?.classList.add('hidden');
      display?.classList.remove('hidden');
    });
  });

  initCountryProvinceSelectors();
});

function initCountryProvinceSelectors() {
  const countrySelects = document.querySelectorAll(
    '[data-address-country-select]'
  );

  countrySelects.forEach((countrySelect) => {
    const form = countrySelect.closest('form');
    if (!form) return;

    const provinceSelect = form.querySelector(
      '[data-address-province-select]'
    );
    if (!provinceSelect) return;

    const defaultCountry = countrySelect.dataset.default;
    const defaultProvince = provinceSelect.dataset.default;

    if (defaultCountry) {
      const options = countrySelect.options;
      for (let i = 0; i < options.length; i++) {
        if (options[i].value === defaultCountry) {
          countrySelect.selectedIndex = i;
          break;
        }
      }
    }

    countrySelect.addEventListener('change', () => {
      updateProvinces(countrySelect, provinceSelect, null);
    });

    updateProvinces(countrySelect, provinceSelect, defaultProvince);
  });
}

function updateProvinces(countrySelect, provinceSelect, defaultProvince) {
  const selectedOption = countrySelect.options[countrySelect.selectedIndex];
  if (!selectedOption) return;

  const provinces = selectedOption.dataset.provinces;
  provinceSelect.innerHTML = '';

  if (provinces) {
    const parsed = JSON.parse(provinces);
    const provinceWrapper = provinceSelect.closest('div');

    if (parsed.length > 0) {
      parsed.forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        if (defaultProvince && code === defaultProvince) {
          option.selected = true;
        }
        provinceSelect.appendChild(option);
      });
      provinceWrapper?.classList.remove('hidden');
    } else {
      provinceWrapper?.classList.add('hidden');
    }
  }
}
