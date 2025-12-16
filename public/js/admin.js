/**
 * MAGNY FC 78 - Administration Panel
 */

let currentSection = 'dashboard';
let categories = [];
let equipes = [];
let menus = [];
let matchs = [];
let actualites = [];
let albums = [];
let partenaires = [];
let contacts = [];
let editingId = null;
let editingType = null;

// =====================================================
// INITIALISATION
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Vérifier l'authentification
  if (!api.isAuthenticated() || !api.isAdmin()) {
    window.location.href = '/admin/login.html';
    return;
  }

  document.getElementById('user-name').textContent = api.getUser()?.nom || 'Admin';

  // Navigation
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => switchSection(item.dataset.section));
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadConfig(tab.dataset.tab);
    });
  });

  // Délégation d'événements globale pour tous les boutons d'action
  document.addEventListener('click', handleGlobalClick);

  // Charger les données initiales
  await loadCategories();
  await loadEquipesList();
  loadDashboard();
});

// =====================================================
// GESTIONNAIRE D'ÉVÉNEMENTS GLOBAL
// =====================================================
function handleGlobalClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const type = btn.dataset.type;
  const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;

  switch(action) {
    case 'add':
      openModal(type);
      break;
    case 'edit':
      handleEdit(type, id);
      break;
    case 'delete':
      deleteItem(type, id);
      break;
    case 'view':
      if (type === 'contact') viewContact(id);
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'save-modal':
      saveModal();
      break;
    case 'logout':
      logout();
      break;
  }
}

function handleEdit(type, id) {
  let item;
  switch(type) {
    case 'menu': item = menus.find(x => x.id === id); break;
    case 'equipe': item = equipes.find(x => x.id === id); break;
    case 'match': item = matchs.find(x => x.id === id); break;
    case 'actualite': item = actualites.find(x => x.id === id); break;
    case 'album': item = albums.find(x => x.id === id); break;
    case 'partenaire': item = partenaires.find(x => x.id === id); break;
  }
  if (item) openModal(type, item);
}

// =====================================================
// NAVIGATION
// =====================================================
function switchSection(section) {
  currentSection = section;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`)?.classList.add('active');

  const titles = {
    dashboard: 'Tableau de bord', config: 'Configuration', menu: 'Menu de navigation',
    equipes: 'Équipes', matchs: 'Matchs', actualites: 'Actualités',
    galerie: 'Galerie', partenaires: 'Partenaires', contacts: 'Messages', logs: 'Activité'
  };
  document.getElementById('page-title').textContent = titles[section] || section;

  // Charger les données
  const loaders = {
    dashboard: loadDashboard, config: () => loadConfig('general'), menu: loadMenu,
    equipes: loadEquipes, matchs: loadMatchs, actualites: loadActualites,
    galerie: loadGalerie, partenaires: loadPartenaires, contacts: loadContacts, logs: loadLogs
  };
  loaders[section]?.();
}

// =====================================================
// DASHBOARD
// =====================================================
async function loadDashboard() {
  try {
    const res = await api.get('/admin/dashboard');
    const { stats, derniers_matchs } = res.data;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-card-icon" style="background:#dbeafe;">👥</div>
        <div class="stat-card-value">${stats.total_equipes}</div>
        <div class="stat-card-label">Équipes</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background:#fef3c7;">⚽</div>
        <div class="stat-card-value">${stats.total_matchs}</div>
        <div class="stat-card-label">Matchs à venir</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background:#d1fae5;">📰</div>
        <div class="stat-card-value">${stats.total_actus}</div>
        <div class="stat-card-label">Actualités</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon" style="background:#fee2e2;">✉️</div>
        <div class="stat-card-value">${stats.messages_non_lus}</div>
        <div class="stat-card-label">Messages non lus</div>
      </div>
    `;

    if (stats.messages_non_lus > 0) {
      document.getElementById('unread-badge').textContent = stats.messages_non_lus;
      document.getElementById('unread-badge').style.display = 'inline';
    }

    document.getElementById('derniers-matchs').innerHTML = derniers_matchs.length ? `
      <table class="table">
        <thead><tr><th>Date</th><th>Équipe</th><th>Adversaire</th><th>Statut</th></tr></thead>
        <tbody>
          ${derniers_matchs.map(m => `
            <tr>
              <td>${new Date(m.date_match).toLocaleDateString('fr-FR')}</td>
              <td>${m.equipe_nom || 'N/A'}</td>
              <td>${m.adversaire}</td>
              <td><span class="badge badge-${m.statut === 'termine' ? 'success' : 'info'}">${m.statut}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun match</p>';
  } catch (e) { showAlert('Erreur chargement dashboard', 'danger'); }
}

// =====================================================
// CONFIGURATION
// =====================================================
async function loadConfig(groupe = 'general') {
  try {
    const res = await api.get('/admin/config');
    const items = res.data.raw.filter(c => c.groupe === groupe);

    document.getElementById('config-form').innerHTML = `
      <form id="config-form-inner">
        ${items.map(c => `
          <div class="form-group">
            <label class="form-label">${c.label || c.cle}</label>
            ${c.type === 'textarea'
              ? `<textarea class="form-control" name="${c.cle}">${c.valeur || ''}</textarea>`
              : c.type === 'color'
              ? `<input type="color" class="form-control" name="${c.cle}" value="${c.valeur || '#000000'}" style="height:50px;">`
              : `<input type="text" class="form-control" name="${c.cle}" value="${c.valeur || ''}">`
            }
          </div>
        `).join('')}
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    `;

    document.getElementById('config-form-inner').addEventListener('submit', saveConfig);
  } catch (e) { showAlert('Erreur chargement config', 'danger'); }
}

async function saveConfig(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  try {
    await api.put('/admin/config', data);
    showAlert('Configuration enregistrée', 'success');
  } catch (e) { showAlert('Erreur sauvegarde', 'danger'); }
}

// =====================================================
// MENU
// =====================================================
async function loadMenu() {
  try {
    const res = await api.get('/admin/menu');
    menus = res.data.items;
    document.getElementById('menu-list').innerHTML = menus.length ? `
      <table class="table">
        <thead><tr><th>Label</th><th>URL</th><th>Ordre</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>
          ${menus.map(m => `
            <tr>
              <td>${m.label}</td>
              <td>${m.url}</td>
              <td>${m.ordre}</td>
              <td><span class="badge badge-${m.actif ? 'success' : 'warning'}">${m.actif ? 'Oui' : 'Non'}</span></td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="menu" data-id="${m.id}">✏️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="menu" data-id="${m.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun élément</p>';
  } catch (e) { showAlert('Erreur chargement menu', 'danger'); }
}

// =====================================================
// ÉQUIPES
// =====================================================
async function loadCategories() {
  try {
    const res = await api.get('/admin/categories');
    categories = res.data.categories;
  } catch (e) { console.error(e); }
}

async function loadEquipesList() {
  try {
    const res = await api.get('/admin/equipes');
    equipes = res.data.equipes;
  } catch (e) { console.error(e); }
}

async function loadEquipes() {
  await loadEquipesList();
  document.getElementById('equipes-list').innerHTML = equipes.length ? `
    <table class="table">
      <thead><tr><th>Nom</th><th>Catégorie</th><th>Division</th><th>Coach</th><th>Joueurs</th><th>Actions</th></tr></thead>
      <tbody>
        ${equipes.map(e => `
          <tr>
            <td><strong>${e.nom}</strong></td>
            <td>${e.categorie_nom || '-'}</td>
            <td>${e.division || '-'}</td>
            <td>${e.coach || '-'}</td>
            <td>${e.nb_joueurs || 0}</td>
            <td>
              <button class="btn btn-sm" data-action="edit" data-type="equipe" data-id="${e.id}">✏️</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-type="equipes" data-id="${e.id}">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p>Aucune équipe</p>';
}

// =====================================================
// MATCHS
// =====================================================
async function loadMatchs() {
  try {
    const res = await api.get('/admin/matchs');
    matchs = res.data.matchs;
    document.getElementById('matchs-list').innerHTML = matchs.length ? `
      <table class="table">
        <thead><tr><th>Date</th><th>Équipe</th><th>Adversaire</th><th>Compétition</th><th>Score</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>
          ${matchs.map(m => `
            <tr>
              <td>${new Date(m.date_match).toLocaleDateString('fr-FR')} ${new Date(m.date_match).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</td>
              <td>${m.equipe_nom || '-'}</td>
              <td>${m.lieu === 'domicile' ? 'vs' : '@'} ${m.adversaire}</td>
              <td>${m.competition || '-'}</td>
              <td>${m.statut === 'termine' ? `${m.score_domicile} - ${m.score_exterieur}` : '-'}</td>
              <td><span class="badge badge-${m.statut === 'termine' ? 'success' : m.statut === 'a_venir' ? 'info' : 'warning'}">${m.statut}</span></td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="match" data-id="${m.id}">✏️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="matchs" data-id="${m.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun match</p>';
  } catch (e) { showAlert('Erreur chargement matchs', 'danger'); }
}

// =====================================================
// ACTUALITÉS
// =====================================================
async function loadActualites() {
  try {
    const res = await api.get('/admin/actualites');
    actualites = res.data.actualites;
    document.getElementById('actualites-list').innerHTML = actualites.length ? `
      <table class="table">
        <thead><tr><th>Titre</th><th>Catégorie</th><th>Date</th><th>Publié</th><th>Vues</th><th>Actions</th></tr></thead>
        <tbody>
          ${actualites.map(a => `
            <tr>
              <td><strong>${a.titre}</strong></td>
              <td><span class="badge badge-info">${a.categorie}</span></td>
              <td>${new Date(a.date_publication).toLocaleDateString('fr-FR')}</td>
              <td><span class="badge badge-${a.publie ? 'success' : 'warning'}">${a.publie ? 'Oui' : 'Non'}</span></td>
              <td>${a.vues || 0}</td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="actualite" data-id="${a.id}">✏️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="actualites" data-id="${a.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun article</p>';
  } catch (e) { showAlert('Erreur chargement actualités', 'danger'); }
}

// =====================================================
// GALERIE
// =====================================================
async function loadGalerie() {
  try {
    const res = await api.get('/admin/galerie/albums');
    albums = res.data.albums;
    document.getElementById('galerie-list').innerHTML = albums.length ? `
      <table class="table">
        <thead><tr><th>Titre</th><th>Date</th><th>Photos</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>
          ${albums.map(a => `
            <tr>
              <td><strong>${a.titre}</strong></td>
              <td>${a.date_evenement ? new Date(a.date_evenement).toLocaleDateString('fr-FR') : '-'}</td>
              <td>${a.nb_photos || 0}</td>
              <td><span class="badge badge-${a.actif ? 'success' : 'warning'}">${a.actif ? 'Oui' : 'Non'}</span></td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="album" data-id="${a.id}">✏️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="galerie/albums" data-id="${a.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun album</p>';
  } catch (e) { showAlert('Erreur chargement galerie', 'danger'); }
}

// =====================================================
// PARTENAIRES
// =====================================================
async function loadPartenaires() {
  try {
    const res = await api.get('/admin/partenaires');
    partenaires = res.data.partenaires;
    document.getElementById('partenaires-list').innerHTML = partenaires.length ? `
      <table class="table">
        <thead><tr><th>Nom</th><th>Type</th><th>Site web</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>
          ${partenaires.map(p => `
            <tr>
              <td><strong>${p.nom}</strong></td>
              <td><span class="badge badge-info">${p.type}</span></td>
              <td>${p.site_web ? `<a href="${p.site_web}" target="_blank">🔗</a>` : '-'}</td>
              <td><span class="badge badge-${p.actif ? 'success' : 'warning'}">${p.actif ? 'Oui' : 'Non'}</span></td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="partenaire" data-id="${p.id}">✏️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="partenaires" data-id="${p.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun partenaire</p>';
  } catch (e) { showAlert('Erreur chargement partenaires', 'danger'); }
}

// =====================================================
// CONTACTS
// =====================================================
async function loadContacts() {
  try {
    const res = await api.get('/admin/contacts');
    contacts = res.data.messages;
    document.getElementById('contacts-list').innerHTML = contacts.length ? `
      <table class="table">
        <thead><tr><th>Date</th><th>Nom</th><th>Email</th><th>Sujet</th><th>Lu</th><th>Actions</th></tr></thead>
        <tbody>
          ${contacts.map(m => `
            <tr style="${!m.lu ? 'font-weight:bold;' : ''}">
              <td>${new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
              <td>${m.nom}</td>
              <td>${m.email}</td>
              <td>${m.sujet || '-'}</td>
              <td><span class="badge badge-${m.lu ? 'success' : 'danger'}">${m.lu ? 'Oui' : 'Non'}</span></td>
              <td>
                <button class="btn btn-sm" data-action="view" data-type="contact" data-id="${m.id}">👁️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="contacts" data-id="${m.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun message</p>';
  } catch (e) { showAlert('Erreur chargement messages', 'danger'); }
}

async function viewContact(id) {
  const m = contacts.find(c => c.id === id);
  if (!m) return;

  document.getElementById('modal-title').textContent = 'Message de ' + m.nom;
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Email:</strong> ${m.email}</p>
    <p><strong>Téléphone:</strong> ${m.telephone || '-'}</p>
    <p><strong>Sujet:</strong> ${m.sujet || '-'}</p>
    <p><strong>Date:</strong> ${new Date(m.created_at).toLocaleString('fr-FR')}</p>
    <hr>
    <p>${m.message}</p>
  `;
  document.getElementById('modal-submit').style.display = 'none';
  document.getElementById('modal').classList.add('active');
  if (!m.lu) await api.patch(`/admin/contacts/${id}/read`);
}

// =====================================================
// LOGS
// =====================================================
async function loadLogs() {
  try {
    const res = await api.get('/admin/logs');
    document.getElementById('logs-list').innerHTML = res.data.logs.length ? `
      <table class="table">
        <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Entité</th></tr></thead>
        <tbody>
          ${res.data.logs.map(l => `
            <tr>
              <td>${new Date(l.created_at).toLocaleString('fr-FR')}</td>
              <td>${l.user_nom || 'Système'}</td>
              <td>${l.action}</td>
              <td>${l.entite || '-'} ${l.entite_id ? '#' + l.entite_id : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucune activité</p>';
  } catch (e) { showAlert('Erreur chargement logs', 'danger'); }
}

// =====================================================
// MODALS
// =====================================================
function openModal(type, data = null) {
  editingType = type;
  editingId = data?.id || null;
  document.getElementById('modal-submit').style.display = 'block';

  const titles = {
    menu: 'Élément de menu', equipe: 'Équipe', match: 'Match',
    actualite: 'Article', album: 'Album', partenaire: 'Partenaire'
  };
  document.getElementById('modal-title').textContent = (editingId ? 'Modifier' : 'Ajouter') + ' ' + (titles[type] || '');

  let html = '';
  switch(type) {
    case 'menu':
      html = `
        <div class="form-group">
          <label class="form-label">Label *</label>
          <input type="text" class="form-control" id="f-label" value="${data?.label || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">URL *</label>
          <input type="text" class="form-control" id="f-url" value="${data?.url || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Icône</label>
            <input type="text" class="form-control" id="f-icone" value="${data?.icone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ordre</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target</label>
            <select class="form-control" id="f-target">
              <option value="_self" ${data?.target === '_self' ? 'selected' : ''}>Même fenêtre</option>
              <option value="_blank" ${data?.target === '_blank' ? 'selected' : ''}>Nouvelle fenêtre</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
          </div>
        </div>
      `;
      break;
    case 'equipe':
      html = `
        <div class="form-group">
          <label class="form-label">Nom *</label>
          <input type="text" class="form-control" id="f-nom" value="${data?.nom || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Catégorie *</label>
            <select class="form-control" id="f-categorie_id">
              ${categories.map(c => `<option value="${c.id}" ${data?.categorie_id == c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Division</label>
            <input type="text" class="form-control" id="f-division" value="${data?.division || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Coach</label>
            <input type="text" class="form-control" id="f-coach" value="${data?.coach || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Assistant</label>
            <input type="text" class="form-control" id="f-assistant" value="${data?.assistant || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description">${data?.description || ''}</textarea>
        </div>
      `;
      break;
    case 'match':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Équipe *</label>
            <select class="form-control" id="f-equipe_id">
              ${equipes.map(e => `<option value="${e.id}" ${data?.equipe_id == e.id ? 'selected' : ''}>${e.nom}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Adversaire *</label>
            <input type="text" class="form-control" id="f-adversaire" value="${data?.adversaire || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date et heure *</label>
            <input type="datetime-local" class="form-control" id="f-date_match" value="${data?.date_match?.slice(0,16) || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Lieu</label>
            <select class="form-control" id="f-lieu">
              <option value="domicile" ${data?.lieu === 'domicile' ? 'selected' : ''}>Domicile</option>
              <option value="exterieur" ${data?.lieu === 'exterieur' ? 'selected' : ''}>Extérieur</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Compétition</label>
          <input type="text" class="form-control" id="f-competition" value="${data?.competition || ''}">
        </div>
        ${editingId ? `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Score domicile</label>
              <input type="number" class="form-control" id="f-score_domicile" value="${data?.score_domicile ?? ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Score extérieur</label>
              <input type="number" class="form-control" id="f-score_exterieur" value="${data?.score_exterieur ?? ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Statut</label>
            <select class="form-control" id="f-statut">
              <option value="a_venir" ${data?.statut === 'a_venir' ? 'selected' : ''}>À venir</option>
              <option value="termine" ${data?.statut === 'termine' ? 'selected' : ''}>Terminé</option>
              <option value="reporte" ${data?.statut === 'reporte' ? 'selected' : ''}>Reporté</option>
            </select>
          </div>
        ` : ''}
      `;
      break;
    case 'actualite':
      html = `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input type="text" class="form-control" id="f-titre" value="${data?.titre || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Catégorie</label>
            <select class="form-control" id="f-categorie">
              ${['Club','Match','Événement','Formation','Partenaire','Autre'].map(c => `<option value="${c}" ${data?.categorie === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date publication</label>
            <input type="datetime-local" class="form-control" id="f-date_publication" value="${data?.date_publication?.slice(0,16) || new Date().toISOString().slice(0,16)}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Extrait</label>
          <textarea class="form-control" id="f-extrait" rows="2">${data?.extrait || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Contenu</label>
          <textarea class="form-control" id="f-contenu" rows="6">${data?.contenu || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-publie" ${data?.publie !== false ? 'checked' : ''}> Publié</label>
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-a_la_une" ${data?.a_la_une ? 'checked' : ''}> À la une</label>
          </div>
        </div>
      `;
      break;
    case 'album':
      html = `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input type="text" class="form-control" id="f-titre" value="${data?.titre || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description">${data?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date d'événement</label>
            <input type="date" class="form-control" id="f-date_evenement" value="${data?.date_evenement?.slice(0,10) || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ordre</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 0}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
        </div>
      `;
      break;
    case 'partenaire':
      html = `
        <div class="form-group">
          <label class="form-label">Nom *</label>
          <input type="text" class="form-control" id="f-nom" value="${data?.nom || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-control" id="f-type">
              ${['principal','officiel','partenaire','fournisseur'].map(t => `<option value="${t}" ${data?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Site web</label>
            <input type="url" class="form-control" id="f-site_web" value="${data?.site_web || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description">${data?.description || ''}</textarea>
        </div>
      `;
      break;
  }

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
  editingId = null;
  editingType = null;
}

async function saveModal() {
  const getValue = id => document.getElementById(id)?.value || '';
  const getChecked = id => document.getElementById(id)?.checked || false;

  let data = {}, endpoint = '';

  switch(editingType) {
    case 'menu':
      data = {
        label: getValue('f-label'), url: getValue('f-url'),
        icone: getValue('f-icone') || null, parent_id: null,
        ordre: parseInt(getValue('f-ordre')) || 0,
        target: getValue('f-target') || '_self', actif: getChecked('f-actif')
      };
      endpoint = '/admin/menu';
      break;
    case 'equipe':
      data = {
        nom: getValue('f-nom'), categorie_id: getValue('f-categorie_id'),
        division: getValue('f-division'), coach: getValue('f-coach'),
        assistant: getValue('f-assistant'), description: getValue('f-description')
      };
      endpoint = '/admin/equipes';
      break;
    case 'match':
      data = {
        equipe_id: getValue('f-equipe_id'), adversaire: getValue('f-adversaire'),
        date_match: getValue('f-date_match'), lieu: getValue('f-lieu'),
        competition: getValue('f-competition')
      };
      if (editingId) {
        data.score_domicile = getValue('f-score_domicile') || null;
        data.score_exterieur = getValue('f-score_exterieur') || null;
        data.statut = getValue('f-statut');
      }
      endpoint = '/admin/matchs';
      break;
    case 'actualite':
      data = {
        titre: getValue('f-titre'), categorie: getValue('f-categorie'),
        extrait: getValue('f-extrait'), contenu: getValue('f-contenu'),
        date_publication: getValue('f-date_publication'),
        publie: getChecked('f-publie'), a_la_une: getChecked('f-a_la_une')
      };
      endpoint = '/admin/actualites';
      break;
    case 'album':
      data = {
        titre: getValue('f-titre'), description: getValue('f-description'),
        date_evenement: getValue('f-date_evenement') || null,
        ordre: parseInt(getValue('f-ordre')) || 0, actif: getChecked('f-actif')
      };
      endpoint = '/admin/galerie/albums';
      break;
    case 'partenaire':
      data = {
        nom: getValue('f-nom'), type: getValue('f-type'),
        site_web: getValue('f-site_web'), description: getValue('f-description')
      };
      endpoint = '/admin/partenaires';
      break;
  }

  try {
    if (editingId) {
      await api.put(`${endpoint}/${editingId}`, data);
    } else {
      await api.post(endpoint, data);
    }
    showAlert('Enregistré avec succès', 'success');
    closeModal();
    switchSection(currentSection);
  } catch (e) {
    showAlert('Erreur: ' + e.message, 'danger');
  }
}

// =====================================================
// HELPERS
// =====================================================
async function deleteItem(endpoint, id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) return;
  try {
    await api.delete(`/admin/${endpoint}/${id}`);
    showAlert('Supprimé avec succès', 'success');
    switchSection(currentSection);
  } catch (e) {
    showAlert('Erreur suppression', 'danger');
  }
}

function showAlert(message, type = 'success') {
  const container = document.getElementById('alert-container');
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => container.innerHTML = '', 4000);
}

function logout() {
  api.logout();
  window.location.href = '/admin/login.html';
}
