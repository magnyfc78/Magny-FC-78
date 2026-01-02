/**
 * MAGNY FC 78 - Administration Panel
 */

let currentSection = 'dashboard';
let categories = [];
let galerieCategories = [];
let equipes = [];
let menus = [];
let matchs = [];
let actualites = [];
let albums = [];
let partenaires = [];
let contacts = [];
let users = [];
let histoireMoments = [];
let organigrammesData = { config: {}, organigrammes: [] };
let currentOrganigrammeId = null;
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
  await loadGalerieCategories();
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
  // Les IDs peuvent être des entiers ou des UUIDs (strings) pour les utilisateurs
  const id = btn.dataset.id || null;

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
    case 'reset-password':
      if (type === 'user') resetUserPassword(id);
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
    case 'select-org':
      selectOrganigramme(btn.dataset.orgId);
      break;
    case 'export-org':
      exportOrganigramme();
      break;
  }
}

function handleEdit(type, id) {
  let item;
  // Fonction de comparaison flexible pour IDs numériques ou string (UUID)
  const matchId = (x) => String(x.id) === String(id);
  switch(type) {
    case 'menu': item = menus.find(matchId); break;
    case 'equipe': item = equipes.find(matchId); break;
    case 'match': item = matchs.find(matchId); break;
    case 'actualite': item = actualites.find(matchId); break;
    case 'album': item = albums.find(matchId); break;
    case 'partenaire': item = partenaires.find(matchId); break;
    case 'user': item = users.find(matchId); break;
    case 'moment': item = histoireMoments.find(matchId); break;
    case 'organigramme':
      // Chercher le membre dans l'organigramme courant
      const currentOrg = organigrammesData.organigrammes.find(o => o.id === currentOrganigrammeId);
      if (currentOrg) item = currentOrg.membres.find(matchId);
      break;
    case 'organigramme-group':
      item = organigrammesData.organigrammes.find(matchId);
      break;
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
    galerie: 'Galerie', histoire: 'Histoire du club', organigramme: 'Organigramme',
    partenaires: 'Partenaires', contacts: 'Messages', users: 'Utilisateurs', logs: 'Activité'
  };
  document.getElementById('page-title').textContent = titles[section] || section;

  // Charger les données
  const loaders = {
    dashboard: loadDashboard, config: () => loadConfig('general'), menu: loadMenu,
    equipes: loadEquipes, matchs: loadMatchs, actualites: loadActualites,
    galerie: loadGalerie, histoire: loadHistoire, organigramme: loadOrganigramme,
    partenaires: loadPartenaires, contacts: loadContacts, users: loadUsers, logs: loadLogs
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

    const renderField = (c) => {
      if (c.type === 'textarea') {
        return `<textarea class="form-control" name="${c.cle}">${c.valeur || ''}</textarea>`;
      } else if (c.type === 'color') {
        return `<input type="color" class="form-control" name="${c.cle}" value="${c.valeur || '#000000'}" style="height:50px;">`;
      } else if (c.type === 'image') {
        return `
          <div class="image-upload-field" data-key="${c.cle}">
            <input type="file" class="form-control" id="config-file-${c.cle}" accept="image/*" style="margin-bottom:8px;">
            <input type="hidden" name="${c.cle}" value="${c.valeur || ''}">
            ${c.valeur ? `
              <div class="image-preview" style="margin-top:8px;">
                <img src="${c.valeur}" style="max-height:120px;max-width:300px;border-radius:8px;border:1px solid #ddd;">
                <div style="margin-top:4px;font-size:0.85rem;color:#6b7280;">${c.valeur}</div>
              </div>
            ` : '<div class="image-preview"></div>'}
          </div>
        `;
      } else {
        return `<input type="text" class="form-control" name="${c.cle}" value="${c.valeur || ''}">`;
      }
    };

    document.getElementById('config-form').innerHTML = `
      <form id="config-form-inner">
        ${items.map(c => `
          <div class="form-group">
            <label class="form-label">${c.label || c.cle}</label>
            ${renderField(c)}
          </div>
        `).join('')}
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    `;

    // Ajouter les listeners pour les uploads d'image
    document.querySelectorAll('.image-upload-field input[type="file"]').forEach(fileInput => {
      fileInput.addEventListener('change', handleConfigImageUpload);
    });

    document.getElementById('config-form-inner').addEventListener('submit', saveConfig);
  } catch (e) { showAlert('Erreur chargement config', 'danger'); }
}

// Gérer l'upload d'image pour les champs de configuration
async function handleConfigImageUpload(e) {
  const fileInput = e.target;
  const file = fileInput.files[0];
  if (!file) return;

  const container = fileInput.closest('.image-upload-field');
  const key = container.dataset.key;
  const hiddenInput = container.querySelector('input[type="hidden"]');
  const previewDiv = container.querySelector('.image-preview');

  // Afficher un indicateur de chargement
  previewDiv.innerHTML = '<div style="color:#6b7280;">Upload en cours...</div>';

  try {
    const formData = new FormData();
    formData.append('image', file);

    const uploadRes = await api.upload('/upload/single/config', formData);

    if (uploadRes.success) {
      const imagePath = uploadRes.data.path;
      hiddenInput.value = imagePath;
      previewDiv.innerHTML = `
        <img src="${imagePath}" style="max-height:120px;max-width:300px;border-radius:8px;border:1px solid #ddd;">
        <div style="margin-top:4px;font-size:0.85rem;color:#6b7280;">${imagePath}</div>
      `;
      showAlert('Image uploadée avec succès', 'success');
    }
  } catch (error) {
    previewDiv.innerHTML = `<div style="color:#ef4444;">Erreur: ${error.message}</div>`;
    showAlert('Erreur upload image: ' + error.message, 'danger');
  }
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
// GALERIE - CATÉGORIES
// =====================================================
async function loadGalerieCategories() {
  try {
    const res = await api.get('/admin/galerie/categories');
    galerieCategories = res.data.categories;
  } catch (e) { console.error(e); }
}

// =====================================================
// GALERIE
// =====================================================
async function loadGalerie() {
  try {
    await loadGalerieCategories();
    const res = await api.get('/admin/galerie/albums');
    albums = res.data.albums;

    // Créer les badges de couleur pour les catégories
    const getCategoryBadge = (album) => {
      if (!album.categorie_nom) return '<span class="badge badge-info">-</span>';
      const colors = {
        'match': 'success',
        'tournoi': 'warning',
        'entrainement': 'info',
        'evenement': 'info',
        'histoire': 'secondary'
      };
      const badgeType = colors[album.categorie_slug] || 'info';
      return `<span class="badge badge-${badgeType}" style="background:${album.categorie_couleur || '#6b7280'};color:white;">${album.categorie_nom}</span>`;
    };

    document.getElementById('galerie-list').innerHTML = albums.length ? `
      <table class="table">
        <thead><tr><th>Titre</th><th>Catégorie</th><th>Date</th><th>Année</th><th>Photos</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>
          ${albums.map(a => `
            <tr>
              <td><strong>${a.titre}</strong></td>
              <td>${getCategoryBadge(a)}</td>
              <td>${a.date_evenement ? new Date(a.date_evenement).toLocaleDateString('fr-FR') : '-'}</td>
              <td>${a.annee || '-'}</td>
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
// HISTOIRE DU CLUB
// =====================================================
async function loadHistoire() {
  try {
    // Charger la configuration
    const configRes = await api.get('/admin/histoire/config');
    const config = configRes.data.config;

    // Afficher le formulaire de configuration
    document.getElementById('histoire-config-form').innerHTML = `
      <form id="histoire-config-inner">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Titre de l'introduction</label>
            <input type="text" class="form-control" name="intro_titre" value="${config.intro_titre?.valeur || ''}" placeholder="24 ans de passion footballistique">
          </div>
          <div class="form-group">
            <label class="form-label">Slogan</label>
            <input type="text" class="form-control" name="slogan" value="${config.slogan?.valeur || ''}" placeholder="Magny FC 78 - Depuis 2000">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Texte d'introduction</label>
          <textarea class="form-control" name="intro_texte" rows="4">${config.intro_texte?.valeur || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Année de création</label>
            <input type="number" class="form-control" name="annee_creation" value="${config.annee_creation?.valeur || '2000'}" min="1900" max="2100">
          </div>
          <div class="form-group">
            <label class="form-label">Nombre de licenciés</label>
            <input type="text" class="form-control" name="nombre_licencies" value="${config.nombre_licencies?.valeur || '300+'}" placeholder="300+">
          </div>
          <div class="form-group">
            <label class="form-label">Nombre d'équipes</label>
            <input type="text" class="form-control" name="nombre_equipes" value="${config.nombre_equipes?.valeur || '17'}" placeholder="17">
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Enregistrer la configuration</button>
      </form>
    `;

    document.getElementById('histoire-config-inner').addEventListener('submit', saveHistoireConfig);

    // Charger les moments clés
    const momentsRes = await api.get('/admin/histoire/moments');
    histoireMoments = momentsRes.data.moments;

    document.getElementById('histoire-moments-list').innerHTML = histoireMoments.length ? `
      <table class="table">
        <thead><tr><th>Année</th><th>Titre</th><th>Description</th><th>Actif</th><th>Actions</th></tr></thead>
        <tbody>
          ${histoireMoments.map(m => `
            <tr>
              <td><strong>${m.annee}</strong></td>
              <td>${m.titre}</td>
              <td>${m.description ? m.description.substring(0, 50) + '...' : '-'}</td>
              <td><span class="badge badge-${m.actif ? 'success' : 'warning'}">${m.actif ? 'Oui' : 'Non'}</span></td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="moment" data-id="${m.id}">✏️</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="histoire/moments" data-id="${m.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun moment clé défini</p>';
  } catch (e) {
    console.error(e);
    showAlert('Erreur chargement histoire', 'danger');
  }
}

async function saveHistoireConfig(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  try {
    await api.put('/admin/histoire/config', data);
    showAlert('Configuration de l\'histoire enregistrée', 'success');
  } catch (e) {
    showAlert('Erreur sauvegarde: ' + e.message, 'danger');
  }
}

// =====================================================
// ORGANIGRAMME (Multi-organigrammes)
// =====================================================
async function loadOrganigramme() {
  try {
    const res = await fetch('/organigramme/data.json');
    organigrammesData = await res.json();

    const organigrammes = organigrammesData.organigrammes || [];

    // Si pas d'organigramme sélectionné, prendre le premier
    if (!currentOrganigrammeId && organigrammes.length > 0) {
      currentOrganigrammeId = organigrammes[0].id;
    }

    const currentOrg = organigrammes.find(o => o.id === currentOrganigrammeId);
    const membres = currentOrg ? currentOrg.membres || [] : [];

    const getNiveauLabel = (niveau) => {
      const labels = { 1: 'Direction', 2: 'Bureau', 3: 'Responsables' };
      return labels[niveau] || niveau;
    };

    const getParentName = (parentId) => {
      if (!parentId) return '-';
      const parent = membres.find(m => m.id === parentId);
      return parent ? `${parent.role} - ${parent.nom}` : '-';
    };

    document.getElementById('organigramme-list').innerHTML = `
      <!-- Liste des organigrammes -->
      <div style="margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px; border:1px solid #e0e0e0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h4 style="margin:0; color:#1a4d92;">Organigrammes</h4>
          <button class="btn btn-sm btn-primary" data-action="add" data-type="organigramme-group">+ Nouvel organigramme</button>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          ${organigrammes.map(o => `
            <div class="org-tab ${o.id === currentOrganigrammeId ? 'active' : ''}"
                 style="padding:10px 15px; background:${o.id === currentOrganigrammeId ? '#1a4d92' : '#fff'};
                        color:${o.id === currentOrganigrammeId ? '#fff' : '#333'};
                        border-radius:6px; cursor:pointer; border:1px solid #ddd;
                        display:flex; align-items:center; gap:10px;"
                 data-action="select-org" data-org-id="${o.id}">
              <span>${o.titre}</span>
              <span style="display:flex; gap:5px;">
                <button class="btn btn-sm" style="padding:2px 6px; background:rgba(255,255,255,0.2);"
                        data-action="edit" data-type="organigramme-group" data-id="${o.id}">✏️</button>
                <button class="btn btn-sm btn-danger" style="padding:2px 6px;"
                        data-action="delete" data-type="organigramme-group" data-id="${o.id}">🗑️</button>
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Membres de l'organigramme sélectionné -->
      ${currentOrg ? `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h4 style="margin:0;">Membres de "${currentOrg.titre}"</h4>
          <button class="btn btn-sm btn-primary" data-action="add" data-type="organigramme">+ Ajouter un membre</button>
        </div>
        ${membres.length ? `
          <table class="table">
            <thead><tr><th>Photo</th><th>Nom</th><th>Rôle</th><th>Niveau</th><th>Rattaché à</th><th>Actions</th></tr></thead>
            <tbody>
              ${membres.map(m => `
                <tr>
                  <td>
                    ${m.photo ? `<img src="${m.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.src='/assets/images/logo.png'">` : '<span style="display:inline-block;width:40px;height:40px;border-radius:50%;background:#e0e0e0;"></span>'}
                  </td>
                  <td><strong>${m.nom}</strong></td>
                  <td>${m.role}</td>
                  <td><span class="badge badge-${m.niveau === 1 ? 'danger' : m.niveau === 2 ? 'warning' : 'info'}">${getNiveauLabel(m.niveau)}</span></td>
                  <td>${getParentName(m.parentId)}</td>
                  <td>
                    <button class="btn btn-sm" data-action="edit" data-type="organigramme" data-id="${m.id}">✏️</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-type="organigramme" data-id="${m.id}">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>Aucun membre dans cet organigramme</p>'}
      ` : '<p>Sélectionnez ou créez un organigramme</p>'}

      <div style="margin-top:20px; padding:15px; background:#f3f4f6; border-radius:8px;">
        <p style="margin:0 0 10px 0;"><strong>Note:</strong> Les modifications sont sauvegardées localement. Pour une persistance permanente, exportez le JSON et remplacez le fichier <code>/organigramme/data.json</code></p>
        <button class="btn btn-sm btn-secondary" data-action="export-org">📥 Exporter JSON</button>
      </div>
    `;
  } catch (e) {
    console.error(e);
    showAlert('Erreur chargement organigramme', 'danger');
  }
}

function selectOrganigramme(orgId) {
  currentOrganigrammeId = orgId;
  loadOrganigramme();
}

function getCurrentOrgMembres() {
  const org = organigrammesData.organigrammes.find(o => o.id === currentOrganigrammeId);
  return org ? org.membres || [] : [];
}

async function saveOrganigramme() {
  try {
    // Sauvegarder en localStorage
    localStorage.setItem('organigramme_data', JSON.stringify(organigrammesData));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function exportOrganigramme() {
  const dataStr = JSON.stringify(organigrammesData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  a.click();

  URL.revokeObjectURL(url);
  showAlert('Fichier JSON exporté', 'success');
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
// UTILISATEURS
// =====================================================
async function loadUsers() {
  try {
    const res = await api.get('/admin/users');
    users = res.data.users;
    document.getElementById('users-list').innerHTML = users.length ? `
      <table class="table">
        <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Actif</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.nom || ''} ${u.prenom || ''}</strong></td>
              <td>${u.email}</td>
              <td><span class="badge badge-${u.role === 'admin' ? 'danger' : u.role === 'editor' ? 'warning' : 'info'}">${u.role}</span></td>
              <td><span class="badge badge-${u.actif ? 'success' : 'warning'}">${u.actif ? 'Oui' : 'Non'}</span></td>
              <td>${u.last_login ? new Date(u.last_login).toLocaleString('fr-FR') : 'Jamais'}</td>
              <td>
                <button class="btn btn-sm" data-action="edit" data-type="user" data-id="${u.id}">✏️</button>
                <button class="btn btn-sm btn-secondary" data-action="reset-password" data-type="user" data-id="${u.id}" title="Réinitialiser mot de passe">🔑</button>
                <button class="btn btn-sm btn-danger" data-action="delete" data-type="users" data-id="${u.id}">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>Aucun utilisateur</p>';
  } catch (e) {
    if (e.message.includes('403') || e.message.includes('Accès refusé')) {
      document.getElementById('users-list').innerHTML = '<p class="alert alert-warning">Accès réservé aux administrateurs</p>';
    } else {
      showAlert('Erreur chargement utilisateurs', 'danger');
    }
  }
}

async function resetUserPassword(userId) {
  const newPassword = prompt('Nouveau mot de passe (min. 8 caractères, avec majuscule, minuscule, chiffre et caractère spécial):');
  if (!newPassword) return;

  if (newPassword.length < 8) {
    showAlert('Le mot de passe doit contenir au moins 8 caractères', 'danger');
    return;
  }

  try {
    await api.patch(`/admin/users/${userId}/password`, { password: newPassword });
    showAlert('Mot de passe mis à jour avec succès', 'success');
  } catch (e) {
    showAlert('Erreur: ' + e.message, 'danger');
  }
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
    actualite: 'Article', album: 'Album', partenaire: 'Partenaire',
    user: 'Utilisateur', moment: 'Moment clé', organigramme: 'Membre',
    'organigramme-group': 'Organigramme'
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
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Horaires d'entraînement</label>
            <input type="text" class="form-control" id="f-horaires_entrainement" value="${data?.horaires_entrainement || ''}" placeholder="Ex: Mardi et Jeudi 18h-20h">
          </div>
          <div class="form-group">
            <label class="form-label">Terrain</label>
            <input type="text" class="form-control" id="f-terrain" value="${data?.terrain || ''}" placeholder="Ex: Terrain A - Stade Jean Jaurès">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Photo (URL)</label>
            <input type="text" class="form-control" id="f-photo" value="${data?.photo || ''}" placeholder="/assets/images/equipe.jpg">
          </div>
          <div class="form-group">
            <label class="form-label">Photo d'équipe</label>
            <input type="file" class="form-control" id="f-photo_equipe_file" accept="image/*">
            <input type="hidden" id="f-photo_equipe" value="${data?.photo_equipe || ''}">
            ${data?.photo_equipe ? `<div style="margin-top:5px;"><img src="${data.photo_equipe}" style="max-height:60px;border-radius:4px;"> <small>${data.photo_equipe}</small></div>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description">${data?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ordre d'affichage</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 0}">
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
          </div>
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
          <label class="form-label">Image principale</label>
          <input type="file" class="form-control" id="f-image_file" accept="image/*">
          <input type="hidden" id="f-image" value="${data?.image || ''}">
          ${data?.image ? `<div style="margin-top:5px;"><img src="${data.image}" style="max-height:60px;border-radius:4px;"> <small>${data.image}</small></div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Extrait</label>
          <textarea class="form-control" id="f-extrait" rows="2" placeholder="Résumé court de l'article (max 500 caractères)">${data?.extrait || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Contenu</label>
          <textarea class="form-control" id="f-contenu" rows="6" placeholder="Contenu HTML de l'article">${data?.contenu || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tags (séparés par des virgules)</label>
          <input type="text" class="form-control" id="f-tags" value="${data?.tags ? (Array.isArray(data.tags) ? data.tags.join(', ') : data.tags) : ''}" placeholder="foot, match, victoire">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-publie" ${data?.publie !== false ? 'checked' : ''}> Publié</label>
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-a_la_une" ${data?.a_la_une ? 'checked' : ''}> À la une</label>
          </div>
        </div>
        ${editingId ? `<div class="form-group"><small>Vues: ${data?.vues || 0}</small></div>` : ''}
      `;
      break;
    case 'album':
      html = `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input type="text" class="form-control" id="f-titre" value="${data?.titre || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Catégorie *</label>
            <select class="form-control" id="f-categorie_id">
              <option value="">-- Sélectionner --</option>
              ${galerieCategories.map(c => `<option value="${c.id}" ${data?.categorie_id == c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Année</label>
            <input type="number" class="form-control" id="f-annee" value="${data?.annee || new Date().getFullYear()}" min="1990" max="2100">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description">${data?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Image de couverture</label>
          <input type="file" class="form-control" id="f-image_couverture_file" accept="image/*">
          <input type="hidden" id="f-image_couverture" value="${data?.image_couverture || ''}">
          ${data?.image_couverture ? `<div style="margin-top:5px;"><img src="${data.image_couverture}" style="max-height:60px;border-radius:4px;"> <small>${data.image_couverture}</small></div>` : ''}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date d'événement</label>
            <input type="date" class="form-control" id="f-date_evenement" value="${data?.date_evenement?.slice(0,10) || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Ordre d'affichage</label>
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
            <input type="url" class="form-control" id="f-site_web" value="${data?.site_web || ''}" placeholder="https://...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Logo</label>
          <input type="file" class="form-control" id="f-logo_file" accept="image/*">
          <input type="hidden" id="f-logo" value="${data?.logo || ''}">
          ${data?.logo ? `<div style="margin-top:5px;"><img src="${data.logo}" style="max-height:60px;border-radius:4px;"> <small>${data.logo}</small></div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description">${data?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ordre d'affichage</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 0}">
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
          </div>
        </div>
      `;
      break;
    case 'user':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input type="text" class="form-control" id="f-nom" value="${data?.nom || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Prénom</label>
            <input type="text" class="form-control" id="f-prenom" value="${data?.prenom || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input type="email" class="form-control" id="f-email" value="${data?.email || ''}" required>
        </div>
        ${!editingId ? `
          <div class="form-group">
            <label class="form-label">Mot de passe * (min. 8 caractères)</label>
            <input type="password" class="form-control" id="f-password" required minlength="8">
            <small style="color:var(--gray);">Doit contenir majuscule, minuscule, chiffre et caractère spécial (@$!%*?&)</small>
          </div>
        ` : ''}
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Rôle *</label>
            <select class="form-control" id="f-role">
              <option value="user" ${data?.role === 'user' ? 'selected' : ''}>Utilisateur</option>
              <option value="editor" ${data?.role === 'editor' ? 'selected' : ''}>Éditeur</option>
              <option value="admin" ${data?.role === 'admin' ? 'selected' : ''}>Administrateur</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
          </div>
        </div>
        ${editingId ? `
          <div class="form-group">
            <small style="color:var(--gray);">
              Créé le: ${data?.created_at ? new Date(data.created_at).toLocaleString('fr-FR') : '-'}<br>
              Dernière connexion: ${data?.last_login ? new Date(data.last_login).toLocaleString('fr-FR') : 'Jamais'}
            </small>
          </div>
        ` : ''}
      `;
      break;
    case 'moment':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Année *</label>
            <input type="number" class="form-control" id="f-annee" value="${data?.annee || new Date().getFullYear()}" min="1900" max="2100" required>
          </div>
          <div class="form-group">
            <label class="form-label">Ordre d'affichage</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 0}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input type="text" class="form-control" id="f-titre" value="${data?.titre || ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="f-description" rows="3">${data?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Image (URL)</label>
          <input type="text" class="form-control" id="f-image" value="${data?.image || ''}" placeholder="/uploads/histoire/moment.jpg">
        </div>
        <div class="form-group">
          <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
        </div>
      `;
      break;
    case 'organigramme':
      // Récupérer les membres de l'organigramme courant
      const currentOrgMembres = getCurrentOrgMembres();
      html = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nom *</label>
            <input type="text" class="form-control" id="f-nom" value="${data?.nom || ''}" required placeholder="Ex: Jean Dupont">
          </div>
          <div class="form-group">
            <label class="form-label">Rôle / Fonction *</label>
            <input type="text" class="form-control" id="f-role" value="${data?.role || ''}" required placeholder="Ex: Vice Président">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Photo</label>
          <input type="file" class="form-control" id="f-photo_file" accept="image/*">
          <input type="hidden" id="f-photo" value="${data?.photo || ''}">
          ${data?.photo ? `<div style="margin-top:8px;"><img src="${data.photo}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid #1a4d92;" onerror="this.style.display='none'"> <small style="color:#6b7280;">${data.photo}</small></div>` : ''}
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Niveau hiérarchique *</label>
            <select class="form-control" id="f-niveau">
              <option value="1" ${data?.niveau === 1 ? 'selected' : ''}>Niveau 1 - Direction</option>
              <option value="2" ${data?.niveau === 2 || !data?.niveau ? 'selected' : ''}>Niveau 2 - Bureau</option>
              <option value="3" ${data?.niveau === 3 ? 'selected' : ''}>Niveau 3 - Responsables</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Ordre d'affichage</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 1}" min="1">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Rattaché à</label>
          <select class="form-control" id="f-parent">
            <option value="">Aucun (niveau supérieur)</option>
            ${currentOrgMembres.filter(m => !data?.id || m.id !== data.id).map(m =>
              `<option value="${m.id}" ${data?.parentId === m.id ? 'selected' : ''}>${m.role} - ${m.nom} (Niv. ${m.niveau})</option>`
            ).join('')}
          </select>
        </div>
      `;
      break;
    case 'organigramme-group':
      html = `
        <div class="form-group">
          <label class="form-label">Titre de l'organigramme *</label>
          <input type="text" class="form-control" id="f-titre" value="${data?.titre || ''}" required placeholder="Ex: ORGANIGRAMME FOOT A 5">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ordre d'affichage</label>
            <input type="number" class="form-control" id="f-ordre" value="${data?.ordre || 1}" min="1">
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="f-actif" ${data?.actif !== false ? 'checked' : ''}> Actif</label>
          </div>
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
      // Upload photo équipe si un fichier est sélectionné
      const photoFile = document.getElementById('f-photo_equipe_file')?.files[0];
      let photoEquipePath = getValue('f-photo_equipe') || null;

      if (photoFile) {
        const nomEquipe = getValue('f-nom');
        if (!nomEquipe) {
          showAlert('Le nom de l\'équipe est requis', 'danger');
          return;
        }
        const formData = new FormData();
        formData.append('photo', photoFile);
        try {
          const uploadRes = await api.upload(`/upload/equipe/${encodeURIComponent(nomEquipe)}`, formData);
          if (uploadRes.success) {
            photoEquipePath = uploadRes.data.path;
          }
        } catch (uploadError) {
          showAlert('Erreur upload photo: ' + uploadError.message, 'danger');
          return;
        }
      }

      data = {
        nom: getValue('f-nom'),
        categorie_id: getValue('f-categorie_id') || null,
        division: getValue('f-division') || null,
        coach: getValue('f-coach') || null,
        assistant: getValue('f-assistant') || null,
        description: getValue('f-description') || null,
        horaires_entrainement: getValue('f-horaires_entrainement') || null,
        terrain: getValue('f-terrain') || null,
        photo: getValue('f-photo') || null,
        photo_equipe: photoEquipePath,
        actif: getChecked('f-actif'),
        ordre: parseInt(getValue('f-ordre')) || 0
      };
      endpoint = '/admin/equipes';
      break;
    case 'match':
      data = {
        equipe_id: getValue('f-equipe_id'), adversaire: getValue('f-adversaire'),
        date_match: getValue('f-date_match'), lieu: getValue('f-lieu') || 'domicile',
        competition: getValue('f-competition') || null,
        adresse_match: null, journee: null
      };
      if (editingId) {
        data.score_domicile = getValue('f-score_domicile') || null;
        data.score_exterieur = getValue('f-score_exterieur') || null;
        data.statut = getValue('f-statut');
      }
      endpoint = '/admin/matchs';
      break;
    case 'actualite':
      // Upload image si un fichier est sélectionné
      const actuImageFile = document.getElementById('f-image_file')?.files[0];
      let actuImagePath = getValue('f-image') || null;

      if (actuImageFile) {
        const formData = new FormData();
        formData.append('image', actuImageFile);
        try {
          const uploadRes = await api.upload('/upload/single/actualite', formData);
          if (uploadRes.success) {
            actuImagePath = uploadRes.data.path;
          }
        } catch (uploadError) {
          showAlert('Erreur upload image: ' + uploadError.message, 'danger');
          return;
        }
      }

      // Parser les tags
      const tagsInput = getValue('f-tags');
      const tagsArray = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

      data = {
        titre: getValue('f-titre'),
        categorie: getValue('f-categorie') || 'Club',
        extrait: getValue('f-extrait') || null,
        contenu: getValue('f-contenu') || null,
        date_publication: getValue('f-date_publication') || new Date().toISOString(),
        publie: getChecked('f-publie'),
        a_la_une: getChecked('f-a_la_une'),
        image: actuImagePath,
        tags: tagsArray
      };
      endpoint = '/admin/actualites';
      break;
    case 'album':
      // Upload image couverture si un fichier est sélectionné
      const albumImageFile = document.getElementById('f-image_couverture_file')?.files[0];
      let albumImagePath = getValue('f-image_couverture') || null;

      if (albumImageFile) {
        const formData = new FormData();
        formData.append('image', albumImageFile);
        try {
          const uploadRes = await api.upload('/upload/single/galerie', formData);
          if (uploadRes.success) {
            albumImagePath = uploadRes.data.path;
          }
        } catch (uploadError) {
          showAlert('Erreur upload image: ' + uploadError.message, 'danger');
          return;
        }
      }

      data = {
        titre: getValue('f-titre'),
        categorie_id: getValue('f-categorie_id') || null,
        description: getValue('f-description') || null,
        date_evenement: getValue('f-date_evenement') || null,
        annee: parseInt(getValue('f-annee')) || new Date().getFullYear(),
        image_couverture: albumImagePath,
        actif: getChecked('f-actif'),
        ordre: parseInt(getValue('f-ordre')) || 0
      };
      endpoint = '/admin/galerie/albums';
      break;
    case 'partenaire':
      // Upload logo si un fichier est sélectionné
      const logoFile = document.getElementById('f-logo_file')?.files[0];
      let logoPath = getValue('f-logo') || null;

      if (logoFile) {
        const formData = new FormData();
        formData.append('image', logoFile);
        try {
          const uploadRes = await api.upload('/upload/single/partenaire', formData);
          if (uploadRes.success) {
            logoPath = uploadRes.data.path;
          }
        } catch (uploadError) {
          showAlert('Erreur upload logo: ' + uploadError.message, 'danger');
          return;
        }
      }

      data = {
        nom: getValue('f-nom'),
        type: getValue('f-type') || 'partenaire',
        site_web: getValue('f-site_web') || null,
        description: getValue('f-description') || null,
        logo: logoPath,
        ordre: parseInt(getValue('f-ordre')) || 0,
        actif: getChecked('f-actif')
      };
      endpoint = '/admin/partenaires';
      break;
    case 'user':
      data = {
        nom: getValue('f-nom'),
        prenom: getValue('f-prenom') || null,
        email: getValue('f-email'),
        role: getValue('f-role') || 'user',
        actif: getChecked('f-actif')
      };
      // Ajouter le mot de passe uniquement pour la création
      if (!editingId) {
        const password = getValue('f-password');
        if (!password || password.length < 8) {
          showAlert('Le mot de passe doit contenir au moins 8 caractères', 'danger');
          return;
        }
        data.password = password;
      }
      endpoint = '/admin/users';
      break;
    case 'moment':
      data = {
        annee: parseInt(getValue('f-annee')) || new Date().getFullYear(),
        titre: getValue('f-titre'),
        description: getValue('f-description') || null,
        image: getValue('f-image') || null,
        ordre: parseInt(getValue('f-ordre')) || 0,
        actif: getChecked('f-actif')
      };
      endpoint = '/admin/histoire/moments';
      break;
    case 'organigramme':
      // Upload photo si un fichier est sélectionné
      const orgPhotoFile = document.getElementById('f-photo_file')?.files[0];
      let orgPhotoPath = getValue('f-photo') || '';

      if (orgPhotoFile) {
        const formData = new FormData();
        formData.append('image', orgPhotoFile);
        try {
          const uploadRes = await api.upload('/upload/single/comite', formData);
          if (uploadRes.success) {
            orgPhotoPath = uploadRes.data.path;
          }
        } catch (uploadError) {
          showAlert('Erreur upload photo: ' + uploadError.message, 'danger');
          return;
        }
      }

      const orgMembreId = editingId || 'membre-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      data = {
        id: orgMembreId,
        nom: getValue('f-nom'),
        role: getValue('f-role'),
        photo: orgPhotoPath,
        niveau: parseInt(getValue('f-niveau')) || 2,
        parentId: getValue('f-parent') || null,
        ordre: parseInt(getValue('f-ordre')) || 1
      };

      // Trouver l'organigramme courant
      const currentOrgForSave = organigrammesData.organigrammes.find(o => o.id === currentOrganigrammeId);
      if (!currentOrgForSave) {
        showAlert('Erreur: organigramme non trouvé', 'danger');
        return;
      }

      // Mise à jour locale des données
      if (editingId) {
        const index = currentOrgForSave.membres.findIndex(m => m.id === editingId);
        if (index !== -1) {
          currentOrgForSave.membres[index] = data;
        }
      } else {
        currentOrgForSave.membres.push(data);
      }

      // Sauvegarder en localStorage
      await saveOrganigramme();
      showAlert('Membre enregistré. N\'oubliez pas d\'exporter le JSON pour une sauvegarde permanente.', 'success');
      closeModal();
      loadOrganigramme();
      return;

    case 'organigramme-group':
      const orgGroupId = editingId || 'org-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      data = {
        id: orgGroupId,
        titre: getValue('f-titre'),
        ordre: parseInt(getValue('f-ordre')) || 1,
        actif: getChecked('f-actif'),
        membres: []
      };

      if (editingId) {
        // Mise à jour - conserver les membres existants
        const existingOrg = organigrammesData.organigrammes.find(o => o.id === editingId);
        if (existingOrg) {
          data.membres = existingOrg.membres;
          const index = organigrammesData.organigrammes.findIndex(o => o.id === editingId);
          organigrammesData.organigrammes[index] = data;
        }
      } else {
        // Nouvel organigramme
        organigrammesData.organigrammes.push(data);
        currentOrganigrammeId = orgGroupId;
      }

      await saveOrganigramme();
      showAlert('Organigramme enregistré. N\'oubliez pas d\'exporter le JSON.', 'success');
      closeModal();
      loadOrganigramme();
      return;
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

  // Cas spécial pour la suppression d'un membre d'organigramme
  if (endpoint === 'organigramme') {
    const currentOrg = organigrammesData.organigrammes.find(o => o.id === currentOrganigrammeId);
    if (!currentOrg) return;

    // Vérifier s'il a des subordonnés
    const hasSubordinates = currentOrg.membres.some(m => m.parentId === id);
    if (hasSubordinates) {
      showAlert('Impossible de supprimer: ce membre a des subordonnés', 'danger');
      return;
    }
    currentOrg.membres = currentOrg.membres.filter(m => m.id !== id);
    await saveOrganigramme();
    showAlert('Membre supprimé. Exportez le JSON pour sauvegarder.', 'success');
    loadOrganigramme();
    return;
  }

  // Cas spécial pour la suppression d'un organigramme complet
  if (endpoint === 'organigramme-group') {
    const org = organigrammesData.organigrammes.find(o => o.id === id);
    if (org && org.membres && org.membres.length > 0) {
      if (!confirm(`Cet organigramme contient ${org.membres.length} membre(s). Voulez-vous vraiment le supprimer ?`)) {
        return;
      }
    }
    organigrammesData.organigrammes = organigrammesData.organigrammes.filter(o => o.id !== id);

    // Sélectionner un autre organigramme si celui supprimé était le courant
    if (currentOrganigrammeId === id) {
      currentOrganigrammeId = organigrammesData.organigrammes[0]?.id || null;
    }

    await saveOrganigramme();
    showAlert('Organigramme supprimé. Exportez le JSON pour sauvegarder.', 'success');
    loadOrganigramme();
    return;
  }

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
