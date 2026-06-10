# Installation et Configuration de GoAccess

Guide complet pour configurer les statistiques de visite avec GoAccess sur magnyfc78.com.

---

## 1. Installation de GoAccess

### Option A: Installation depuis les dépôts officiels (recommandé)

```bash
# Ajouter le dépôt officiel GoAccess
echo "deb https://deb.goaccess.io/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/goaccess.list

# Importer la clé GPG
wget -O - https://deb.goaccess.io/gnupg.key | sudo gpg --dearmor -o /usr/share/keyrings/goaccess-archive-keyring.gpg

# Mettre à jour et installer
sudo apt update
sudo apt install goaccess -y
```

### Option B: Installation depuis apt (version stable)

```bash
sudo apt update
sudo apt install goaccess -y
```

### Vérifier l'installation

```bash
goaccess --version
# Devrait afficher: GoAccess - x.x
```

---

## 2. Configuration du système

### Créer les répertoires nécessaires

```bash
# Créer le répertoire de logs
sudo mkdir -p /var/www/magny-fc-78/logs
sudo chown www-data:www-data /var/www/magny-fc-78/logs

# Créer le répertoire public si inexistant
sudo mkdir -p /var/www/magny-fc-78/public
sudo chown www-data:www-data /var/www/magny-fc-78/public
```

### Copier les fichiers de configuration

```bash
# Depuis le répertoire du projet
cd /var/www/magny-fc-78

# Copier la configuration GoAccess
sudo cp server/config/goaccess.conf /etc/goaccess/goaccess.conf

# Copier et rendre exécutable le script
sudo cp server/scripts/generate-stats.sh /usr/local/bin/generate-stats.sh
sudo chmod +x /usr/local/bin/generate-stats.sh
```

---

## 3. Configuration de la protection par mot de passe

### Créer le fichier htpasswd

```bash
# Installer apache2-utils si nécessaire
sudo apt install apache2-utils -y

# Créer le fichier avec l'utilisateur admin
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Entrez le mot de passe quand demandé

# Pour ajouter d'autres utilisateurs (sans -c)
sudo htpasswd /etc/nginx/.htpasswd autre_utilisateur
```

### Configurer Nginx

```bash
# Éditer le fichier de configuration du site
sudo nano /etc/nginx/sites-available/magnyfc78.com

# Ajouter les blocs location du fichier server/config/nginx-stats.conf
# dans le bloc server existant

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

---

## 4. Configuration du Cron Job

### Générer le rapport toutes les heures

```bash
# Éditer le crontab
sudo crontab -e

# Ajouter cette ligne pour exécuter toutes les heures
0 * * * * /usr/local/bin/generate-stats.sh >> /var/www/magny-fc-78/logs/goaccess.log 2>&1

# Alternative: toutes les 30 minutes
*/30 * * * * /usr/local/bin/generate-stats.sh >> /var/www/magny-fc-78/logs/goaccess.log 2>&1
```

### Vérifier le cron

```bash
# Lister les cron jobs
sudo crontab -l

# Voir les logs cron
sudo tail -f /var/log/syslog | grep CRON
```

---

## 5. Premier test

### Générer un rapport manuellement

```bash
# Exécuter le script
sudo /usr/local/bin/generate-stats.sh

# Vérifier que le fichier a été créé
ls -la /var/www/magny-fc-78/public/stats.html

# Voir les logs
cat /var/www/magny-fc-78/logs/goaccess.log
```

### Accéder aux statistiques

```
https://magnyfc78.com/stats.html
# Entrez les identifiants définis dans htpasswd
```

---

## 6. Mode Temps Réel (optionnel)

### Démarrer GoAccess en mode temps réel

```bash
# Démarrer le service temps réel
sudo /usr/local/bin/generate-stats.sh --realtime

# Vérifier que le processus tourne
ps aux | grep goaccess

# Arrêter le service temps réel
sudo /usr/local/bin/generate-stats.sh --stop
```

### Configurer comme service systemd

Créer `/etc/systemd/system/goaccess.service`:

```ini
[Unit]
Description=GoAccess Real-Time Web Log Analyzer
After=network.target nginx.service

[Service]
Type=simple
ExecStart=/usr/local/bin/generate-stats.sh --realtime
ExecStop=/usr/local/bin/generate-stats.sh --stop
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
```

```bash
# Activer et démarrer le service
sudo systemctl daemon-reload
sudo systemctl enable goaccess
sudo systemctl start goaccess

# Vérifier le statut
sudo systemctl status goaccess
```

### Ouvrir le port firewall pour WebSocket

```bash
# Si vous utilisez ufw
sudo ufw allow 7890/tcp comment "GoAccess WebSocket"
```

---

## 7. Dépannage

### Problèmes courants

**Le rapport ne se génère pas:**
```bash
# Vérifier les permissions
ls -la /var/log/nginx/access.log
ls -la /var/www/magny-fc-78/public/

# Vérifier que l'utilisateur peut lire les logs
sudo chmod 644 /var/log/nginx/access.log
```

**Erreur 401 sur /stats.html:**
```bash
# Vérifier que le fichier htpasswd existe
ls -la /etc/nginx/.htpasswd

# Vérifier le contenu
sudo cat /etc/nginx/.htpasswd
```

**WebSocket ne fonctionne pas:**
```bash
# Vérifier que le port est ouvert
sudo netstat -tulpn | grep 7890

# Vérifier les logs
sudo journalctl -u goaccess -f
```

### Logs utiles

```bash
# Logs GoAccess
tail -f /var/www/magny-fc-78/logs/goaccess.log

# Logs Nginx
sudo tail -f /var/log/nginx/error.log

# Logs système
sudo journalctl -f
```

---

## 8. Personnalisation

### Modifier le thème du rapport

Dans `goaccess.conf`:
```
# Thème sombre
html-prefs {"theme":"dark","perPage":20,"layout":"horizontal"}

# Thème clair
html-prefs {"theme":"bright","perPage":20,"layout":"vertical"}
```

### Activer la géolocalisation

```bash
# Installer GeoIP
sudo apt install geoip-database geoip-database-extra -y

# Télécharger MaxMind GeoLite2 (nécessite un compte gratuit)
# https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
```

Puis dans `goaccess.conf`:
```
geoip-database /usr/share/GeoIP/GeoLite2-City.mmdb
```

---

## Récapitulatif des fichiers

| Fichier | Emplacement |
|---------|-------------|
| Script principal | `/usr/local/bin/generate-stats.sh` |
| Configuration GoAccess | `/etc/goaccess/goaccess.conf` |
| Rapport HTML | `/var/www/magny-fc-78/public/stats.html` |
| Logs GoAccess | `/var/www/magny-fc-78/logs/goaccess.log` |
| Mot de passe | `/etc/nginx/.htpasswd` |

---

## Commandes rapides

```bash
# Générer le rapport
sudo /usr/local/bin/generate-stats.sh

# Voir les stats en terminal
sudo goaccess /var/log/nginx/access.log --log-format=COMBINED

# Démarrer temps réel
sudo /usr/local/bin/generate-stats.sh --realtime

# Arrêter temps réel
sudo /usr/local/bin/generate-stats.sh --stop
```
