/* Volta a Nadal · frontend. Les dades viuen a MongoDB, darrere de l'API (carpeta backend); aquesta pàgina només les mostra. */
(function () {
'use strict';

const $ = id => document.getElementById(id);
const cfg = window.ADVENT_CONFIG || {};
const MONTHS = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
const MSHORT = ['gen','febr','març','abr','maig','juny','jul','ag','set','oct','nov','des'];
const LEVELS = [[2000,'Campió de la volta'],[1200,'Escalador'],[500,'Gregari'],[0,'Ciclista de cafè']];
const ALIAS_RE = /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._-]{1,18}[A-Za-zÀ-ÿ0-9]$/;

const API = String(cfg.API_URL || '').replace(/\/$/, '');
const googleClientId = cfg.GOOGLE_CLIENT_ID || '';
let gReady = false;
const gQueue = [];

let CONTENT = [];
const CUR_LOCKED = 'Respon la pregunta d’aquesta etapa i descobriràs la curiositat que la completa.';
const S = { raw: 0, today: 0, start: '2026-12-01', session: null, profile: null, progress: {}, answers: {}, lb: { rows: [], me: null } };
let current = null, lastFocus = null, toastTimer = null, refreshing = false, again = false;

/* ---------- utilitats ---------- */
function mk(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function dateOf(d) { const p = S.start.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2] + d - 1); }
function deMonth(m) { return /^[aeiou]/.test(MONTHS[m]) ? "d'" + MONTHS[m] : 'de ' + MONTHS[m]; }
function longDate(d) { const x = dateOf(d); return x.getDate() + ' ' + deMonth(x.getMonth()); }
function shortDate(d) { const x = dateOf(d); return x.getDate() + ' ' + MSHORT[x.getMonth()]; }
function levelFor(p) { for (const l of LEVELS) if (p >= l[0]) return l[1]; return LEVELS[LEVELS.length - 1][1]; }
function unlocked(d) { return d <= S.today; }
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
}
const ERRORS = {
  not_authenticated: 'Cal entrar amb Google.',
  no_profile: "Primer acaba l'alta amb el teu àlies.",
  locked: "Aquesta etapa encara no està oberta.",
  already_answered: 'Ja havies respost aquesta pregunta.',
  alias_taken: 'Aquest àlies ja està agafat. Prova’n un altre.',
  alias_invalid: 'L’àlies ha de tenir de 3 a 20 caràcters: lletres, números, espai, punt, guió o guió baix.',
  profile_exists: 'Ja tens un perfil creat.',
  bad_choice: 'Resposta no vàlida.',
  invalid_credential: 'Google no ha confirmat el teu accés. Torna-ho a provar.',
  forbidden: 'Petició no permesa.'
};
function errText(e) {
  const m = (e && e.message) || '';
  if (ERRORS[m]) return ERRORS[m];
  return 'No hem pogut connectar. Torna-ho a provar d’aquí a un moment.';
}
const ROUTES = {
  get_today:       () => ['GET', '/api/today'],
  get_state:       () => ['GET', '/api/state'],
  get_leaderboard: a => ['GET', '/api/leaderboard?limit=' + a.p_limit],
  create_profile:  a => ['POST', '/api/profile', { alias: a.p_alias, newsletter: a.p_newsletter }],
  set_newsletter:  a => ['POST', '/api/newsletter', { on: a.p_on }],
  get_question:    a => ['GET', '/api/question/' + a.p_day],
  answer_question: a => ['POST', '/api/answer', { day: a.p_day, choice: a.p_choice }],
  open_day:        a => ['POST', '/api/open', { day: a.p_day }],
  set_challenge:   a => ['POST', '/api/challenge', { day: a.p_day, done: a.p_done }]
};
async function call(name, args) {
  const r = ROUTES[name](args || {});
  let res;
  try {
    res = await fetch(API + r[1], { method: r[0], credentials: 'include', headers: r[2] ? { 'Content-Type': 'application/json' } : {}, body: r[2] ? JSON.stringify(r[2]) : undefined });
  } catch (e) { throw new Error('network'); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* sense cos */ }
  if (!res.ok) throw new Error((data && data.error) || 'server');
  return data;
}
function localDays() {
  const p = S.start.split('-').map(Number);
  const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t0 - new Date(p[0], p[1] - 1, p[2])) / 864e5) + 1;
}

/* ---------- càrrega d'estat ---------- */
async function refresh() {
  if (refreshing) { again = true; return; }
  refreshing = true;
  try {
    try { const t = await call('get_today'); S.raw = t.raw; S.today = t.day; S.start = t.start; }
    catch (e) { S.raw = localDays(); S.today = Math.min(24, Math.max(0, S.raw)); }
    S.session = false; S.profile = null; S.progress = {}; S.answers = {};
    try {
      const st = await call('get_state');
      S.session = true;
      S.profile = (st && st.profile) || null;
      ((st && st.progress) || []).forEach(p => { S.progress[p.day] = p; });
      ((st && st.answers) || []).forEach(a => { S.answers[a.day] = a; });
    } catch (e) { if (e.message !== 'not_authenticated') toast(errText(e)); }
    try { S.lb = await call('get_leaderboard', { p_limit: 50 }); } catch (e) { /* es manté l'anterior */ }
    renderAll();
    if (S.session && !S.profile) showOnboarding();
  } finally {
    refreshing = false;
    if (again) { again = false; refresh(); }
  }
}

/* ---------- accés (Google Identity Services) ---------- */
function gbutton(el) {
  if (gReady) window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'medium', text: 'signin_with', locale: 'ca', shape: 'rectangular' });
  else gQueue.push(el);
}
async function onCredential(resp) {
  try {
    const r = await fetch(API + '/api/auth/google', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'server'); }
    await refresh();
    if (current) { updateDoneBtn(); loadQuiz(current); }
  } catch (e) { toast(errText(e)); }
}
function startGoogle() {
  const go = () => {
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: onCredential, auto_select: false, ux_mode: 'popup' });
    gReady = true; gQueue.splice(0).forEach(gbutton);
  };
  if (window.google && window.google.accounts) { go(); return; }
  const sc = document.createElement('script');
  sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = go;
  document.head.appendChild(sc);
}
async function logout() {
  try { await fetch(API + '/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) { /* ok */ }
  if (gReady) window.google.accounts.id.disableAutoSelect();
  await refresh();
}
function focusLogin() { closePanel(); window.scrollTo(0, 0); const b = $('authbar').querySelector('[role=button],button'); if (b) b.focus(); }

function renderAuth() {
  const bar = $('authbar'); bar.innerHTML = '';
  if (!googleClientId || !API) {
    bar.appendChild(mk('span', '', 'Falta configurar la pàgina (fitxer config.js: API_URL i GOOGLE_CLIENT_ID).'));
    return;
  }
  if (!S.session) {
    bar.appendChild(mk('span', '', 'Entra amb Google per guardar els punts i sortir a la classificació.'));
    const slot = mk('div'); bar.appendChild(slot); gbutton(slot);
    return;
  }
  const me = mk('div', 'me');
  if (S.profile) {
    const hi = mk('span'); hi.append('Hola, ', mk('b', '', S.profile.alias));
    me.appendChild(hi);
    const lab = mk('label', 'inline'), cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!S.profile.newsletter; cb.id = 'news-toggle';
    cb.addEventListener('change', async () => {
      try { await call('set_newsletter', { p_on: cb.checked }); S.profile.newsletter = cb.checked; toast(cb.checked ? 'Rebràs el correu diari.' : 'T’has donat de baixa del correu diari.'); }
      catch (e) { cb.checked = !cb.checked; toast(errText(e)); }
    });
    lab.append(cb, document.createTextNode(' Rebre el correu diari'));
    me.appendChild(lab);
  } else {
    me.appendChild(mk('span', '', 'Has entrat, però falta triar l’àlies.'));
    const f = mk('button', 'btn pri sm', 'Acaba l’alta'); f.type = 'button'; f.addEventListener('click', showOnboarding);
    me.appendChild(f);
  }
  bar.appendChild(me);
  const out = mk('button', 'btn sm', 'Surt'); out.type = 'button'; out.addEventListener('click', logout);
  bar.appendChild(out);
}

/* ---------- alta ---------- */
function showOnboarding() {
  $('ob-err').hidden = true;
  $('ob').classList.add('on'); $('ob').setAttribute('aria-hidden', 'false');
  $('ob-alias').focus();
}
function hideOnboarding() { $('ob').classList.remove('on'); $('ob').setAttribute('aria-hidden', 'true'); }
$('ob-cancel').addEventListener('click', hideOnboarding);
$('ob-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('ob-err'), alias = $('ob-alias').value.trim();
  const fail = m => { err.textContent = m; err.hidden = false; };
  if (!ALIAS_RE.test(alias)) return fail(ERRORS.alias_invalid);
  if (!$('ob-terms').checked) return fail('Cal acceptar la política de privacitat i les bases per continuar.');
  $('ob-go').disabled = true;
  try {
    await call('create_profile', { p_alias: alias, p_newsletter: $('ob-news').checked });
    hideOnboarding(); toast('Perfil creat. Som-hi!');
    await refresh();
    if (current) loadQuiz(current);
  } catch (ex) { fail(errText(ex)); }
  $('ob-go').disabled = false;
});

/* ---------- pintat ---------- */
function bestRun() { let b = 0, r = 0; for (let d = 1; d <= 24; d++) { if (S.progress[d] && S.progress[d].done) { r++; if (r > b) b = r; } else r = 0; } return b; }
function points() { let p = 0; Object.keys(S.answers).forEach(k => { p += S.answers[k].points; }); return p; }

function renderStatus() {
  let t;
  if (S.raw < 1) {
    const n = 1 - S.raw;
    t = n === 1 ? "Demà s'obre la primera etapa." : 'Falten ' + n + ' dies perquè s’obri la primera etapa, el ' + longDate(1) + '.';
  } else if (S.raw <= 24 && CONTENT.length) t = 'Avui toca l’etapa ' + S.raw + ': ' + CONTENT[S.raw - 1].name + '.';
  else t = 'La volta ha acabat, però pots repassar les 24 etapes quan vulgui.';
  $('status').textContent = t;
}
function renderStats() {
  let o = 0, f = 0;
  Object.keys(S.progress).forEach(k => { o++; if (S.progress[k].done) f++; });
  $('s-open').textContent = o; $('s-done').textContent = f; $('s-run').textContent = bestRun();
  const p = points();
  $('s-pts').textContent = p; $('s-lvl').textContent = S.session ? levelFor(p) : 'punts del quiz';
}
function renderBars() {
  const bars = $('bars'), ticks = $('ticks'); bars.innerHTML = ''; ticks.innerHTML = '';
  CONTENT.forEach(x => {
    const d = x.day, pr = S.progress[d];
    const b = mk('div', 'bar' + (pr && pr.done ? ' done' : (pr ? ' open' : '')) + (d === S.raw ? ' today' : ''));
    b.style.height = (x.difficulty * 18 + 4) + '%';
    bars.appendChild(b);
    ticks.appendChild(mk('span', '', (d === 1 || d % 4 === 0) ? String(d) : ''));
  });
}
function renderGrid() {
  const grid = $('grid'); grid.innerHTML = '';
  CONTENT.forEach(x => {
    const d = x.day, un = unlocked(d), pr = S.progress[d], ans = un ? S.answers[d] : null;
    const done = !!(pr && pr.done);
    const b = mk('button', 'bib' + (un ? '' : ' locked') + (done ? ' done' : '') + (d === S.raw ? ' today' : ''));
    b.type = 'button'; b.id = 'bib-' + d;
    b.setAttribute('aria-label', 'Etapa ' + d + ', ' + longDate(d) + (un ? ': ' + x.name + (done ? ', repte fet' : '') + (ans ? (ans.points > 0 ? ', pregunta encertada' : ', pregunta fallada') : '') : ', encara tancada'));
    for (let i = 0; i < 4; i++) b.appendChild(mk('i', 'pin'));
    const top = mk('span', 'top'); top.appendChild(mk('span', 'date', shortDate(d)));
    if (ans) { const qm = mk('span', 'qm ' + (ans.points > 0 ? 'ok' : 'bad')); qm.setAttribute('aria-hidden', 'true'); qm.appendChild(mk('span', '', ans.points > 0 ? '✓' : '✕')); top.appendChild(qm); }
    b.append(top, mk('span', 'num', String(d).padStart(2, '0')));
    const foot = mk('span', 'foot');
    if (!un) foot.textContent = '🔒 Tancada'; else foot.textContent = (done ? '✓ ' : '') + x.name;
    b.appendChild(foot);
    b.addEventListener('click', () => openDay(d));
    grid.appendChild(b);
  });
}
function renderRank() {
  const tb = $('rank'); tb.innerHTML = '';
  const rows = (S.lb && S.lb.rows) || [], me = S.lb && S.lb.me;
  const add = (r, mine) => {
    const tr = mk('tr', mine ? 'me' : '');
    [r.rank, r.alias, r.points, r.correct + '/' + r.answered].forEach(v => tr.appendChild(mk('td', '', String(v))));
    tb.appendChild(tr);
  };
  if (!rows.length) {
    const tr = mk('tr'), td = mk('td', 'empty', 'Encara no hi ha cap punt. Obre una etapa i respon la pregunta!'); td.colSpan = 4; tr.appendChild(td); tb.appendChild(tr); return;
  }
  rows.forEach(r => add(r, me && r.rank === me.rank));
  if (me && !rows.some(r => r.rank === me.rank)) {
    const tr = mk('tr'), td = mk('td', 'empty', '…'); td.colSpan = 4; tr.appendChild(td); tb.appendChild(tr);
    add(me, true);
  }
}
function renderAll() { renderAuth(); renderStatus(); renderStats(); renderBars(); renderGrid(); renderRank(); }

/* ---------- targeta del dia ---------- */
function updateDoneBtn() {
  const b = $('b-done'), done = !!(S.progress[current] && S.progress[current].done);
  b.textContent = !S.session ? 'Entra amb Google per guardar el repte' : (done ? 'Repte fet ✓ (desfer)' : 'Marca el repte com a fet');
  b.className = 'btn' + (done && S.session ? '' : ' pri');
}
async function openDay(d) {
  if (!unlocked(d)) { toast("Aquesta etapa s'obre el " + longDate(d) + '.'); return; }
  const x = CONTENT[d - 1];
  current = d; lastFocus = $('bib-' + d);
  $('p-meta').textContent = 'Etapa ' + d + ' · ' + longDate(d);
  $('p-title').textContent = x.name;
  $('p-type').textContent = x.type;
  $('p-dif').innerHTML = [1, 2, 3, 4, 5].map(k => '<i class="' + (k <= x.difficulty ? 'f' : '') + '"></i>').join('');
  $('p-cur').textContent = CUR_LOCKED;
  $('p-tip-t').textContent = x.tip_title;
  $('p-tip').textContent = x.tip;
  $('p-rep').textContent = x.challenge;
  $('copybox').classList.remove('on');
  updateDoneBtn();
  $('overlay').classList.add('on'); $('overlay').setAttribute('aria-hidden', 'false');
  $('p-title').focus();
  loadQuiz(d);
  if (S.session && S.profile && !S.progress[d]) {
    try { await call('open_day', { p_day: d }); S.progress[d] = { day: d, done: false }; renderStats(); renderBars(); }
    catch (e) { /* no és crític */ }
  }
}
function closePanel() {
  $('overlay').classList.remove('on'); $('overlay').setAttribute('aria-hidden', 'true');
  const el = current ? $('bib-' + current) : null; current = null; if (el) el.focus();
}

async function loadQuiz(d) {
  const q = $('pq-q'), opts = $('pq-opts'), fb = $('pq-fb');
  opts.innerHTML = ''; fb.innerHTML = ''; fb.className = '';
  if (!S.session) {
    q.textContent = 'Entra amb Google per respondre i sumar punts.';
    const slot = mk('div'); fb.appendChild(slot); gbutton(slot);
    return;
  }
  if (!S.profile) {
    q.textContent = 'Acaba l’alta (triant un àlies) per respondre.';
    const b = mk('button', 'btn pri', 'Acaba l’alta'); b.type = 'button'; b.addEventListener('click', showOnboarding); fb.appendChild(b);
    return;
  }
  q.textContent = 'Carregant la pregunta…';
  try {
    const data = await call('get_question', { p_day: d });
    if (current !== d) return;
    renderQuestion(d, data);
  } catch (e) { if (current === d) q.textContent = errText(e); }
}
function renderQuestion(d, data) {
  const opts = $('pq-opts'), fb = $('pq-fb');
  const rot = (d * 3) % 4, order = [0, 1, 2, 3].map(k => (k + rot) % 4);
  const answered = data.chosen !== undefined && data.chosen !== null;
  $('pq-q').textContent = data.question;
  $('p-cur').textContent = answered && data.curiosity ? data.curiosity : CUR_LOCKED;
  opts.innerHTML = ''; fb.innerHTML = ''; fb.className = '';
  order.forEach((oi, pos) => {
    const b = mk('button', 'opt'); b.type = 'button';
    b.append(mk('span', 'k', 'ABCD'[pos]), mk('span', '', data.options[oi]));
    if (answered) {
      b.disabled = true;
      if (data.correct === 'all' || oi === data.correct) b.classList.add('right'); else if (oi === data.chosen) b.classList.add('wrong');
    } else b.addEventListener('click', () => answer(d, oi));
    opts.appendChild(b);
  });
  if (answered) {
    fb.className = 'fb';
    const p = mk('p'); p.append(mk('b', '', data.correct === 'all' ? 'Totes són bones respostes! +100 punts. ' : (data.points > 0 ? 'Correcte! +100 punts. ' : 'No és aquesta. ')), document.createTextNode(data.explanation));
    fb.appendChild(p);
  }
}
async function answer(d, oi) {
  Array.prototype.forEach.call($('pq-opts').children, b => { b.disabled = true; });
  try {
    const r = await call('answer_question', { p_day: d, p_choice: oi });
    S.answers[d] = { day: d, chosen: oi, points: r.points, correct: r.correct, explanation: r.explanation };
    if (current === d) {
      const data = await call('get_question', { p_day: d });
      renderQuestion(d, data);
    }
    try { S.lb = await call('get_leaderboard', { p_limit: 50 }); } catch (e) { /* ok */ }
    renderAll();
  } catch (e) {
    toast(errText(e));
    if (current === d) loadQuiz(d);
  }
}

$('b-done').addEventListener('click', async () => {
  if (!S.session) { focusLogin(); return; }
  if (!S.profile) { showOnboarding(); return; }
  const d = current, now = !(S.progress[d] && S.progress[d].done);
  try {
    await call('set_challenge', { p_day: d, p_done: now });
    S.progress[d] = { day: d, done: now };
    updateDoneBtn(); renderStats(); renderBars(); renderGrid();
    if (now) toast('Un repte més. Pedalem!');
  } catch (e) { toast(errText(e)); }
});
$('b-copy').addEventListener('click', () => {
  const x = CONTENT[current - 1], box = $('copybox');
  const txt = '🪝 ' + x.tip_title + '\n\n💡 Etapa ' + current + ' de la Volta a Nadal: ' + x.name + '.\n' + x.tip +
    "\n\nRepte d'avui: " + x.challenge + "\n\n📣 Guarda-ho i digue'm com t'ha anat als comentaris. Som-hi!\n\n#VoltaANadal";
  box.value = txt;
  const manual = () => { box.classList.add('on'); box.focus(); box.select(); toast('Selecciona el text i copia’l.'); };
  try { navigator.clipboard.writeText(txt).then(() => toast('Text copiat. Ja el pots enganxar a Instagram.'), manual); } catch (e) { manual(); }
});
$('close').addEventListener('click', closePanel);
$('overlay').addEventListener('click', e => { if (e.target === $('overlay')) closePanel(); });
$('ob').addEventListener('click', e => { if (e.target === $('ob')) hideOnboarding(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('ob').classList.contains('on')) hideOnboarding(); else if (current) closePanel();
});

/* ---------- inici ---------- */
async function init() {
  try {
    const r = await fetch(API + '/api/stages');
    CONTENT = await r.json();
  } catch (e) { toast('No s’ha pogut carregar el contingut. Torna-ho a provar d’aquí a un moment.'); }
  if (googleClientId) startGoogle();
  await refresh();
}
init();
window.__advent = { S: S, refresh: refresh };
})();
