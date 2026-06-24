import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import InstallPrompt from './components/InstallPrompt'
import Home from './pages/Home'
import Results from './pages/Results'
import Booking from './pages/Booking'
import OrderSuccess from './pages/OrderSuccess'
import Payment from './pages/Payment'
import MyTickets from './pages/MyTickets'
import Profile from './pages/Profile'
import { useLocation } from 'react-router-dom'

function AppRoutes() {
  const loc = useLocation()
  const showNav = ['/', '/tickets', '/profile', '/more'].includes(loc.pathname)
  return (
    <>
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {showNav && <BottomNav />}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
