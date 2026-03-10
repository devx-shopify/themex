const initAccordions = () => {
  const accordions = document.querySelectorAll('[data-accordion]');

  for (const accordion of accordions) {
    const trigger = accordion.querySelector('[data-accordion-trigger]');
    const content = accordion.querySelector('[data-accordion-content]');
    const iconElement = accordion.querySelector('[data-accordion-icon]');

    if (!trigger || !content) continue;
    if (trigger.dataset.accordionInitialized === 'true') continue;
    trigger.dataset.accordionInitialized = 'true';

    const iconType = iconElement?.dataset.accordionIconType ?? 'plus-minus';
    const iconPlus = accordion.querySelector('[data-accordion-icon-plus]');
    const iconMinus = accordion.querySelector('[data-accordion-icon-minus]');
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';

    if (isOpen) {
      content.style.maxHeight = `${content.scrollHeight}px`;
      updateIcon(iconType, iconElement, iconPlus, iconMinus, true);
    } else {
      content.style.maxHeight = '0px';
      updateIcon(iconType, iconElement, iconPlus, iconMinus, false);
      toggleFocusable(content, false);
    }

    trigger.addEventListener('click', () => {
      const isCurrentlyOpen = trigger.getAttribute('aria-expanded') === 'true';
      const newState = !isCurrentlyOpen;

      trigger.setAttribute('aria-expanded', newState);
      content.setAttribute('aria-hidden', !newState);
      toggleFocusable(content, newState);

      if (newState) {
        content.style.maxHeight = `${content.scrollHeight}px`;
      } else {
        content.style.maxHeight = '0px';
      }

      updateIcon(iconType, iconElement, iconPlus, iconMinus, newState);
    });
  }
};

const updateIcon = (type, iconElement, iconPlus, iconMinus, isOpen) => {
  if (type === 'chevron' && iconElement) {
    if (isOpen) {
      iconElement.classList.add('rotate-180');
    } else {
      iconElement.classList.remove('rotate-180');
    }
    return;
  }

  if (iconPlus) {
    if (isOpen) {
      iconPlus.classList.add('hidden');
    } else {
      iconPlus.classList.remove('hidden');
    }
  }

  if (iconMinus) {
    if (isOpen) {
      iconMinus.classList.remove('hidden');
    } else {
      iconMinus.classList.add('hidden');
    }
  }
};

const toggleFocusable = (container, isOpen) => {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const elements = container.querySelectorAll(selectors);

  for (const element of elements) {
    if (isOpen) {
      const original = element.dataset.originalTabindex;
      if (original !== undefined) {
        if (original === 'null' || original === '') {
          element.removeAttribute('tabindex');
        } else {
          element.setAttribute('tabindex', original);
        }
        delete element.dataset.originalTabindex;
      }
      continue;
    }

    const currentTabindex = element.getAttribute('tabindex');
    element.dataset.originalTabindex = currentTabindex ?? 'null';
    element.setAttribute('tabindex', '-1');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
});

const accordionObserver = new MutationObserver(() => {
  initAccordions();
});

accordionObserver.observe(document.body, {
  childList: true,
  subtree: true,
});
