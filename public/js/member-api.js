/**
 * MAGNY FC 78 - Client API Espace Membre
 * Gère l'authentification et les données des adhérents
 */

class MemberAPI {
  constructor() {
    this.baseURL = '/api/member';
    this.token = localStorage.getItem('memberAccessToken');
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

  // Gestion des erreurs et rafraîchissement du token
  async handleResponse(response, retry = true) {
    const data = await response.json();

    if (!response.ok) {
      // Token expiré - essayer de rafraîchir
      if (response.status === 401 && this.token && retry) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return { _retry: true };
        }
      }

      // Email non vérifié
      if (data.code === 'EMAIL_NOT_VERIFIED') {
        throw { message: data.error, code: 'EMAIL_NOT_VERIFIED' };
      }

      throw new Error(data.error || 'Une erreur est survenue');
    }

    return data;
  }

  // Requête générique avec retry automatique
  async request(endpoint, options = {}, retry = true) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: this.getHeaders(),
        credentials: 'include'
      });

      const result = await this.handleResponse(response, retry);

      // Si retry nécessaire, relancer la requête
      if (result && result._retry) {
        return this.request(endpoint, options, false);
      }

      return result;
    } catch (error) {
      console.error('Member API Error:', error);
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
  async delete(endpoint, data = null) {
    const options = { method: 'DELETE' };
    if (data) {
      options.body = JSON.stringify(data);
    }
    return this.request(endpoint, options);
  }

  // =====================================================
  // AUTHENTIFICATION MEMBRE
  // =====================================================

  async register(data) {
    const response = await this.post('/auth/register', data);
    return response;
  }

  async login(email, password, rememberMe = false) {
    const response = await this.post('/auth/login', { email, password, rememberMe });
    if (response.success) {
      this.token = response.data.accessToken;
      localStorage.setItem('memberAccessToken', this.token);
      localStorage.setItem('memberAccount', JSON.stringify(response.data.account));
      localStorage.setItem('memberLicenses', JSON.stringify(response.data.licenses || []));
    }
    return response;
  }

  async logout() {
    try {
      await this.post('/auth/logout', {});
    } catch (error) {
      console.warn('Logout failed, clearing local storage anyway');
    } finally {
      this.clearSession();
    }
  }

  async refreshToken() {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.token = data.data.accessToken;
          localStorage.setItem('memberAccessToken', this.token);
          return true;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    this.clearSession();
    return false;
  }

  clearSession() {
    this.token = null;
    localStorage.removeItem('memberAccessToken');
    localStorage.removeItem('memberAccount');
    localStorage.removeItem('memberLicenses');
  }

  async verifyEmail(token) {
    return this.post('/auth/verify-email', { token });
  }

  async resendVerification(email) {
    return this.post('/auth/resend-verification', { email });
  }

  async forgotPassword(email) {
    return this.post('/auth/forgot-password', { email });
  }

  async resetPassword(token, password) {
    return this.post('/auth/reset-password', { token, password });
  }

  async getMe() {
    const response = await this.get('/auth/me');
    if (response.success) {
      localStorage.setItem('memberAccount', JSON.stringify(response.data.account));
      localStorage.setItem('memberLicenses', JSON.stringify(response.data.licenses || []));
    }
    return response;
  }

  async getSessions() {
    return this.get('/auth/sessions');
  }

  async revokeSession(sessionId) {
    return this.delete(`/auth/sessions/${sessionId}`);
  }

  // =====================================================
  // LICENCES
  // =====================================================

  async getLicenses() {
    return this.get('/licenses');
  }

  async getLicense(id) {
    return this.get(`/licenses/${id}`);
  }

  async updateLicense(id, data) {
    return this.patch(`/licenses/${id}`, data);
  }

  async setPrimaryLicense(id) {
    return this.put(`/licenses/${id}/primary`, {});
  }

  async linkLicense(code) {
    return this.post('/licenses/link', { code });
  }

  async unlinkLicense(id) {
    return this.delete(`/licenses/${id}/unlink`);
  }

  async requestLicenseLink(licenseId, relationship, message) {
    return this.post(`/licenses/${licenseId}/request-link`, { relationship, message });
  }

  // =====================================================
  // PROFIL
  // =====================================================

  async getProfile() {
    return this.get('/profile');
  }

  async updateProfile(data) {
    return this.patch('/profile', data);
  }

  async changePassword(currentPassword, newPassword, confirmPassword) {
    return this.put('/profile/password', { currentPassword, newPassword, confirmPassword });
  }

  async changeEmail(newEmail, password) {
    return this.put('/profile/email', { newEmail, password });
  }

  async updateNotifications(preferences) {
    return this.put('/profile/notifications', preferences);
  }

  async deleteAccount(password, confirmation) {
    return this.delete('/profile', { password, confirmation });
  }

  async getActivity(limit = 20, offset = 0) {
    return this.get(`/profile/activity?limit=${limit}&offset=${offset}`);
  }

  // =====================================================
  // HELPERS
  // =====================================================

  isAuthenticated() {
    return !!this.token;
  }

  getAccount() {
    const account = localStorage.getItem('memberAccount');
    return account ? JSON.parse(account) : null;
  }

  getLicensesFromStorage() {
    const licenses = localStorage.getItem('memberLicenses');
    return licenses ? JSON.parse(licenses) : [];
  }

  getPrimaryLicense() {
    const licenses = this.getLicensesFromStorage();
    return licenses.find(l => l.isPrimary) || licenses[0] || null;
  }
}

// Instance globale
const memberAPI = new MemberAPI();
