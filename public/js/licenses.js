/**
 * Magny FC 78 — Espace membre (mes licences) & admin (gestion licences).
 * Dépend de auth.js (V1, helpers $, showAlert...).
 */

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('fr-FR');
};
const guardAuth = () => {
  if (!V1.getToken()) { window.location.href = '/pages/login.html'; return false; }
  return true;
};
const logout = () => { V1.clear(); window.location.href = '/pages/login.html'; };

const LicensesUI = {
  // =========================================================================
  // ESPACE MEMBRE — MES LICENCES
  // =========================================================================
  async initDashboard() {
    if (!guardAuth()) return;
    const alert = $('#alert');
    const grid = $('#lic-grid');
    const user = V1.user();
    if (user) $('#welcome').textContent = `Bonjour ${user.prenom || user.nom || ''}`;
    $('#btn-logout').addEventListener('click', logout);

    const render = (licenses) => {
      if (!licenses.length) {
        grid.innerHTML = '<div class="muted-box">Aucune licence liée pour le moment. Ajoutez la vôtre ou celle de votre enfant ci-dessous.</div>';
        return;
      }
      grid.innerHTML = licenses.map((l) => `
        <div class="lic ${l.is_primary ? 'primary' : ''}">
          ${l.is_primary ? '<span class="badge gold">Principale</span>' : '<span class="badge grey">' + (l.relationship === 'parent' ? 'Enfant' : 'Moi') + '</span>'}
          <div class="name" style="margin-top:6px">${l.prenom} ${l.nom}</div>
          <div class="meta">N° ${l.numero_licence}</div>
          <div class="meta">${l.categorie || '—'}${l.equipe_nom ? ' • ' + l.equipe_nom : ''}</div>
          <div class="meta">Né(e) le ${fmtDate(l.date_naissance)} • ${l.saison}</div>
          <div class="actions">
            ${l.is_primary ? '' : `<button class="btn ghost sm" data-primary="${l.license_id}">Définir principale</button>`}
            <button class="btn ghost sm" data-remove="${l.license_id}">Délier</button>
          </div>
        </div>`).join('');

      grid.querySelectorAll('[data-primary]').forEach((b) => b.addEventListener('click', () => setPrimary(b.dataset.primary)));
      grid.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => removeLicense(b.dataset.remove)));
    };

    const load = async () => {
      grid.innerHTML = '<div class="spin"></div>';
      try {
        const r = await V1.req('/account/licenses', { auth: true });
        render(r.data.licenses);
      } catch (e) {
        if (e.status === 401) return logout();
        showAlert(alert, 'err', e.message);
      }
    };

    const setPrimary = async (licenseId) => {
      try { await V1.req(`/account/licenses/${licenseId}/set-primary`, { method: 'PUT', auth: true }); load(); }
      catch (e) { showAlert(alert, 'err', e.message); }
    };
    const removeLicense = async (licenseId) => {
      if (!window.confirm('Délier cette licence de votre compte ?')) return;
      try { await V1.req(`/account/licenses/${licenseId}`, { method: 'DELETE', auth: true }); load(); }
      catch (e) { showAlert(alert, 'err', e.message); }
    };

    // --- RGPD / sécurité ---
    const history = $('#history');
    $('#btn-history').addEventListener('click', async () => {
      history.classList.remove('hidden');
      history.innerHTML = '<div class="spin"></div>';
      try {
        const r = await V1.req('/account/login-history', { auth: true });
        const items = r.data.login_history;
        history.innerHTML = items.length
          ? '<strong>Dernières connexions</strong><br>' + items.slice(0, 15).map((h) =>
            `${fmtDate(h.created_at)} ${new Date(h.created_at).toLocaleTimeString('fr-FR')} — ${h.ip_address || '—'} ${h.success ? '✅' : '❌'}`).join('<br>')
          : 'Aucune connexion enregistrée.';
      } catch (e) { history.innerHTML = e.message; }
    });

    $('#btn-export').addEventListener('click', async () => {
      try {
        const r = await V1.req('/account/export', { auth: true });
        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'mes-donnees-magnyfc78.json';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch (e) { showAlert(alert, 'err', e.message); }
    });

    $('#btn-delete').addEventListener('click', async () => {
      const pw = window.prompt('Confirmez votre mot de passe pour supprimer définitivement votre compte :');
      if (!pw) return;
      try {
        await V1.req('/account', { method: 'DELETE', auth: true, body: { password: pw } });
        V1.clear();
        window.alert('Votre compte a été supprimé.');
        window.location.href = '/pages/login.html';
      } catch (e) { showAlert(alert, 'err', e.message); }
    });

    // Formulaire d'ajout de licence (scénario 3 : soi-même ou enfant)
    $('#add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alert);
      const btn = $('#btn-add');
      setLoading(btn, true);
      try {
        await V1.req('/account/licenses/link', {
          method: 'POST', auth: true,
          body: {
            license_number: $('#license_number').value.trim(),
            birth_date: $('#birth_date').value,
            relationship: $('#relationship').value
          }
        });
        $('#add-form').reset();
        showAlert(alert, 'ok', 'Licence liée à votre compte.');
        load();
      } catch (e2) { showAlert(alert, 'err', e2.message); }
      finally { setLoading(btn, false, 'Ajouter la licence'); }
    });

    load();
  },

  // =========================================================================
  // ADMIN — GESTION DES LICENCES
  // =========================================================================
  async initAdmin() {
    if (!guardAuth()) return;
    const user = V1.user();
    if (!user || user.role !== 'admin') { window.location.href = '/pages/login.html'; return; }
    $('#btn-logout').addEventListener('click', logout);

    // Onglets
    const tabs = document.querySelectorAll('.tab');
    const panels = { licenses: $('#panel-licenses'), import: $('#panel-import'), invitations: $('#panel-invitations'), accounts: $('#panel-accounts') };
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      Object.values(panels).forEach((p) => p.classList.add('hidden'));
      panels[t.dataset.tab].classList.remove('hidden');
      if (t.dataset.tab === 'licenses') loadLicenses();
      if (t.dataset.tab === 'accounts') loadAccounts();
    }));

    // --- Licences ---
    const licBody = $('#lic-body');
    const loadLicenses = async (page = 1) => {
      licBody.innerHTML = '<tr><td colspan="6"><div class="spin"></div></td></tr>';
      const params = new URLSearchParams({ page });
      ['q', 'categorie', 'saison', 'statut', 'linked'].forEach((k) => {
        const v = $(`#f_${k}`).value;
        if (v) params.set(k, v);
      });
      try {
        const r = await V1.req(`/admin/licenses?${params.toString()}`, { auth: true });
        const rows = r.data.licenses;
        licBody.innerHTML = rows.length ? rows.map((l) => `
          <tr>
            <td>${l.numero_licence}</td>
            <td>${l.nom} ${l.prenom}</td>
            <td>${l.categorie || '—'}</td>
            <td>${l.saison}</td>
            <td>${l.nb_comptes > 0 ? '<span class="badge gold">Lié</span>' : '<span class="badge grey">Non lié</span>'}</td>
            <td><button class="btn ghost sm" data-invite="${l.id}" data-email="${l.email || ''}">Inviter</button></td>
          </tr>`).join('') : '<tr><td colspan="6" class="center">Aucune licence.</td></tr>';
        $('#lic-total').textContent = `${r.data.pagination.total} licence(s)`;
        licBody.querySelectorAll('[data-invite]').forEach((b) => b.addEventListener('click', () => {
          document.querySelector('.tab[data-tab="invitations"]').click();
          $('#inv_license_id').value = b.dataset.invite;
          if (b.dataset.email) $('#inv_email').value = b.dataset.email;
        }));
      } catch (e) {
        if (e.status === 401) return logout();
        licBody.innerHTML = `<tr><td colspan="6" class="center">${e.message}</td></tr>`;
      }
    };
    $('#btn-filter').addEventListener('click', () => loadLicenses(1));

    // --- Import CSV ---
    $('#import-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = $('#import-result');
      const btn = $('#btn-import');
      const file = $('#csv').files[0];
      if (!file) { out.innerHTML = '<div class="alert show err">Sélectionnez un fichier CSV.</div>'; return; }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('season', $('#season').value.trim());
      if ($('#dry').checked) fd.append('dry_run', 'true');
      setLoading(btn, true);
      out.innerHTML = '<div class="spin"></div>';
      try {
        const r = await V1.req('/admin/licenses/import', { method: 'POST', auth: true, form: true, body: fd });
        const s = r.data.stats;
        out.innerHTML = `<div class="alert show ok">${r.message}</div>
          <ul><li>Lignes : ${s.total}</li><li>Insérées : ${s.inserted}</li>
          <li>Mises à jour : ${s.updated}</li><li>Ignorées : ${s.skipped}</li>
          <li>Erreurs : ${s.errors}</li></ul>
          ${r.data.problems.length ? '<div class="muted-box">' + r.data.problems.slice(0, 15).join('<br>') + '</div>' : ''}`;
      } catch (e2) { out.innerHTML = `<div class="alert show err">${e2.message}</div>`; }
      finally { setLoading(btn, false, 'Lancer l\'import'); }
    });

    // --- Invitations ---
    $('#inv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = $('#inv-result');
      const btn = $('#btn-inv');
      setLoading(btn, true);
      try {
        const r = await V1.req('/admin/invitations', {
          method: 'POST', auth: true,
          body: {
            license_id: Number($('#inv_license_id').value),
            email: $('#inv_email').value.trim(),
            role: $('#inv_role').value
          }
        });
        out.innerHTML = `<div class="alert show ok">Invitation envoyée à ${r.data.email}.<br>Code : <strong>${r.data.code}</strong></div>`;
        $('#inv-form').reset();
      } catch (e2) { out.innerHTML = `<div class="alert show err">${e2.message}</div>`; }
      finally { setLoading(btn, false, 'Générer l\'invitation'); }
    });

    // --- Comptes ---
    const accBody = $('#acc-body');
    const loadAccounts = async () => {
      accBody.innerHTML = '<tr><td colspan="6"><div class="spin"></div></td></tr>';
      try {
        const r = await V1.req('/admin/accounts', { auth: true });
        const rows = r.data.accounts;
        accBody.innerHTML = rows.length ? rows.map((a) => `
          <tr>
            <td><code style="font-size:12px">${a.id}</code></td>
            <td>${a.prenom || ''} ${a.nom}</td>
            <td>${a.email}</td>
            <td>${a.email_verified ? '✅' : '⏳'}</td>
            <td>${a.nb_licences}</td>
            <td>${fmtDate(a.created_at)}</td>
          </tr>`).join('') : '<tr><td colspan="6" class="center">Aucun compte.</td></tr>';
      } catch (e) {
        if (e.status === 401) return logout();
        accBody.innerHTML = `<tr><td colspan="6" class="center">${e.message}</td></tr>`;
      }
    };

    // --- Fusion de doublons ---
    $('#merge-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = $('#merge-result');
      const source = $('#merge_source').value.trim();
      const target = $('#merge_target').value.trim();
      if (!window.confirm(`Fusionner ${source} dans ${target} ? Le compte source sera supprimé.`)) return;
      const btn = $('#btn-merge');
      setLoading(btn, true);
      try {
        const r = await V1.req('/admin/accounts/merge', {
          method: 'POST', auth: true, body: { source_id: source, target_id: target }
        });
        out.innerHTML = `<div class="alert show ok">${r.message}</div>`;
        $('#merge-form').reset();
        loadAccounts();
      } catch (e2) { out.innerHTML = `<div class="alert show err">${e2.message}</div>`; }
      finally { setLoading(btn, false, 'Fusionner'); }
    });

    loadLicenses();
  }
};

window.LicensesUI = LicensesUI;
