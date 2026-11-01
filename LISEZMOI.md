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

## 9. Nouveautés 6.5

- **Sac** : sélection multiple (☑️ Sélectionner › Tout / un par un) pour retirer des affaires d'un relais (la liste type est
  conservée, « Remettre » possible) ou les supprimer de la liste type.
- **Listes des vacances** (Sac › Vacances) : par période de vacances, créées par un parent, soit « je demande à l'autre parent
  de fournir », soit « je fournis ». Aller (début des vacances) puis Retour (fin) : celui qui donne coche chaque élément,
  indique le nombre exact et ce qu'il met ; l'autre confirme la réception (écarts signalés). Autant de photos que voulu
  par élément, chacune se coche séparément. Sélection multiple pour supprimer.
- **Mode test** (Réglages › Mode test) : cercle « 🧪 Famille TEST » avec un compte Maman TEST (adresse fictive) pour tout
  essayer sans toucher au vrai cercle ; « Passer en Maman TEST » / « Revenir à mon compte ».
- Widget Pleine page : 5 colonnes par défaut, légende « RDV ».

## 10. Nouveautés 6.6

- **Vidéos** dans les souvenirs : filmer ou importer (3 min max), compressées sur le téléphone (480p, MP4) et rangées
  en morceaux dans Firestore (offre gratuite, 15 Mo max par vidéo).
- **Validation des importations** : chaque souvenir (photo/vidéo) ou document ajouté est validé par l'autre parent.
  Les proches ne voient que ce qui est publié (voir 6.7 pour le délai de 48 h).
- Sac : retirer une affaire d'un relais ne la supprime jamais de la liste type ni des listes des vacances.
- Lien d'import de listes préparées : `#/import?k=…` (outil `mklists.py`).
- Règles Firestore v6.6 à republier.

## 10 bis. Nouveautés 6.7

- **48 h pour valider, sinon renvoi** : une importation non validée dans les 48 h qui suivent l'envoi disparaît pour
  l'autre parent (elle n'est plus jamais publiée automatiquement). La personne qui l'a envoyée la garde, marquée ⌛,
  avec **📤 Renvoyer** (nouvelle demande de 48 h) ou **Supprimer**. Elle est aussi prévenue à l'expiration.
- **Rappels** à l'autre parent 24 h, 1 h et 15 min avant l'expiration (notifications ntfy programmées ; les photos ou
  vidéos envoyées ensemble ne font qu'un rappel). Ils s'arrêtent dès que la demande est validée, refusée, supprimée,
  ou mise en **🔕 Sourdine** (bouton dans l'application ou directement dans la notification ; la validation reste
  possible jusqu'à l'expiration).
- Registre partagé des rappels : `reminders/ap_<lot>_<envoi>` (pas de doublon entre les téléphones des deux parents).
  Les rappels d'un envoi fait par un proche sont programmés à la prochaine ouverture de l'application par un parent.
- Règles Firestore v6.7 : la validation n'est acceptée que de l'autre parent et avant la fin des 48 h.

## 10 ter. Nouveautés 6.8 (Sac)

- Boutons toujours visibles : enfants, onglets, vacances en haut ; actions (Sac prêt, J'ai tout préparé, Réception
  confirmée, Exporter…) en bas, au-dessus des onglets. Prénoms partout (jamais « Papa / Maman », sauf « Maman TEST »).
- **Listes type privées** (onglet 📋, rangées dans le profil `users/{uid}.sacTpl`, invisibles pour l'autre parent) :
  une par vacances (Toussaint, Noël, Hiver, Pâques, Été), en « Demande à … » ou « Envoi à … ». Chaque élément a son
  bouton pour l'envoyer vers les vacances du même nom de l'année choisie ; la liste des vacances est créée toute seule.
  Lien d'import des 5 listes : outil `mktpl.py`.
- **Circuit complet** par élément : demande (ou envoi prévu), envoi, réception, retour, récupération, chacun daté.
  Seule la personne qui a créé la liste peut la modifier (éléments, quantités, avec historique daté) ou la supprimer.
  L'autre parent ne change pas la quantité demandée. À la confirmation de réception, les éléments reçus sont figés.
  Au retour, la quantité à rendre est celle reçue à l'aller (non modifiable) ; la confirmation fige tout.
  Un élément ajouté après validation porte sa date d'ajout et prévient l'autre parent.
- **Export** de chaque liste en JPG ou PDF avec tout le circuit (`sac-export.js`, PDF généré sur le téléphone).
- Affaires de chaque relais : Sac › Relais › « Affaires de chaque relais ». Bouton « Modifier la liste » supprimé.
- Réglages › Sac › **Tout effacer et recommencer** : affaires, listes, relais, photos et notifications du Sac dans le
  cercle et le cercle de test (listes type gardées).

## 10 quater. Nouveautés 6.9

- **Maman TEST dans une session séparée** : « Passer en Maman TEST » / « Revenir à mon compte » basculent sans jamais
  déconnecter le compte principal (application Firebase nommée `sjtest`). Le bandeau du mode test reste toujours visible.
- **Notifications cliquables** : chaque notification (dans l'application et sur le téléphone) ouvre l'élément concerné
  (`link` de l'historique ; lien ntfy `#/vue?…&fam=<cercle>`).
- **Sac** : année après chaque vacance (« Toussaint 27 ») ; cases de validation lisibles (Envoyé, Reçu, Rendu,
  Récupéré, Dans le sac) et bouton **Tout valider** ; photo directe ou galerie / fichiers sur chaque élément.
  À la réception : « Demander un élément » et « Reçu en plus (non déclaré) » ; au retour : « Rendu en plus ».
  Le retour s'ouvre par défaut une fois l'aller confirmé ; le propriétaire ne voit que les éléments rendus et corrige
  la quantité récupérée. Encadré **Alertes** (demandes, non déclarés, non envoyés / reçus / rendus, écarts) avec les
  actions de l'étape, et bouton ⚠️ en haut qui fait défiler jusqu'à lui. Suppression uniquement par l'auteur et avant
  toute action de l'autre parent ; pendant la période, seulement « ajouter une quantité » (datée, notifiée).
  Retour confirmé sans alerte = **transfert clos** (lecture seule, liste gardée dans sa période).
  Export JPG / PDF d'un, plusieurs ou tous les éléments, avec ou sans photos ; partager ou télécharger.

## 10 quinquies. Nouveautés 6.10

- **Quantités par enfant partout dans le Sac** (listes type, listes des vacances, affaires de chaque relais) : chaque
  élément a un nombre par enfant (0 = pas pour cet enfant). Sur un prénom : ses éléments et ses quantités seulement.
  Sur « Tous » : les éléments du même nom sont regroupés et additionnés avec le détail (« Caleçons ×8+8=16 »,
  « Selman 8 + Jandal 8 »), y compris dans l'export JPG / PDF.
- **Supprimer pour un enfant** : l'élément est retiré pour cet enfant seulement, puis l'application **propose** de le
  retirer aussi pour l'autre (rien n'est supprimé automatiquement).
- **Boutons des listes type** : ils affichent les prochaines vacances avec l'année (« 🎃 Toussaint 27 », « 🎄 Noël 26 »)
  au lieu du nombre d'éléments.
- **Vacances (accueil)** : toucher une période ouvre son récapitulatif complet : garde de chaque enfant (jours par
  parent), relais, échanges, événements, listes du Sac (état aller / retour, total par enfant, éléments), tâches,
  dépenses et souvenirs de la période.
- **Proches** : ni récapitulatif des vacances, ni listes des vacances du Sac (seulement les affaires du relais si le
  Sac leur est ouvert).
- Lien d'import des listes type v3 (`tools/mktpl.py`) : nombres par prénom (`{"selman": 8, "jandal": 8}`).
- Les fichiers téléchargés n'ont plus d'accents dans leur nom (Chrome les renommait « download »).

## 10 sexies. Nouveautés 6.11

- **Sac** : dans « + » (ajouter une quantité) et « Ajouter un élément », la quantité de départ est 0 ; l'addition et le total
  s'affichent en direct (« 8 + 2 = 10 après l'ajout », « Selman 1 + Jandal 2 = 3 »).
- **Nombre finalement reçu / récupéré** : depuis l'alerte « Reçu en moins / Non reçu », on indique le nombre réellement reçu.
  C'est définitif : l'alerte se ferme et l'autre parent ne peut plus le contester.
- **Confirmations** : chaque action définitive (préparer, confirmer la réception, refuser, contester, accepter un écart,
  ajouter pendant la période, valider un souvenir, une dépense, un échange…) ouvre une fenêtre « Ce que ça fait » /
  « Ce que <prénom> verra ».
- **Listes type** : les vacances n'ont plus d'année (la liste vaut pour les mêmes vacances chaque année) ; l'année n'apparaît
  que sur les listes envoyées (« Envoyer vers : Noël 26 »).
- **Notifications** : une notification reste **non lue** (entourée de rouge, comptée dans le badge 🔔) tant qu'on ne l'a pas
  touchée (ou ouverte depuis la notification du téléphone). « Tout marquer comme lu » reste possible.
- **Relances quotidiennes à 19 h** : une fois les vacances terminées, la personne qui doit faire l'étape en cours de la liste
  (préparer, recevoir, rendre, récupérer, traiter les alertes) est relancée chaque jour à 19 h jusqu'à ce que ce soit fait ;
  l'autre parent est prévenu de chaque relance. Les relances sont programmées 3 jours à l'avance (limite de ntfy) et
  renouvelées dès que l'un des deux parents ouvre l'application.
- **Horaires réguliers** : Quand ? (chaque semaine, semaines paires, semaines impaires, veille / fin des vacances, une date),
  année scolaire, heure et « jusqu'à », **qui dépose** + lieu de dépose, **qui récupère** + lieu de récupération (Chez <prénom>,
  École, Autre à préciser), et une **solution de repli** (la veille / le jour même, heure, qui dépose, lieu). Un horaire avant
  midi est un **relais du matin** : la garde de la veille continue jusque-là (présence, nuits, widgets). Dans la fiche du jour,
  « Si impossible » crée la demande d'échange d'horaire correspondante.
- Lien de réglage du lundi : `#/settings?preset=lundi` (dépose à l'école 8h20–8h30 par Khalid après sa garde, sinon la veille
  à 18h30 chez Jounayda).
- **Prénoms partout** (widgets compris) ; « Papa » / « Maman » seulement sur l'accueil et dans le Cercle.
- **Proches** : lien avec les enfants et côté (paternel / maternel) : « Grand-mère paternelle de Selman & Jandal ».
- Widgets Android (nouvel APK) et iPhone : relais du matin, créneau, lieu de dépose, prénoms.

## 10 septies. Nouveautés 6.12

- **Widgets Android (nouvel APK, version 10)** : la présence (« Chez … ») et les relais des cases viennent directement de la
  liste des relais calculée par l'application : un changement d'horaire, de lieu ou de règle apparaît après un simple
  « ⟳ » (sans réinstaller). Le bouton ⟳ s'estompe pendant le téléchargement puis affiche « planning à jour ✓ » (ou l'erreur).
  Chaque case indique **tous les relais** (matin, mi-journée, soir) avec l'heure et le lieu. Plus d'option de largeur : la
  pleine page occupe 5 × 5 cases (5 × 4 pour le mois, 5 colonnes pour la semaine et le programme). Le flux annonce la
  version minimale de l'APK (`WIDGETS_APK`) : au-dessous, le ⟳ propose la mise à jour.
- **Agenda** et **accueil** : chaque relais (pas seulement le soir) est dans la case du jour avec l'heure et le lieu.
  **Réglages › Relais** : les prochains relais (heure, lieu, matin / soir) et les horaires réguliers.
- **Sac** : les vacances commencent à Noël 26 (Toussaint 26 et avant ne sont plus proposées).
- **Mode test** : seulement pour la personne qui a créé le cercle, en tête des Réglages et mis en avant.
- **Demande d'échange** : « Prévu chez … » / « Demande : chez … », relais de **début** et de **fin** (date, parents, heure
  et lieu modifiables ; enregistrés comme horaires convenus) ; la fin ne peut plus précéder le début.
- **Réponse à une demande** : la notification ouvre la demande ; une réponse reste dans « À traiter » / « Mes demandes »
  (encadrée) tant qu'on n'a pas quitté l'écran, puis passe dans l'historique.
- **Nouvel arrivant** : aucune notification ni historique d'avant son arrivée dans le cercle.

## 10 octies. Nouveautés 6.13

- **Proches avec l'accord des deux parents** (tous les cercles) : un proche ajouté par un parent reste « ⏳ En attente de
  l'accord de … » ; l'autre parent voit « Proche à valider » (accueil, notifications, Cercle) et répond « ✓ Donner mon
  accord » / « ✗ Refuser ». L'invitation n'est envoyable qu'après l'accord. Cercle de test : Rachid (oncle paternel) et
  Samira (tante paternelle) ajoutés par Khalid, Fatima (grand-mère maternelle) et Karim (oncle maternel) par Maman TEST,
  tous en attente de l'accord de l'autre parent.
- **Tâches** : « Confiée à » propose aussi l'autre parent.
- **Validation avant chaque notification** : toute action qui prévient l'autre parent (échange, dépense, événement,
  document, souvenir, tâche, note, horaire, envoi d'une liste type vers Vacances…) ouvre d'abord une fenêtre « Ce que ça
  fait / Ce que … verra ». Rien n'est demandé si l'autre parent n'est pas encore dans le cercle.
- **Boutons reliés** : ouvrir un écran (échanges, Cercle, tâches…) marque comme lues les notifications qui y mènent ; le
  badge et le cadre « À traiter » suivent.
- **Vacances** : « 📅 À venir » dans l'ordre chronologique à partir d'aujourd'hui (les vacances en cours en premier) et
  « 🗄️ Archives » (vacances passées), toujours visibles en haut de la page.
- **Sac** : boutons des listes types dans l'ordre Hiver, Pâques, Été, Toussaint, Noël ; dans « Tous », les totaux
  s'affichent sans « × ».
- **Calendrier annuel** : A4 paysage, aperçu en tête de la fenêtre (touchez pour agrandir), PDF, partage ou impression.
- **Souvenirs** : chaque membre du cercle peut voir et télécharger les photos et vidéos.
- **« Lieu habituel »** retiré partout.
- **Aïd** : croissant dans la case, avec sa légende « Fête de l'Aïd » ; les jours fériés gardent le point rouge.
- **Widgets Android (APK version 11)** : relais sur trois lignes (🔁, l'heure, le lieu « Chez » + prénom) ; le ⟳ télécharge
  le planning au premier plan (contourne le blocage réseau en arrière-plan de certains téléphones).

## 10 nonies. Nouveautés 6.14

- **Proches TEST** : Réglages › Mode test liste les quatre proches de test et l'accord qu'ils attendent. Dès que les deux
  parents ont donné leur accord, « 👤 Devenir … » crée le compte du proche (la première fois), l'ajoute au cercle de test
  et ouvre l'application en son nom (bandeau « Vous êtes … TEST (proche) », « Revenir à mon compte »).
- **Fête de l'Aïd** : croissant **vert émeraude** dans l'agenda (case, fiche du jour, légende « Fête de l'Aïd »), dans le
  calendrier annuel et dans les widgets.
- **Widgets (APK version 12)** : un jour à deux gardes (Aïd, demi-journée) est coupé **horizontalement** — en haut la garde
  du matin avec le relais de mi-journée, en bas celle de l'après-midi avec le relais du soir ; le texte s'ajuste à la case
  pour rester lisible. Tous les autres jours, la case est d'une seule couleur, sans ligne de démarcation. Point rouge pour
  les jours fériés, croissant vert émeraude pour l'Aïd. Widget iPhone : même coupure et même croissant.

## 11. Nettoyer les comptes de test (console Firebase)

- *Authentication › Users* : menu ⋮ de chaque ligne › **Supprimer le compte**.
- *Firestore Database › Données* : menu ⋮ de chaque collection (`users`, `families`, `joinCodes`, `widgets`, `stats`, anciennes `circles`/`admin`) › **Supprimer la collection**.

Mode démonstration (sans compte, données locales) : ajoutez `?demo=1` à l'adresse.
