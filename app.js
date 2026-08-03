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
