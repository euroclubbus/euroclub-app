import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import InstallPrompt from './components/InstallPrompt'
import Home from './pages/Home'
import Results from './pages/Results'
import Booking from './pages/Booking'
import RoundTripSummary from './pages/RoundTripSummary'
import OrderSuccess from './pages/OrderSuccess'
import Payment from './pages/Payment'
import Game from './pages/Game'
import Ticket from './pages/Ticket'
import TicketDetails from './pages/TicketDetails'
import AgreementPrivacy from './pages/AgreementPrivacy'
import AgreementContract from './pages/AgreementContract'
import AgreementOffer from './pages/AgreementOffer'
import MyTickets from './pages/MyTickets'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Auth from './pages/Auth'
import Splash from './pages/Splash'
import Fleet from './pages/Fleet'
import CookieBanner from './components/CookieBanner'
import { useAuthStore } from './authStore'
import { useState, useEffect } from 'react'
import { registerPushToken } from './push'
import { useLocation } from 'react-router-dom'

function AppRoutes() {
  const loc = useLocation()
  // Меню на всіх сторінках (ховаємо лише на квитку, де воно заважає)
  const showNav = loc.pathname !== '/ticket'
  return (
    <>
      <InstallPrompt />
      <div style={{ paddingBottom: showNav ? 64 : 0 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/round-trip-summary" element={<RoundTripSummary />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/game" element={<Game />} />
          <Route path="/ticket" element={<Ticket />} />
          <Route path="/ticket-details" element={<TicketDetails />} />
          <Route path="/agreement-privacy" element={<AgreementPrivacy />} />
          <Route path="/agreement-contract" element={<AgreementContract />} />
          <Route path="/agreement-offer" element={<AgreementOffer />} />
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </>
  )
}

const REQUIRE_LOGIN = true  // обов'язковий вхід; постав false, щоб дозволити користуватись без акаунта

function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  useEffect(() => {
    if (!user) return
    // Якщо дозвіл на сповіщення вже надавали раніше — тихо перереєструємо токен
    // (без нового запиту дозволу), щоб не втрачати токен між сесіями/оновленнями застосунку.
    try {
      if (localStorage.getItem('eclub_notif_asked') === '1') registerPushToken().catch(() => {})
    } catch {}
  }, [user])
  if (REQUIRE_LOGIN && !user) return <Auth />
  return <>{children}</>
}

function Root() {
  const [splashDone, setSplashDone] = useState(false)
  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />
  return (
    <AuthGate>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthGate>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
    <CookieBanner />
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
