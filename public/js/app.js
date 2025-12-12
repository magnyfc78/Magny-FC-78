/**
 * MAGNY FC 78 - Application avec design Brutalist (Style Wix)
 */

// =====================================================
// VUES / PAGES
// =====================================================

const views = {
  // Page d'accueil - Style Brutalist
  async home() {
    const [matchsRes, actusRes] = await Promise.all([
      api.getMatchs('a_venir', 6),
      api.getActualites(3)
    ]);

    const matchs = matchsRes?.data?.matchs || [];
    const actualites = actusRes?.data?.actualites || [];

    const values = [
      { icon: '👥', title: "ESPRIT D'ÉQUIPE", description: "Ensemble, nous sommes plus forts. La solidarité est au cœur de notre club." },
      { icon: '🛡️', title: "RESPECT", description: "Respect des adversaires, des arbitres et des valeurs du sport." },
      { icon: '🏆', title: "PERFORMANCE", description: "Viser l'excellence à chaque entraînement et chaque match." },
      { icon: '❤️', title: "SOLIDARITÉ", description: "Un club où chacun trouve sa place et son soutien." }
    ];

    return `
      <!-- Hero -->
      <section class="hero">
        <div class="hero-content">
          <h1>MAGNY FC 78</h1>
          <p class="hero-subtitle">Le club de football amateur de Magny-les-Hameaux, Yvelines.</p>
          <a href="/contact" class="btn-hero brutalist-shadow-primary" data-link>
            REJOINDRE LE CLUB
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 8px; background: var(--turquoise);"></div>
      </section>

      <!-- Marquee Values -->
      <section class="marquee-section">
        <div class="marquee-content">
          ${[1,2,3,4].map(() => values.map(v => `
            <div class="marquee-item">
              <span>${v.title}</span>
              <div class="marquee-diamond"></div>
            </div>
          `).join('')).join('')}
        </div>
      </section>

      <!-- Histoire Section -->
      <section class="histoire-section">
        <div class="container">
          <div class="histoire-grid">
            <div class="histoire-title">
              <h2>Notre Histoire</h2>
            </div>
            <div class="histoire-content">
              <p>Fondé à Magny-les-Hameaux dans les Yvelines, le <strong>Magny FC 78</strong> est bien plus qu'un club de football amateur. C'est une famille, une communauté unie par la passion du ballon rond.</p>
              <p>Depuis nos débuts, nous accueillons des joueurs de tous âges, des U7 aux Séniors, en passant par nos équipes Féminines. Notre mission : développer le talent, cultiver l'esprit sportif et créer des souvenirs inoubliables.</p>
              <p>Basés au cœur du 78114, nous sommes fiers de représenter Magny-les-Hameaux sur les terrains de la région et au-delà.</p>
              <div class="histoire-image brutalist-shadow-primary">
                <img src="/assets/images/equipes/equipe_1.jpg" alt="Équipe Magny FC 78" loading="lazy">
              </div>
              <a href="/equipes" class="btn btn-outline" style="border-color: var(--bleu-fonce); color: var(--bleu-fonce);" data-link>
                DÉCOUVRIR NOS ÉQUIPES →
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Values Section -->
      <section class="values-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Nos Valeurs</h2>
            <div class="section-line"></div>
          </div>
        </div>
        <div class="values-grid">
          ${values.map(v => `
            <div class="value-card">
              <div class="value-icon">${v.icon}</div>
              <h3>${v.title}</h3>
              <p>${v.description}</p>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Actualités CTA -->
      <section class="cta-section">
        <div class="container">
          <div class="cta-content">
            <h2>Dernières Actualités</h2>
            <p>Résultats, événements, vie du club : suivez toute l'actualité du MFC78.</p>
            <a href="/actualites" class="btn btn-primary" data-link>VOIR TOUTES LES ACTUS →</a>
          </div>
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

      <!-- CTA Rejoindre -->
      <section class="section" style="background: var(--blanc);">
        <div class="container text-center">
          <h2 class="section-title">Prêt à nous rejoindre ?</h2>
          <p style="font-size: 1.2rem; color: var(--gris); margin-bottom: 40px; max-width: 700px; margin-left: auto; margin-right: auto;">
            Que vous soyez débutant ou confirmé, jeune ou moins jeune, il y a une place pour vous au Magny FC 78.
          </p>
          <div class="cta-buttons">
            <a href="/contact" class="btn btn-primary brutalist-shadow-primary" data-link>S'INSCRIRE MAINTENANT →</a>
            <a href="/contact" class="btn btn-outline" style="border-color: var(--bleu-fonce); color: var(--bleu-fonce);" data-link>NOUS CONTACTER</a>
          </div>
        </div>
      </section>
    `;
  },

  // Page équipes - Style Brutalist
  async equipes() {
    const res = await api.getEquipes();
    const equipes = res?.data?.equipes || [];
    const categories = ['Tous', 'Seniors', 'Féminines', 'Vétérans', 'Jeunes', 'École de Foot'];

    return `
      <section class="page-header-brutalist">
        <div class="container">
          <h1>NOS ÉQUIPES</h1>
          <p>De l'école de foot aux seniors, découvrez toutes nos catégories</p>
        </div>
      </section>

      <!-- Filters -->
      <section style="background: var(--gris-fonce); padding: 20px 0;">
        <div class="container">
          <div class="filters" id="equipes-filters" style="margin-bottom: 0;">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" onclick="filterEquipes('${c}', this)">${c}</button>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="equipes-grid" id="equipes-grid">
            ${renderEquipesBrutalist(equipes)}
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <div class="container">
          <div class="cta-content">
            <h2>REJOIGNEZ UNE ÉQUIPE</h2>
            <p>Inscrivez-vous dès maintenant et faites partie de la famille Magny FC 78</p>
            <a href="/contact" class="btn btn-primary" data-link>DEVENIR MEMBRE →</a>
          </div>
        </div>
      </section>
    `;
  },

  // Page actualités - Style Brutalist
  async actualites() {
    const res = await api.getActualites(20);
    const actualites = res?.data?.actualites || [];
    const categories = ['Tous', 'Match', 'Événement', 'Club', 'Formation'];
    window.actualitesData = actualites;

    return `
      <section class="page-header-brutalist">
        <div class="container">
          <h1>ACTUALITÉS</h1>
          <p>Toute l'actualité du Magny FC 78</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="filters" id="actualites-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" onclick="filterActualites('${c}', this)">${c}</button>
            `).join('')}
          </div>
          <div class="actualites-grid" id="actualites-grid">
            ${renderActualites(actualites)}
          </div>
        </div>
      </section>
    `;
  },

  // Page galerie - Style Brutalist
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
      <section class="page-header-brutalist">
        <div class="container">
          <h1>GALERIE</h1>
          <p>Les moments forts du club en images</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="filters" id="galerie-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" onclick="filterGalerie('${c}', this)">${c}</button>
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

  // Page partenaires - Style Brutalist
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
      <section class="page-header-brutalist">
        <div class="container">
          <h1>PARTENAIRES</h1>
          <p>Ils nous soutiennent</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="filters" id="partenaires-filters">
            ${categories.map(c => `
              <button class="filter-btn ${c === 'Tous' ? 'active' : ''}" onclick="filterPartenaires('${c}', this)">${c}</button>
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

  // Page calendrier - Style Brutalist
  async calendrier() {
    const res = await api.getMatchs('tous', 30);
    const matchs = res?.data?.matchs || [];

    return `
      <section class="page-header-brutalist">
        <div class="container">
          <h1>CALENDRIER</h1>
          <p>Tous les matchs de la saison</p>
        </div>
      </section>

      <section class="section">
        <div class="container" style="max-width: 900px;">
          ${matchs.map(m => `
            <div class="match-card brutalist-shadow-primary" style="margin-bottom: 20px;">
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

  // Page contact - Style Brutalist
  contact() {
    return `
      <section class="page-header-brutalist">
        <div class="container">
          <h1>CONTACT</h1>
          <p>Une question ? N'hésitez pas à nous contacter</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="contact-grid" style="grid-template-columns: 7fr 5fr;">
            <!-- Formulaire -->
            <div class="contact-form-brutalist">
              <h2>ENVOYEZ-NOUS UN MESSAGE</h2>
              <form id="contact-form" onsubmit="handleContact(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  <div class="form-group">
                    <label for="nom">Nom complet *</label>
                    <input type="text" id="nom" name="nom" class="form-control" required>
                  </div>
                  <div class="form-group">
                    <label for="email">Email *</label>
                    <input type="email" id="email" name="email" class="form-control" required>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                  <div class="form-group">
                    <label for="telephone">Téléphone</label>
                    <input type="tel" id="telephone" name="telephone" class="form-control">
                  </div>
                  <div class="form-group">
                    <label for="sujet">Sujet *</label>
                    <input type="text" id="sujet" name="sujet" class="form-control" required>
                  </div>
                </div>
                <div class="form-group">
                  <label for="message">Message *</label>
                  <textarea id="message" name="message" class="form-control" rows="6" required></textarea>
                </div>
                <button type="submit" class="btn btn-primary">
                  ENVOYER
                  <span style="margin-left: 10px;">→</span>
                </button>
              </form>
            </div>

            <!-- Infos Contact -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
              <div class="contact-info-brutalist">
                <h3>COORDONNÉES</h3>
                <div class="info-item">
                  <span class="info-icon">📍</span>
                  <div class="info-content">
                    <h4>Adresse</h4>
                    <p>Stade Municipal<br>Magny-les-Hameaux<br>78114, Yvelines</p>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">✉️</span>
                  <div class="info-content">
                    <h4>Email</h4>
                    <a href="mailto:mfcmagnymfc@gmail.com">mfcmagnymfc@gmail.com</a>
                  </div>
                </div>
                <div class="info-item">
                  <span class="info-icon">📞</span>
                  <div class="info-content">
                    <h4>Téléphone</h4>
                    <a href="tel:+33123456789">01 23 45 67 89</a>
                  </div>
                </div>
              </div>

              <div class="map-container">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d42064.89707373!2d2.0641!3d48.7350!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e67f0b0b0b0b0b%3A0x0!2sMagny-les-Hameaux!5e0!3m2!1sfr!2sfr!4v1234567890"
                  allowfullscreen loading="lazy" title="Localisation Magny FC 78">
                </iframe>
                <div class="map-info">
                  <p><strong>Stade Municipal</strong> - Magny-les-Hameaux, 78114</p>
                </div>
              </div>

              <div class="hours-card">
                <h3>HORAIRES D'OUVERTURE</h3>
                <div class="hours-row">
                  <span><strong>Lundi - Vendredi:</strong></span>
                  <span>18h00 - 21h00</span>
                </div>
                <div class="hours-row">
                  <span><strong>Samedi:</strong></span>
                  <span>09h00 - 18h00</span>
                </div>
                <div class="hours-row">
                  <span><strong>Dimanche:</strong></span>
                  <span>09h00 - 13h00</span>
                </div>
              </div>
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

// Render équipes style brutalist
function renderEquipesBrutalist(equipes) {
  return equipes.map(e => `
    <div class="equipe-card-brutalist">
      <div class="equipe-image">
        <span class="equipe-initial">${e.nom.charAt(0)}</span>
        ${e.categorie_nom ? `<span class="category-badge">${e.categorie_nom}</span>` : ''}
      </div>
      <div class="equipe-body">
        <h3>${e.nom}</h3>
        ${e.division ? `<p>${e.division}</p>` : ''}
        ${e.coach ? `
          <div class="equipe-meta">
            <span>👤</span>
            <span><strong>Entraîneur:</strong> ${e.coach}</span>
          </div>
        ` : ''}
        ${e.horaires ? `
          <div class="equipe-schedule">
            <span>🕐</span>
            <div>
              <p><strong>Horaires d'entraînement:</strong></p>
              <p>${e.horaires}</p>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Legacy render équipes (fallback)
function renderEquipes(equipes) {
  return renderEquipesBrutalist(equipes);
}

async function filterEquipes(categorie, btn) {
  document.querySelectorAll('#equipes-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const grid = document.getElementById('equipes-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const res = await api.getEquipes(categorie);
  grid.innerHTML = renderEquipesBrutalist(res?.data?.equipes || []);
}

// Render actualités
function renderActualites(actualites) {
  const imageMap = { 'Match': 'match', 'Événement': 'evenement', 'Club': 'club', 'Formation': 'formation' };
  return actualites.map((a, index) => {
    const imgType = imageMap[a.categorie] || 'club';
    const imgNum = (index % 2) + 1;
    return `
      <article class="actu-card card-brutalist" data-category="${a.categorie}">
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
function filterActualites(categorie, btn) {
  document.querySelectorAll('#actualites-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

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
function filterGalerie(categorie, btn) {
  document.querySelectorAll('#galerie-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

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
    <div class="partenaire-item card-brutalist" data-category="${p.categorie}">
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
function filterPartenaires(categorie, btn) {
  document.querySelectorAll('#partenaires-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

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
  btn.innerHTML = 'ENVOI EN COURS...';

  try {
    const data = {
      nom: form.nom.value,
      email: form.email.value,
      telephone: form.telephone?.value || '',
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
  btn.innerHTML = 'ENVOYER <span style="margin-left: 10px;">→</span>';
}

// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  // Charger header
  document.getElementById('header').innerHTML = `
    <div class="container header-content">
      <a href="/" class="logo" data-link title="Retour à l'accueil">
        <img src="/assets/images/logo.png" alt="Logo Magny FC 78" class="logo-icon" style="width: 55px; height: 55px; border-radius: 50%; object-fit: contain;">
        <span class="logo-text">MAGNY FC 78</span>
      </a>
      <button class="menu-toggle" id="menu-toggle">☰</button>
      <nav id="nav">
        <a href="/" data-link>ACCUEIL</a>
        <a href="/equipes" data-link>ÉQUIPES</a>
        <a href="/actualites" data-link>ACTUALITÉS</a>
        <a href="/galerie" data-link>GALERIE</a>
        <a href="/partenaires" data-link>PARTENAIRES</a>
        <a href="/contact" data-link>CONTACT</a>
        <a href="/admin/login.html" class="btn-connexion">CONNEXION</a>
      </nav>
    </div>
  `;

  // Charger footer
  document.getElementById('footer').innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <a href="/" class="footer-logo" data-link title="Retour à l'accueil">
            <img src="/assets/images/logo.png" alt="Logo Magny FC 78" class="logo-icon" style="width: 60px; height: 60px; border-radius: 50%; object-fit: contain;">
            <span class="logo-text">MAGNY FC 78</span>
          </a>
          <p class="footer-desc">Club de football amateur à Magny-les-Hameaux, Yvelines (78114). Esprit d'équipe • Respect • Performance • Solidarité</p>
        </div>
        <div class="footer-col">
          <h4>Navigation</h4>
          <a href="/" data-link>Accueil</a>
          <a href="/equipes" data-link>Nos Équipes</a>
          <a href="/actualites" data-link>Actualités</a>
          <a href="/contact" data-link>Devenir Membre</a>
          <a href="/contact" data-link>Contact</a>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <p>Magny-les-Hameaux</p>
          <p>78114, Yvelines</p>
          <p><a href="mailto:mfcmagnymfc@gmail.com">mfcmagnymfc@gmail.com</a></p>
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
        © ${new Date().getFullYear()} Magny FC 78. Tous droits réservés.
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
