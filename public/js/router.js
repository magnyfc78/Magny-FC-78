/**
 * MAGNY FC 78 - Router SPA
 */

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;

    // Écouter les changements d'URL
    window.addEventListener('popstate', () => this.handleRoute());
    
    // Intercepter les clics sur les liens
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (link) {
        e.preventDefault();
        this.navigate(link.getAttribute('href'));
      }
    });
  }

  // Ajouter une route
  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  // Naviguer vers une route
  navigate(path) {
    window.history.pushState(null, null, path);
    this.handleRoute();
  }

  // Gérer la route actuelle
  async handleRoute() {
    const path = window.location.pathname;
    const mainContent = document.getElementById('main-content');
    
    // Trouver la route correspondante
    let handler = this.routes[path];
    
    // Routes dynamiques (ex: /equipes/1)
    if (!handler) {
      for (const route in this.routes) {
        const pattern = route.replace(/:\w+/g, '([^/]+)');
        const regex = new RegExp(`^${pattern}$`);
        const match = path.match(regex);
        if (match) {
          handler = this.routes[route];
          this.params = match.slice(1);
          break;
        }
      }
    }

    // 404 si aucune route trouvée
    if (!handler) {
      handler = this.routes['/404'] || (() => '<h1>Page non trouvée</h1>');
    }

    // Afficher le loading
    mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      // Exécuter le handler
      const content = await handler(this.params);
      mainContent.innerHTML = content;
      
      // Mettre à jour la navigation active
      this.updateActiveLink(path);
      
      // Scroll en haut
      window.scrollTo(0, 0);
      
    } catch (error) {
      console.error('Router error:', error);
      mainContent.innerHTML = `
        <div class="section" style="text-align: center; padding: 100px 20px;">
          <h1 style="color: var(--bleu-900);">Erreur</h1>
          <p style="color: var(--gris-600);">${error.message}</p>
          <a href="/" class="btn btn-primary" data-link style="margin-top: 20px;">Retour à l'accueil</a>
        </div>
      `;
    }
  }

  // Mettre à jour le lien actif
  updateActiveLink(path) {
    document.querySelectorAll('nav a').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === path) {
        link.classList.add('active');
      }
    });
  }

  // Initialiser le router
  init() {
    this.handleRoute();
  }
}

// Instance globale
const router = new Router();
