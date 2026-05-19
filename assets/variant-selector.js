class VariantSelector extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const dataScript = this.querySelector('[data-variant-data]');
    if (!dataScript) return;

    try {
      this.variantData = JSON.parse(dataScript.textContent);
    } catch {
      return;
    }

    this.variants = this.variantData.variants;
    this.productOptions = this.variantData.options;
    this.productId = this.dataset.productId;
    this.optionButtons = [...this.querySelectorAll('[data-option-value]')];
    this.selectedOptions = this.getInitialSelectedOptions();

    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-option-value]');
      if (!button) return;

      const index = parseInt(button.dataset.optionIndex, 10);
      const value = button.dataset.optionValue;

      this.selectedOptions[index] = value;

      const variant = this.findVariant(this.selectedOptions);
      this.fillMissingOptions(variant);

      this.updateButtonStates();
      this.updateAvailability();

      publish(PUB_SUB_EVENTS.variantChange, {
        productId: this.productId,
        variant,
      });
    });

    this.updateAvailability();
  }

  disconnectedCallback() {
    this.initialized = false;
  }

  getInitialSelectedOptions() {
    const options = [];
    if (!this.productOptions) return options;

    this.productOptions.forEach((option, index) => {
      const activeButton = this.querySelector(
        `[data-option-index="${index}"][aria-pressed="true"]`
      );
      if (activeButton) {
        options[index] = activeButton.dataset.optionValue;
      } else {
        options[index] = option.values?.[0] ?? '';
      }
    });

    return options;
  }

  findVariant(selectedOptions) {
    const exactMatch = this.variants.find((v) =>
      v.options.every((opt, i) => opt === selectedOptions[i])
    );
    if (exactMatch) return exactMatch;

    const displayedIndices = this.getDisplayedIndices();

    const partialMatch = this.variants.find((v) =>
      v.options.every((opt, i) => {
        if (!displayedIndices.has(i)) return true;
        return opt === selectedOptions[i];
      })
    );

    return partialMatch ?? null;
  }

  fillMissingOptions(variant) {
    if (!variant) return;
    const displayedIndices = this.getDisplayedIndices();
    variant.options.forEach((opt, i) => {
      if (!displayedIndices.has(i)) {
        this.selectedOptions[i] = opt;
      }
    });
  }

  getDisplayedIndices() {
    return new Set(
      this.optionButtons.map((btn) => parseInt(btn.dataset.optionIndex, 10))
    );
  }

  updateButtonStates() {
    this.optionButtons.forEach((btn) => {
      const index = parseInt(btn.dataset.optionIndex, 10);
      const value = btn.dataset.optionValue;
      const isSelected = this.selectedOptions[index] === value;
      const isColor = btn.dataset.isColor === 'true';

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
        const isFilled = btn.dataset.pillStyle === 'filled';
        if (isSelected) {
          btn.classList.add('border-foreground', 'bg-foreground', 'text-background');
          btn.classList.remove('border-border', 'border-foreground/20', 'bg-foreground/5');
        } else if (isFilled) {
          btn.classList.remove('border-foreground', 'bg-foreground', 'text-background', 'border-border');
          btn.classList.add('border-foreground/20', 'bg-foreground/5');
        } else {
          btn.classList.remove('border-foreground', 'bg-foreground', 'text-background', 'border-foreground/20', 'bg-foreground/5');
          btn.classList.add('border-border');
        }
      }
    });

    this.querySelectorAll('[data-selected-option]').forEach((label) => {
      const index = parseInt(label.dataset.selectedOption, 10);
      if (this.selectedOptions[index]) {
        label.textContent = this.selectedOptions[index];
      }
    });
  }

  updateAvailability() {
    const displayedIndices = this.getDisplayedIndices();

    this.optionButtons.forEach((btn) => {
      const index = parseInt(btn.dataset.optionIndex, 10);
      const value = btn.dataset.optionValue;

      const candidateSelection = [...this.selectedOptions];
      candidateSelection[index] = value;

      const available = this.variants.some((v) =>
        v.available &&
        v.options.every((opt, i) => {
          if (!displayedIndices.has(i)) return true;
          return opt === candidateSelection[i];
        })
      );

      btn.toggleAttribute('disabled', !available);
      btn.classList.toggle('opacity-40', !available);
    });
  }
}

if (!customElements.get('variant-selector')) {
  customElements.define('variant-selector', VariantSelector);
}
