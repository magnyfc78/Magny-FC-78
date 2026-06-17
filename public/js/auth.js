/**
 * Magny FC 78 — JS partagé des pages d'authentification (API v1).
 * Pages standalone : register, login, verify-email, reset/forgot password.
 */

// ---------------------------------------------------------------------------
// Client API v1
// ---------------------------------------------------------------------------
const V1 = {
  base: '/api/v1',
  getToken() { return localStorage.getItem('accessToken'); },
  setSession(data) {
    if (data.accessToken) localStorage.setItem('accessToken', data.accessToken);
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
  },
  clear() { localStorage.removeItem('accessToken'); localStorage.removeItem('user'); },
  user() { try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; } },

  async req(path, { method = 'GET', body, auth = false, form = false } = {}) {
    const headers = {};
    if (!form) headers['Content-Type'] = 'application/json';
    if (auth && this.getToken()) headers.Authorization = `Bearer ${this.getToken()}`;
    const res = await fetch(this.base + path, {
      method,
      headers,
      credentials: 'include',
      body: form ? body : (body ? JSON.stringify(body) : undefined)
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* corps vide */ }
    if (!res.ok) {
      const msg = data.error
        || (data.details ? data.details.map((d) => d.message).join(' • ') : '')
        || `Erreur ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
};

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const showAlert = (el, type, msg) => {
  if (!el) return;
  el.className = `alert show ${type}`;
  el.textContent = msg;
};
const hideAlert = (el) => { if (el) el.className = 'alert'; };
const setLoading = (btn, on, labelIdle) => {
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.idle = btn.textContent; btn.textContent = '…'; }
  else { btn.textContent = labelIdle || btn.dataset.idle || btn.textContent; }
};
const qparam = (name) => new URLSearchParams(window.location.search).get(name);

const AuthUI = {
  // -------------------------------------------------------------------------
  // INSCRIPTION (wizard 3 étapes)
  // -------------------------------------------------------------------------
  initRegister() {
    const state = { email: '', step: 1, licenseFound: false };
    const alert = $('#alert');
    const steps = [1, 2, 3];
    const showStep = (n) => {
      state.step = n;
      steps.forEach((s) => $(`#step-${s}`).classList.toggle('hidden', s !== n));
      document.querySelectorAll('.stepper .step').forEach((el, i) => {
        el.classList.toggle('active', i + 1 === n);
        el.classList.toggle('done', i + 1 < n);
      });
    };

    // Pré-remplissage si invitation dans l'URL
    const invite = qparam('invitation');
    if (invite) {
      $('#invitation-block').classList.remove('hidden');
      $('#invitation_code').value = invite;
    }

    // Étape 1 : vérification email
    $('#btn-check').addEventListener('click', async () => {
      hideAlert(alert);
      const email = $('#email').value.trim();
      if (!email) return showAlert(alert, 'err', 'Saisissez votre email.');
      const btn = $('#btn-check');
      setLoading(btn, true);
      try {
        const r = await V1.req('/auth/check-email', { method: 'POST', body: { email } });
        state.email = email;
        state.licenseFound = r.data.found;
        $('#reg_email').value = email;
        if (r.data.found) {
          $('#preview').classList.remove('hidden');
          $('#preview').textContent = `Licence trouvée : ${r.data.license_preview} — confirmez et créez votre compte.`;
          $('#parent-note').classList.add('hidden');
        } else {
          $('#preview').classList.add('hidden');
          $('#parent-note').classList.remove('hidden');
        }
        showStep(2);
      } catch (e) {
        showAlert(alert, 'err', e.message);
      } finally { setLoading(btn, false, 'Vérifier'); }
    });

    // Toggle "lier ma licence"
    $('#toggle-license').addEventListener('change', (e) => {
      $('#license-fields').classList.toggle('hidden', !e.target.checked);
    });

    // Étape 2 -> 3 : récap
    $('#btn-to-recap').addEventListener('click', () => {
      hideAlert(alert);
      const fn = $('#first_name').value.trim();
      const ln = $('#last_name').value.trim();
      const pw = $('#password').value;
      const pw2 = $('#password2').value;
      if (fn.length < 2 || ln.length < 2) return showAlert(alert, 'err', 'Nom et prénom requis.');
      if (pw.length < 8) return showAlert(alert, 'err', 'Mot de passe : 8 caractères minimum.');
      if (pw !== pw2) return showAlert(alert, 'err', 'Les mots de passe ne correspondent pas.');
      $('#recap').innerHTML = `
        <strong>${fn} ${ln}</strong><br>${state.email}
        ${$('#toggle-license').checked ? `<br>Licence : ${$('#license_number').value}` : ''}`;
      showStep(3);
    });

    $('#btn-back-2').addEventListener('click', () => showStep(2));

    // Soumission finale
    $('#btn-submit').addEventListener('click', async () => {
      hideAlert(alert);
      const btn = $('#btn-submit');
      setLoading(btn, true);
      const payload = {
        email: state.email,
        first_name: $('#first_name').value.trim(),
        last_name: $('#last_name').value.trim(),
        password: $('#password').value
      };
      const withLicense = $('#toggle-license').checked;
      if (withLicense) {
        payload.license_number = $('#license_number').value.trim();
        payload.birth_date = $('#birth_date').value;
      }
      try {
        let r;
        if (invite) {
          r = await V1.req('/auth/register-with-invitation', {
            method: 'POST',
            body: {
              invitation_code: $('#invitation_code').value.trim(),
              email: payload.email,
              password: payload.password,
              first_name: payload.first_name,
              last_name: payload.last_name
            }
          });
        } else {
          r = await V1.req('/auth/register', { method: 'POST', body: payload });
        }
        V1.setSession(r.data);
        $('#step-3').classList.add('hidden');
        $('#done').classList.remove('hidden');
        document.querySelector('.stepper').classList.add('hidden');
      } catch (e) {
        showAlert(alert, 'err', e.message);
        setLoading(btn, false, 'Créer mon compte');
      }
    });

    showStep(1);
  },

  // -------------------------------------------------------------------------
  // CONNEXION
  // -------------------------------------------------------------------------
  initLogin() {
    const alert = $('#alert');
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alert);
      const btn = $('#btn-login');
      setLoading(btn, true);
      try {
        const r = await V1.req('/auth/login', {
          method: 'POST',
          body: { email: $('#email').value.trim(), password: $('#password').value }
        });
        V1.setSession(r.data);
        const target = r.data.user.role === 'admin'
          ? '/pages/admin-licenses.html'
          : '/pages/member-dashboard.html';
        window.location.href = target;
      } catch (e2) {
        showAlert(alert, 'err', e2.message);
        setLoading(btn, false, 'Se connecter');
      }
    });
  },

  // -------------------------------------------------------------------------
  // VÉRIFICATION EMAIL
  // -------------------------------------------------------------------------
  async initVerify() {
    const box = $('#result');
    const token = qparam('token');
    if (!token) { box.innerHTML = '<div class="alert show err">Lien invalide.</div>'; return; }
    try {
      await V1.req(`/auth/verify-email/${encodeURIComponent(token)}`, { method: 'POST' });
      box.innerHTML = '<div class="alert show ok">Votre email est vérifié, votre compte est activé.</div>'
        + '<a class="btn" href="/pages/login.html">Se connecter</a>';
    } catch (e) {
      box.innerHTML = `<div class="alert show err">${e.message}</div>`;
    }
  },

  // -------------------------------------------------------------------------
  // MOT DE PASSE OUBLIÉ
  // -------------------------------------------------------------------------
  initForgot() {
    const alert = $('#alert');
    $('#forgot-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alert);
      const btn = $('#btn-forgot');
      setLoading(btn, true);
      try {
        const r = await V1.req('/auth/forgot-password', {
          method: 'POST', body: { email: $('#email').value.trim() }
        });
        showAlert(alert, 'ok', r.message);
      } catch (e2) { showAlert(alert, 'err', e2.message); }
      finally { setLoading(btn, false, 'Envoyer le lien'); }
    });
  },

  // -------------------------------------------------------------------------
  // RÉINITIALISATION MOT DE PASSE
  // -------------------------------------------------------------------------
  initReset() {
    const alert = $('#alert');
    const token = qparam('token');
    if (!token) { showAlert(alert, 'err', 'Lien de réinitialisation invalide.'); return; }
    $('#reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alert);
      const pw = $('#password').value;
      const pw2 = $('#password2').value;
      if (pw !== pw2) return showAlert(alert, 'err', 'Les mots de passe ne correspondent pas.');
      const btn = $('#btn-reset');
      setLoading(btn, true);
      try {
        const r = await V1.req('/auth/reset-password', { method: 'POST', body: { token, password: pw } });
        showAlert(alert, 'ok', `${r.message}`);
        $('#reset-form').classList.add('hidden');
        $('#to-login').classList.remove('hidden');
      } catch (e2) { showAlert(alert, 'err', e2.message); setLoading(btn, false, 'Réinitialiser'); }
    });
  }
};

window.V1 = V1;
window.AuthUI = AuthUI;
