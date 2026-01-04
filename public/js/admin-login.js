/**
 * MAGNY FC 78 - Admin Login Script
 */

// Si déjà connecté en admin, rediriger
if (api.isAuthenticated() && api.isAdmin()) {
    window.location.href = '/admin/';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const alertEl = document.getElementById('alert');

    btn.disabled = true;
    btn.textContent = 'Connexion...';
    alertEl.style.display = 'none';

    try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        await api.login(email, password);

        if (api.isAdmin()) {
            window.location.href = '/admin/';
        } else {
            await api.logout();
            alertEl.textContent = 'Accès refusé. Vous devez être administrateur.';
            alertEl.className = 'alert alert-danger';
            alertEl.style.display = 'block';
        }
    } catch (error) {
        alertEl.textContent = error.message || 'Identifiants incorrects';
        alertEl.className = 'alert alert-danger';
        alertEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Se connecter';
});
