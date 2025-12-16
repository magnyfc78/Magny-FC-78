/**
 * MAGNY FC 78 - Application avec nouveau design
 */

// =====================================================
// VUES / PAGES
// =====================================================

const views = {
  // Page d'accueil
  async home() {
    const [matchsRes, actusRes] = await Promise.all([
      api.getMatchs('a_venir', 6),
      api.getActualites(3)
    ]);

    const matchs = matchsRes?.data?.matchs || [];
    const actualites = actusRes?.data?.actualites || [];

    return `
      <!-- Hero -->
      <section class="hero">
        <div class="hero-content">
          <h1>MAGNY FC 78</h1>
          <p class="hero-subtitle">Le club de football amateur de Magny-les-Hameaux, Yvelines.</p>
          <a href="/contact" class="btn-hero" data-link>
            REJOINDRE LE CLUB
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
            <div class="stat-item">
              <div class="stat-value">300+</div>
              <div class="stat-label">Licenciés</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">17</div>
              <div class="stat-label">Équipes</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">24</div>
              <div class="stat-label">Années</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">1er</div>
              <div class="stat-label">Club de la ville</div>
            </div>
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
                    <span class="match-competition">${m.competition || 'Match'}</span>
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
            ${actualites.map((a, index) => {
              const imageMap = { 'Match': 'match', 'Événement': 'evenement', 'Club': 'club', 'Formation': 'formation' };
              const imgType = imageMap[a.categorie] || 'club';
              const imgNum = (index % 2) + 1;
              return `
              <article class="actu-card">
                <div class="actu-image">
                  <img src="/assets/images/actualites/${imgType}_${imgNum}.jpg" alt="${a.titre}" loading="lazy">
                </div>
                <div class="actu-body">
                  <div class="actu-meta">
                    <span class="actu-category">${a.categorie}</span>
                    <span class="actu-date">${a.date_formatee}</span>
                  </div>
                  <h3 class="actu-title">${a.titre}</h3>
                  <p class="actu-excerpt">${a.extrait || ''}</p>
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
            ${[1,2,3,4,5].map(i => `
              <div class="partenaire-item">
                <span style="color: var(--gris); font-size: 0.9rem;">Partenaire ${i}</span>
              </div>
            `).join('')}
          </div>
          <div class="text-center mt-4">
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
    const res = await api.getActualites(20);
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
  galerie() {
    const categories = ['Tous', 'Matchs', 'Entraînements', 'Événements'];
    const images = {
      matchs: [1,2,3,4,5,6].map(i => ({ src: `/assets/images/gallery/match_${i}.jpg`, cat: 'Matchs', alt: `Match ${i}` })),
      entrainements: [1,2,3,4,5,6].map(i => ({ src: `/assets/images/gallery/entrainement_${i}.jpg`, cat: 'Entraînements', alt: `Entraînement ${i}` })),
      evenements: [1,2,3,4].map(i => ({ src: `/assets/images/gallery/evenement_${i}.jpg`, cat: 'Événements', alt: `Événement ${i}` }))
    };
    const allImages = [...images.matchs, ...images.entrainements, ...images.evenements];
    window.galerieImages = allImages;

    return `
      <section class="page-header">
        <h1>Galerie</h1>
        <p>Les moments forts du club en images</p>
      </section>

      <section class="section">
        <div class="container">
          <div class="filters" id="galerie-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" data-filter="galerie" data-category="${c}">${c}</button>
            `).join('')}
          </div>
          <div class="galerie-grid" id="galerie-grid">
            ${allImages.map(img => `
              <div class="galerie-item" data-category="${img.cat}">
                <img src="${img.src}" alt="${img.alt}" loading="lazy">
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  },

  // Page partenaires
  partenaires() {
    const categories = ['Tous', 'Gold', 'Silver', 'Bronze'];
    const partenaires = [
      { nom: 'Mairie de Magny', categorie: 'Gold', logo: 'mairie' },
      { nom: 'Conseil Départemental 78', categorie: 'Gold', logo: 'cd78' },
      { nom: 'Sport 2000', categorie: 'Gold', logo: 'sport2000' },
      { nom: 'Crédit Agricole', categorie: 'Silver', logo: 'ca' },
      { nom: 'Boulangerie du Centre', categorie: 'Silver', logo: 'boulangerie' },
      { nom: 'Garage Dupont', categorie: 'Silver', logo: 'garage' },
      { nom: 'Pharmacie des Hameaux', categorie: 'Silver', logo: 'pharmacie' },
      { nom: 'Restaurant Le Sporting', categorie: 'Bronze', logo: 'resto' },
      { nom: 'Assurance Martin', categorie: 'Bronze', logo: 'assurance' },
      { nom: 'Coiffure Style', categorie: 'Bronze', logo: 'coiffure' }
    ];
    window.partenairesData = partenaires;

    return `
      <section class="page-header">
        <h1>Partenaires</h1>
        <p>Ils nous soutiennent</p>
      </section>

      <section class="section">
        <div class="container">
          <div class="filters" id="partenaires-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" data-filter="partenaires" data-category="${c}">${c}</button>
            `).join('')}
          </div>
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

  // Page calendrier
  async calendrier() {
    const res = await api.getMatchs('tous', 30);
    const matchs = res?.data?.matchs || [];

    return `
      <section class="page-header">
        <h1>Calendrier</h1>
        <p>Tous les matchs de la saison</p>
      </section>
      
      <section class="section">
        <div class="container" style="max-width: 900px;">
          ${matchs.map(m => `
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
                  <span class="match-competition">${m.competition || 'Match'}</span>
                </div>
              </div>
            </div>
          `).join('') || '<p class="text-center">Aucun match programmé</p>'}
        </div>
      </section>
    `;
  },

  // Page contact
  contact() {
    return `
      <section class="page-header">
        <h1>Contact</h1>
        <p>Rejoignez le Magny FC 78</p>
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
                  <p>Stade Jean Jaurès<br>4 rue Jean Jaurès<br>78114 Magny-les-Hameaux</p>
                </div>
              </div>

              <div class="contact-item">
                <span class="contact-icon">📞</span>
                <div>
                  <h3>TÉLÉPHONE</h3>
                  <p>01 XX XX XX XX</p>
                </div>
              </div>

              <div class="contact-item">
                <span class="contact-icon">✉️</span>
                <div>
                  <h3>EMAIL</h3>
                  <p>contact@magnyfc78.fr</p>
                </div>
              </div>

              <div class="contact-item">
                <span class="contact-icon">🕐</span>
                <div>
                  <h3>HORAIRES SECRÉTARIAT</h3>
                  <p>Mercredi : 14h - 18h<br>Samedi : 9h - 12h</p>
                </div>
              </div>
            </div>

            <div class="contact-form">
              <h2>ENVOYER UN MESSAGE</h2>
              <form id="contact-form" onsubmit="handleContact(event)">
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
                    <option>Inscription</option>
                    <option>Information</option>
                    <option>Partenariat</option>
                    <option>Autre</option>
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
      <div class="equipe-card-header">
        <h3>${e.nom}</h3>
      </div>
      <div class="equipe-card-body">
        <div class="equipe-badges">
          <span class="badge badge-or">${e.categorie_nom}</span>
          <span class="badge badge-bleu">${e.division || '-'}</span>
        </div>
        <div class="equipe-info">
          <p>👥 ${e.nb_joueurs || 0} joueurs</p>
          <p>🏆 Coach: ${e.coach || 'N/A'}</p>
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
  const imageMap = { 'Match': 'match', 'Événement': 'evenement', 'Club': 'club', 'Formation': 'formation' };
  return actualites.map((a, index) => {
    const imgType = imageMap[a.categorie] || 'club';
    const imgNum = (index % 2) + 1;
    return `
      <article class="actu-card" data-category="${a.categorie}">
        <div class="actu-image">
          <img src="/assets/images/actualites/${imgType}_${imgNum}.jpg" alt="${a.titre}" loading="lazy">
        </div>
        <div class="actu-body">
          <div class="actu-meta">
            <span class="actu-category">${a.categorie}</span>
            <span class="actu-date">${a.date_formatee}</span>
          </div>
          <h3 class="actu-title">${a.titre}</h3>
          <p class="actu-excerpt">${a.extrait || ''}</p>
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

// Filter galerie
function filterGalerie(categorie) {
  const items = document.querySelectorAll('.galerie-item');
  items.forEach(item => {
    if (categorie === 'Tous' || item.dataset.category === categorie) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// Render partenaires
function renderPartenaires(partenaires) {
  const badgeColors = { 'Gold': 'badge-or', 'Silver': 'badge-argent', 'Bronze': 'badge-bronze' };
  return partenaires.map(p => `
    <div class="partenaire-item" data-category="${p.categorie}">
      <div class="partenaire-logo">
        <span style="font-size: 2rem;">🏢</span>
      </div>
      <div class="partenaire-info">
        <h3>${p.nom}</h3>
        <span class="badge ${badgeColors[p.categorie] || 'badge-or'}">${p.categorie}</span>
      </div>
    </div>
  `).join('');
}

// Filter partenaires
function filterPartenaires(categorie) {
  const grid = document.getElementById('partenaires-grid');
  const partenaires = window.partenairesData || [];

  if (categorie === 'Tous') {
    grid.innerHTML = renderPartenaires(partenaires);
  } else {
    const filtered = partenaires.filter(p => p.categorie === categorie);
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
  // Charger le menu depuis l'API
  let menuItems = [];
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success) {
      menuItems = data.data.items;
    }
  } catch (e) {
    console.error('Erreur chargement menu:', e);
  }

  // Générer les liens du menu
  const menuLinks = menuItems.map(item =>
    `<a href="${item.url}" ${item.target === '_blank' ? 'target="_blank"' : 'data-link'}>${item.label}</a>`
  ).join('');

  // Charger header
  document.getElementById('header').innerHTML = `
    <div class="container header-content">
      <a href="/" class="logo" data-link>
        <div class="logo-icon"></div>
        <span class="logo-text">MAGNY FC 78</span>
      </a>
      <button class="menu-toggle" id="menu-toggle">☰</button>
      <nav id="nav">
        ${menuLinks}
        <a href="/admin/login.html" class="btn-connexion">CONNEXION</a>
      </nav>
    </div>
  `;

  // Charger footer
  document.getElementById('footer').innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <div class="footer-logo">
            <div class="logo-icon"></div>
            <span class="logo-text">MAGNY FC 78</span>
          </div>
          <p class="footer-desc">Le club de football amateur de Magny-les-Hameaux depuis 2000. Rejoignez notre grande famille de passionnés !</p>
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
          <p>📍 Stade Jean Jaurès</p>
          <p>📞 01 XX XX XX XX</p>
          <p>✉️ contact@magnyfc78.fr</p>
        </div>
        <div class="footer-col">
          <h4>Suivez-nous</h4>
          <div class="social-links">
            <a href="#" class="social-link">📘</a>
            <a href="#" class="social-link">📷</a>
            <a href="#" class="social-link">🐦</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        © ${new Date().getFullYear()} Magny Football Club 78. Tous droits réservés.
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

  // Routes
  router.addRoute('/', views.home);
  router.addRoute('/equipes', views.equipes);
  router.addRoute('/actualites', views.actualites);
  router.addRoute('/galerie', views.galerie);
  router.addRoute('/partenaires', views.partenaires);
  router.addRoute('/calendrier', views.calendrier);
  router.addRoute('/contact', views.contact);

  // Initialiser
  router.init();
});
