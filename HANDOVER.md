# EuroClub App — Чек-лист здачі проєкту замовнику

Дата підготовки: 07.08.2026

---

## Головний акаунт

**eclubbus21@gmail.com** — центральний акаунт, через який відкривається доступ до
більшості платформ проєкту (GitHub, Cloudflare — підтверджено; Firebase/Google Play —
підтвердити окремо, див. нижче).

**Передача замовнику = передача доступу до цього Google-акаунту** (або зміна email
власника/додавання замовника як Owner/Admin у кожному сервісі окремо — безпечніший варіант,
не віддавати пароль від самого Google-акаунту).

---

## 1. GitHub — код застосунку

- **Що там:** весь вихідний код (React/Vite/TS, Android/iOS Capacitor-обгортки),
  `PRICING_SPEC.md`, `FIXES.md`, GitHub Actions workflow для Android-збірки.
- **Репозиторій:** `github.com/euroclubbus/euroclub-app`
- **Акаунт:** eclubbus21@gmail.com
- **Секрети всередині GitHub** (Settings → Secrets and variables → Actions) —
  видно ТІЛЬКИ власнику/адміну репо, не видно навіть у коді:
  - `KEYSTORE_BASE64` — Android-keystore для підпису релізів (закодований у base64)
  - паролі підпису keystore (окремі secrets, якщо є)
- **Передача:** Settings → Collaborators/Teams → додати замовника як Admin, або
  Transfer ownership репозиторію на акаунт замовника.

---

## 2. Vercel — деплой веб-версії (PWA)

- **Що там:** автодеплой з GitHub main → https://euroclub-app.vercel.app
- **Акаунт:** ⚠️ ПІДТВЕРДИТИ — під яким акаунтом заведений Vercel-проєкт (зазвичай
  прив'язаний через GitHub OAuth до того ж eclubbus21@gmail.com, але могло бути
  підключено з іншого акаунту при першому налаштуванні).
- **Передача:** Vercel Dashboard → Project Settings → Transfer, або додати замовника
  як Member проєкту.

---

## 3. Firebase — база даних і push-інфраструктура

- **Проєкт:** `eurocclub`
- **Що там:** Firestore (`device_tokens/{userId}/devices/{deviceId}` — push-токени,
  `open_returns/{oid}` — маркери "Відкритої дати повернення"), Firebase Cloud Messaging
  (Android push), конфіг клієнта в `src/firebaseConfig.ts` (публічний, не секретний).
- **Акаунт:** ⚠️ ПІДТВЕРДИТИ — чи той самий eclubbus21@gmail.com, чи інший Google-акаунт.
- **Передача:** Firebase Console → Project Settings → Users and permissions → додати
  замовника як Owner.

---

## 4. Cloudflare — Push Worker (окремий сервіс, НЕ в GitHub-репо)

- **Worker:** `euroclub-push-sender` — `euroclub-push-sender.eclubbus21.workers.dev/send`
- **Акаунт:** eclubbus21@gmail.com (підтверджено)
- **Що там:** код Worker'а (JS, ~200 рядків, копія лежить у чат-артефактах, не в GitHub-репо
  застосунку), секрети: `API_SECRET`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`,
  `APNS_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`.
- **⚠️ ВАЖЛИВО:** цей Worker живе ТІЛЬКИ в Cloudflare Dashboard — якщо замовник не отримає
  доступ саме сюди (а не тільки до GitHub), push-сповіщення перестануть працювати, і ніхто
  не зможе їх редагувати/перевипустити секрети.
- **Передача:** Cloudflare Dashboard → Manage Account → Members → додати замовника,
  або передати сам акаунт.

---

## 5. Apple Developer / App Store Connect (iOS)

- **Акаунт:** ⚠️ ОКРЕМИЙ Apple ID — НЕ пов'язаний з eclubbus21@gmail.com напряму
  (Apple вимагає окремий Apple ID для розробника).
- **Team ID:** `6878RWUM3C`
- **Що там:** сертифікати підпису, provisioning profiles, APNs Key (`FKR923Y9LD`),
  сам застосунок у App Store Connect (Build-и, метадані, скріншоти).
- **Передача:** App Store Connect → Users and Access → додати замовника з роллю
  Admin/App Manager, АБО повна передача Apple Developer акаунту (складніше, платний
  акаунт $99/рік прив'язаний до юридичної особи).

---

## 6. Google Play Console (Android)

- **Акаунт:** ⚠️ ПІДТВЕРДИТИ — чи eclubbus21@gmail.com, чи інший.
- **Що там:** опублікований застосунок EuroClub, версія 1.0.17 (найближчим часом 1.0.18),
  upload-keystore (підпис — той самий, що зберігається в GitHub Secret `KEYSTORE_BASE64`,
  БЕЗ нього нові версії неможливо підписати сумісно зі старими).
- **Передача:** Google Play Console → Users and permissions → додати замовника.

---

## 7. Backend API (eclub.com.ua) — окремо від цього проєкту

- Бекенд бронювання/оплати живе на `eclub.com.ua` — керується прогером бекенду, НЕ входить
  до цього репозиторію і не передається через нього. Уточнити окремо, чи потрібна ця частина
  в пакеті здачі, чи замовник вже має до неї доступ.

---

## Підсумок — що конкретно передати замовнику

| # | Платформа | Акаунт | Статус |
|---|---|---|---|
| 1 | GitHub (код) | eclubbus21@gmail.com | Підтверджено |
| 2 | Vercel (веб-деплой) | ? | Перевірити |
| 3 | Firebase (`eurocclub`) | ? | Перевірити |
| 4 | Cloudflare (Push Worker) | eclubbus21@gmail.com | Підтверджено |
| 5 | Apple Developer / App Store Connect | окремий Apple ID | Уточнити який |
| 6 | Google Play Console | ? | Перевірити |
| 7 | Backend API (eclub.com.ua) | окремо | Уточнити чи входить у пакет |

*Клітинки "?" — потрібно самостійно перевірити, під яким акаунтом заведені ці сервіси,
перш ніж передавати доступ.*
