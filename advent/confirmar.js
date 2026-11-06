(function () {
  var API = String((window.ADVENT_CONFIG || {}).API_URL || '').replace(/\/$/, '');
  var t = new URLSearchParams(location.search).get('t') || '';
  var btn = document.getElementById('go'), msg = document.getElementById('msg');
  var fail = "No ho hem pogut fer. Torna-ho a provar d'aquí a un moment.";
  if (!t || !API) { btn.hidden = true; msg.textContent = "Aquest enllaç no és vàlid. Obre l'enllaç del darrer correu que has rebut."; return; }
  btn.addEventListener('click', function () {
    btn.disabled = true;
    fetch(API + '/api/subscribe/confirm?t=' + encodeURIComponent(t), { method: 'POST' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok && x.j && x.j.ok) { btn.hidden = true; msg.textContent = "Subscripció confirmada. Gràcies! T'acabem d'enviar un correu de benvinguda."; }
        else if (x.j && x.j.error === 'not_found') { btn.hidden = true; msg.textContent = "Aquest enllaç ja no és vàlid. Torna a apuntar-te des del formulari."; }
        else { btn.disabled = false; msg.textContent = fail; }
      })
      .catch(function () { btn.disabled = false; msg.textContent = fail; });
  });
})();
