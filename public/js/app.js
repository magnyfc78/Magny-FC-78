/**
 * MAGNY FC 78 - Application avec nouveau design
 */

// =====================================================
// GESTIONNAIRE GLOBAL D'ERREURS D'IMAGES
// =====================================================
// Remplace les images cassées par le logo du club
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && !e.target.dataset.fallbackApplied) {
    e.target.dataset.fallbackApplied = 'true';
    e.target.src = '/assets/images/logo.png';
  }
}, true);

// =====================================================
// VUES / PAGES
// =====================================================

const views = {
  // Page d'accueil
  async home() {
    const [matchsRes, actusRes, configRes, partenairesRes] = await Promise.all([
      api.getMatchs('a_venir', 6),
      api.getActualites(4),
      fetch('/api/config').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/partenaires').then(r => r.json()).catch(() => ({ success: false }))
    ]);

    const matchs = matchsRes?.data?.matchs || [];
    const actualites = actusRes?.data?.actualites || [];
    const config = configRes?.success ? configRes.data : {};
    const partenaires = partenairesRes?.success ? partenairesRes.data.partenaires : [];

    // Valeurs dynamiques depuis la config
    const heroTitre = config.hero_titre || 'MAGNY FC 78';
    const heroSoustitre = config.hero_soustitre || 'Le club de football amateur de Magny-les-Hameaux, Yvelines.';
    const heroBoutonTexte = config.hero_bouton_texte || 'REJOINDRE LE CLUB';
    const heroBoutonLien = config.hero_bouton_lien || '/contact';
    const heroImage = config.hero_image || 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1920';

    // Style inline pour l'image de fond dynamique
    const heroStyle = `background: linear-gradient(to bottom, rgba(13, 24, 41, 0.7) 0%, rgba(13, 24, 41, 0.5) 50%, rgba(13, 24, 41, 0.8) 100%), url('${heroImage}') center/cover no-repeat;`;

    // Statistiques dynamiques (champs individuels en BD)
    const stats = [
      { valeur: config.stat_1_valeur || '300+', label: config.stat_1_label || 'Licenciés' },
      { valeur: config.stat_2_valeur || '17', label: config.stat_2_label || 'Équipes' },
      { valeur: config.stat_3_valeur || '24', label: config.stat_3_label || 'Années' },
      { valeur: config.stat_4_valeur || '1er', label: config.stat_4_label || 'Club de la ville' }
    ].filter(s => s.valeur || s.label);

    return `
      <!-- Hero -->
      <section class="hero" style="${heroStyle}">
        <div class="hero-content">
          <h1>${heroTitre}</h1>
          <p class="hero-subtitle">${heroSoustitre}</p>
          <a href="${heroBoutonLien}" class="btn-hero" data-link>
            ${heroBoutonTexte}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </section>

      <!-- Stats -->
      <section class="stats-section">
        <div class="container">
          <div class="stats-grid">
            ${stats.map(s => `
              <div class="stat-item">
                <div class="stat-value">${s.valeur}</div>
                <div class="stat-label">${s.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Prochains Matchs -->
      <section class="section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Prochains Matchs</h2>
            <div class="section-line"></div>
          </div>
          <div style="max-width: 900px; margin: 0 auto;">
            ${matchs.length ? matchs.slice(0, 4).map(m => `
              <div class="match-card">
                <div class="match-date">
                  <div class="day">${m.date_formatee.split(' ')[0]}</div>
                  <div class="month">${m.date_formatee.split(' ')[1]}</div>
                </div>
                <div class="match-content">
                  <div class="match-teams">
                    <span class="team ${m.equipe_dom.includes('Magny') ? 'highlight' : ''}">${m.equipe_dom}</span>
                    <span class="vs">VS</span>
                    <span class="team ${m.equipe_ext.includes('Magny') ? 'highlight' : ''}">${m.equipe_ext}</span>
                  </div>
                  <div class="match-meta">
                    <span class="match-time">${m.heure}</span>
                    ${m.equipe_nom ? `<span class="match-category">${m.equipe_nom}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('') : '<p class="text-center">Aucun match programmé</p>'}
          </div>
          <div class="text-center mt-4">
            <a href="/calendrier" class="btn btn-primary" data-link>VOIR LE CALENDRIER</a>
          </div>
        </div>
      </section>

      <!-- Actualités -->
      <section class="section" style="background: var(--gris-clair);">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Actualités</h2>
            <div class="section-line"></div>
          </div>
          <div class="actualites-grid">
            ${actualites.map((a) => {
              // Utiliser l'image de la BDD (stockée dans /uploads/actualites/)
              const imageSrc = a.image || '/assets/images/logo.png';
              const instagramIcon = a.lien_instagram ? `
                <a href="${a.lien_instagram}" target="_blank" rel="noopener noreferrer" class="instagram-link-bottom" title="Voir sur Instagram">
                  <img src="/icons/instagram.svg" alt="Instagram"> Voir sur Instagram
                </a>
              ` : '';
              return `
              <article class="actu-card">
                <div class="actu-image">
                  <img src="${imageSrc}" alt="${a.titre}" loading="lazy">
                </div>
                <div class="actu-body">
                  <div class="actu-meta">
                    <span class="actu-category">${a.categorie}</span>
                    <span class="actu-date">${a.date_formatee}</span>
                  </div>
                  <h3 class="actu-title">${a.titre}</h3>
                  <p class="actu-excerpt">${a.extrait || ''}</p>
                  ${instagramIcon}
                </div>
              </article>
            `}).join('') || '<p class="text-center">Aucune actualité</p>'}
          </div>
          <div class="text-center mt-4">
            <a href="/actualites" class="btn btn-primary" data-link>TOUTES LES ACTUALITÉS</a>
          </div>
        </div>
      </section>

      <!-- Partenaires -->
      <section class="section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Nos Partenaires</h2>
            <div class="section-line"></div>
          </div>
          <div class="partenaires-grid">
            ${partenaires.length ? partenaires.slice(0, 5).map(p => `
              <div class="partenaire-item">
                <img src="${p.logo || '/assets/images/logo.png'}" alt="${p.nom}" loading="lazy" title="${p.nom}">
              </div>
            `).join('') : '<p class="text-center" style="grid-column: 1/-1;">Aucun partenaire</p>'}
          </div>
          <div class="text-center mt-4">
            <a href="/partenaires" class="btn btn-outline" data-link>Voir plus</a>
            <a href="/partenaires" class="btn btn-secondary" data-link>DEVENIR PARTENAIRE</a>
          </div>
        </div>
      </section>
    `;
  },

  // Page équipes
  async equipes() {
    const res = await api.getEquipes();
    const equipes = res?.data?.equipes || [];
    const categories = ['Tous', 'Seniors', 'Féminines', 'Vétérans', 'Jeunes', 'École de Foot'];

    return `
      <section class="page-header">
        <h1>Nos Équipes</h1>
        <p>17 équipes de l'école de foot aux seniors</p>
      </section>
      
      <section class="section equipes-section">
        <div class="container">
          <div class="filters" id="equipes-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" data-filter="equipes" data-category="${c}">${c}</button>
            `).join('')}
          </div>
          <div class="equipes-grid" id="equipes-grid">
            ${renderEquipes(equipes)}
          </div>
        </div>
      </section>
    `;
  },

  // Page actualités
  async actualites() {
    const res = await api.getActualites(100);
    const actualites = res?.data?.actualites || [];
    const categories = ['Tous', 'Match', 'Événement', 'Club', 'Formation'];
    const imageMap = { 'Match': 'match', 'Événement': 'evenement', 'Club': 'club', 'Formation': 'formation' };
    window.actualitesData = actualites;

    return `
      <section class="page-header">
        <h1>Actualités</h1>
        <p>Toute l'actualité du Magny FC 78</p>
      </section>

      <section class="section">
        <div class="container">
          <div class="filters" id="actualites-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" data-filter="actualites" data-category="${c}">${c}</button>
            `).join('')}
          </div>
          <div class="actualites-grid" id="actualites-grid">
            ${renderActualites(actualites)}
          </div>
        </div>
      </section>
    `;
  },

  // Page galerie
  async galerie() {
    // Charger les catégories et albums depuis l'API
    let categories = [];
    let albums = [];
    try {
      const [catRes, albumRes] = await Promise.all([
        fetch('/api/galerie/categories'),
        fetch('/api/galerie')
      ]);
      const catData = await catRes.json();
      const albumData = await albumRes.json();
      if (catData.success) categories = catData.data.categories;
      if (albumData.success) albums = albumData.data.albums;
    } catch (e) {
      console.error('Erreur chargement galerie:', e);
    }

    // Stocker les données globalement pour le filtrage
    window.galerieAlbumsData = albums;

    return `
      <section class="page-header">
        <h1>Galerie</h1>
        <p>Les moments forts du club en images</p>
      </section>

      <section class="section">
        <div class="container">
          <!-- Filtres par catégorie -->
          <div class="filters galerie-filters" id="galerie-filters">
            <button class="filter-btn active" data-filter="galerie" data-category="Tous">Tous</button>
            ${categories.map(c => `
              <button class="filter-btn" data-filter="galerie" data-category="${c.slug}" style="--cat-color: ${c.couleur}">
                ${c.nom}
              </button>
            `).join('')}
          </div>

          <!-- Lien vers la page Histoire -->
          <div class="histoire-banner">
            <a href="/galerie/histoire" data-link class="histoire-link">
              <span class="histoire-icon">📜</span>
              <div class="histoire-text">
                <strong>Découvrez l'Histoire du Club</strong>
                <span>24 ans de passion depuis 2000</span>
              </div>
              <span class="histoire-arrow">→</span>
            </a>
          </div>

          <div class="galerie-albums-grid" id="galerie-grid">
            ${renderGalerieAlbums(albums)}
          </div>
        </div>
      </section>
    `;
  },

  // Page histoire du club
  async galerieHistoire() {
    let histoireData = { albums: [], timeline: {}, config: {}, moments: [] };
    try {
      const res = await fetch('/api/galerie/histoire');
      const data = await res.json();
      if (data.success) {
        histoireData = data.data;
      }
    } catch (e) {
      console.error('Erreur chargement histoire:', e);
    }

    const { albums, timeline, config, moments } = histoireData;
    const decades = Object.keys(timeline).sort();

    // Utiliser les valeurs dynamiques de la config
    const introTitre = config.intro_titre || '24 ans de passion footballistique';
    const introTexte = config.intro_texte || 'Découvrez l\'histoire de notre club à travers les images qui ont marqué notre parcours.';
    const slogan = config.slogan || 'Magny FC 78 - Depuis 2000';
    const anneeCreation = config.annee_creation || 2000;
    const anneesExistence = config.annees_existence || (new Date().getFullYear() - anneeCreation);
    const nombreLicencies = config.nombre_licencies || '300+';
    const nombreEquipes = config.nombre_equipes || '17';

    return `
      <section class="page-header histoire-header">
        <h1>Histoire du Club</h1>
        <p>${slogan}</p>
      </section>

      <!-- Section intro -->
      <section class="section histoire-intro">
        <div class="container">
          <div class="histoire-intro-content">
            <div class="histoire-logo">
              <div class="logo-icon large"></div>
            </div>
            <div class="histoire-intro-text">
              <h2>${introTitre}</h2>
              <p>${introTexte}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Timeline -->
      <section class="section histoire-timeline-section">
        <div class="container">
          <div class="timeline">
            ${decades.map((decade, index) => `
              <div class="timeline-decade ${index % 2 === 0 ? 'left' : 'right'}">
                <div class="timeline-decade-header">
                  <span class="decade-badge">${decade}</span>
                </div>
                <div class="timeline-albums">
                  ${timeline[decade].map(album => `
                    <div class="timeline-album-card">
                      <div class="timeline-year">${album.annee}</div>
                      <div class="timeline-album-image">
                        <img src="${album.image_couverture || '/assets/images/logo.png'}" alt="${album.titre}" loading="lazy">
                      </div>
                      <div class="timeline-album-info">
                        <h3>${album.titre}</h3>
                        ${album.description ? `<p>${album.description}</p>` : ''}
                        <span class="photo-count">${album.nb_photos || 0} photos</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          ${!albums.length ? `
            <div class="histoire-empty">
              <p>L'histoire du club sera bientôt disponible en images.</p>
              <p>Revenez nous voir prochainement !</p>
            </div>
          ` : ''}
        </div>
      </section>

      <!-- Stats historiques -->
      <section class="section histoire-stats">
        <div class="container">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${anneeCreation}</div>
              <div class="stat-label">Année de création</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${anneesExistence}</div>
              <div class="stat-label">Années d'existence</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${nombreLicencies}</div>
              <div class="stat-label">Licenciés actuels</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${nombreEquipes}</div>
              <div class="stat-label">Équipes</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Moments clés -->
      ${moments && moments.length > 0 ? `
      <section class="section histoire-moments">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Moments Clés</h2>
            <div class="section-line"></div>
          </div>
          <div class="moments-grid">
            ${moments.map(m => `
              <div class="moment-card">
                <div class="moment-year">${m.annee}</div>
                <h3>${m.titre}</h3>
                ${m.description ? `<p>${m.description}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </section>
      ` : ''}

      <section class="section">
        <div class="container text-center">
          <a href="/galerie" class="btn btn-primary" data-link>← Retour à la galerie</a>
        </div>
      </section>
    `;
  },

  // Page album (détail avec photos)
  async galerieAlbum(params) {
    const slug = Array.isArray(params) ? params[0] : params;
    let album = null;
    try {
      const res = await fetch(`/api/galerie/${slug}`);
      const data = await res.json();
      if (data.success) {
        album = data.data.album;
      }
    } catch (e) {
      console.error('Erreur chargement album:', e);
    }

    if (!album) {
      return `
        <section class="page-header">
          <h1>Album introuvable</h1>
          <p>Cet album n'existe pas ou n'est plus disponible</p>
        </section>
        <section class="section">
          <div class="container text-center">
            <a href="/galerie" class="btn btn-primary" data-link>← Retour à la galerie</a>
          </div>
        </section>
      `;
    }

    const photos = album.photos || [];
    const instagramLink = album.lien_instagram ? `
      <a href="${album.lien_instagram}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="gap: 8px;">
        <img src="/icons/instagram.svg" alt="Instagram" style="width: 20px; height: 20px;"> Voir sur Instagram
      </a>
    ` : '';

    return `
      <section class="page-header">
        <h1>${album.titre}</h1>
        <p>${album.description || ''}</p>
        ${album.categorie_nom ? `<span class="album-category-badge" style="background:${album.categorie_couleur || '#1a4d92'}">${album.categorie_nom}</span>` : ''}
      </section>

      <section class="section">
        <div class="container">
          <div class="album-header-info">
            <div class="album-meta-info">
              ${album.date_evenement ? `<span>📅 ${new Date(album.date_evenement).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>` : ''}
              <span>📷 ${photos.length} photo${photos.length > 1 ? 's' : ''}</span>
            </div>
            <div class="album-actions">
              ${instagramLink}
            </div>
          </div>

          ${photos.length > 0 ? `
            <div class="album-photos-grid">
              ${photos.map(photo => `
                <div class="album-photo-item galerie-item">
                  <img src="${photo.thumbnail || photo.fichier}"
                       data-full="${photo.fichier}"
                       alt="${photo.titre || album.titre}"
                       loading="lazy">
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="album-empty">
              <p>Aucune photo dans cet album pour le moment.</p>
            </div>
          `}

          <div class="text-center" style="margin-top: 40px;">
            <a href="/galerie" class="btn btn-primary" data-link>← Retour à la galerie</a>
          </div>
        </div>
      </section>
    `;
  },

  // Page partenaires
  async partenaires() {
    // Charger les partenaires depuis l'API
    let partenaires = [];
    try {
      const res = await fetch('/api/partenaires');
      const data = await res.json();
      if (data.success) {
        partenaires = data.data.partenaires;
      }
    } catch (e) {
      console.error('Erreur chargement partenaires:', e);
    }

    window.partenairesData = partenaires;

    return `
      <section class="page-header">
        <h1>Partenaires</h1>
        <p>Ils nous soutiennent</p>
      </section>

      <section class="section">
        <div class="container">
          <div class="partenaires-grid" id="partenaires-grid">
            ${renderPartenaires(partenaires)}
          </div>
          <div class="text-center mt-4">
            <p style="color: var(--gris); margin-bottom: 20px;">Vous souhaitez soutenir le club ?</p>
            <a href="/contact" class="btn btn-secondary" data-link>NOUS CONTACTER</a>
          </div>
        </div>
      </section>
    `;
  },

  // Page calendrier avec 4 onglets (comme dyf78.fff.fr)
  async calendrier() {
    // Charger toutes les données en parallèle
    const [resultatsRes, agendaRes, classementsRes] = await Promise.all([
      api.getMatchs('termine', 50),
      api.getMatchs('a_venir', 50),
      fetch('/api/classements').then(r => r.json()).catch(() => ({ success: false, data: { classements: [] } }))
    ]);

    const resultats = resultatsRes?.data?.matchs || [];
    const agenda = agendaRes?.data?.matchs || [];
    const allMatchs = [...resultats, ...agenda].sort((a, b) => new Date(a.date_match) - new Date(b.date_match));
    const classements = classementsRes?.success ? classementsRes.data.classements : [];

    // Grouper les classements par compétition
    const classementsByCompetition = {};
    classements.forEach(c => {
      if (!classementsByCompetition[c.competition_nom]) {
        classementsByCompetition[c.competition_nom] = [];
      }
      classementsByCompetition[c.competition_nom].push(c);
    });

    // Stocker les données pour le filtrage par onglet
    window.calendrierData = { resultats, agenda, allMatchs, classementsByCompetition };

    // Fonction pour rendre une liste de matchs
    const renderMatchList = (matchs, showScore = false) => {
      if (!matchs.length) return '<p class="text-center text-muted">Aucun match</p>';
      return matchs.map(m => `
        <div class="match-card ${showScore && m.statut === 'termine' ? 'match-termine' : ''}">
          <div class="match-date">
            <div class="day">${m.date_formatee?.split(' ')[0] || '-'}</div>
            <div class="month">${m.date_formatee?.split(' ')[1] || '-'}</div>
          </div>
          <div class="match-content">
            <div class="match-teams">
              <span class="team ${m.equipe_dom?.includes('Magny') ? 'highlight' : ''}">${m.equipe_dom || 'Équipe'}</span>
              ${showScore && m.statut === 'termine' ? `
                <span class="match-score">${m.score_domicile ?? '-'} - ${m.score_exterieur ?? '-'}</span>
              ` : '<span class="vs">VS</span>'}
              <span class="team ${m.equipe_ext?.includes('Magny') ? 'highlight' : ''}">${m.equipe_ext || 'Adversaire'}</span>
            </div>
            <div class="match-meta">
              <span class="match-time">${m.heure || '15:00'}</span>
              ${m.equipe_nom ? `<span class="match-category">${m.equipe_nom}</span>` : ''}
              ${showScore && m.resultat ? `<span class="match-result match-result-${m.resultat}">${m.resultat === 'victoire' ? 'V' : m.resultat === 'nul' ? 'N' : 'D'}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    };

    // Fonction pour rendre les classements
    const renderClassements = () => {
      if (Object.keys(classementsByCompetition).length === 0) {
        return '<p class="text-center text-muted">Aucun classement disponible</p>';
      }
      return Object.entries(classementsByCompetition).map(([compName, teams]) => `
        <div class="classement-group">
          <h3 class="classement-title">${compName}</h3>
          <div class="classement-table-wrapper">
            <table class="classement-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Équipe</th>
                  <th>Pts</th>
                  <th>J</th>
                  <th>G</th>
                  <th>N</th>
                  <th>P</th>
                  <th>+/-</th>
                </tr>
              </thead>
              <tbody>
                ${teams.sort((a, b) => a.position - b.position).map(t => `
                  <tr class="${/magny/i.test(t.equipe_nom) ? 'highlight-row' : ''}">
                    <td class="position">${t.position}</td>
                    <td class="team-name">${t.equipe_nom}</td>
                    <td class="points"><strong>${t.points}</strong></td>
                    <td>${t.joues}</td>
                    <td>${t.gagnes}</td>
                    <td>${t.nuls}</td>
                    <td>${t.perdus}</td>
                    <td class="${t.difference > 0 ? 'positive' : t.difference < 0 ? 'negative' : ''}">${t.difference > 0 ? '+' : ''}${t.difference}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('');
    };

    return `
      <section class="page-header">
        <h1>Calendrier & Résultats</h1>
        <p>Saison 2024-2025</p>
      </section>

      <section class="section calendrier-section">
        <div class="container">
          <!-- Onglets -->
          <div class="calendrier-tabs" id="calendrier-tabs">
            <button class="tab-btn active" data-tab="resultats">Résultats</button>
            <button class="tab-btn" data-tab="agenda">Agenda</button>
            <button class="tab-btn" data-tab="classement">Classement</button>
            <button class="tab-btn" data-tab="calendrier">Calendrier</button>
          </div>

          <!-- Contenu des onglets -->
          <div class="calendrier-content" id="calendrier-content">
            <!-- Résultats (affiché par défaut) -->
            <div class="tab-pane active" id="tab-resultats">
              <h2 class="tab-section-title">Derniers Résultats</h2>
              <div class="matchs-list" style="max-width: 900px; margin: 0 auto;">
                ${renderMatchList(resultats.slice(0, 20), true)}
              </div>
            </div>

            <!-- Agenda -->
            <div class="tab-pane" id="tab-agenda">
              <h2 class="tab-section-title">Matchs à Venir</h2>
              <div class="matchs-list" style="max-width: 900px; margin: 0 auto;">
                ${renderMatchList(agenda.slice(0, 20), false)}
              </div>
            </div>

            <!-- Classement -->
            <div class="tab-pane" id="tab-classement">
              <h2 class="tab-section-title">Classements</h2>
              <div class="classements-container">
                ${renderClassements()}
              </div>
            </div>

            <!-- Calendrier complet -->
            <div class="tab-pane" id="tab-calendrier">
              <h2 class="tab-section-title">Calendrier Complet</h2>
              <div class="matchs-list" style="max-width: 900px; margin: 0 auto;">
                ${renderMatchList(allMatchs, true)}
              </div>
            </div>
          </div>

          <!-- Dernière mise à jour -->
          <div class="calendrier-footer">
            <p class="sync-info">Données synchronisées automatiquement depuis la FFF</p>
            <a href="https://dyf78.fff.fr/recherche-clubs?tab=resultats&scl=25702" target="_blank" rel="noopener" class="fff-link">
              Voir sur le site du District →
            </a>
          </div>
        </div>
      </section>
    `;
  },

  // Page club (organigrammes multiples)
  async club() {
    // Charger les données des organigrammes depuis l'API
    let organigrammes = [];
    try {
      const res = await fetch('/api/organigrammes');
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data.organigrammes) {
          organigrammes = result.data.organigrammes.map(org => ({
            ...org,
            actif: true,
            membres: (org.membres || []).map(m => ({
              ...m,
              parentId: m.parent_id
            }))
          }));
        }
      }
    } catch (e) {
      console.error('Erreur chargement organigramme:', e);
    }

    const config = { clubNom: 'MAGNY FC 78', defaultPhoto: '/assets/images/default-avatar.png' };
    organigrammes = organigrammes
      .filter(o => o.actif !== false)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

    // Fonction pour rendre un hexagone
    const renderHexagon = (member) => {
      const hasPhoto = member.photo && member.photo !== '';
      return `
        <div class="hexagon-container" data-member-id="${member.id}">
          <div class="hexagon">
            <div class="hexagon-inner">
              ${hasPhoto ?
                `<img src="${member.photo || '/assets/images/logo.png'}" alt="${member.nom}">`
                :
                `<div class="placeholder">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>`
              }
            </div>
          </div>
        </div>
      `;
    };

    // Fonction pour rendre un membre
    const renderMember = (member) => `
      <div class="org-member" data-member-id="${member.id}">
        ${renderHexagon(member)}
        <div class="member-info">
          <div class="member-role">${member.role}</div>
          <div class="member-name">${member.nom}</div>
        </div>
      </div>
    `;

    // Fonction pour rendre un organigramme complet
    const renderOrganigramme = (org) => {
      const membres = org.membres || [];
      const getMembersByLevel = (level) => membres.filter(m => m.niveau === level).sort((a, b) => a.ordre - b.ordre);

      const level1 = getMembersByLevel(1);
      const level2 = getMembersByLevel(2);
      const level3 = getMembersByLevel(3);

      // Grouper le niveau 3 par parent
      const level3ByParent = {};
      level3.forEach(m => {
        if (!level3ByParent[m.parentId]) {
          level3ByParent[m.parentId] = [];
        }
        level3ByParent[m.parentId].push(m);
      });

      return `
        <section class="organigramme-section" data-org-id="${org.id}">
          <div class="organigramme-header">
            <h1>${org.titre}</h1>
            <div class="club-name">${config.clubNom || 'MAGNY FC 78'}</div>
          </div>

          <div class="organigramme-page">
            <div class="organigramme-container">
              <!-- Niveau 1 -->
              <div class="org-level org-level-1">
                ${level1.map(m => renderMember(m)).join('')}
              </div>

              ${level2.length > 0 ? `
                <!-- Connecteur vertical -->
                <div class="org-connector-vertical" style="height: 50px; width: 2px; background: #1e3a5f; margin: 0 auto;"></div>

                <!-- Ligne horizontale niveau 2 -->
                <div class="org-connector-horizontal" style="height: 2px; background: #1e3a5f; margin: 0 auto; width: 80%; max-width: 1000px;"></div>

                <!-- Niveau 2 -->
                <div class="org-level org-level-2" style="padding-top: 0;">
                  ${level2.map(m => {
                    const subordinates = level3ByParent[m.id] || [];
                    const hasSubordinates = subordinates.length > 0;

                    return `
                      <div class="org-group ${hasSubordinates ? 'has-subordinates' : ''}">
                        <div class="org-connector-up" style="height: 30px; width: 2px; background: #1e3a5f; margin: 0 auto;"></div>
                        ${renderMember(m)}
                        ${hasSubordinates ? `
                          <div class="org-connector-down" style="height: 30px; width: 2px; background: #1e3a5f; margin: 0 auto; margin-top: 10px;"></div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              <!-- Niveau 3 -->
              ${level3.length > 0 ? `
                <div class="org-level org-level-3">
                  ${level3.map(m => renderMember(m)).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </section>
      `;
    };

    return `
      <div class="organigrammes-wrapper">
        ${organigrammes.map(org => renderOrganigramme(org)).join('')}
      </div>
    `;
  },

  // Page contact
  async contact() {
    // Charger la configuration depuis l'API
    let config = {};
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        config = data.data;
      }
    } catch (e) {
      console.error('Erreur chargement config:', e);
    }

    const adresse = config.contact_adresse || 'Stade Jean Jaurès, 78114 Magny-les-Hameaux';
    const telephone = config.contact_telephone || '01 XX XX XX XX';
    const email = config.contact_email || 'contact@magnyfc78.fr';
    const horaires = config.contact_horaires || 'Mercredi : 14h - 18h | Samedi : 9h - 12h';

    return `
      <section class="page-header">
        <h1>Contact</h1>
        <p>Rejoignez le ${config.site_nom || 'Magny FC 78'}</p>
      </section>

      <section class="section">
        <div class="container">
          <div class="contact-grid">
            <div class="contact-info">
              <h2>NOUS CONTACTER</h2>

              <div class="contact-item">
                <span class="contact-icon">📍</span>
                <div>
                  <h3>ADRESSE</h3>
                  <p>${adresse.replace(/,/g, '<br>')}</p>
                </div>
              </div>

              <div class="contact-item">
                <span class="contact-icon">📞</span>
                <div>
                  <h3>TÉLÉPHONE</h3>
                  <p>${telephone}</p>
                </div>
              </div>

              <div class="contact-item">
                <span class="contact-icon">✉️</span>
                <div>
                  <h3>EMAIL</h3>
                  <p>${email}</p>
                </div>
              </div>

              <div class="contact-item">
                <span class="contact-icon">🕐</span>
                <div>
                  <h3>HORAIRES SECRÉTARIAT</h3>
                  <p>${horaires.replace(/\|/g, '<br>')}</p>
                </div>
              </div>

              ${config.social_facebook || config.social_instagram ? `
              <div class="contact-item">
                <span class="contact-icon">🌐</span>
                <div>
                  <h3>RÉSEAUX SOCIAUX</h3>
                  <p>
                    ${config.social_facebook ? `<a href="${config.social_facebook}" target="_blank">Facebook</a>` : ''}
                    ${config.social_facebook && config.social_instagram ? ' | ' : ''}
                    ${config.social_instagram ? `<a href="${config.social_instagram}" target="_blank">Instagram</a>` : ''}
                  </p>
                </div>
              </div>
              ` : ''}
            </div>

            <div class="contact-form">
              <h2>ENVOYER UN MESSAGE</h2>
              <form id="contact-form">
                <div class="form-group">
                  <label for="nom">Nom complet</label>
                  <input type="text" id="nom" name="nom" class="form-control" required>
                </div>
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" class="form-control" required>
                </div>
                <div class="form-group">
                  <label for="sujet">Sujet</label>
                  <select id="sujet" name="sujet" class="form-control">
                    <option value="Inscription">Inscription</option>
                    <option value="Information">Information</option>
                    <option value="Partenariat">Partenariat</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="message">Message</label>
                  <textarea id="message" name="message" class="form-control" rows="5" required></textarea>
                </div>
                <button type="submit" class="btn-submit">ENVOYER</button>
              </form>
            </div>
          </div>
        </div>
      </section>
    `;
  }
};

// =====================================================
// HELPERS
// =====================================================

function renderEquipes(equipes) {
  return equipes.map(e => `
    <div class="equipe-card">
      ${e.photo_equipe ? `
        <div class="equipe-card-image">
          <img src="${e.photo_equipe}" alt="Photo ${e.nom}" loading="lazy">
        </div>
      ` : ''}
      <div class="equipe-card-header">
        <h3>${e.nom}</h3>
      </div>
      <div class="equipe-card-body">
        <div class="equipe-badges">
          <span class="badge badge-or">${e.categorie_nom}</span>
          <span class="badge badge-bleu">${e.division || '-'}</span>
        </div>
        <div class="equipe-info">
          ${e.nb_joueurs > 0 ? `<p>👥 ${e.nb_joueurs} joueurs</p>` : ''}
          <p>🏆 Coach: ${e.coach || 'N/A'}</p>
          ${e.assistant ? `<p>🤝 Assistant: ${e.assistant}</p>` : ''}
          ${e.horaires_entrainement ? `<p>🕐 ${e.horaires_entrainement}</p>` : ''}
          ${e.terrain ? `<p>📍 ${e.terrain}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function filterEquipes(categorie) {
  const grid = document.getElementById('equipes-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const res = await api.getEquipes(categorie);
  grid.innerHTML = renderEquipes(res?.data?.equipes || []);
}

// Render actualités
function renderActualites(actualites) {
  return actualites.map((a) => {
    // Utiliser l'image de la BDD (stockée dans /uploads/actualites/), sinon logo du club
    const imageSrc = a.image || '/assets/images/logo.png';
    const instagramIcon = a.lien_instagram ? `
      <a href="${a.lien_instagram}" target="_blank" rel="noopener noreferrer" class="instagram-link-bottom" title="Voir sur Instagram">
        <img src="/icons/instagram.svg" alt="Instagram"> Voir sur Instagram
      </a>
    ` : '';
    return `
      <article class="actu-card" data-category="${a.categorie}">
        <div class="actu-image">
          <img src="${imageSrc}" alt="${a.titre}" loading="lazy">
        </div>
        <div class="actu-body">
          <div class="actu-meta">
            <span class="actu-category">${a.categorie}</span>
            <span class="actu-date">${a.date_formatee}</span>
          </div>
          <h3 class="actu-title">${a.titre}</h3>
          <p class="actu-excerpt">${a.extrait || ''}</p>
          ${instagramIcon}
        </div>
      </article>
    `;
  }).join('') || '<p class="text-center">Aucune actualité</p>';
}

// Filter actualités
function filterActualites(categorie) {
  const grid = document.getElementById('actualites-grid');
  const actualites = window.actualitesData || [];

  if (categorie === 'Tous') {
    grid.innerHTML = renderActualites(actualites);
  } else {
    const filtered = actualites.filter(a => a.categorie === categorie);
    grid.innerHTML = renderActualites(filtered);
  }
}

// Render galerie albums
function renderGalerieAlbums(albums) {
  return albums.map(album => {
    // Icône Instagram (non-cliquable, juste indicatif)
    const instagramBadge = album.lien_instagram ? `
      <span class="album-instagram-badge" title="Disponible sur Instagram">
        <img src="/icons/instagram.svg" alt="Instagram">
      </span>
    ` : '';
    return `
    <a href="/galerie/${album.slug}" data-link class="album-card" data-category="${album.categorie_slug || ''}">
      <div class="album-image">
        <img src="${album.image_couverture || '/assets/images/logo.png'}" alt="${album.titre}" loading="lazy">
        <span class="album-count">${album.nb_photos || 0} photos</span>
        ${album.categorie_nom ? `<span class="album-category" style="background:${album.categorie_couleur || '#1a4d92'}">${album.categorie_nom}</span>` : ''}
        ${instagramBadge}
      </div>
      <div class="album-info">
        <h3>${album.titre}</h3>
        <div class="album-meta">
          ${album.date_evenement ? `<span class="album-date">${new Date(album.date_evenement).toLocaleDateString('fr-FR')}</span>` : ''}
          ${album.annee ? `<span class="album-year">${album.annee}</span>` : ''}
        </div>
        ${album.description ? `<p>${album.description}</p>` : ''}
      </div>
    </a>
  `}).join('') || '<p class="text-center">Aucun album disponible</p>';
}

// Filter galerie
function filterGalerie(categorie) {
  const grid = document.getElementById('galerie-grid');
  const albums = window.galerieAlbumsData || [];

  if (categorie === 'Tous') {
    grid.innerHTML = renderGalerieAlbums(albums);
  } else {
    const filtered = albums.filter(a => a.categorie_slug === categorie);
    grid.innerHTML = renderGalerieAlbums(filtered);
  }
}

// Render partenaires
function renderPartenaires(partenaires) {
  return partenaires.map(p => {
    const content = `
      <div class="partenaire-logo">
        <img src="${p.logo || '/assets/images/logo.png'}" alt="${p.nom}" loading="lazy">
      </div>
      <div class="partenaire-info">
        <h3>${p.nom}</h3>
        ${p.description ? `<p>${p.description}</p>` : ''}
      </div>
    `;

    // Si le partenaire a un site web, rendre la carte cliquable
    if (p.site_web) {
      return `<a href="${p.site_web}" target="_blank" rel="noopener noreferrer" class="partenaire-item partenaire-clickable">${content}</a>`;
    }
    return `<div class="partenaire-item">${content}</div>`;
  }).join('') || '<p class="text-center">Aucun partenaire</p>';
}

// Filter partenaires
function filterPartenaires(categorie) {
  const grid = document.getElementById('partenaires-grid');
  const partenaires = window.partenairesData || [];

  if (categorie === 'Tous') {
    grid.innerHTML = renderPartenaires(partenaires);
  } else {
    const filtered = partenaires.filter(p => p.type === categorie);
    grid.innerHTML = renderPartenaires(filtered);
  }
}

async function handleContact(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'ENVOI EN COURS...';

  try {
    const data = {
      nom: form.nom.value,
      email: form.email.value,
      sujet: form.sujet.value,
      message: form.message.value
    };
    await api.sendContact(data);
    alert('Message envoyé avec succès !');
    form.reset();
  } catch (err) {
    alert('Erreur: ' + err.message);
  }

  btn.disabled = false;
  btn.textContent = 'ENVOYER';
}

// =====================================================
// EXPOSE FUNCTIONS GLOBALLY (for inline handlers)
// =====================================================
window.handleContact = handleContact;

// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Charger le menu et la config depuis l'API
  let menuItems = [];
  let siteConfig = {};
  try {
    const [menuRes, configRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/config')
    ]);
    const menuData = await menuRes.json();
    const configData = await configRes.json();
    if (menuData.success) {
      menuItems = menuData.data.items;
    }
    if (configData.success) {
      siteConfig = configData.data;
    }
  } catch (e) {
    console.error('Erreur chargement menu/config:', e);
  }

  // Valeurs dynamiques depuis la config
  const siteNom = siteConfig.site_nom || 'MAGNY FC 78';
  const siteDescription = siteConfig.site_description || 'Le club de football amateur de Magny-les-Hameaux depuis 2000. Rejoignez notre grande famille de passionnés !';
  const contactAdresse = siteConfig.contact_adresse || 'Stade Jean Jaurès';
  const contactTelephone = siteConfig.contact_telephone || '01 XX XX XX XX';
  const contactEmail = siteConfig.contact_email || 'contact@magnyfc78.fr';
  const socialFacebook = siteConfig.social_facebook || '';
  const socialInstagram = siteConfig.social_instagram || '';
  const socialTwitter = siteConfig.social_twitter || '';

  // Générer les liens du menu
  const menuLinks = menuItems.map(item =>
    `<a href="${item.url}" ${item.target === '_blank' ? 'target="_blank"' : 'data-link'}>${item.label}</a>`
  ).join('');

  // Charger header
  document.getElementById('header').innerHTML = `
    <div class="container header-content">
      <a href="/" class="logo" data-link>
        <div class="logo-icon"></div>
        <span class="logo-text">${siteNom}</span>
      </a>
      <button class="menu-toggle" id="menu-toggle">☰</button>
      <nav id="nav">
        ${menuLinks}
        <a href="/admin/login.html" class="btn-connexion">CONNEXION</a>
      </nav>
    </div>
  `;

  // Charger footer avec les informations dynamiques
  document.getElementById('footer').innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div class="footer-logo">
            <div class="logo-icon"></div>
            <span class="logo-text">${siteNom}</span>
          </div>
          <p class="footer-desc">${siteDescription}</p>
        </div>
        <div class="footer-col">
          <h4>Navigation</h4>
          <a href="/" data-link>Accueil</a>
          <a href="/equipes" data-link>Équipes</a>
          <a href="/actualites" data-link>Actualités</a>
          <a href="/calendrier" data-link>Calendrier</a>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <p>📍 ${contactAdresse.split(',')[0]}</p>
          <p>📞 ${contactTelephone}</p>
          <p>✉️ ${contactEmail}</p>
        </div>
        <div class="footer-col">
          <h4>Suivez-nous</h4>
          <div class="social-links">
            ${socialFacebook ? `<a href="${socialFacebook}" target="_blank" class="social-link social-facebook" title="Facebook">
              <img src="/icons/facebook.svg" alt="Facebook">
            </a>` : ''}
            ${socialInstagram ? `<a href="${socialInstagram}" target="_blank" class="social-link social-instagram" title="Instagram">
              <img src="/icons/instagram.svg" alt="Instagram">
            </a>` : ''}
            ${socialTwitter ? `<a href="${socialTwitter}" target="_blank" class="social-link social-twitter" title="Twitter/X">
              <img src="/icons/twitter.svg" alt="Twitter">
            </a>` : ''}
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        © ${new Date().getFullYear()} ${siteNom}. Tous droits réservés.
      </div>
    </div>
  `;

  // Menu mobile
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('active');
  });

  // Fermer menu au clic sur lien
  document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('nav').classList.remove('active');
    });
  });

  // Event delegation for filter buttons
  document.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('.filter-btn[data-filter]');
    if (!filterBtn) return;

    const filterType = filterBtn.dataset.filter;
    const category = filterBtn.dataset.category;
    const filtersContainer = filterBtn.closest('.filters');

    // Update active state
    filtersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    filterBtn.classList.add('active');

    // Call the appropriate filter function
    switch (filterType) {
      case 'equipes':
        filterEquipes(category);
        break;
      case 'actualites':
        filterActualites(category);
        break;
      case 'galerie':
        filterGalerie(category);
        break;
      case 'partenaires':
        filterPartenaires(category);
        break;
    }
  });

  // Event delegation for calendrier tabs
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.tab-btn[data-tab]');
    if (!tabBtn) return;

    const tabId = tabBtn.dataset.tab;
    const tabsContainer = tabBtn.closest('.calendrier-tabs');
    const contentContainer = document.getElementById('calendrier-content');

    if (!contentContainer) return;

    // Update active tab button
    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');

    // Update active tab pane
    contentContainer.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  });

  // Event delegation for contact form submission
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'contact-form') {
      handleContact(e);
    }
  });

  // Routes
  router.addRoute('/', views.home);
  router.addRoute('/equipes', views.equipes);
  router.addRoute('/actualites', views.actualites);
  router.addRoute('/galerie', views.galerie);
  router.addRoute('/galerie/histoire', views.galerieHistoire);
  router.addRoute('/galerie/:slug', views.galerieAlbum);
  router.addRoute('/partenaires', views.partenaires);
  router.addRoute('/calendrier', views.calendrier);
  router.addRoute('/club', views.club);
  router.addRoute('/contact', views.contact);

  // =====================================================
  // LIGHTBOX - Affichage des images en grand format
  // =====================================================

  // Variables pour la navigation
  let lightboxImages = [];
  let lightboxCurrentIndex = 0;

  // Créer le modal lightbox avec navigation
  const lightbox = document.createElement('div');
  lightbox.id = 'lightbox';
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `
    <button class="lightbox-close">&times;</button>
    <button class="lightbox-nav lightbox-prev">&#10094;</button>
    <img class="lightbox-img" src="" alt="Image en grand">
    <button class="lightbox-nav lightbox-next">&#10095;</button>
    <div class="lightbox-counter"></div>
  `;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const lightboxClose = lightbox.querySelector('.lightbox-close');
  const lightboxPrev = lightbox.querySelector('.lightbox-prev');
  const lightboxNext = lightbox.querySelector('.lightbox-next');
  const lightboxCounter = lightbox.querySelector('.lightbox-counter');

  // Afficher l'image courante
  function showLightboxImage(index) {
    if (lightboxImages.length === 0) return;

    // Boucler sur les images
    if (index < 0) index = lightboxImages.length - 1;
    if (index >= lightboxImages.length) index = 0;

    lightboxCurrentIndex = index;
    lightboxImg.src = lightboxImages[index];

    // Mettre à jour le compteur
    lightboxCounter.textContent = `${index + 1} / ${lightboxImages.length}`;

    // Masquer les flèches s'il n'y a qu'une image
    const showNav = lightboxImages.length > 1;
    lightboxPrev.style.display = showNav ? 'flex' : 'none';
    lightboxNext.style.display = showNav ? 'flex' : 'none';
    lightboxCounter.style.display = showNav ? 'block' : 'none';
  }

  // Navigation
  function lightboxPrevImage() {
    showLightboxImage(lightboxCurrentIndex - 1);
  }

  function lightboxNextImage() {
    showLightboxImage(lightboxCurrentIndex + 1);
  }

  // Fermer la lightbox
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightboxImages = [];
    lightboxCurrentIndex = 0;
  }

  // Event listeners
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    lightboxPrevImage();
  });
  lightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    lightboxNextImage();
  });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrevImage();
    if (e.key === 'ArrowRight') lightboxNextImage();
  });

  // Ouvrir la lightbox au clic sur une image
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;

    // Ignorer les logos, icônes et petites images
    const isLogo = img.closest('.logo, .logo-icon, .footer-logo, .social-link');
    const isIcon = img.closest('.instagram-link-bottom') || img.width < 50;
    const isPartenaireSmall = img.closest('.partenaire-item');
    const isOrganigramme = img.closest('.organigramme-section, .organigramme-container, .hexagon, .org-member');

    if (isLogo || isIcon || isPartenaireSmall || isOrganigramme) return;

    // Trouver toutes les images de la galerie/album
    const container = img.closest('.album-photos-grid, .galerie-grid, .actualites-grid');
    if (container) {
      // Mode galerie: collecter toutes les images
      const images = container.querySelectorAll('img');
      lightboxImages = Array.from(images).map(i => i.dataset.full || i.src);
      lightboxCurrentIndex = Array.from(images).indexOf(img);
    } else {
      // Mode image unique
      lightboxImages = [img.dataset.full || img.src];
      lightboxCurrentIndex = 0;
    }

    // Ouvrir la lightbox
    showLightboxImage(lightboxCurrentIndex);
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Initialiser
  router.init();
});
