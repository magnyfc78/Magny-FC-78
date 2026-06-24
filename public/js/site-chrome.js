/**
 * MAGNY FC 78 — En-tête & pied de page partagés
 * Injecte le header/footer officiels du site (cf. js/app.js) sur les
 * pages autonomes (espace membre, authentification…).
 * Navigation classique (rechargement complet) : ces pages ne font pas
 * partie de la SPA, mais le serveur renvoie index.html pour les routes
 * inconnues, donc les liens du menu fonctionnent normalement.
 */
(function () {
  const FALLBACK_MENU = [
    { label: 'Accueil', url: '/' },
    { label: 'Le Club', url: '/club' },
    { label: 'Équipes', url: '/equipes' },
    { label: 'Actualités', url: '/actualites' },
    { label: 'Calendrier', url: '/calendrier' },
    { label: 'Galerie', url: '/galerie' },
    { label: 'Contact', url: '/contact' }
  ];

  function buildHeader(siteNom, menuItems) {
    const links = menuItems
      .map(
        (item) =>
          `<a href="${item.url}"${item.target === '_blank' ? ' target="_blank" rel="noopener"' : ''}>${item.label}</a>`
      )
      .join('');

    return `
      <div class="container header-content">
        <a href="/" class="logo">
          <div class="logo-icon"></div>
          <span class="logo-text">${siteNom}</span>
        </a>
        <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
        <nav id="nav">
          ${links}
          <a href="/pages/login.html" class="btn-connexion">ESPACE MEMBRE</a>
        </nav>
      </div>`;
  }

  function buildFooter(cfg) {
    const siteNom = cfg.site_nom || 'MAGNY FC 78';
    const desc =
      cfg.site_description ||
      'Le club de football amateur de Magny-les-Hameaux. Rejoignez notre grande famille de passionnés !';
    const adresse = (cfg.contact_adresse || 'Stade Jean Jaurès').split(',')[0];
    const tel = cfg.contact_telephone || '01 XX XX XX XX';
    const email = cfg.contact_email || 'contact@magnyfc78.fr';
    const fb = cfg.social_facebook || '';
    const ig = cfg.social_instagram || '';
    const tw = cfg.social_twitter || '';

    return `
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <div class="footer-logo">
              <div class="logo-icon"></div>
              <span class="logo-text">${siteNom}</span>
            </div>
            <p class="footer-desc">${desc}</p>
          </div>
          <div class="footer-col">
            <h4>Navigation</h4>
            <a href="/">Accueil</a>
            <a href="/equipes">Équipes</a>
            <a href="/actualites">Actualités</a>
            <a href="/calendrier">Calendrier</a>
          </div>
          <div class="footer-col">
            <h4>Espace membre</h4>
            <a href="/pages/login.html">Connexion</a>
            <a href="/pages/register.html">Inscription</a>
            <a href="/pages/member-dashboard.html">Mes licences</a>
          </div>
          <div class="footer-col">
            <h4>Contact</h4>
            <p>📍 ${adresse}</p>
            <p>📞 ${tel}</p>
            <p>✉️ ${email}</p>
            <div class="social-links">
              ${fb ? `<a href="${fb}" target="_blank" rel="noopener" class="social-link">📘</a>` : ''}
              ${ig ? `<a href="${ig}" target="_blank" rel="noopener" class="social-link">📷</a>` : ''}
              ${tw ? `<a href="${tw}" target="_blank" rel="noopener" class="social-link">🐦</a>` : ''}
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          © ${new Date().getFullYear()} ${siteNom}. Tous droits réservés.
        </div>
      </div>`;
  }

  async function render() {
    let menuItems = FALLBACK_MENU;
    let cfg = {};
    try {
      const [menuRes, configRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/config')
      ]);
      const menuData = await menuRes.json();
      const configData = await configRes.json();
      if (menuData.success && Array.isArray(menuData.data.items) && menuData.data.items.length) {
        menuItems = menuData.data.items;
      }
      if (configData.success) cfg = configData.data;
    } catch (e) {
      /* hors-ligne / API indisponible : on garde les valeurs de repli */
    }

    const siteNom = cfg.site_nom || 'MAGNY FC 78';
    const header = document.querySelector('header.site-header');
    const footer = document.querySelector('footer.site-footer');
    if (header) header.innerHTML = buildHeader(siteNom, menuItems);
    if (footer) footer.innerHTML = buildFooter(cfg);

    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => nav.classList.toggle('active'));
      nav.querySelectorAll('a').forEach((a) =>
        a.addEventListener('click', () => nav.classList.remove('active'))
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
