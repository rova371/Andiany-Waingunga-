# Andiany Mamikely 🌿

Calendrier partagé + discussion de groupe + personnalisation, pour toute la
tribu. Tout le monde qui ouvre l'app peut ajouter/modifier/supprimer des
événements, écrire dans la discussion, et changer le thème — il n'y a pas de
statut "admin" séparé. L'app fonctionne aussi hors connexion une fois ouverte
une première fois : tes changements partent automatiquement dès que le réseau
revient.

⚠️ **Limite de copyright** : le thème visuel est un thème "jungle" générique
(feuillage, couleurs vertes/dorées) inspiré de l'ambiance du Livre de la
Jungle. Il ne reproduit pas les personnages tels que dessinés par Disney
(Mowgli, Baloo, Bagheera…), qui sont protégés par le droit d'auteur.

---

## Ce que contient ce dossier

```
andiany-mamikely/
├── index.html          → la page de l'app
├── css/style.css        → le thème (couleurs, mise en page)
├── js/app.js            → toute la logique (calendrier, chat, réglages)
├── js/firebase-config.js→ TES clés Firebase (à remplir, voir étape 2)
├── manifest.json         → permet d'"installer" l'app comme une appli
├── sw.js                 → fait fonctionner l'app hors connexion
├── icons/icon.svg        → icône de l'app
└── firestore.rules       → règles d'accès à la base de données
```

Aucune étape de build n'est nécessaire (pas de `npm install`) : ce sont des
fichiers HTML/CSS/JS classiques.

---

## Étape 1 — Créer un projet Firebase (gratuit)

Firebase est le service qui héberge la base de données partagée (calendrier,
messages) et fait fonctionner le temps réel + le hors-ligne, un peu comme
Google Drive.

1. Va sur https://console.firebase.google.com et connecte-toi avec un compte
   Google.
2. Clique **Ajouter un projet**, donne-lui un nom (ex : `andiany-mamikely`),
   puis termine la création (tu peux désactiver Google Analytics, pas
   nécessaire ici).
3. Dans le menu de gauche : **Compilation > Firestore Database** → **Créer
   une base de données** → choisis une région proche de toi → démarre en
   **mode production**.
4. Toujours dans le menu de gauche : **Compilation > Authentication** →
   **Commencer** → onglet **Sign-in method** → active **Anonyme**.
   (Ça permet à chacun d'entrer juste son prénom, sans mot de passe.)
5. Retourne dans **Paramètres du projet** (icône ⚙️ en haut à gauche) >
   onglet **Général** > section **Vos applications** > clique l'icône `</>`
   (Web) > donne un nom à l'app > **Enregistrer l'application**.
6. Firebase affiche un objet `firebaseConfig` qui ressemble à :
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "andiany-mamikely.firebaseapp.com",
     projectId: "andiany-mamikely",
     storageBucket: "andiany-mamikely.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
   Copie ces valeurs dans le fichier `js/firebase-config.js` de ce projet, à
   la place des `"REMPLACE_MOI"`.

7. Applique les règles de sécurité : dans **Firestore Database** > onglet
   **Règles**, remplace tout le contenu par celui du fichier
   `firestore.rules` fourni ici, puis clique **Publier**.

C'est tout pour Firebase — pas de carte bancaire nécessaire pour cet usage
(le plan gratuit "Spark" suffit largement pour un groupe).

---

## Étape 2 — Mettre le code sur GitHub

1. Crée un compte sur https://github.com si tu n'en as pas.
2. Clique **New repository**, nomme-le par exemple `andiany-mamikely`,
   laisse-le public ou privé (privé si tu ne veux pas que le code soit
   visible publiquement — ça ne change rien pour l'accès à l'app une fois
   déployée).
3. Sur ta machine, dans le dossier `andiany-mamikely` (celui-ci) :
   ```bash
   git init
   git add .
   git commit -m "Premier envoi de l'application"
   git branch -M main
   git remote add origin https://github.com/TON-NOM/andiany-mamikely.git
   git push -u origin main
   ```
   (Remplace `TON-NOM` par ton nom d'utilisateur GitHub.)

   Si tu préfères ne pas utiliser de ligne de commande, tu peux aussi faire
   glisser tous les fichiers directement sur la page du dépôt GitHub via
   **Add file > Upload files** dans le navigateur.

---

## Étape 3 — Mettre l'app en ligne (GitHub Pages, gratuit)

1. Dans ton dépôt GitHub, va dans **Settings > Pages**.
2. Sous **Build and deployment**, choisis la source **Deploy from a
   branch**, branche `main`, dossier `/ (root)`.
3. Enregistre. Après une ou deux minutes, GitHub te donne une adresse du
   type `https://ton-nom.github.io/andiany-mamikely/`.
4. Partage ce lien à tout le groupe : chacun l'ouvre, entre son prénom, et
   peut immédiatement voir et modifier le calendrier, discuter, et changer
   le thème pour tout le monde.

---

## Fonctionnement hors connexion

Une fois que l'app a été ouverte au moins une fois avec du réseau :
- La coquille de l'app (HTML/CSS/JS) est mise en cache par le
  "service worker" (`sw.js`) et s'ouvre même sans connexion.
- Les données (événements, messages) sont mises en cache localement par
  Firestore. Tu peux consulter et même ajouter des choses hors connexion :
  elles s'envoient automatiquement dès que le réseau revient.

---

## Personnaliser encore plus

- **Nom de l'app** : onglet "Personnaliser" dans l'app (partagé avec tout le
  groupe), ou directement `<title>` dans `index.html`.
- **Couleurs / ambiance jour-nuit / image de fond** : onglet "Personnaliser"
  dans l'app.
- **Catégories du calendrier** (couleurs "Travail", "Perso", etc.) : liste
  `COLORS` en haut de `js/app.js`.
- **Sécurité plus stricte** (limiter à des personnes précises plutôt qu'à
  quiconque a le lien) : remplacer la connexion anonyme par une connexion
  e-mail/mot de passe et adapter `firestore.rules` — demande de l'aide si tu
  veux cette version.

---

## Support

Si une étape ne fonctionne pas (page blanche, erreur "permission-denied",
etc.), le plus souvent la cause est :
- Les clés dans `js/firebase-config.js` ne sont pas encore remplies.
- L'authentification "Anonyme" n'a pas été activée dans Firebase.
- Les règles Firestore n'ont pas été publiées.
