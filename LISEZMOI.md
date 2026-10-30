# SJ Family 6 — mise en service

Application web (PWA) hébergée sur GitHub Pages : **https://newboy7745.github.io/sj-family/**
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

Mode démonstration (sans compte, données locales) : ajoutez `?demo=1` à l'adresse.
