/*
  Configuration Firebase du projet "andiany-waingunga".
  Si tu recrées un jour un nouveau projet Firebase, remplace ces valeurs
  par celles de Project settings > General > Your apps.
*/

const firebaseConfig = {
  apiKey: "AIzaSyAYd_g_z3CHfpP6S2eLZQlN_JSb7Yrgffg",
  authDomain: "andiany-waingunga.firebaseapp.com",
  projectId: "andiany-waingunga",
  storageBucket: "andiany-waingunga.firebasestorage.app",
  messagingSenderId: "1074919039138",
  appId: "1:1074919039138:web:256b01157a89228ceab7fb"
};

firebase.initializeApp(firebaseConfig);

// Active le cache hors-connexion : les lectures/écritures fonctionnent
// même sans réseau et se resynchronisent automatiquement au retour du réseau.
firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Persistance hors-ligne non disponible :", err.code);
});
