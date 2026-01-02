/**
 * MAGNY FC 78 - Organigramme Dynamique
 *
 * Ce module gère l'affichage et la modification dynamique de l'organigramme du comité.
 * Les données sont chargées depuis un fichier JSON et peuvent être modifiées via une interface admin.
 */

class Organigramme {
  constructor(containerId, dataUrl = '/organigramme/data.json') {
    this.container = document.getElementById(containerId);
    this.dataUrl = dataUrl;
    this.data = null;
    this.adminMode = false;
    this.modal = null;
    this.currentEditMember = null;
  }

  /**
   * Initialise l'organigramme
   */
  async init() {
    try {
      await this.loadData();
      this.render();
      this.setupEventListeners();
    } catch (error) {
      console.error('Erreur initialisation organigramme:', error);
      this.showError('Impossible de charger l\'organigramme');
    }
  }

  /**
   * Charge les données depuis le JSON
   */
  async loadData() {
    const response = await fetch(this.dataUrl);
    if (!response.ok) {
      throw new Error('Erreur chargement données');
    }
    this.data = await response.json();
    return this.data;
  }

  /**
   * Sauvegarde les données (simulation - en production, envoyer vers une API)
   */
  async saveData() {
    // En mode production, envoyer vers une API backend
    // Pour le moment, on stocke en localStorage comme démonstration
    localStorage.setItem('organigramme_data', JSON.stringify(this.data));
    console.log('Données sauvegardées:', this.data);

    // Simuler un appel API
    // await fetch('/api/organigramme', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(this.data)
    // });
  }

  /**
   * Récupère les membres par niveau
   */
  getMembersByLevel(level) {
    return this.data.membres
      .filter(m => m.niveau === level)
      .sort((a, b) => a.ordre - b.ordre);
  }

  /**
   * Récupère les subordonnés d'un membre
   */
  getSubordinates(parentId) {
    return this.data.membres
      .filter(m => m.parentId === parentId)
      .sort((a, b) => a.ordre - b.ordre);
  }

  /**
   * Récupère un membre par son ID
   */
  getMemberById(id) {
    return this.data.membres.find(m => m.id === id);
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
              `<img src="${photoSrc}" alt="${member.nom}" onerror="this.parentElement.innerHTML='<div class=\\'placeholder\\'><svg viewBox=\\'0 0 24 24\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg></div>'">`
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
          <button class="org-action-btn edit" onclick="organigramme.editMember('${member.id}')" title="Modifier">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button class="org-action-btn delete" onclick="organigramme.deleteMember('${member.id}')" title="Supprimer">
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

    let html = `
      <!-- Niveau 1: Président -->
      <div class="org-level org-level-1">
        ${level1.map(m => this.renderMember(m)).join('')}
      </div>

      <!-- Connecteur vertical du président vers niveau 2 -->
      <div class="org-connector-vertical" style="height: 50px; width: 2px; background: #1e3a5f; margin: 0 auto;"></div>

      <!-- Ligne horizontale niveau 2 -->
      <div class="org-connector-horizontal" style="height: 2px; background: #1e3a5f; margin: 0 auto; width: 80%; max-width: 1000px;"></div>

      <!-- Niveau 2: Bureau -->
      <div class="org-level org-level-2" style="padding-top: 0;">
        ${level2.map(m => {
          const subordinates = level3ByParent[m.id] || [];
          const hasSubordinates = subordinates.length > 0;

          return `
            <div class="org-group ${hasSubordinates ? 'has-subordinates' : ''}">
              <div class="org-connector-up" style="height: 30px; width: 2px; background: #1e3a5f; margin: 0 auto;"></div>
              ${this.renderMember(m)}
              ${hasSubordinates ? `
                <div class="org-connector-down" style="height: 30px; width: 2px; background: #1e3a5f; margin: 0 auto; margin-top: 10px;"></div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Niveau 3: Responsables -->
      <div class="org-level org-level-3">
        ${level3.map(m => this.renderMember(m)).join('')}
      </div>

      <!-- Modal d'édition -->
      <div class="org-modal-overlay" id="org-modal">
        <div class="org-modal">
          <div class="org-modal-header">
            <h3 id="modal-title">Modifier un membre</h3>
            <button class="org-modal-close" onclick="organigramme.closeModal()">&times;</button>
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
                <input type="text" id="member-photo" placeholder="/assets/images/comite/nom.jpg">
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
            <button class="org-btn org-btn-secondary" onclick="organigramme.closeModal()">Annuler</button>
            <button class="org-btn org-btn-primary" onclick="organigramme.saveMember()">Enregistrer</button>
          </div>
        </div>
      </div>

      <!-- Bouton ajouter -->
      <button class="add-member-btn" onclick="organigramme.addMember()" title="Ajouter un membre">+</button>
    `;

    this.container.innerHTML = html;
    this.modal = document.getElementById('org-modal');
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
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
    const memberData = {
      id: id || this.generateId(),
      nom: document.getElementById('member-nom').value.trim(),
      role: document.getElementById('member-role').value.trim(),
      photo: document.getElementById('member-photo').value.trim(),
      niveau: parseInt(document.getElementById('member-niveau').value),
      parentId: document.getElementById('member-parent').value || null,
      ordre: parseInt(document.getElementById('member-ordre').value)
    };

    if (this.currentEditMember) {
      // Mise à jour
      const index = this.data.membres.findIndex(m => m.id === id);
      if (index !== -1) {
        this.data.membres[index] = memberData;
      }
    } else {
      // Ajout
      this.data.membres.push(memberData);
    }

    await this.saveData();
    this.render();
    this.setupEventListeners();
    this.closeModal();
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

    this.data.membres = this.data.membres.filter(m => m.id !== memberId);
    await this.saveData();
    this.render();
    this.setupEventListeners();
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
        <button class="org-btn org-btn-primary" onclick="location.reload()">Réessayer</button>
      </div>
    `;
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
