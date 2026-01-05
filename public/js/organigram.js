/**
 * MAGNY FC 78 - Organigramme Dynamique
 *
 * Ce module gère l'affichage et la modification dynamique de l'organigramme du comité.
 * Les données sont chargées depuis la base de données via l'API.
 */

console.log('[Organigramme] Script chargé - version 2024-01-05');

class Organigramme {
  constructor(containerId, options = {}) {
    console.log('[Organigramme] Constructeur appelé');
    this.container = document.getElementById(containerId);
    this.apiBase = options.apiBase || '/api';
    this.data = null;
    this.currentOrgId = null;
    this.adminMode = false;
    this.modal = null;
    this.currentEditMember = null;
  }

  /**
   * Initialise l'organigramme
   */
  async init() {
    console.log('[Organigramme] init() appelé');
    try {
      await this.loadData();
      // Sélectionner le premier organigramme actif par défaut
      const activeOrgs = this.data.organigrammes.filter(o => o.actif);
      if (activeOrgs.length > 0) {
        this.currentOrgId = activeOrgs[0].id;
      }
      this.render();
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur initialisation organigramme:', error);
      this.showError('Impossible de charger l\'organigramme: ' + error.message);
    }
  }

  /**
   * Charge les données depuis l'API (base de données)
   */
  async loadData() {
    console.log('[Organigramme] loadData() - Appel API:', `${this.apiBase}/organigrammes`);

    const response = await fetch(`${this.apiBase}/organigrammes`);
    console.log('[Organigramme] Réponse:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Organigramme] Données reçues:', result);

    if (!result.success || !result.data.organigrammes) {
      throw new Error('Format de réponse invalide');
    }

    // Transformer les données API en format compatible
    this.data = {
      config: {
        clubNom: 'MAGNY FC 78',
        logoUrl: '/assets/images/logo.png',
        defaultPhoto: '/assets/images/default-avatar.png'
      },
      organigrammes: result.data.organigrammes.map(org => ({
        ...org,
        actif: true,
        membres: (org.membres || []).map(m => ({
          ...m,
          parentId: m.parent_id // Normaliser le nom du champ
        }))
      }))
    };

    console.log('[Organigramme] Données transformées:', this.data);
    return this.data;
  }

  /**
   * Sauvegarde l'ordre des organigrammes via l'API
   */
  async saveOrganigrammesOrdre(ordres) {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.apiBase}/admin/organigrammes-ordre`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ordres })
      });
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Erreur sauvegarde ordre:', error);
      return false;
    }
  }

  /**
   * Sauvegarde un membre via l'API
   */
  async saveMemberToApi(membre, isNew = false) {
    try {
      const token = localStorage.getItem('auth_token');
      const orgId = this.currentOrgId;
      const url = isNew
        ? `${this.apiBase}/admin/organigrammes/${orgId}/membres`
        : `${this.apiBase}/admin/organigrammes/${orgId}/membres/${membre.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: membre.id,
          nom: membre.nom,
          role: membre.role,
          photo: membre.photo,
          niveau: membre.niveau,
          parent_id: membre.parentId,
          ordre: membre.ordre
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Erreur de sauvegarde');
      }
      return result;
    } catch (error) {
      console.error('Erreur sauvegarde membre:', error);
      throw error;
    }
  }

  /**
   * Supprime un membre via l'API
   */
  async deleteMemberFromApi(membreId) {
    try {
      const token = localStorage.getItem('auth_token');
      const orgId = this.currentOrgId;
      const response = await fetch(`${this.apiBase}/admin/organigrammes/${orgId}/membres/${membreId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Erreur de suppression');
      }
      return true;
    } catch (error) {
      console.error('Erreur suppression membre:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde les données localement (fallback si API non disponible)
   */
  async saveData() {
    // Sauvegarde locale en fallback
    localStorage.setItem('organigramme_data', JSON.stringify(this.data));
    console.log('Données sauvegardées localement:', this.data);
  }

  /**
   * Récupère l'organigramme courant
   */
  getCurrentOrg() {
    return this.data.organigrammes.find(o => o.id === this.currentOrgId);
  }

  /**
   * Change l'organigramme affiché
   */
  switchOrg(orgId) {
    this.currentOrgId = orgId;
    this.render();
    this.setupEventListeners();
  }

  /**
   * Récupère les membres par niveau
   */
  getMembersByLevel(level) {
    const org = this.getCurrentOrg();
    if (!org) return [];
    return org.membres
      .filter(m => m.niveau === level)
      .sort((a, b) => a.ordre - b.ordre);
  }

  /**
   * Récupère les subordonnés d'un membre
   */
  getSubordinates(parentId) {
    const org = this.getCurrentOrg();
    if (!org) return [];
    return org.membres
      .filter(m => m.parentId === parentId)
      .sort((a, b) => a.ordre - b.ordre);
  }

  /**
   * Récupère un membre par son ID
   */
  getMemberById(id) {
    const org = this.getCurrentOrg();
    if (!org) return null;
    return org.membres.find(m => m.id === id);
  }

  /**
   * Génère le HTML d'un hexagone avec photo
   */
  renderHexagon(member) {
    const photoSrc = member.photo || this.data.config.defaultPhoto;
    const hasPhoto = member.photo && member.photo !== '';

    return `
      <div class="hexagon-container" data-member-id="${member.id}">
        <div class="hexagon">
          <div class="hexagon-inner">
            ${hasPhoto ?
              `<img src="${photoSrc}" alt="${member.nom}" data-fallback="placeholder">`
              :
              `<div class="placeholder">
                <svg viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>`
            }
          </div>
        </div>
        <div class="org-actions">
          <button class="org-action-btn edit" data-action="edit-member" data-member-id="${member.id}" title="Modifier">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button class="org-action-btn delete" data-action="delete-member" data-member-id="${member.id}" title="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Génère le HTML d'un membre
   */
  renderMember(member) {
    return `
      <div class="org-member" data-member-id="${member.id}">
        ${this.renderHexagon(member)}
        <div class="member-info">
          <div class="member-role">${member.role}</div>
          <div class="member-name">${member.nom}</div>
        </div>
      </div>
    `;
  }

  /**
   * Génère l'HTML complet de l'organigramme
   */
  render() {
    const config = this.data.config;
    const currentOrg = this.getCurrentOrg();
    const activeOrgs = this.data.organigrammes.filter(o => o.actif);

    if (!currentOrg) {
      this.container.innerHTML = '<p style="text-align: center; padding: 40px;">Aucun organigramme disponible</p>';
      return;
    }

    const level1 = this.getMembersByLevel(1);
    const level2 = this.getMembersByLevel(2);
    const level3 = this.getMembersByLevel(3);

    // Grouper le niveau 3 par parent
    const level3ByParent = {};
    level3.forEach(m => {
      if (!level3ByParent[m.parentId]) {
        level3ByParent[m.parentId] = [];
      }
      level3ByParent[m.parentId].push(m);
    });

    // Calculer le nombre de membres niveau 2 pour la ligne horizontale
    const level2Count = level2.length;

    // Mettre à jour le titre de la page si l'élément existe
    const headerTitle = document.querySelector('.organigramme-header h1');
    if (headerTitle) {
      headerTitle.textContent = currentOrg.titre;
    }

    let html = `
      <!-- Sélecteur d'organigramme -->
      ${activeOrgs.length > 1 ? `
        <div class="org-selector" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 30px; flex-wrap: wrap;">
          ${activeOrgs.map(org => `
            <button class="org-selector-btn ${org.id === this.currentOrgId ? 'active' : ''}"
                    data-action="switch-org" data-org-id="${org.id}"
                    style="padding: 10px 20px; border: 2px solid #1e3a5f; background: ${org.id === this.currentOrgId ? '#1e3a5f' : 'white'};
                           color: ${org.id === this.currentOrgId ? 'white' : '#1e3a5f'}; border-radius: 25px; cursor: pointer;
                           font-family: var(--font-titre); font-weight: 500; letter-spacing: 1px; transition: all 0.3s ease;">
              ${org.titre.replace('ORGANIGRAMME ', '')}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <!-- Niveau 1: Président/Coordinateur -->
      <div class="org-level org-level-1">
        ${level1.map(m => this.renderMember(m)).join('')}
      </div>

      <!-- Connecteur vertical arrondi du président vers niveau 2 -->
      <svg class="org-svg-connector" width="100%" height="50" style="display: block;">
        <path d="M 50% 0 L 50% 50" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>

      <!-- Ligne horizontale avec coins arrondis niveau 2 -->
      <div class="org-horizontal-wrapper" style="position: relative; height: 30px; width: 80%; max-width: 1000px; margin: 0 auto;">
        <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
          <path d="M 0 0 Q 0 15, 15 15 L calc(100% - 15px) 15 Q 100% 15, 100% 30" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
      </div>

      <!-- Niveau 2: Bureau -->
      <div class="org-level org-level-2" style="padding-top: 0;">
        ${level2.map((m, index) => {
          const subordinates = level3ByParent[m.id] || [];
          const hasSubordinates = subordinates.length > 0;
          const isFirst = index === 0;
          const isLast = index === level2Count - 1;
          const isMiddle = !isFirst && !isLast;

          return `
            <div class="org-group ${hasSubordinates ? 'has-subordinates' : ''}">
              <svg class="org-svg-connector-up" width="50" height="30" style="display: block; margin: 0 auto;">
                ${isFirst ?
                  `<path d="M 25 30 L 25 10 Q 25 0, 35 0 L 50 0" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>` :
                  isLast ?
                  `<path d="M 25 30 L 25 10 Q 25 0, 15 0 L 0 0" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>` :
                  `<path d="M 25 30 L 25 0" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>`
                }
              </svg>
              ${this.renderMember(m)}
              ${hasSubordinates ? `
                <svg class="org-svg-connector-down" width="100" height="40" style="display: block; margin: 10px auto 0;">
                  ${subordinates.length === 1 ?
                    `<path d="M 50 0 L 50 40" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>` :
                    subordinates.length === 2 ?
                    `<path d="M 50 0 L 50 20 M 50 20 Q 50 30, 40 30 L 10 30 L 10 40 M 50 20 Q 50 30, 60 30 L 90 30 L 90 40" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>` :
                    `<path d="M 50 0 L 50 40" stroke="#1e3a5f" stroke-width="2" fill="none" stroke-linecap="round"/>`
                  }
                </svg>
                <div class="org-subordinates" style="display: flex; justify-content: center; gap: 20px;">
                  ${subordinates.map(sub => this.renderMember(sub)).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Niveau 3: Responsables sans parent direct au niveau 2 -->
      ${level3.filter(m => !level2.some(l2 => l2.id === m.parentId)).length > 0 ? `
        <div class="org-level org-level-3">
          ${level3.filter(m => !level2.some(l2 => l2.id === m.parentId)).map(m => this.renderMember(m)).join('')}
        </div>
      ` : ''}

      <!-- Modal d'édition -->
      <div class="org-modal-overlay" id="org-modal">
        <div class="org-modal">
          <div class="org-modal-header">
            <h3 id="modal-title">Modifier un membre</h3>
            <button class="org-modal-close" data-action="close-modal">&times;</button>
          </div>
          <div class="org-modal-body">
            <form id="member-form">
              <input type="hidden" id="member-id">

              <div class="org-form-group">
                <label for="member-nom">Nom</label>
                <input type="text" id="member-nom" required placeholder="Ex: Jean Dupont">
              </div>

              <div class="org-form-group">
                <label for="member-role">Rôle / Fonction</label>
                <input type="text" id="member-role" required placeholder="Ex: Vice Président">
              </div>

              <div class="org-form-group">
                <label for="member-photo">URL de la photo</label>
                <input type="text" id="member-photo" placeholder="/uploads/organigramme/photo.jpg">
                <div class="photo-preview" id="photo-preview" style="display: none;">
                  <img src="" alt="Aperçu">
                </div>
              </div>

              <div class="org-form-group">
                <label for="member-niveau">Niveau hiérarchique</label>
                <select id="member-niveau">
                  <option value="1">Niveau 1 - Direction</option>
                  <option value="2">Niveau 2 - Bureau</option>
                  <option value="3">Niveau 3 - Responsables</option>
                </select>
              </div>

              <div class="org-form-group">
                <label for="member-parent">Rattaché à</label>
                <select id="member-parent">
                  <option value="">Aucun (niveau supérieur)</option>
                </select>
              </div>

              <div class="org-form-group">
                <label for="member-ordre">Ordre d'affichage</label>
                <input type="number" id="member-ordre" min="1" value="1">
              </div>
            </form>
          </div>
          <div class="org-modal-footer">
            <button class="org-btn org-btn-secondary" data-action="close-modal">Annuler</button>
            <button class="org-btn org-btn-primary" data-action="save-member">Enregistrer</button>
          </div>
        </div>
      </div>

      <!-- Bouton ajouter -->
      <button class="add-member-btn" data-action="add-member" title="Ajouter un membre">+</button>
    `;

    this.container.innerHTML = html;
    this.modal = document.getElementById('org-modal');
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Délégation d'événements pour les actions (remplace les onclick inline)
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const memberId = btn.dataset.memberId;

      switch (action) {
        case 'edit-member':
          this.editMember(memberId);
          break;
        case 'delete-member':
          this.deleteMember(memberId);
          break;
        case 'close-modal':
          this.closeModal();
          break;
        case 'save-member':
          this.saveMember();
          break;
        case 'add-member':
          this.addMember();
          break;
        case 'switch-org':
          const orgId = btn.dataset.orgId;
          if (orgId) this.switchOrg(orgId);
          break;
      }
    });

    // Gestionnaire d'erreurs d'images - affiche placeholder si image cassée
    this.container.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG' && e.target.dataset.fallback === 'placeholder') {
        const placeholder = `<div class="placeholder"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>`;
        e.target.parentElement.innerHTML = placeholder;
      }
    }, true);

    // Aperçu de la photo
    const photoInput = document.getElementById('member-photo');
    if (photoInput) {
      photoInput.addEventListener('input', (e) => {
        const preview = document.getElementById('photo-preview');
        const img = preview.querySelector('img');
        if (e.target.value) {
          img.src = e.target.value;
          preview.style.display = 'block';
          img.onerror = () => { preview.style.display = 'none'; };
        } else {
          preview.style.display = 'none';
        }
      });
    }

    // Fermer modal en cliquant en dehors
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }

    // Touche Echap pour fermer le modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.closeModal();
      }
    });
  }

  /**
   * Active/désactive le mode admin
   */
  toggleAdminMode(enabled) {
    this.adminMode = enabled;
    document.body.classList.toggle('admin-mode', enabled);
  }

  /**
   * Ouvre le modal
   */
  openModal(title = 'Modifier un membre') {
    document.getElementById('modal-title').textContent = title;
    this.updateParentOptions();
    this.modal.classList.add('active');
  }

  /**
   * Ferme le modal
   */
  closeModal() {
    this.modal.classList.remove('active');
    this.currentEditMember = null;
    document.getElementById('member-form').reset();
    document.getElementById('photo-preview').style.display = 'none';
  }

  /**
   * Met à jour les options de parent dans le formulaire
   */
  updateParentOptions() {
    const select = document.getElementById('member-parent');
    const currentLevel = parseInt(document.getElementById('member-niveau').value) || 2;

    // Récupérer les membres du niveau supérieur
    const parentLevel = currentLevel - 1;
    const potentialParents = this.getMembersByLevel(parentLevel);

    select.innerHTML = '<option value="">Aucun (niveau supérieur)</option>';
    potentialParents.forEach(p => {
      if (this.currentEditMember && p.id === this.currentEditMember.id) return;
      select.innerHTML += `<option value="${p.id}">${p.role} - ${p.nom}</option>`;
    });
  }

  /**
   * Ouvre le modal pour ajouter un nouveau membre
   */
  addMember() {
    this.currentEditMember = null;
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    this.openModal('Ajouter un membre');
  }

  /**
   * Ouvre le modal pour modifier un membre
   */
  editMember(memberId) {
    const member = this.getMemberById(memberId);
    if (!member) return;

    this.currentEditMember = member;

    document.getElementById('member-id').value = member.id;
    document.getElementById('member-nom').value = member.nom;
    document.getElementById('member-role').value = member.role;
    document.getElementById('member-photo').value = member.photo || '';
    document.getElementById('member-niveau').value = member.niveau;
    document.getElementById('member-ordre').value = member.ordre;

    // Aperçu photo
    if (member.photo) {
      const preview = document.getElementById('photo-preview');
      preview.querySelector('img').src = member.photo;
      preview.style.display = 'block';
    }

    this.openModal('Modifier un membre');

    // Mettre à jour les parents après avoir défini le niveau
    setTimeout(() => {
      this.updateParentOptions();
      document.getElementById('member-parent').value = member.parentId || '';
    }, 0);
  }

  /**
   * Sauvegarde les modifications d'un membre
   */
  async saveMember() {
    const form = document.getElementById('member-form');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = document.getElementById('member-id').value;
    const isNew = !id;
    const memberData = {
      id: id || this.generateId(),
      nom: document.getElementById('member-nom').value.trim(),
      role: document.getElementById('member-role').value.trim(),
      photo: document.getElementById('member-photo').value.trim(),
      niveau: parseInt(document.getElementById('member-niveau').value),
      parentId: document.getElementById('member-parent').value || null,
      ordre: parseInt(document.getElementById('member-ordre').value)
    };

    const currentOrg = this.getCurrentOrg();
    if (!currentOrg) return;

    try {
      // Sauvegarder via l'API
      await this.saveMemberToApi(memberData, isNew);

      // Mettre à jour les données locales
      if (this.currentEditMember) {
        // Mise à jour
        const index = currentOrg.membres.findIndex(m => m.id === id);
        if (index !== -1) {
          currentOrg.membres[index] = memberData;
        }
      } else {
        // Ajout
        currentOrg.membres.push(memberData);
      }

      await this.saveData();
      this.render();
      this.setupEventListeners();
      this.closeModal();
    } catch (error) {
      alert('Erreur lors de la sauvegarde: ' + error.message);
    }
  }

  /**
   * Supprime un membre
   */
  async deleteMember(memberId) {
    const member = this.getMemberById(memberId);
    if (!member) return;

    // Vérifier s'il a des subordonnés
    const subordinates = this.getSubordinates(memberId);
    if (subordinates.length > 0) {
      alert(`Impossible de supprimer ${member.nom}. Ce membre a ${subordinates.length} subordonné(s).`);
      return;
    }

    if (!confirm(`Voulez-vous vraiment supprimer ${member.nom} (${member.role}) ?`)) {
      return;
    }

    const currentOrg = this.getCurrentOrg();
    if (!currentOrg) return;

    try {
      // Supprimer via l'API
      await this.deleteMemberFromApi(memberId);

      // Mettre à jour les données locales
      currentOrg.membres = currentOrg.membres.filter(m => m.id !== memberId);
      await this.saveData();
      this.render();
      this.setupEventListeners();
    } catch (error) {
      alert('Erreur lors de la suppression: ' + error.message);
    }
  }

  /**
   * Génère un ID unique
   */
  generateId() {
    return 'member-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Affiche un message d'erreur
   */
  showError(message) {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <p style="color: #dc3545; font-size: 1.2rem; margin-bottom: 20px;">${message}</p>
        <button class="org-btn org-btn-primary" data-action="reload">Réessayer</button>
      </div>
    `;
    // Ajouter listener pour le reload
    this.container.querySelector('[data-action="reload"]')?.addEventListener('click', () => location.reload());
  }

  /**
   * Exporte les données JSON
   */
  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'organigramme-data.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Importe des données JSON
   */
  async importData(file) {
    try {
      const text = await file.text();
      const newData = JSON.parse(text);

      if (!newData.config || !newData.membres) {
        throw new Error('Format de données invalide');
      }

      this.data = newData;
      await this.saveData();
      this.render();
      this.setupEventListeners();
      alert('Données importées avec succès !');
    } catch (error) {
      alert('Erreur lors de l\'import: ' + error.message);
    }
  }
}

// Instance globale
let organigramme = null;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('organigramme-content');
  if (container) {
    organigramme = new Organigramme('organigramme-content');
    organigramme.init();
  }
});

// Export pour utilisation en module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Organigramme;
}
