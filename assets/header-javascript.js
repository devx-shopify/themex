document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('mobile-menu-trigger');
  const drawer = document.getElementById('mobile-menu-drawer');

  if (!trigger || !drawer) return;

  const panel = drawer.querySelector('.mobile-menu-panel');
  const backdrop = drawer.querySelector('.mobile-menu-backdrop');
  const header = document.getElementById('mobile-header');
  let isOpen = false;

  function openMenu() {
    isOpen = true;
    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');

    if (header) header.classList.add('menu-open');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        backdrop.classList.add('opacity-100');
        panel.classList.remove('-translate-x-full');
        panel.classList.add('translate-x-0');
      });
    });
  }

  function closeMenu() {
    isOpen = false;
    trigger.setAttribute('aria-expanded', 'false');

    if (header) header.classList.remove('menu-open');

    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    panel.classList.remove('translate-x-0');
    panel.classList.add('-translate-x-full');

    setTimeout(() => {
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden');
    }, 300);
  }

  trigger.addEventListener('click', () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  drawer.addEventListener('click', (e) => {
    if (e.target.closest('[data-mobile-menu-close]')) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });

  let lastScroll = 0;
  const mainHeader = document.getElementById('main-header');

  if (mainHeader) {
    window.addEventListener(
      'scroll',
      () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 10) {
          mainHeader.classList.add('shadow-sm');
        } else {
          mainHeader.classList.remove('shadow-sm');
        }
        lastScroll = currentScroll;
      },
      { passive: true }
    );
  }
});
