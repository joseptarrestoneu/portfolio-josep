const root = document.documentElement;
const header = document.querySelector('[data-header]');
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector('[data-nav]');
const themeToggle = document.querySelector('[data-theme-toggle]');
const year = document.querySelector('[data-year]');

const themeMeta = document.querySelector('meta[name="theme-color"]');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme() {
  try {
    const theme = localStorage.getItem('portfolio-theme');
    return theme === 'dark' || theme === 'light' ? theme : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (themeMeta) themeMeta.content = theme === 'dark' ? '#10110f' : '#f3f1eb';
}

applyTheme(storedTheme() || (systemDark.matches ? 'dark' : 'light'));
systemDark.addEventListener('change', (event) => {
  if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light');
});

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
  applyTheme(nextTheme);
  try {
    localStorage.setItem('portfolio-theme', nextTheme);
  } catch {
    /* sense emmagatzematge: el tema només dura aquesta visita */
  }
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

// Esdeveniments de GoatCounter (la web és d'una sola pàgina: els clics són el que ens diu què funciona)
function trackEvent(name) {
  if (name && window.goatcounter && typeof window.goatcounter.count === 'function') {
    window.goatcounter.count({ path: name, event: true });
  }
}

// Panell de detall que s'expandeix des de la targeta
const detailState = { panel: null, trigger: null, card: null, rect: null, pushed: false };

// El panell neix i mor amb la mida exacta de la targeta (sense comptar l'escala temporal ni la barra de desplaçament)
function applyClip(panel, rect, radius) {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  panel.style.setProperty('--clip-top', `${Math.max(rect.top, 0)}px`);
  panel.style.setProperty('--clip-left', `${Math.max(rect.left, 0)}px`);
  panel.style.setProperty('--clip-right', `${Math.max(viewportWidth - rect.right, 0)}px`);
  panel.style.setProperty('--clip-bottom', `${Math.max(viewportHeight - rect.bottom, 0)}px`);
  panel.style.setProperty('--clip-radius', radius);
}

function setBackgroundInert(isInert) {
  document.querySelectorAll('.site-header, main').forEach((element) => {
    element.inert = isInert;
  });
}

function openDetail(id, trigger, { animate = true, push = true } = {}) {
  const panel = document.getElementById(id);
  if (!panel || detailState.panel) return;
  const card = trigger ? trigger.closest('.project-card') : null;

  detailState.panel = panel;
  detailState.trigger = trigger;
  detailState.card = card;

  if (card) {
    card.getAnimations().forEach((animation) => animation.finish());
    detailState.rect = card.getBoundingClientRect();
    detailState.radius = getComputedStyle(card).borderTopLeftRadius;
  }
  if (card && animate) {
    applyClip(panel, detailState.rect, detailState.radius);
    card.classList.add('is-pressed');
  }

  panel.hidden = false;
  panel.scrollTop = 0;
  document.body.classList.add('detail-open');
  setBackgroundInert(true);

  if (animate && card) {
    void panel.offsetWidth;
    panel.classList.add('is-open');
  } else {
    panel.style.transition = 'none';
    panel.classList.add('is-open');
    void panel.offsetWidth;
    panel.style.transition = '';
  }

  if (push) {
    history.pushState({ detail: id }, '', `#${id}`);
    detailState.pushed = true;
  }
  panel.querySelector('[data-detail-close]').focus({ preventScroll: true });
}

function finishCloseDetail() {
  const { panel, trigger, card } = detailState;
  if (!panel) return;
  panel.hidden = true;
  panel.style.removeProperty('--clip-top');
  panel.style.removeProperty('--clip-right');
  panel.style.removeProperty('--clip-bottom');
  panel.style.removeProperty('--clip-left');
  panel.style.removeProperty('--clip-radius');
  document.body.classList.remove('detail-open');
  setBackgroundInert(false);
  if (card) card.classList.remove('is-pressed');
  if (location.hash === '#' + panel.id) history.replaceState(null, '', location.pathname + location.search);
  if (trigger) trigger.focus({ preventScroll: true });
  detailState.panel = null;
  detailState.trigger = null;
  detailState.card = null;
  detailState.rect = null;
  detailState.pushed = false;
}

function closeDetail() {
  const { panel, card } = detailState;
  if (!panel || !panel.classList.contains('is-open')) return;
  if (card && detailState.rect) {
    applyClip(panel, detailState.rect, detailState.radius);
    card.classList.remove('is-pressed');
  }
  panel.classList.remove('is-open');
  window.setTimeout(finishCloseDetail, card ? 800 : 0);
}

function requestCloseDetail() {
  if (!detailState.panel) return;
  if (detailState.pushed) {
    history.back();
  } else {
    closeDetail();
  }
}

document.querySelectorAll('[data-detail-close]').forEach((button) => {
  button.addEventListener('click', requestCloseDetail);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && detailState.panel) requestCloseDetail();
});

window.addEventListener('popstate', () => {
  if (detailState.panel && !(history.state && history.state.detail)) {
    closeDetail();
  }
});

const deepLink = location.hash ? document.querySelector(`[data-detail="${CSS.escape(location.hash.slice(1))}"]`) : null;
if (deepLink) {
  openDetail(deepLink.dataset.detail, deepLink, { animate: false, push: false });
}

document.querySelectorAll('[data-carousel]').forEach((carousel) => {
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

  const mobile = window.matchMedia('(max-width: 560px)');

  function fitHeight() {
    if (mobile.matches) {
      carousel.style.setProperty('--stage-h', `${cards[active].offsetHeight}px`);
    } else {
      carousel.style.removeProperty('--stage-h');
    }
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
    fitHeight();
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
        return;
      }
      const tracked = event.target.closest('[data-track]');
      if (tracked) trackEvent(tracked.dataset.track);
      const trigger = event.target.closest('[data-detail]');
      if (trigger) {
        event.preventDefault();
        openDetail(trigger.dataset.detail, trigger);
      }
    });
  });

  window.addEventListener('resize', fitHeight);
  window.addEventListener('load', fitHeight);
  track.querySelectorAll('img').forEach((image) => image.addEventListener('load', fitHeight));

  render();
});
