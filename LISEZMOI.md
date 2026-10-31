# SJ Family 6.4 — mise en service

Adresse à partager : **https://tinyurl.com/sj-family** (redirige vers l'application hébergée sur GitHub Pages).
Données : Firebase (projet `sj-family-dd337`, offre gratuite Spark).

---

## 1. Règles Firestore (obligatoire, 1 minute)

1. https://console.firebase.google.com → projet **sj-family-dd337** → **Firestore Database** → onglet **Règles**.
2. Effacez tout, collez le contenu du fichier **`REGLES-FIRESTORE.txt`** (identique à `firestore.rules`), touchez **Publier**.

> Sans cette étape, l'application affiche « Accès refusé ».

Nettoyage facultatif des anciennes données : *Authentication* → supprimer les anciens comptes ;
*Firestore* → supprimer les collections `circles` et `admin` (l'ancienne version).

## 2. Mettre les fichiers en ligne sur GitHub

### Option A — le plus simple
Reliez GitHub à Claude (claude.ai → Paramètres → Connecteurs → GitHub, accès au dépôt `sj-family`) et dites « go » : Claude publie tout.

### Option B — depuis le téléphone
1. Décompressez `sj-family-v6.zip` (application *Mes fichiers* › appui long › Extraire).
2. Sur github.com, ouvrez le dépôt **sj-family** › **Add file** › **Upload files** › sélectionnez **tous les fichiers** du dossier extrait › **Commit changes**.
3. Une seule fois : **Add file** › **Create new file**, nommez-le exactement
   `.github/workflows/android.yml`, collez le contenu du fichier `WORKFLOW-ANDROID.txt`, **Commit changes**.
   → GitHub compile alors automatiquement l'app Android des widgets (onglet **Actions**, ~5 min).

Le site est à jour 1 à 2 minutes après l'envoi. Si l'ancienne version s'affiche encore, fermez puis rouvrez l'app deux fois
(ou Réglages › *Mettre à jour / vider le cache*).

## 3. Installer l'application

- **Samsung (Chrome ou Samsung Internet)** : ouvrez le lien › menu › *Ajouter à l'écran d'accueil* / *Installer l'application*.
- **iPhone (Safari)** : ouvrez le lien › bouton *Partager* › *Sur l'écran d'accueil*.

## 4. Premier lancement

1. Créez votre compte (prénom, nom, téléphone, e-mail).
2. **Créer mon cercle familial** (indiquez Jounayda comme autre parent).
3. Cercle › **Ajouter un enfant** : Selman, puis Jandal.
4. Planning › **Importer les plannings officiels 2026 & 2027** (KA = Khalid).
   Vérification : Bilan 2026 = 97 j / 97 j ; Bilan 2027 = Khalid 97 j / Jounayda 96 j.
5. Cercle › **Inviter** Jounayda (SMS / e-mail avec le lien et le code). Elle crée son compte puis *Rejoindre un cercle*.
   Dès qu'elle a rejoint, chaque changement (planning, statut, échange, horaires) doit être **validé par l'autre parent**.

Règle de relais intégrée : une garde qui commence le jour J = récupération **la veille à 18h30** ;
le dernier jour de garde, remise à l'autre parent **à 18h30**, sauf accord différent (échange « horaire de relais »).

## 5. Widgets

Dans l'app : **Accueil › Widgets › Activer les widgets**.

- **Samsung / Android** : bouton *Télécharger l'APK* (app « SJ Widgets »), installez-la, puis *Connecter mes widgets*.
  Ajout : appui long sur l'écran d'accueil › Widgets › SJ Widgets › Garde (2×2), Semaine (4×2), Mois (4×4) ou Programme.
  Chaque widget demande l'enfant : Selman, Jandal ou Tous. Rappel automatique avant chaque relais (réglable).
- **iPhone** : installez **Scriptable** (gratuit), touchez *Copier le script*, collez-le dans Scriptable (nom : SJ Family).
  Ajout : appui long › + › Scriptable › taille › Modifier le widget › Script *SJ Family*, Paramètre `Selman`, `Jandal` ou `Tous`
  (+ `;semaine`, `;mois`, `;programme`). Fonctionne aussi sur l'écran verrouillé.

## 6. Notifications push (gratuites)

Réglages › *Notifications push* : installez l'app **ntfy** (Android/iPhone), abonnez-vous au sujet secret affiché, activez, **Enregistrer**.
Vous recevez les actions des autres membres (jamais les vôtres) et un rappel avant chaque relais.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `app.css`, `app.js`, `core.js`, `ui.js`, `backend.js` | Application |
| `engine.js` | Moteur de garde (relais 18h30, bilans, rythmes, vacances, export .ics, flux widgets) |
| `sj-data.js` | Plannings officiels 2026 et 2027 de Selman & Jandal |
| `views-*.js` | Écrans (accueil, agenda, planning, échanges, cercle, budget, autres) |
| `widget-iphone.js` | Widget iPhone (chargé par Scriptable) |
| `android-src.zip` + `.github/workflows/android.yml` | App Android des widgets, compilée par GitHub |
| `firestore.rules` | Règles de sécurité à coller dans Firebase |
| `sw.js`, `manifest.json`, icônes | Installation sur l'écran d'accueil, hors-ligne |

## 7. Mode administrateur

Sur l'écran de connexion, saisissez **admin@admin.com** et le mot de passe admin : l'application ouvre uniquement
le tableau de bord (comptes créés, utilisateurs actifs par jour, cercles, installations Android/iPhone,
clics « Télécharger », téléchargements de l'APK des widgets). Les statistiques sont anonymes.
Ce compte correspond au compte Firebase **khalid.ajdid@gmail.com** (mot de passe oublié → lien envoyé à cette adresse) ;
l'adresse doit être confirmée une fois (lien reçu par e-mail). Aucun mot de passe n'est écrit dans le code.

## 8. Nouveautés 6.4

- **Barre du haut** sur toutes les pages : Notifications, Réglages, Profil, Déconnexion (avec confirmation).
- **Onglets** — parents : Accueil, Agenda, Échange, Cercle, Sac ; proches : Accueil, Agenda, Souvenirs, Liaison, Cercle.
- **Droits des proches** : agenda à jour, souvenirs, notes de liaison qui leur sont adressées. Les parents peuvent ouvrir Documents,
  Tâches, Répertoire, Budget (lecture) ou Sac à un proche (Cercle › Membres) ; avec deux parents, l'autre parent doit valider.
  Les informations école / santé des enfants restent réservées aux parents (collection `childInfo`).
- **Historique personnel** : chacun a le sien (`inbox`). Réglages personnels → seulement son historique ; tout ajout partagé
  → historique des deux parents + notification de l'autre parent ; nouveaux souvenirs → tout le cercle.
- **Relais programmés** (Réglages › Relais) : horaire par défaut + horaires réguliers (jour, une semaine sur deux, veille / fin des
  vacances, date) avec lieu ; un échange « horaire de relais » reste possible au cas par cas.
  Préréglage vendredi 16h30 à l'école : ouvrir `#/settings?preset=vendredi`.
- **Note de liaison** : destinataires au choix, pièce jointe PDF/photo rangée dans Documents (copie indépendante).
- **Documents** avec miniatures, **photos des enfants** et photo de groupe, **Voir ensemble** (plusieurs enfants côte à côte),
  **Sac du relais** (affaires avec photo et description, préparé puis reçu), **calendrier annuel imprimable** (Agenda ou Réglages),
  compte à rebours à la minute, widget Android **Pleine page**, cases des widgets qui ouvrent le jour dans l'agenda.
- Les règles Firestore ont changé : recoller `REGLES-FIRESTORE.txt` et **Publier**.

## 9. Nettoyer les comptes de test (console Firebase)

- *Authentication › Users* : menu ⋮ de chaque ligne › **Supprimer le compte**.
- *Firestore Database › Données* : menu ⋮ de chaque collection (`users`, `families`, `joinCodes`, `widgets`, `stats`, anciennes `circles`/`admin`) › **Supprimer la collection**.

Mode démonstration (sans compte, données locales) : ajoutez `?demo=1` à l'adresse.
