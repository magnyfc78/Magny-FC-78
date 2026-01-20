/**
 * MAGNY FC 78 - Administration des Adhérents
 * Interface de gestion des licences et comptes membres
 */

// =====================================================
// API ADMIN MEMBRES
// =====================================================

const adminMembersAPI = {
  baseURL: '/api/admin/members',

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      credentials: 'include'
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erreur serveur');
    }
    return data;
  },

  get: (endpoint) => adminMembersAPI.request(endpoint, { method: 'GET' }),
  post: (endpoint, data) => adminMembersAPI.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => adminMembersAPI.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => adminMembersAPI.request(endpoint, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (season) => adminMembersAPI.get(`/dashboard${season ? `?season=${season}` : ''}`),

  // Licences
  getLicenses: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminMembersAPI.get(`/licenses${query ? `?${query}` : ''}`);
  },
  getLicense: (id) => adminMembersAPI.get(`/licenses/${id}`),
  createLicense: (data) => adminMembersAPI.post('/licenses', data),
  updateLicense: (id, data) => adminMembersAPI.put(`/licenses/${id}`, data),
  deleteLicense: (id) => adminMembersAPI.delete(`/licenses/${id}`),
  importLicenses: (licenses, season) => adminMembersAPI.post('/licenses/import', { licenses, season }),
  exportLicenses: (season) => adminMembersAPI.get(`/licenses/export?season=${season}`),

  // Invitations
  createInvitation: (licenseId, data) => adminMembersAPI.post(`/licenses/${licenseId}/invitations`, data),
  revokeInvitation: (id) => adminMembersAPI.delete(`/invitations/${id}`),

  // Comptes
  getAccounts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return adminMembersAPI.get(`/accounts${query ? `?${query}` : ''}`);
  },
  getAccount: (id) => adminMembersAPI.get(`/accounts/${id}`),
  updateAccount: (id, data) => adminMembersAPI.put(`/accounts/${id}`, data),
  deleteAccount: (id) => adminMembersAPI.delete(`/accounts/${id}`),
  linkLicenseToAccount: (accountId, licenseId, relationship) =>
    adminMembersAPI.post(`/accounts/${accountId}/licenses/${licenseId}`, { relationship }),
  unlinkLicenseFromAccount: (accountId, licenseId) =>
    adminMembersAPI.delete(`/accounts/${accountId}/licenses/${licenseId}`)
};

// =====================================================
// VARIABLES GLOBALES
// =====================================================

let currentSeason = getCurrentSeason();
let currentLicensesPage = 1;
let currentAccountsPage = 1;

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

// =====================================================
// DASHBOARD ADHÉRENTS
// =====================================================

async function renderAdminMembersDashboard() {
  const container = document.getElementById('admin-content');

  container.innerHTML = `
    <div class="admin-page-header">
      <h1>Gestion des Adhérents</h1>
      <div class="admin-header-actions">
        <select id="season-select" class="form-select" onchange="changeSeason(this.value)">
          ${generateSeasonOptions()}
        </select>
      </div>
    </div>
    <div id="members-dashboard-content">
      <div class="loading-spinner"></div>
    </div>
  `;

  await loadMembersDashboard();
}

async function loadMembersDashboard() {
  const container = document.getElementById('members-dashboard-content');

  try {
    const response = await adminMembersAPI.getDashboard(currentSeason);
    const { stats, categoryStats, recentAccounts } = response.data;

    container.innerHTML = `
      <!-- Stats cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalLicenses}</div>
          <div class="stat-label">Licences ${currentSeason}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalAccounts}</div>
          <div class="stat-label">Comptes membres</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.linkedLicenses}</div>
          <div class="stat-label">Licences rattachées</div>
        </div>
        <div class="stat-card ${stats.linkRate < 50 ? 'warning' : 'success'}">
          <div class="stat-value">${stats.linkRate}%</div>
          <div class="stat-label">Taux de rattachement</div>
        </div>
      </div>

      <!-- Navigation rapide -->
      <div class="quick-actions">
        <button onclick="renderAdminLicensesList()" class="btn btn-primary">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"/></svg>
          Gérer les licences
        </button>
        <button onclick="renderAdminAccountsList()" class="btn btn-outline">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          Gérer les comptes
        </button>
        <button onclick="showImportModal()" class="btn btn-outline">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
          Importer des licences
        </button>
        <button onclick="exportLicenses()" class="btn btn-outline">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Exporter
        </button>
      </div>

      <div class="dashboard-grid">
        <!-- Stats par catégorie -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h3>Répartition par catégorie</h3>
          </div>
          <div class="admin-card-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Total</th>
                  <th>Garçons</th>
                  <th>Filles</th>
                </tr>
              </thead>
              <tbody>
                ${categoryStats.map(c => `
                  <tr>
                    <td><strong>${c.category || 'Non assigné'}</strong></td>
                    <td>${c.count}</td>
                    <td>${c.male}</td>
                    <td>${c.female}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Derniers comptes -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h3>Dernières inscriptions</h3>
          </div>
          <div class="admin-card-body">
            ${recentAccounts.length > 0 ? `
              <ul class="recent-list">
                ${recentAccounts.map(a => `
                  <li class="recent-item">
                    <div class="recent-info">
                      <strong>${a.first_name} ${a.last_name}</strong>
                      <span>${a.email}</span>
                    </div>
                    <div class="recent-meta">
                      ${a.is_verified
                        ? '<span class="badge badge-success">Vérifié</span>'
                        : '<span class="badge badge-warning">Non vérifié</span>'}
                      <span class="date">${new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : '<p class="text-muted">Aucune inscription récente</p>'}
          </div>
        </div>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
  }
}

function changeSeason(season) {
  currentSeason = season;
  loadMembersDashboard();
}

function generateSeasonOptions() {
  const current = getCurrentSeason();
  const years = [];
  const startYear = 2020;
  const currentYear = new Date().getFullYear();

  for (let y = currentYear + 1; y >= startYear; y--) {
    const season = `${y}-${y + 1}`;
    const selected = season === currentSeason ? 'selected' : '';
    years.push(`<option value="${season}" ${selected}>${season}</option>`);
  }

  return years.join('');
}

// =====================================================
// LISTE DES LICENCES
// =====================================================

async function renderAdminLicensesList() {
  const container = document.getElementById('admin-content');

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-header-left">
        <button onclick="renderAdminMembersDashboard()" class="btn btn-outline btn-sm">
          &larr; Retour
        </button>
        <h1>Licences</h1>
      </div>
      <div class="admin-header-actions">
        <select id="season-filter" class="form-select" onchange="filterLicenses()">
          ${generateSeasonOptions()}
        </select>
        <select id="category-filter" class="form-select" onchange="filterLicenses()">
          <option value="">Toutes catégories</option>
          <option value="U7">U7</option>
          <option value="U9">U9</option>
          <option value="U11">U11</option>
          <option value="U13">U13</option>
          <option value="U15">U15</option>
          <option value="U17">U17</option>
          <option value="U19">U19</option>
          <option value="Seniors">Seniors</option>
          <option value="Vétérans">Vétérans</option>
        </select>
        <select id="linked-filter" class="form-select" onchange="filterLicenses()">
          <option value="">Toutes</option>
          <option value="true">Rattachées</option>
          <option value="false">Non rattachées</option>
        </select>
        <input type="text" id="search-licenses" class="form-input" placeholder="Rechercher..." onkeyup="debounceSearch(filterLicenses)">
        <button onclick="showCreateLicenseModal()" class="btn btn-primary">+ Nouvelle licence</button>
      </div>
    </div>
    <div id="licenses-list-content">
      <div class="loading-spinner"></div>
    </div>
  `;

  await loadLicensesList();
}

async function loadLicensesList(page = 1) {
  const container = document.getElementById('licenses-list-content');
  currentLicensesPage = page;

  const params = {
    season: document.getElementById('season-filter')?.value || currentSeason,
    page,
    limit: 50
  };

  const category = document.getElementById('category-filter')?.value;
  if (category) params.category = category;

  const linked = document.getElementById('linked-filter')?.value;
  if (linked) params.linked = linked;

  const search = document.getElementById('search-licenses')?.value;
  if (search) params.search = search;

  try {
    const response = await adminMembersAPI.getLicenses(params);
    const { licenses, pagination } = response.data;

    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>N° Licence</th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Équipe</th>
              <th>Compte lié</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${licenses.length > 0 ? licenses.map(l => `
              <tr>
                <td><code>${l.license_number}</code></td>
                <td>
                  <strong>${l.first_name} ${l.last_name}</strong>
                  <br><small class="text-muted">${l.email || '-'}</small>
                </td>
                <td>${l.category || '-'}</td>
                <td>${l.team_name || '-'}</td>
                <td>
                  ${l.account_email
                    ? `<span class="badge badge-success">${l.account_first_name} ${l.account_last_name}</span>`
                    : '<span class="badge badge-warning">Non rattachée</span>'}
                </td>
                <td class="actions">
                  <button onclick="showLicenseDetails(${l.id})" class="btn btn-xs btn-outline">Voir</button>
                  <button onclick="showEditLicenseModal(${l.id})" class="btn btn-xs btn-outline">Modifier</button>
                  ${!l.account_email ? `
                    <button onclick="showCreateInvitationModal(${l.id})" class="btn btn-xs btn-primary">Inviter</button>
                  ` : ''}
                </td>
              </tr>
            `).join('') : '<tr><td colspan="6" class="text-center">Aucune licence trouvée</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      ${pagination.pages > 1 ? `
        <div class="pagination">
          ${pagination.page > 1 ? `<button onclick="loadLicensesList(${pagination.page - 1})" class="btn btn-sm btn-outline">&laquo; Précédent</button>` : ''}
          <span class="pagination-info">Page ${pagination.page} / ${pagination.pages} (${pagination.total} résultats)</span>
          ${pagination.page < pagination.pages ? `<button onclick="loadLicensesList(${pagination.page + 1})" class="btn btn-sm btn-outline">Suivant &raquo;</button>` : ''}
        </div>
      ` : ''}
    `;

  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
  }
}

let searchTimeout;
function debounceSearch(callback) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(callback, 300);
}

function filterLicenses() {
  loadLicensesList(1);
}

// =====================================================
// DÉTAILS LICENCE
// =====================================================

async function showLicenseDetails(id) {
  try {
    const response = await adminMembersAPI.getLicense(id);
    const { license, linkedAccounts, invitations } = response.data;

    const modal = createModal('Détails de la licence', `
      <div class="license-details">
        <div class="details-section">
          <h4>Informations personnelles</h4>
          <div class="details-grid">
            <div class="detail-item">
              <label>N° Licence</label>
              <span><code>${license.license_number}</code></span>
            </div>
            <div class="detail-item">
              <label>Nom complet</label>
              <span>${license.first_name} ${license.last_name}</span>
            </div>
            <div class="detail-item">
              <label>Date de naissance</label>
              <span>${license.birth_date ? new Date(license.birth_date).toLocaleDateString('fr-FR') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Genre</label>
              <span>${license.gender === 'M' ? 'Masculin' : 'Féminin'}</span>
            </div>
            <div class="detail-item">
              <label>Catégorie</label>
              <span>${license.category || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Équipe</label>
              <span>${license.team_name || '-'}</span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <h4>Contact</h4>
          <div class="details-grid">
            <div class="detail-item">
              <label>Email</label>
              <span>${license.email || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Téléphone</label>
              <span>${license.phone || '-'}</span>
            </div>
            <div class="detail-item full-width">
              <label>Adresse</label>
              <span>${license.address ? `${license.address}, ${license.postal_code} ${license.city}` : '-'}</span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <h4>Comptes rattachés</h4>
          ${linkedAccounts.length > 0 ? `
            <ul class="linked-accounts-list">
              ${linkedAccounts.map(a => `
                <li>
                  <strong>${a.first_name} ${a.last_name}</strong> (${a.email})
                  <span class="badge">${a.relationship}</span>
                  ${a.is_primary ? '<span class="badge badge-gold">Principal</span>' : ''}
                </li>
              `).join('')}
            </ul>
          ` : `
            <p class="text-muted">Aucun compte rattaché</p>
            <button onclick="showCreateInvitationModal(${license.id})" class="btn btn-sm btn-primary">Créer une invitation</button>
          `}
        </div>

        ${invitations.length > 0 ? `
          <div class="details-section">
            <h4>Invitations en cours</h4>
            <ul class="invitations-list">
              ${invitations.map(i => `
                <li>
                  <code>${i.invitation_code}</code>
                  ${i.invited_email ? `<span>Pour: ${i.invited_email}</span>` : ''}
                  <span>Expire: ${new Date(i.expires_at).toLocaleDateString('fr-FR')}</span>
                  <button onclick="revokeInvitation(${i.id})" class="btn btn-xs btn-danger-outline">Révoquer</button>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${license.notes ? `
          <div class="details-section">
            <h4>Notes internes</h4>
            <p>${license.notes}</p>
          </div>
        ` : ''}
      </div>

      <div class="modal-actions">
        <button onclick="showEditLicenseModal(${license.id})" class="btn btn-primary">Modifier</button>
        <button onclick="deleteLicense(${license.id})" class="btn btn-danger-outline">Supprimer</button>
      </div>
    `);

    document.body.appendChild(modal);

  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

// =====================================================
// CRÉATION/MODIFICATION LICENCE
// =====================================================

function showCreateLicenseModal() {
  const modal = createModal('Nouvelle licence', `
    <form id="create-license-form" onsubmit="createLicense(event)">
      <div class="form-row">
        <div class="form-group">
          <label>N° Licence *</label>
          <input type="text" name="license_number" required>
        </div>
        <div class="form-group">
          <label>Saison *</label>
          <input type="text" name="season" value="${currentSeason}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" name="first_name" required>
        </div>
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" name="last_name" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de naissance *</label>
          <input type="date" name="birth_date" required>
        </div>
        <div class="form-group">
          <label>Genre *</label>
          <select name="gender" required>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie</label>
          <select name="category">
            <option value="">Non assignée</option>
            <option value="U7">U7</option>
            <option value="U9">U9</option>
            <option value="U11">U11</option>
            <option value="U13">U13</option>
            <option value="U15">U15</option>
            <option value="U17">U17</option>
            <option value="U19">U19</option>
            <option value="Seniors">Seniors</option>
            <option value="Vétérans">Vétérans</option>
          </select>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email">
        </div>
      </div>
      <div class="form-group">
        <label>Téléphone</label>
        <input type="tel" name="phone">
      </div>

      <div id="create-license-error" class="alert alert-error" style="display: none;"></div>

      <div class="modal-actions">
        <button type="button" onclick="closeModal()" class="btn btn-outline">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer</button>
      </div>
    </form>
  `);

  document.body.appendChild(modal);
}

async function createLicense(e) {
  e.preventDefault();
  const form = e.target;
  const errorDiv = document.getElementById('create-license-error');

  const data = {
    license_number: form.license_number.value,
    first_name: form.first_name.value,
    last_name: form.last_name.value,
    birth_date: form.birth_date.value,
    gender: form.gender.value,
    category: form.category.value || null,
    email: form.email.value || null,
    phone: form.phone.value || null,
    season: form.season.value
  };

  try {
    await adminMembersAPI.createLicense(data);
    closeModal();
    showAdminNotification('Licence créée avec succès', 'success');
    loadLicensesList(currentLicensesPage);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

async function showEditLicenseModal(id) {
  try {
    const response = await adminMembersAPI.getLicense(id);
    const license = response.data.license;

    const modal = createModal('Modifier la licence', `
      <form id="edit-license-form" onsubmit="updateLicense(event, ${id})">
        <div class="form-row">
          <div class="form-group">
            <label>N° Licence *</label>
            <input type="text" name="license_number" value="${license.license_number}" required>
          </div>
          <div class="form-group">
            <label>Saison</label>
            <input type="text" name="season" value="${license.season}" readonly>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Prénom *</label>
            <input type="text" name="first_name" value="${license.first_name}" required>
          </div>
          <div class="form-group">
            <label>Nom *</label>
            <input type="text" name="last_name" value="${license.last_name}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date de naissance *</label>
            <input type="date" name="birth_date" value="${license.birth_date?.split('T')[0] || ''}" required>
          </div>
          <div class="form-group">
            <label>Genre *</label>
            <select name="gender" required>
              <option value="M" ${license.gender === 'M' ? 'selected' : ''}>Masculin</option>
              <option value="F" ${license.gender === 'F' ? 'selected' : ''}>Féminin</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Catégorie</label>
            <select name="category">
              <option value="">Non assignée</option>
              ${['U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Seniors', 'Vétérans'].map(c =>
                `<option value="${c}" ${license.category === c ? 'selected' : ''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" value="${license.email || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Téléphone</label>
            <input type="tel" name="phone" value="${license.phone || ''}">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select name="is_active">
              <option value="true" ${license.is_active ? 'selected' : ''}>Actif</option>
              <option value="false" ${!license.is_active ? 'selected' : ''}>Inactif</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Notes internes</label>
          <textarea name="notes" rows="3">${license.notes || ''}</textarea>
        </div>

        <div id="edit-license-error" class="alert alert-error" style="display: none;"></div>

        <div class="modal-actions">
          <button type="button" onclick="closeModal()" class="btn btn-outline">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    `);

    document.body.appendChild(modal);

  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

async function updateLicense(e, id) {
  e.preventDefault();
  const form = e.target;
  const errorDiv = document.getElementById('edit-license-error');

  const data = {
    license_number: form.license_number.value,
    first_name: form.first_name.value,
    last_name: form.last_name.value,
    birth_date: form.birth_date.value,
    gender: form.gender.value,
    category: form.category.value || null,
    email: form.email.value || null,
    phone: form.phone.value || null,
    is_active: form.is_active.value === 'true',
    notes: form.notes.value || null
  };

  try {
    await adminMembersAPI.updateLicense(id, data);
    closeModal();
    showAdminNotification('Licence mise à jour', 'success');
    loadLicensesList(currentLicensesPage);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

async function deleteLicense(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette licence ?')) return;

  try {
    await adminMembersAPI.deleteLicense(id);
    closeModal();
    showAdminNotification('Licence supprimée', 'success');
    loadLicensesList(currentLicensesPage);
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

// =====================================================
// INVITATIONS
// =====================================================

function showCreateInvitationModal(licenseId) {
  const modal = createModal('Créer une invitation', `
    <form id="invitation-form" onsubmit="createInvitation(event, ${licenseId})">
      <div class="form-group">
        <label>Email du destinataire (optionnel)</label>
        <input type="email" name="email" placeholder="parent@email.com">
        <small>Si renseigné, seul cet email pourra utiliser le code</small>
      </div>
      <div class="form-group">
        <label>Type de relation</label>
        <select name="relationship">
          <option value="parent">Parent</option>
          <option value="self">Le licencié lui-même</option>
          <option value="tutor">Tuteur légal</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div class="form-group">
        <label>Validité (jours)</label>
        <input type="number" name="expirationDays" value="7" min="1" max="30">
      </div>

      <div id="invitation-error" class="alert alert-error" style="display: none;"></div>

      <div class="modal-actions">
        <button type="button" onclick="closeModal()" class="btn btn-outline">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer et envoyer</button>
      </div>
    </form>
  `);

  document.body.appendChild(modal);
}

async function createInvitation(e, licenseId) {
  e.preventDefault();
  const form = e.target;
  const errorDiv = document.getElementById('invitation-error');

  const data = {
    email: form.email.value || null,
    relationship: form.relationship.value,
    expirationDays: parseInt(form.expirationDays.value)
  };

  try {
    const response = await adminMembersAPI.createInvitation(licenseId, data);
    closeModal();
    showAdminNotification(response.message, 'success');

    // Afficher le code
    const codeModal = createModal('Code d\'invitation créé', `
      <div class="text-center">
        <p>Code d'invitation :</p>
        <div class="invitation-code-display">${response.data.code}</div>
        <p class="text-muted">Expire le ${new Date(response.data.expiresAt).toLocaleDateString('fr-FR')}</p>
        ${data.email ? `<p>Un email a été envoyé à ${data.email}</p>` : ''}
      </div>
      <div class="modal-actions">
        <button onclick="closeModal()" class="btn btn-primary">Fermer</button>
      </div>
    `);
    document.body.appendChild(codeModal);

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}

async function revokeInvitation(id) {
  if (!confirm('Révoquer cette invitation ?')) return;

  try {
    await adminMembersAPI.revokeInvitation(id);
    showAdminNotification('Invitation révoquée', 'success');
    // Recharger les détails
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

// =====================================================
// LISTE DES COMPTES
// =====================================================

async function renderAdminAccountsList() {
  const container = document.getElementById('admin-content');

  container.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-header-left">
        <button onclick="renderAdminMembersDashboard()" class="btn btn-outline btn-sm">
          &larr; Retour
        </button>
        <h1>Comptes membres</h1>
      </div>
      <div class="admin-header-actions">
        <select id="verified-filter" class="form-select" onchange="filterAccounts()">
          <option value="">Tous</option>
          <option value="true">Vérifiés</option>
          <option value="false">Non vérifiés</option>
        </select>
        <input type="text" id="search-accounts" class="form-input" placeholder="Rechercher..." onkeyup="debounceSearch(filterAccounts)">
      </div>
    </div>
    <div id="accounts-list-content">
      <div class="loading-spinner"></div>
    </div>
  `;

  await loadAccountsList();
}

async function loadAccountsList(page = 1) {
  const container = document.getElementById('accounts-list-content');
  currentAccountsPage = page;

  const params = { page, limit: 50 };

  const verified = document.getElementById('verified-filter')?.value;
  if (verified) params.verified = verified;

  const search = document.getElementById('search-accounts')?.value;
  if (search) params.search = search;

  try {
    const response = await adminMembersAPI.getAccounts(params);
    const accounts = response.data.accounts;

    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Licences</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.length > 0 ? accounts.map(a => `
              <tr>
                <td><strong>${a.fullName}</strong></td>
                <td>${a.email}</td>
                <td><span class="badge">${a.role}</span></td>
                <td>${a.licenseCount}</td>
                <td>
                  ${a.isVerified
                    ? '<span class="badge badge-success">Vérifié</span>'
                    : '<span class="badge badge-warning">Non vérifié</span>'}
                  ${!a.isActive ? '<span class="badge badge-danger">Désactivé</span>' : ''}
                </td>
                <td>${a.lastLogin ? new Date(a.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</td>
                <td class="actions">
                  <button onclick="showAccountDetails(${a.id})" class="btn btn-xs btn-outline">Voir</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="7" class="text-center">Aucun compte trouvé</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
  }
}

function filterAccounts() {
  loadAccountsList(1);
}

async function showAccountDetails(id) {
  try {
    const response = await adminMembersAPI.getAccount(id);
    const { account, licenses, sessions } = response.data;

    const modal = createModal('Détails du compte', `
      <div class="account-details">
        <div class="details-section">
          <h4>Informations</h4>
          <div class="details-grid">
            <div class="detail-item">
              <label>Nom</label>
              <span>${account.first_name} ${account.last_name}</span>
            </div>
            <div class="detail-item">
              <label>Email</label>
              <span>${account.email}</span>
            </div>
            <div class="detail-item">
              <label>Rôle</label>
              <span>${account.role}</span>
            </div>
            <div class="detail-item">
              <label>Vérifié</label>
              <span>${account.is_verified ? 'Oui' : 'Non'}</span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <h4>Licences rattachées (${licenses.length})</h4>
          ${licenses.length > 0 ? `
            <ul class="licenses-mini-list">
              ${licenses.map(l => `
                <li>
                  <strong>${l.first_name} ${l.last_name}</strong> (${l.license_number})
                  <span class="badge">${l.relationship}</span>
                  <button onclick="unlinkFromAccount(${id}, ${l.id})" class="btn btn-xs btn-danger-outline">Détacher</button>
                </li>
              `).join('')}
            </ul>
          ` : '<p class="text-muted">Aucune licence rattachée</p>'}
        </div>

        <div class="details-section">
          <h4>Actions</h4>
          <div class="action-buttons">
            <button onclick="toggleAccountVerified(${id}, ${!account.is_verified})" class="btn btn-sm btn-outline">
              ${account.is_verified ? 'Retirer la vérification' : 'Marquer comme vérifié'}
            </button>
            <button onclick="toggleAccountActive(${id}, ${!account.is_active})" class="btn btn-sm ${account.is_active ? 'btn-danger-outline' : 'btn-success-outline'}">
              ${account.is_active ? 'Désactiver le compte' : 'Réactiver le compte'}
            </button>
            <button onclick="deleteAccount(${id})" class="btn btn-sm btn-danger">Supprimer</button>
          </div>
        </div>
      </div>

      <div class="modal-actions">
        <button onclick="closeModal()" class="btn btn-outline">Fermer</button>
      </div>
    `);

    document.body.appendChild(modal);

  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

async function toggleAccountVerified(id, verified) {
  try {
    await adminMembersAPI.updateAccount(id, { is_verified: verified });
    closeModal();
    showAdminNotification('Compte mis à jour', 'success');
    loadAccountsList(currentAccountsPage);
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

async function toggleAccountActive(id, active) {
  try {
    await adminMembersAPI.updateAccount(id, { is_active: active });
    closeModal();
    showAdminNotification('Compte mis à jour', 'success');
    loadAccountsList(currentAccountsPage);
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

async function deleteAccount(id) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte ? Cette action est irréversible.')) return;

  try {
    await adminMembersAPI.deleteAccount(id);
    closeModal();
    showAdminNotification('Compte supprimé', 'success');
    loadAccountsList(currentAccountsPage);
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

async function unlinkFromAccount(accountId, licenseId) {
  if (!confirm('Détacher cette licence du compte ?')) return;

  try {
    await adminMembersAPI.unlinkLicenseFromAccount(accountId, licenseId);
    closeModal();
    showAdminNotification('Licence détachée', 'success');
    showAccountDetails(accountId);
  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

// =====================================================
// IMPORT/EXPORT
// =====================================================

function showImportModal() {
  const modal = createModal('Importer des licences', `
    <div class="import-tabs">
      <button class="import-tab active" onclick="switchImportTab('file')">Fichier CSV</button>
      <button class="import-tab" onclick="switchImportTab('paste')">Coller les données</button>
    </div>

    <form id="import-form">
      <div class="form-group">
        <label>Saison</label>
        <input type="text" name="season" value="${currentSeason}" required>
      </div>

      <!-- Onglet Upload fichier -->
      <div id="import-tab-file" class="import-tab-content">
        <div class="import-file-zone" id="import-dropzone">
          <input type="file" id="csv-file-input" accept=".csv" style="display: none;" onchange="handleFileSelect(event)">
          <svg viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M14,2H6C4.89,2 4,2.89 4,4V20C4,21.1 4.89,22 6,22H18C19.11,22 20,21.1 20,20V8L14,2M18,20H6V4H13V9H18V20M15,11V19H9L12,15.5L9.5,12.5L15,11Z"/></svg>
          <p><strong>Glissez un fichier CSV ici</strong></p>
          <p class="text-muted">ou <a href="#" onclick="document.getElementById('csv-file-input').click(); return false;">parcourir</a></p>
          <p id="selected-file-name" class="text-muted"></p>
        </div>
        <div class="import-template">
          <a href="/api/admin/members/licenses/import/template" download class="btn btn-sm btn-outline">
            Télécharger le modèle CSV
          </a>
        </div>
      </div>

      <!-- Onglet Coller données -->
      <div id="import-tab-paste" class="import-tab-content" style="display: none;">
        <div class="import-instructions">
          <p>Format attendu :</p>
          <code>license_number,first_name,last_name,birth_date,gender,category,email,phone</code>
        </div>
        <div class="form-group">
          <label>Données CSV</label>
          <textarea name="csvData" rows="8" placeholder="Collez les données ici..."></textarea>
        </div>
      </div>

      <div id="import-error" class="alert alert-error" style="display: none;"></div>
      <div id="import-result" class="alert alert-success" style="display: none;"></div>

      <div class="modal-actions">
        <button type="button" onclick="closeModal()" class="btn btn-outline">Annuler</button>
        <button type="submit" class="btn btn-primary" onclick="importLicenses(event)">Importer</button>
      </div>
    </form>
  `);

  document.body.appendChild(modal);

  // Setup drag and drop
  const dropzone = document.getElementById('import-dropzone');
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect({ target: { files: e.dataTransfer.files } });
    }
  });
}

let selectedCSVFile = null;

function switchImportTab(tab) {
  document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.import-tab-content').forEach(c => c.style.display = 'none');

  document.querySelector(`.import-tab[onclick*="${tab}"]`).classList.add('active');
  document.getElementById(`import-tab-${tab}`).style.display = 'block';
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file && file.name.endsWith('.csv')) {
    selectedCSVFile = file;
    document.getElementById('selected-file-name').textContent = `Fichier sélectionné : ${file.name}`;
  }
}

async function importLicenses(e) {
  e.preventDefault();
  const form = document.getElementById('import-form');
  const errorDiv = document.getElementById('import-error');
  const resultDiv = document.getElementById('import-result');
  const submitBtn = form.querySelector('button[type="submit"]');

  errorDiv.style.display = 'none';
  resultDiv.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Import en cours...';

  try {
    const season = form.querySelector('input[name="season"]').value;
    let response;

    // Si un fichier est sélectionné, utiliser l'upload
    if (selectedCSVFile) {
      const formData = new FormData();
      formData.append('file', selectedCSVFile);
      formData.append('season', season);

      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/members/licenses/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });

      response = await res.json();
      if (!res.ok) throw new Error(response.error || 'Erreur d\'import');
    }
    // Sinon, utiliser les données collées
    else {
      const csvData = form.querySelector('textarea[name="csvData"]')?.value;
      if (!csvData || csvData.trim().length === 0) {
        throw new Error('Veuillez sélectionner un fichier CSV ou coller des données');
      }

      const licenses = parseCSV(csvData);
      if (licenses.length === 0) {
        throw new Error('Aucune donnée valide trouvée');
      }

      response = await adminMembersAPI.importLicenses(licenses, season);
    }

    resultDiv.innerHTML = `
      <strong>Import terminé !</strong><br>
      ${response.data.imported} licences créées<br>
      ${response.data.updated} licences mises à jour<br>
      ${response.data.skipped || 0} ignorées<br>
      ${response.data.errors.length} erreurs
    `;
    resultDiv.style.display = 'block';

    if (response.data.errors && response.data.errors.length > 0) {
      const errorsHtml = response.data.errors.map(e =>
        `Ligne ${e.line || '?'}: ${e.license || ''} - ${e.error}`
      ).join('<br>');
      errorDiv.innerHTML = `<strong>Erreurs :</strong><br>${errorsHtml}`;
      errorDiv.style.display = 'block';
    }

    // Reset
    selectedCSVFile = null;
    document.getElementById('selected-file-name').textContent = '';

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Importer';
  }
}

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const licenses = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 5) continue;

    const license = {};
    headers.forEach((h, idx) => {
      license[h] = values[idx] || null;
    });

    if (license.license_number && license.first_name && license.last_name) {
      licenses.push(license);
    }
  }

  return licenses;
}

async function exportLicenses() {
  try {
    const response = await adminMembersAPI.exportLicenses(currentSeason);
    const licenses = response.data.licenses;

    // Générer CSV
    const headers = ['license_number', 'first_name', 'last_name', 'birth_date', 'gender', 'category', 'email', 'phone', 'team_name', 'account_email'];
    const csv = [
      headers.join(','),
      ...licenses.map(l => headers.map(h => `"${(l[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Télécharger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `licences_${currentSeason}.csv`;
    link.click();

    showAdminNotification('Export téléchargé', 'success');

  } catch (error) {
    showAdminNotification(error.message, 'error');
  }
}

// =====================================================
// UTILITAIRES
// =====================================================

function createModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button onclick="closeModal()" class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;
  return modal;
}

function closeModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) modal.remove();
}

function showAdminNotification(message, type = 'info') {
  // Utiliser le système de notification existant si disponible
  if (typeof showNotification === 'function') {
    showNotification(message, type);
    return;
  }

  const notification = document.createElement('div');
  notification.className = `admin-notification ${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">&times;</button>
  `;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}
