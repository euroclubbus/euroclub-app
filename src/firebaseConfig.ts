// Firebase-проєкт "eurocclub" (той самий, що й в euroclub-admin панелі).
export const firebaseConfig = {
  apiKey: 'AIzaSyB9Hg1Kcma1lkpTuR_P33kyRD5jrgc3bzU',
  authDomain: 'eurocclub.firebaseapp.com',
  projectId: 'eurocclub',
  storageBucket: 'eurocclub.firebasestorage.app',
  messagingSenderId: '1018363723545',
  appId: '1:1018363723545:web:0f2f6e0da3c85d9e664f88',
}

export const isFirebaseConfigured = () => !!firebaseConfig.projectId
