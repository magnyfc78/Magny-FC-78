/**
 * MAGNY FC 78 - Espace Membre
 * Interface utilisateur pour les adhérents
 */

// =====================================================
// INITIALISATION
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  initMemberArea();
});

function initMemberArea() {
  // Vérifier si on est sur une page de l'espace membre
  const path = window.location.pathname;
  if (!path.startsWith('/espace-membre')) return;

  // Router pour l'espace membre
  const route = path.replace('/espace-membre', '') || '/';

  switch (route) {
    case '/':
    case '/dashboard':
      if (memberAPI.isAuthenticated()) {
        renderMemberDashboard();
      } else {
        renderMemberLogin();
      }
      break;
    case '/login':
      renderMemberLogin();
      break;
    case '/register':
      renderMemberRegister();
      break;
    case '/verify':
      renderEmailVerification();
      break;
    case '/forgot-password':
      renderForgotPassword();
      break;
    case '/reset-password':
      renderResetPassword();
      break;
    case '/profile':
      if (requireAuth()) renderMemberProfile();
      break;
    case '/licenses':
      if (requireAuth()) renderMemberLicenses();
      break;
    case '/link':
      if (requireAuth()) renderLinkLicense();
      break;
    case '/security':
      if (requireAuth()) renderSecuritySettings();
      break;
    default:
      if (memberAPI.isAuthenticated()) {
        renderMemberDashboard();
      } else {
        renderMemberLogin();
      }
  }
}

function requireAuth() {
  if (!memberAPI.isAuthenticated()) {
    window.location.href = '/espace-membre/login';
    return false;
  }
  return true;
}

// =====================================================
// TEMPLATES COMMUNS
// =====================================================

function getMemberHeader() {
  const account = memberAPI.getAccount();
  const licenses = memberAPI.getLicensesFromStorage();
  const primaryLicense = memberAPI.getPrimaryLicense();

  return `
    <header class="member-header">
      <div class="member-header-inner">
        <a href="/" class="member-logo">
          <img src="/assets/images/logo.jpeg" alt="Magny FC 78">
          <span>Espace Membre</span>
        </a>
        ${account ? `
          <nav class="member-nav">
            <a href="/espace-membre/dashboard" class="member-nav-link">Tableau de bord</a>
            <a href="/espace-membre/licenses" class="member-nav-link">Mes Licences</a>
            <a href="/espace-membre/profile" class="member-nav-link">Mon Profil</a>
          </nav>
          <div class="member-user">
            <div class="member-user-info">
              <span class="member-user-name">${account.fullName}</span>
              <span class="member-user-email">${account.email}</span>
            </div>
            <button onclick="handleMemberLogout()" class="btn btn-outline-light btn-sm">Déconnexion</button>
          </div>
        ` : ''}
      </div>
    </header>
  `;
}

function getMemberSidebar(activeSection = 'dashboard') {
  const account = memberAPI.getAccount();
  const licenses = memberAPI.getLicensesFromStorage();

  return `
    <aside class="member-sidebar">
      <div class="member-sidebar-user">
        <div class="member-avatar">
          ${account?.firstName?.charAt(0) || 'U'}${account?.lastName?.charAt(0) || ''}
        </div>
        <div class="member-sidebar-user-info">
          <strong>${account?.fullName || 'Utilisateur'}</strong>
          <span>${licenses.length} licence(s)</span>
        </div>
      </div>
      <nav class="member-sidebar-nav">
        <a href="/espace-membre/dashboard" class="member-sidebar-link ${activeSection === 'dashboard' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
          Tableau de bord
        </a>
        <a href="/espace-membre/licenses" class="member-sidebar-link ${activeSection === 'licenses' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"/></svg>
          Mes Licences
        </a>
        <a href="/espace-membre/profile" class="member-sidebar-link ${activeSection === 'profile' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          Mon Profil
        </a>
        <a href="/espace-membre/security" class="member-sidebar-link ${activeSection === 'security' ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          Sécurité
        </a>
      </nav>
      <div class="member-sidebar-footer">
        <a href="/" class="member-sidebar-link">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          Retour au site
        </a>
        <button onclick="handleMemberLogout()" class="member-sidebar-link logout">
          <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          Déconnexion
        </button>
      </div>
    </aside>
  `;
}

// =====================================================
// PAGE LOGIN
// =====================================================
function renderMemberLogin() {
  const main = document.getElementById('main-content') || document.body;

  main.innerHTML = `
    <div class="member-auth-page">
      <div class="member-auth-container">
        <div class="member-auth-header">
          <a href="/" class="member-auth-logo">
            <img src="/assets/images/logo.jpeg" alt="Magny FC 78">
          </a>
          <h1>Espace Membre</h1>
          <p>Connectez-vous pour accéder à votre espace</p>
        </div>

        <form id="member-login-form" class="member-auth-form">
          <div class="form-group">
            <label for="email">Adresse email</label>
            <input type="email" id="email" name="email" required autocomplete="email">
          </div>

          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" required autocomplete="current-password">
          </div>

          <div class="form-group form-row">
            <label class="checkbox-label">
              <input type="checkbox" id="remember" name="remember">
              <span>Rester connecté</span>
            </label>
            <a href="/espace-membre/forgot-password" class="link-forgot">Mot de passe oublié ?</a>
          </div>

          <div id="login-error" class="alert alert-error" style="display: none;"></div>

          <button type="submit" class="btn btn-primary btn-block">Se connecter</button>
        </form>

        <div class="member-auth-footer">
          <p>Pas encore de compte ? <a href="/espace-membre/register">Créer un compte</a></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('member-login-form').addEventListener('submit', handleMemberLogin);
}

async function handleMemberLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember').checked;
  const errorDiv = document.getElementById('login-error');
  const submitBtn = e.target.querySelector('button[type="submit"]');

  errorDiv.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion...';

  try {
    const response = await memberAPI.login(email, password, remember);

    if (response.success) {
      if (response.data.requiresVerification) {
        showNotification('Veuillez vérifier votre email pour activer toutes les fonctionnalités.', 'warning');
      }
      window.location.href = '/espace-membre/dashboard';
    }
  } catch (error) {
    errorDiv.textContent = error.message || 'Email ou mot de passe incorrect.';
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }
}

// =====================================================
// PAGE INSCRIPTION
// =====================================================
function renderMemberRegister() {
  const main = document.getElementById('main-content') || document.body;

  main.innerHTML = `
    <div class="member-auth-page">
      <div class="member-auth-container">
        <div class="member-auth-header">
          <a href="/" class="member-auth-logo">
            <img src="/assets/images/logo.jpeg" alt="Magny FC 78">
          </a>
          <h1>Créer un compte</h1>
          <p>Rejoignez l'espace membre du Magny FC 78</p>
        </div>

        <form id="member-register-form" class="member-auth-form">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">Prénom *</label>
              <input type="text" id="firstName" name="firstName" required>
            </div>
            <div class="form-group">
              <label for="lastName">Nom *</label>
              <input type="text" id="lastName" name="lastName" required>
            </div>
          </div>

          <div class="form-group">
            <label for="email">Adresse email *</label>
            <input type="email" id="email" name="email" required autocomplete="email">
            <small>Utilisez l'email associé à votre licence si possible</small>
          </div>

          <div class="form-group">
            <label for="phone">Téléphone</label>
            <input type="tel" id="phone" name="phone" autocomplete="tel">
          </div>

          <div class="form-group">
            <label for="password">Mot de passe *</label>
            <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
            <small>Minimum 8 caractères, avec majuscule, minuscule et chiffre</small>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le mot de passe *</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="new-password">
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="terms" name="terms" required>
              <span>J'accepte les <a href="/mentions-legales" target="_blank">conditions d'utilisation</a></span>
            </label>
          </div>

          <div id="register-error" class="alert alert-error" style="display: none;"></div>
          <div id="register-success" class="alert alert-success" style="display: none;"></div>

          <button type="submit" class="btn btn-primary btn-block">Créer mon compte</button>
        </form>

        <div class="member-auth-footer">
          <p>Déjà un compte ? <a href="/espace-membre/login">Se connecter</a></p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('member-register-form').addEventListener('submit', handleMemberRegister);
}

async function handleMemberRegister(e) {
  e.preventDefault();

  const form = e.target;
  const data = {
    firstName: form.firstName.value,
    lastName: form.lastName.value,
    email: form.email.value,
    phone: form.phone.value || null,
    password: form.password.value
  };

  const errorDiv = document.getElementById('register-error');
  const successDiv = document.getElementById('register-success');
  const submitBtn = form.querySelector('button[type="submit"]');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';

  // Validation mot de passe
  if (data.password !== form.confirmPassword.value) {
    errorDiv.textContent = 'Les mots de passe ne correspondent pas.';
    errorDiv.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Création en cours...';

  try {
    const response = await memberAPI.register(data);

    if (response.success) {
      successDiv.innerHTML = `
        <strong>Compte créé avec succès !</strong><br>
        Un email de vérification a été envoyé à <strong>${data.email}</strong>.<br>
        Veuillez cliquer sur le lien dans l'email pour activer votre compte.
      `;
      successDiv.style.display = 'block';
      form.reset();
    }
  } catch (error) {
    errorDiv.textContent = error.message || 'Erreur lors de la création du compte.';
    errorDiv.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Créer mon compte';
  }
}

// =====================================================
// VÉRIFICATION EMAIL
// =====================================================
async function renderEmailVerification() {
  const main = document.getElementById('main-content') || document.body;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  main.innerHTML = `
    <div class="member-auth-page">
      <div class="member-auth-container">
        <div class="member-auth-header">
          <a href="/" class="member-auth-logo">
            <img src="/assets/images/logo.jpeg" alt="Magny FC 78">
          </a>
          <h1>Vérification de l'email</h1>
        </div>
        <div id="verify-content" class="text-center">
          <div class="loading-spinner"></div>
          <p>Vérification en cours...</p>
        </div>
      </div>
    </div>
  `;

  if (!token) {
    document.getElementById('verify-content').innerHTML = `
      <div class="alert alert-error">Token de vérification manquant.</div>
      <a href="/espace-membre/login" class="btn btn-primary">Se connecter</a>
    `;
    return;
  }

  try {
    const response = await memberAPI.verifyEmail(token);

    document.getElementById('verify-content').innerHTML = `
      <div class="alert alert-success">
        <strong>Email vérifié avec succès !</strong><br>
        Vous pouvez maintenant vous connecter à votre espace membre.
      </div>
      <a href="/espace-membre/login" class="btn btn-primary">Se connecter</a>
    `;
  } catch (error) {
    document.getElementById('verify-content').innerHTML = `
      <div class="alert alert-error">${error.message}</div>
      <a href="/espace-membre/login" class="btn btn-primary">Se connecter</a>
    `;
  }
}

// =====================================================
// MOT DE PASSE OUBLIÉ
// =====================================================
function renderForgotPassword() {
  const main = document.getElementById('main-content') || document.body;

  main.innerHTML = `
    <div class="member-auth-page">
      <div class="member-auth-container">
        <div class="member-auth-header">
          <a href="/" class="member-auth-logo">
            <img src="/assets/images/logo.jpeg" alt="Magny FC 78">
          </a>
          <h1>Mot de passe oublié</h1>
          <p>Entrez votre email pour recevoir un lien de réinitialisation</p>
        </div>

        <form id="forgot-password-form" class="member-auth-form">
          <div class="form-group">
            <label for="email">Adresse email</label>
            <input type="email" id="email" name="email" required>
          </div>

          <div id="forgot-message" class="alert" style="display: none;"></div>

          <button type="submit" class="btn btn-primary btn-block">Envoyer le lien</button>
        </form>

        <div class="member-auth-footer">
          <a href="/espace-membre/login">Retour à la connexion</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const messageDiv = document.getElementById('forgot-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    try {
      const response = await memberAPI.forgotPassword(email);
      messageDiv.className = 'alert alert-success';
      messageDiv.textContent = response.message;
      messageDiv.style.display = 'block';
    } catch (error) {
      messageDiv.className = 'alert alert-error';
      messageDiv.textContent = error.message;
      messageDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer le lien';
    }
  });
}

// =====================================================
// RÉINITIALISATION MOT DE PASSE
// =====================================================
function renderResetPassword() {
  const main = document.getElementById('main-content') || document.body;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    main.innerHTML = `
      <div class="member-auth-page">
        <div class="member-auth-container">
          <div class="alert alert-error">Lien de réinitialisation invalide.</div>
          <a href="/espace-membre/forgot-password" class="btn btn-primary">Demander un nouveau lien</a>
        </div>
      </div>
    `;
    return;
  }

  main.innerHTML = `
    <div class="member-auth-page">
      <div class="member-auth-container">
        <div class="member-auth-header">
          <a href="/" class="member-auth-logo">
            <img src="/assets/images/logo.jpeg" alt="Magny FC 78">
          </a>
          <h1>Nouveau mot de passe</h1>
        </div>

        <form id="reset-password-form" class="member-auth-form">
          <input type="hidden" id="token" value="${token}">

          <div class="form-group">
            <label for="password">Nouveau mot de passe</label>
            <input type="password" id="password" name="password" required minlength="8">
            <small>Minimum 8 caractères, avec majuscule, minuscule et chiffre</small>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le mot de passe</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required>
          </div>

          <div id="reset-message" class="alert" style="display: none;"></div>

          <button type="submit" class="btn btn-primary btn-block">Réinitialiser</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('token').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('reset-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (password !== confirmPassword) {
      messageDiv.className = 'alert alert-error';
      messageDiv.textContent = 'Les mots de passe ne correspondent pas.';
      messageDiv.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;

    try {
      const response = await memberAPI.resetPassword(token, password);
      messageDiv.className = 'alert alert-success';
      messageDiv.innerHTML = `${response.message} <a href="/espace-membre/login">Se connecter</a>`;
      messageDiv.style.display = 'block';
    } catch (error) {
      messageDiv.className = 'alert alert-error';
      messageDiv.textContent = error.message;
      messageDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// =====================================================
// DASHBOARD MEMBRE
// =====================================================
async function renderMemberDashboard() {
  const main = document.getElementById('main-content') || document.body;
  const account = memberAPI.getAccount();
  const licenses = memberAPI.getLicensesFromStorage();

  main.innerHTML = `
    <div class="member-layout">
      ${getMemberSidebar('dashboard')}
      <main class="member-main">
        <div class="member-page-header">
          <h1>Bienvenue, ${account?.firstName || 'Membre'} !</h1>
          <p>Voici un aperçu de votre espace membre</p>
        </div>

        <div class="dashboard-grid">
          <!-- Carte licences -->
          <div class="dashboard-card">
            <div class="dashboard-card-header">
              <h3>Mes Licences</h3>
              <span class="badge badge-primary">${licenses.length}</span>
            </div>
            <div class="dashboard-card-body">
              ${licenses.length > 0 ? `
                <ul class="license-list-mini">
                  ${licenses.map(l => `
                    <li class="license-item-mini ${l.isPrimary ? 'primary' : ''}">
                      <div class="license-avatar">${l.firstName?.charAt(0) || ''}${l.lastName?.charAt(0) || ''}</div>
                      <div class="license-info">
                        <strong>${l.fullName || `${l.firstName} ${l.lastName}`}</strong>
                        <span>${l.category || 'Non assigné'} - ${l.licenseNumber}</span>
                      </div>
                    </li>
                  `).join('')}
                </ul>
              ` : `
                <p class="text-muted">Aucune licence rattachée</p>
              `}
            </div>
            <div class="dashboard-card-footer">
              <a href="/espace-membre/licenses" class="btn btn-sm btn-outline">Gérer mes licences</a>
              <a href="/espace-membre/link" class="btn btn-sm btn-primary">Rattacher une licence</a>
            </div>
          </div>

          <!-- Carte prochains matchs -->
          <div class="dashboard-card" id="upcoming-matches-card">
            <div class="dashboard-card-header">
              <h3>Prochains Matchs</h3>
            </div>
            <div class="dashboard-card-body">
              <div class="loading-spinner-small"></div>
            </div>
          </div>

          <!-- Carte profil -->
          <div class="dashboard-card">
            <div class="dashboard-card-header">
              <h3>Mon Profil</h3>
            </div>
            <div class="dashboard-card-body">
              <div class="profile-summary">
                <div class="profile-item">
                  <span class="label">Email</span>
                  <span class="value">${account?.email || '-'}</span>
                </div>
                <div class="profile-item">
                  <span class="label">Statut</span>
                  <span class="value">
                    ${account?.isVerified
                      ? '<span class="badge badge-success">Vérifié</span>'
                      : '<span class="badge badge-warning">Email non vérifié</span>'}
                  </span>
                </div>
              </div>
            </div>
            <div class="dashboard-card-footer">
              <a href="/espace-membre/profile" class="btn btn-sm btn-outline">Modifier mon profil</a>
            </div>
          </div>

          <!-- Carte liens rapides -->
          <div class="dashboard-card">
            <div class="dashboard-card-header">
              <h3>Liens Rapides</h3>
            </div>
            <div class="dashboard-card-body">
              <div class="quick-links">
                <a href="/contact" class="quick-link">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                  Contacter le club
                </a>
                <a href="/actualites" class="quick-link">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                  Actualités
                </a>
                <a href="/matchs" class="quick-link">
                  <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                  Calendrier
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  // Charger les prochains matchs
  loadUpcomingMatches();
}

async function loadUpcomingMatches() {
  const card = document.getElementById('upcoming-matches-card');
  if (!card) return;

  const licenses = memberAPI.getLicensesFromStorage();
  const teamIds = [...new Set(licenses.map(l => l.teamId).filter(Boolean))];

  try {
    // Utiliser l'API publique des matchs
    const response = await api.getMatchs('a_venir', 5);

    if (response.success && response.data.matchs) {
      const matches = response.data.matchs.slice(0, 5);

      card.querySelector('.dashboard-card-body').innerHTML = matches.length > 0 ? `
        <ul class="match-list-mini">
          ${matches.map(m => `
            <li class="match-item-mini">
              <div class="match-date">
                <span class="day">${new Date(m.date_match).getDate()}</span>
                <span class="month">${new Date(m.date_match).toLocaleDateString('fr-FR', { month: 'short' })}</span>
              </div>
              <div class="match-info">
                <strong>${m.equipe_nom || 'Équipe'} vs ${m.adversaire}</strong>
                <span>${m.competition || ''} - ${m.lieu === 'domicile' ? 'Dom.' : 'Ext.'}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      ` : '<p class="text-muted">Aucun match à venir</p>';
    }
  } catch (error) {
    card.querySelector('.dashboard-card-body').innerHTML = '<p class="text-muted">Impossible de charger les matchs</p>';
  }
}

// =====================================================
// PAGE LICENCES
// =====================================================
async function renderMemberLicenses() {
  const main = document.getElementById('main-content') || document.body;

  main.innerHTML = `
    <div class="member-layout">
      ${getMemberSidebar('licenses')}
      <main class="member-main">
        <div class="member-page-header">
          <h1>Mes Licences</h1>
          <p>Gérez les licences rattachées à votre compte</p>
        </div>

        <div class="member-actions">
          <a href="/espace-membre/link" class="btn btn-primary">
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Rattacher une licence
          </a>
        </div>

        <div id="licenses-container">
          <div class="loading-spinner"></div>
        </div>
      </main>
    </div>
  `;

  try {
    const response = await memberAPI.getLicenses();

    if (response.success) {
      renderLicensesList(response.data.licenses);
    }
  } catch (error) {
    document.getElementById('licenses-container').innerHTML = `
      <div class="alert alert-error">${error.message}</div>
    `;
  }
}

function renderLicensesList(licenses) {
  const container = document.getElementById('licenses-container');

  if (!licenses || licenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="64" height="64"><path fill="currentColor" d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"/></svg>
        <h3>Aucune licence rattachée</h3>
        <p>Utilisez un code d'invitation pour rattacher une licence à votre compte.</p>
        <a href="/espace-membre/link" class="btn btn-primary">Rattacher une licence</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="licenses-grid">
      ${licenses.map(l => `
        <div class="license-card ${l.isPrimary ? 'primary' : ''}">
          ${l.isPrimary ? '<span class="badge badge-gold">Principale</span>' : ''}
          <div class="license-card-header">
            <div class="license-avatar-large">
              ${l.photoUrl ? `<img src="${l.photoUrl}" alt="">` : `${l.firstName?.charAt(0) || ''}${l.lastName?.charAt(0) || ''}`}
            </div>
            <div class="license-header-info">
              <h3>${l.fullName}</h3>
              <span class="license-number">${l.licenseNumber}</span>
            </div>
          </div>
          <div class="license-card-body">
            <div class="license-detail">
              <span class="label">Catégorie</span>
              <span class="value">${l.category || 'Non assignée'}</span>
            </div>
            <div class="license-detail">
              <span class="label">Équipe</span>
              <span class="value">${l.team?.name || 'Non assignée'}</span>
            </div>
            <div class="license-detail">
              <span class="label">Date de naissance</span>
              <span class="value">${l.birthDate ? new Date(l.birthDate).toLocaleDateString('fr-FR') : '-'}</span>
            </div>
            <div class="license-detail">
              <span class="label">Relation</span>
              <span class="value">${getRelationshipLabel(l.relationship)}</span>
            </div>
            <div class="license-detail">
              <span class="label">Certificat médical</span>
              <span class="value">
                ${l.medicalCertificate?.isValid
                  ? '<span class="badge badge-success">Valide</span>'
                  : '<span class="badge badge-warning">Non valide</span>'}
              </span>
            </div>
          </div>
          <div class="license-card-actions">
            <a href="/espace-membre/licenses/${l.id}" class="btn btn-sm btn-outline">Détails</a>
            ${!l.isPrimary ? `<button onclick="setPrimaryLicense(${l.id})" class="btn btn-sm btn-outline">Définir principale</button>` : ''}
            ${l.relationship !== 'self' ? `<button onclick="unlinkLicense(${l.id}, '${l.fullName}')" class="btn btn-sm btn-danger-outline">Détacher</button>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function getRelationshipLabel(relationship) {
  const labels = {
    'self': 'Moi-même',
    'parent': 'Parent/Tuteur',
    'tutor': 'Tuteur légal',
    'other': 'Autre'
  };
  return labels[relationship] || relationship;
}

async function setPrimaryLicense(licenseId) {
  try {
    const response = await memberAPI.setPrimaryLicense(licenseId);
    if (response.success) {
      showNotification('Licence principale mise à jour', 'success');
      renderMemberLicenses();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function unlinkLicense(licenseId, licenseName) {
  if (!confirm(`Êtes-vous sûr de vouloir détacher la licence de ${licenseName} de votre compte ?`)) {
    return;
  }

  try {
    const response = await memberAPI.unlinkLicense(licenseId);
    if (response.success) {
      showNotification('Licence détachée', 'success');
      // Rafraîchir les données
      await memberAPI.getMe();
      renderMemberLicenses();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// =====================================================
// PAGE RATTACHER LICENCE
// =====================================================
function renderLinkLicense() {
  const main = document.getElementById('main-content') || document.body;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';

  main.innerHTML = `
    <div class="member-layout">
      ${getMemberSidebar('licenses')}
      <main class="member-main">
        <div class="member-page-header">
          <h1>Rattacher une licence</h1>
          <p>Utilisez le code d'invitation reçu par email ou fourni par le club</p>
        </div>

        <div class="link-license-container">
          <form id="link-license-form" class="card">
            <div class="card-body">
              <div class="form-group">
                <label for="invitation-code">Code d'invitation</label>
                <input type="text" id="invitation-code" value="${code}" placeholder="Ex: ABCD1234"
                       class="input-large" style="text-transform: uppercase; font-family: monospace; letter-spacing: 2px;">
                <small>Le code à 8 caractères fourni par le club</small>
              </div>

              <div id="link-message" class="alert" style="display: none;"></div>

              <button type="submit" class="btn btn-primary btn-block">Rattacher la licence</button>
            </div>
          </form>

          <div class="link-help card">
            <div class="card-body">
              <h3>Comment obtenir un code ?</h3>
              <ul>
                <li>Le club vous envoie un code par email lors de votre inscription</li>
                <li>Demandez au secrétariat du club</li>
                <li>Contactez votre responsable d'équipe</li>
              </ul>
              <p>Vous pouvez rattacher plusieurs licences à un même compte (ex: parent avec plusieurs enfants).</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('link-license-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('invitation-code').value.trim().toUpperCase();
    const messageDiv = document.getElementById('link-message');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!code || code.length < 6) {
      messageDiv.className = 'alert alert-error';
      messageDiv.textContent = 'Veuillez entrer un code d\'invitation valide.';
      messageDiv.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Vérification...';

    try {
      const response = await memberAPI.linkLicense(code);

      if (response.success) {
        messageDiv.className = 'alert alert-success';
        messageDiv.innerHTML = `
          <strong>Licence rattachée avec succès !</strong><br>
          ${response.message}
        `;
        messageDiv.style.display = 'block';

        // Rafraîchir les données
        await memberAPI.getMe();

        // Rediriger après 2s
        setTimeout(() => {
          window.location.href = '/espace-membre/licenses';
        }, 2000);
      }
    } catch (error) {
      messageDiv.className = 'alert alert-error';
      messageDiv.textContent = error.message;
      messageDiv.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Rattacher la licence';
    }
  });
}

// =====================================================
// PAGE PROFIL
// =====================================================
async function renderMemberProfile() {
  const main = document.getElementById('main-content') || document.body;

  main.innerHTML = `
    <div class="member-layout">
      ${getMemberSidebar('profile')}
      <main class="member-main">
        <div class="member-page-header">
          <h1>Mon Profil</h1>
          <p>Gérez vos informations personnelles</p>
        </div>

        <div id="profile-container">
          <div class="loading-spinner"></div>
        </div>
      </main>
    </div>
  `;

  try {
    const response = await memberAPI.getProfile();

    if (response.success) {
      renderProfileForm(response.data.profile);
    }
  } catch (error) {
    document.getElementById('profile-container').innerHTML = `
      <div class="alert alert-error">${error.message}</div>
    `;
  }
}

function renderProfileForm(profile) {
  const container = document.getElementById('profile-container');

  container.innerHTML = `
    <div class="profile-grid">
      <!-- Informations personnelles -->
      <div class="card">
        <div class="card-header">
          <h3>Informations personnelles</h3>
        </div>
        <form id="profile-form" class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">Prénom</label>
              <input type="text" id="firstName" value="${profile.firstName || ''}" required>
            </div>
            <div class="form-group">
              <label for="lastName">Nom</label>
              <input type="text" id="lastName" value="${profile.lastName || ''}" required>
            </div>
          </div>
          <div class="form-group">
            <label for="phone">Téléphone</label>
            <input type="tel" id="phone" value="${profile.phone || ''}">
          </div>
          <div id="profile-message" class="alert" style="display: none;"></div>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </form>
      </div>

      <!-- Email -->
      <div class="card">
        <div class="card-header">
          <h3>Adresse email</h3>
        </div>
        <div class="card-body">
          <div class="profile-item">
            <span class="label">Email actuel</span>
            <span class="value">${profile.email}</span>
          </div>
          <div class="profile-item">
            <span class="label">Statut</span>
            <span class="value">
              ${profile.isVerified
                ? '<span class="badge badge-success">Vérifié</span>'
                : '<span class="badge badge-warning">Non vérifié</span>'}
            </span>
          </div>
          ${!profile.isVerified ? `
            <button onclick="resendVerificationEmail()" class="btn btn-outline btn-sm">Renvoyer l'email de vérification</button>
          ` : ''}
        </div>
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card-header">
          <h3>Préférences de notification</h3>
        </div>
        <form id="notifications-form" class="card-body">
          <label class="checkbox-label">
            <input type="checkbox" id="notify_email" ${profile.notifications?.email ? 'checked' : ''}>
            <span>Recevoir les notifications par email</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="notify_match" ${profile.notifications?.match ? 'checked' : ''}>
            <span>Rappels de matchs</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="notify_training" ${profile.notifications?.training ? 'checked' : ''}>
            <span>Rappels d'entraînements</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="notify_news" ${profile.notifications?.news ? 'checked' : ''}>
            <span>Actualités du club</span>
          </label>
          <button type="submit" class="btn btn-outline">Mettre à jour</button>
        </form>
      </div>

      <!-- Stats -->
      <div class="card">
        <div class="card-header">
          <h3>Informations du compte</h3>
        </div>
        <div class="card-body">
          <div class="profile-item">
            <span class="label">Membre depuis</span>
            <span class="value">${new Date(profile.stats?.memberSince).toLocaleDateString('fr-FR')}</span>
          </div>
          <div class="profile-item">
            <span class="label">Dernière connexion</span>
            <span class="value">${profile.stats?.lastLogin ? new Date(profile.stats.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
  document.getElementById('notifications-form').addEventListener('submit', handleNotificationsUpdate);
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const messageDiv = document.getElementById('profile-message');

  try {
    const response = await memberAPI.updateProfile({
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      phone: document.getElementById('phone').value || null
    });

    if (response.success) {
      messageDiv.className = 'alert alert-success';
      messageDiv.textContent = 'Profil mis à jour avec succès.';
      messageDiv.style.display = 'block';
      await memberAPI.getMe();
    }
  } catch (error) {
    messageDiv.className = 'alert alert-error';
    messageDiv.textContent = error.message;
    messageDiv.style.display = 'block';
  }
}

async function handleNotificationsUpdate(e) {
  e.preventDefault();

  try {
    const response = await memberAPI.updateNotifications({
      email: document.getElementById('notify_email').checked,
      match: document.getElementById('notify_match').checked,
      training: document.getElementById('notify_training').checked,
      news: document.getElementById('notify_news').checked
    });

    if (response.success) {
      showNotification('Préférences mises à jour', 'success');
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function resendVerificationEmail() {
  const account = memberAPI.getAccount();
  try {
    await memberAPI.resendVerification(account.email);
    showNotification('Email de vérification envoyé', 'success');
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// =====================================================
// PAGE SÉCURITÉ
// =====================================================
async function renderSecuritySettings() {
  const main = document.getElementById('main-content') || document.body;

  main.innerHTML = `
    <div class="member-layout">
      ${getMemberSidebar('security')}
      <main class="member-main">
        <div class="member-page-header">
          <h1>Sécurité</h1>
          <p>Gérez la sécurité de votre compte</p>
        </div>

        <div class="security-grid">
          <!-- Changer mot de passe -->
          <div class="card">
            <div class="card-header">
              <h3>Changer le mot de passe</h3>
            </div>
            <form id="password-form" class="card-body">
              <div class="form-group">
                <label for="currentPassword">Mot de passe actuel</label>
                <input type="password" id="currentPassword" required>
              </div>
              <div class="form-group">
                <label for="newPassword">Nouveau mot de passe</label>
                <input type="password" id="newPassword" required minlength="8">
                <small>Minimum 8 caractères, avec majuscule, minuscule et chiffre</small>
              </div>
              <div class="form-group">
                <label for="confirmPassword">Confirmer le nouveau mot de passe</label>
                <input type="password" id="confirmPassword" required>
              </div>
              <div id="password-message" class="alert" style="display: none;"></div>
              <button type="submit" class="btn btn-primary">Changer le mot de passe</button>
            </form>
          </div>

          <!-- Sessions actives -->
          <div class="card">
            <div class="card-header">
              <h3>Sessions actives</h3>
            </div>
            <div class="card-body" id="sessions-list">
              <div class="loading-spinner-small"></div>
            </div>
          </div>

          <!-- Zone dangereuse -->
          <div class="card card-danger">
            <div class="card-header">
              <h3>Zone dangereuse</h3>
            </div>
            <div class="card-body">
              <p>La suppression de votre compte est irréversible. Toutes vos données seront perdues.</p>
              <button onclick="showDeleteAccountModal()" class="btn btn-danger">Supprimer mon compte</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('password-form').addEventListener('submit', handlePasswordChange);
  loadSessions();
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const messageDiv = document.getElementById('password-message');
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    messageDiv.className = 'alert alert-error';
    messageDiv.textContent = 'Les mots de passe ne correspondent pas.';
    messageDiv.style.display = 'block';
    return;
  }

  try {
    const response = await memberAPI.changePassword(currentPassword, newPassword, confirmPassword);

    if (response.success) {
      messageDiv.className = 'alert alert-success';
      messageDiv.textContent = 'Mot de passe modifié avec succès.';
      messageDiv.style.display = 'block';
      e.target.reset();
    }
  } catch (error) {
    messageDiv.className = 'alert alert-error';
    messageDiv.textContent = error.message;
    messageDiv.style.display = 'block';
  }
}

async function loadSessions() {
  const container = document.getElementById('sessions-list');

  try {
    const response = await memberAPI.getSessions();

    if (response.success && response.data.sessions) {
      const sessions = response.data.sessions;

      container.innerHTML = sessions.length > 0 ? `
        <ul class="sessions-list">
          ${sessions.map(s => `
            <li class="session-item">
              <div class="session-info">
                <strong>${s.device_info || 'Appareil inconnu'}</strong>
                <span>${s.ip_address || ''} - ${new Date(s.last_activity).toLocaleString('fr-FR')}</span>
              </div>
              <button onclick="revokeSession(${s.id})" class="btn btn-sm btn-outline">Révoquer</button>
            </li>
          `).join('')}
        </ul>
      ` : '<p class="text-muted">Aucune session active</p>';
    }
  } catch (error) {
    container.innerHTML = '<p class="text-muted">Impossible de charger les sessions</p>';
  }
}

async function revokeSession(sessionId) {
  try {
    await memberAPI.revokeSession(sessionId);
    showNotification('Session révoquée', 'success');
    loadSessions();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

function showDeleteAccountModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Supprimer mon compte</h3>
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-close">&times;</button>
      </div>
      <form id="delete-account-form" class="modal-body">
        <p class="text-danger"><strong>Attention :</strong> Cette action est irréversible !</p>
        <p>Toutes vos données seront définitivement supprimées.</p>
        <div class="form-group">
          <label for="delete-password">Votre mot de passe</label>
          <input type="password" id="delete-password" required>
        </div>
        <div class="form-group">
          <label for="delete-confirm">Tapez "SUPPRIMER MON COMPTE" pour confirmer</label>
          <input type="text" id="delete-confirm" required>
        </div>
        <div id="delete-error" class="alert alert-error" style="display: none;"></div>
        <div class="modal-actions">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-outline">Annuler</button>
          <button type="submit" class="btn btn-danger">Supprimer définitivement</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('delete-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('delete-password').value;
    const confirmation = document.getElementById('delete-confirm').value;
    const errorDiv = document.getElementById('delete-error');

    try {
      await memberAPI.deleteAccount(password, confirmation);
      window.location.href = '/';
    } catch (error) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  });
}

// =====================================================
// DÉCONNEXION
// =====================================================
async function handleMemberLogout() {
  await memberAPI.logout();
  window.location.href = '/espace-membre/login';
}

// =====================================================
// NOTIFICATIONS
// =====================================================
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">&times;</button>
  `;

  // Ajouter au container ou créer
  let container = document.querySelector('.notifications-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notifications-container';
    document.body.appendChild(container);
  }

  container.appendChild(notification);

  // Auto-remove après 5s
  setTimeout(() => {
    notification.remove();
  }, 5000);
}
