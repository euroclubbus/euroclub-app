// Заповнити після того, як Кеп дасть Firebase config з проєкту адмін-панелі.
// Поки порожньо — reporting.ts просто не відправляє нічого (тихий no-op), нічого не ламається.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

export const isFirebaseConfigured = () => !!firebaseConfig.projectId
