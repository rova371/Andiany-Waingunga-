const firebaseConfig = {
  apiKey: "AIzaSyAYd_g_z3CHfpP6S2eLZQlN_JSb7Yrgffg",
  authDomain: "andiany-waingunga.firebaseapp.com",
  projectId: "andiany-waingunga",
  storageBucket: "andiany-waingunga.firebasestorage.app",
  messagingSenderId: "1074919039138",
  appId: "1:1074919039138:web:256b01157a89228ceab7fb"
};

firebase.initializeApp(firebaseConfig);

firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Persistance hors-ligne non disponible :", err.code);
});
