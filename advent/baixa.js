(function () {
  var API = String((window.ADVENT_CONFIG || {}).API_URL || '').replace(/\/$/, '');
  var t = new URLSearchParams(location.search).get('t') || '';
  var btn = document.getElementById('go'), msg = document.getElementById('msg');
  var fail = 'No ho hem pogut fer. Torna-ho a provar d\'aquí a un moment.';
  if (!t || !API) { btn.hidden = true; msg.textContent = 'Aquest enllaç no és vàlid. Obre l\'enllaç de baixa del darrer correu que has rebut.'; return; }
  btn.addEventListener('click', function () {
    btn.disabled = true;
    fetch(API + '/api/unsubscribe?t=' + encodeURIComponent(t), { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) { btn.hidden = true; msg.textContent = 'Fet. Ja no rebràs més correus.'; } else { btn.disabled = false; msg.textContent = fail; } })
      .catch(function () { btn.disabled = false; msg.textContent = fail; });
  });
})();
