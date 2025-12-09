/**
 * MAGNY FC 78 - Client API sécurisé
 */

class API {
  constructor() {
    this.baseURL = '/api';
    this.token = localStorage.getItem('accessToken');
  }

  // Headers par défaut
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Gestion des erreurs
  async handleResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
      // Token expiré - essayer de rafraîchir
      if (response.status === 401 && this.token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Réessayer la requête
          return null; // Signal pour retry
        }
      }
      throw new Error(data.error || 'Une erreur est survenue');
    }
    
    return data;
  }

  // Requête générique
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: this.getHeaders(),
        credentials: 'include' // Pour les cookies
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // GET
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // PATCH
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // DELETE
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // =====================================================
  // AUTHENTIFICATION
  // =====================================================
  
  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });
    if (response.success) {
      this.token = response.data.accessToken;
      localStorage.setItem('accessToken', this.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  }

  async register(nom, email, password, confirmPassword) {
    const response = await this.post('/auth/register', { nom, email, password, confirmPassword });
    if (response.success) {
      this.token = response.data.accessToken;
      localStorage.setItem('accessToken', this.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response;
  }

  async logout() {
    await this.post('/auth/logout', {});
    this.token = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }

  async refreshToken() {
    try {
      const response = await this.post('/auth/refresh', {});
      if (response.success) {
        this.token = response.data.accessToken;
        localStorage.setItem('accessToken', this.token);
        return true;
      }
    } catch (error) {
      this.logout();
    }
    return false;
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    return !!this.token;
  }

  isAdmin() {
    const user = this.getUser();
    return user?.role === 'admin';
  }

  // =====================================================
  // ÉQUIPES
  // =====================================================
  
  async getEquipes(categorie = null) {
    let url = '/equipes';
    if (categorie && categorie !== 'Tous') {
      url += `?categorie=${encodeURIComponent(categorie)}`;
    }
    return this.get(url);
  }

  async getEquipe(id) {
    return this.get(`/equipes/${id}`);
  }

  async getCategories() {
    return this.get('/equipes/categories');
  }

  // =====================================================
  // MATCHS
  // =====================================================
  
  async getMatchs(type = 'a_venir', limit = 20) {
    return this.get(`/matchs?type=${type}&limit=${limit}`);
  }

  // =====================================================
  // ACTUALITÉS
  // =====================================================
  
  async getActualites(limit = 10, categorie = null) {
    let url = `/actualites?limit=${limit}`;
    if (categorie && categorie !== 'Tous') {
      url += `&categorie=${encodeURIComponent(categorie)}`;
    }
    return this.get(url);
  }

  async getActualite(id) {
    return this.get(`/actualites/${id}`);
  }

  // =====================================================
  // CONTACT
  // =====================================================
  
  async sendContact(data) {
    return this.post('/contact', data);
  }
}

// Instance globale
const api = new API();
