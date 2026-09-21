/*
  ⚠️ À FAIRE : remplace les valeurs ci-dessous par celles de TON projet Firebase.
  Explique dans le README comment les obtenir (c'est gratuit et prend 5 minutes).

  1. Va sur https://console.firebase.google.com
  2. Crée un projet (ex: "andiany-mamikely")
  3. Dans "Paramètres du projet" > "Général" > "Vos applications" > ajoute une app Web
  4. Firebase te donne un objet firebaseConfig : copie-le ici
  5. Active "Firestore Database" (mode production) et "Authentication" > méthode "Anonyme"
*/

const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
};

firebase.initializeApp(firebaseConfig);

// Active le cache hors-connexion : les lectures/écritures fonctionnent
// même sans réseau et se resynchronisent automatiquement au retour du réseau.
firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Persistance hors-ligne non disponible :", err.code);
});
