const root = document.documentElement;
const header = document.querySelector('[data-header]');
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector('[data-nav]');
const themeToggle = document.querySelector('[data-theme-toggle]');
const year = document.querySelector('[data-year]');

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme === 'dark' || savedTheme === 'light') {
  root.dataset.theme = savedTheme;
}

year.textContent = new Date().getFullYear();

function closeMenu() {
  nav.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

menuButton.addEventListener('click', () => {
  const willOpen = !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', willOpen);
  menuButton.setAttribute('aria-expanded', String(willOpen));
  document.body.classList.toggle('menu-open', willOpen);
  if (!willOpen) {nav.scrollTop = 0;}
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeMenu);
});

themeToggle.addEventListener('click', () => {
  const currentTheme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = nextTheme;
  localStorage.setItem('portfolio-theme', nextTheme);
});

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 24);
}

window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

const carousel = document.querySelector('[data-carousel]');

if (carousel) {
  const track = carousel.querySelector('[data-carousel-track]');
  const cards = [...track.querySelectorAll('.project-card')];
  const count = carousel.querySelector('[data-carousel-count]');
  const total = cards.length;
  const pad = (value) => String(value).padStart(2, '0');
  let active = 0;
  let dragStartX = null;
  let dragged = false;

  cards.forEach((card) => card.classList.remove('reveal'));
  track.querySelectorAll('a, img').forEach((element) => { element.draggable = false; });

  function wrapOffset(offset) {
    return ((offset + total / 2) % total + total) % total - total / 2;
  }

  function render() {
    cards.forEach((card, index) => {
      const offset = wrapOffset(index - active);
      const distance = Math.abs(offset);
      const isActive = distance === 0;
      card.style.setProperty('--offset', offset);
      card.style.setProperty('--abs', Math.min(distance, 3));
      card.classList.toggle('is-active', isActive);
      card.classList.toggle('is-hidden', distance > 2);
      card.setAttribute('aria-hidden', String(!isActive));
      card.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', isActive ? '0' : '-1'));
    });
    count.textContent = `${pad(active + 1)} / ${pad(total)}`;
  }

  function goTo(index) {
    active = ((index % total) + total) % total;
    render();
  }

  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => goTo(active - 1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => goTo(active + 1));

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(active + 1); }
  });

  track.addEventListener('pointerdown', (event) => {
    dragStartX = event.clientX;
    dragged = false;
  });

  track.addEventListener('pointerup', (event) => {
    if (dragStartX === null) return;
    const distance = event.clientX - dragStartX;
    dragStartX = null;
    if (Math.abs(distance) > 50) {
      dragged = true;
      goTo(active + (distance < 0 ? 1 : -1));
    }
  });

  track.addEventListener('pointercancel', () => { dragStartX = null; });

  cards.forEach((card, index) => {
    card.addEventListener('click', (event) => {
      if (dragged) {
        event.preventDefault();
        dragged = false;
        return;
      }
      if (index !== active) {
        event.preventDefault();
        goTo(index);
      }
    });
  });

  render();
}
