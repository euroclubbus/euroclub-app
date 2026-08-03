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
import RoutesPage from './pages/Routes'
import StaticPage from './pages/StaticPage'
import Feedback from './pages/Feedback'
import AdminTransferCities from './pages/AdminTransferCities'
import ErrorBoundary from './components/ErrorBoundary'
import CookieBanner from './components/CookieBanner'
import { useAuthStore } from './authStore'
import { useState, useEffect } from 'react'
import { registerPushToken } from './push'
import { useLocation } from 'react-router-dom'
import { useForceUpdate } from './forceUpdate'
import ForceUpdateScreen from './components/ForceUpdateScreen'

// Guideline 5.1.1(v) Apple: логін вимагається лише для account-based функцій
// (бронювання, оплата, квитки, профіль, сповіщення). Пошук/перегляд маршрутів —
// публічно, без входу.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Auth />
  return <>{children}</>
}

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
          <Route path="/booking" element={<RequireAuth><Booking /></RequireAuth>} />
          <Route path="/round-trip-summary" element={<RequireAuth><RoundTripSummary /></RequireAuth>} />
          <Route path="/order-success" element={<RequireAuth><OrderSuccess /></RequireAuth>} />
          <Route path="/payment" element={<RequireAuth><Payment /></RequireAuth>} />
          <Route path="/game" element={<Game />} />
          <Route path="/ticket" element={<RequireAuth><Ticket /></RequireAuth>} />
          <Route path="/ticket-details" element={<RequireAuth><TicketDetails /></RequireAuth>} />
          <Route path="/agreement-privacy" element={<AgreementPrivacy />} />
          <Route path="/agreement-contract" element={<AgreementContract />} />
          <Route path="/agreement-offer" element={<AgreementOffer />} />
          <Route path="/tickets" element={<RequireAuth><MyTickets /></RequireAuth>} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/page/:slug" element={<StaticPage />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/admin/transfer-cities" element={<RequireAuth><AdminTransferCities /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </>
  )
}

function PushTokenSync() {
  const user = useAuthStore(s => s.user)
  useEffect(() => {
    if (!user) return
    // Якщо дозвіл на сповіщення вже надавали раніше — тихо перереєструємо токен
    // (без нового запиту дозволу), щоб не втрачати токен між сесіями/оновленнями застосунку.
    try {
      if (localStorage.getItem('eclub_notif_asked') === '1') registerPushToken().catch(() => {})
    } catch {}
  }, [user])
  return null
}

function Root() {
  const [splashDone, setSplashDone] = useState(false)
  const forceUpdate = useForceUpdate()
  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />
  if (forceUpdate.blocked) return <ForceUpdateScreen storeUrl={forceUpdate.storeUrl} />
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <PushTokenSync />
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
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
