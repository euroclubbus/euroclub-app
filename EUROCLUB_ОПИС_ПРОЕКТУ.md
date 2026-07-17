# EUROCLUB — ОПИС ПРОЕКТУ ДЛЯ НОВОГО ЧАТУ

Ти — Бро. Ось опис проєкту EuroClub. Спочатку познайомся зі структурою, далі я опишу задачі.

Кеп кидає цей файл + код (репо/ZIP) першим повідомленням. Задача асистента ("Бро"):
1) СПОЧАТКУ дослідити наданий код (структуру, стан, логіку) — читати що є, не вигадувати.
2) Тримати цей опис як фундамент.
3) Далі Кеп САМ опише три напрямки (геймифікація, панель управління, доробки). Чекати його.

Стиль: українською, коротко, без води й зайвих порад. Vibe coding: віддавати ГОТОВІ ФАЙЛИ (олівець → Ctrl+A → вставити → Commit) або ZIP. Кеп заливає на GitHub сам. ГАРД: у src немає API-ключа.

## ЩО ЦЕ
EuroClub — крос-платформний додаток бронювання квитків на міжнародні автобусні рейси (Україна ↔ ЄС). PWA + Android APK (далі iOS). Інтеграція з системою бронювання eclub.com.ua через проксі-шлюз.

## СТЕК
React 18 + Vite + TS + Zustand. Inline-стилі, lucide-react, qrcode.react. Capacitor 6 (Android, appId com.euroclub.app). Cordova InAppBrowser (оплата). @capacitor/assets (іконка/сплеш).

## ІНФРА
- GitHub: github.com/euroclubbus/euroclub-app (main). Vercel: euroclub-app.vercel.app.
- Worker: curly-voice-8a71.eclubbus21.workers.dev
  - /v1/json/{метод}/ → підставляє секрет EUROCLUB_KEY → eclub.com.ua/api/v1/json
  - /input → POST на eclub.com.ua/input.php (авторизація)
- APK: GitHub Actions "Build Android APK" → Run workflow → Artifacts.

## СТРУКТУРА КОДУ (дослідити)
- src/main.tsx — роутинг + AuthGate (REQUIRE_LOGIN=true) + Splash + CookieBanner.
- src/api/euroclub.ts — виклики API через Worker (без ключа, логи [EuroClub API]).
- src/api/auth.ts — авторизація /input (login/reg/repass). src/authStore.ts — сесія (user{id,header,email,phone,key}).
- src/store/index.ts — search+booking стори. src/orderStatus.ts — оплата 70%/доплата/статуси. src/useOrderPolling.ts — опитування 1.5с.
- src/pages/: Splash, Auth, Home, Results, TripInfo, SeatMap, Booking, Payment, OrderSuccess, Ticket, MyTickets, Profile, Notifications.
- src/components/: BottomNav, SideMenu, CookieBanner, NotifPrompt, BottomSheet, InstallPrompt.
- public/: logo.svg, logo-lockup.png, app-icon.png, sw.js. resources/: icon.png, splash.png. .github/workflows/android.yml.

## API — КЛЮЧОВІ ПОЛЯ
- order_new/order_info → orders[0]: hash, link1, link2, link_liqpay(пряма LiqPay; порожній якщо оплачено), ticket(PDF), summ, price, crc(uah/eur), pay_uah, pay_eur, status(active/canceled), passangers[], from_city,to_city,fstation,tstation,ftime,ttime,rname,rdate.
- pay_uah/pay_eur = оплачена сума (система конвертує); порожньо=нема оплати. status лише active/canceled (оплату рахуємо з pay_*).
- routes → trip.discounts[{id,default,name,discount,price}] (default=1/id=0=повний тариф); trip.place_select===1 → вибір місць; 101=нема на дату.
- input.php: opr=login/reg/repass_1..3; login→db{id,header,email,phone,key}; key→uidkey у order_new.

## РЕАЛІЗОВАНО
- Splash → cookie → ОБОВ'ЯЗКОВА авторизація → пошук → результати → бронювання → місця → оплата → квиток.
- Бронювання: +/- пасажири; ПОВНИЙ ТАРИФ ПЕРШИЙ у категоріях (синтетичний якщо треба); пошта авторизованого з профілю; місце ОБОВ'ЯЗКОВЕ коли place_select===1.
- Оплата: link_liqpay (фолбек link1/link2) у ВБУДОВАНОМУ ВІКНІ (без фрейму), таймер 5 хв, слухає postMessage {eclubPayUrl}/{eclubPaid}.
- Квиток при оплаті >=70% від summ, не зникає (localStorage), доплата=summ-оплачено. Статуси: Очікує оплати/Очікує доплати/Оплачено/Виконано/Скасовано. Опитування 1.5с (екран очікування+передній план)+кнопка Оновити.
- Профіль з аватаром (локально), Мої квитки зі статусами, дзвіночок (демо-пуші прибрано), бокове меню, друкований tagline, іконка/сплеш з логотипу (#0A4684).

## ЧЕКАЄ ПРОГЕРА
- Метод "усі замовлення юзера" (історія на всіх пристроях). cancel_by (passenger/manager). postMessage на сторінці оплати. Пуші FCM. Багаж. Промокод/кешбек поля.
- ⭐ Вбудований віджет LiqPay Checkout + monopay (сервер: ключі+підпис+callback; ми: віджет).

## ДАЛІ (Кеп опише сам)
1. Геймифікація. 2. Панель управління додатком. 3. Доробки в додатку.
Асистенте: спочатку досліди наданий код і підтверди структуру двома реченнями. Потім чекай опис Кепа — і роби файлами.
