const BLUE = '#0A4684'

export default function ForceUpdateScreen({ storeUrl }: { storeUrl: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: BLUE, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
    }}>
      <img src="/logo-lockup.png" alt="EuroClub" style={{ width: 160, maxWidth: '50%', marginBottom: 32 }} />
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 12 }}>Доступне важливе оновлення</h2>
      <p style={{ color: '#cfe0f2', fontSize: 15, marginBottom: 28, maxWidth: 320 }}>
        Щоб продовжити користуватись застосунком, будь ласка, оновіть його до останньої версії.
      </p>
      <a
        href={storeUrl}
        style={{
          background: '#fff', color: BLUE, fontWeight: 600, fontSize: 16,
          padding: '14px 36px', borderRadius: 12, textDecoration: 'none',
        }}
      >
        Оновити
      </a>
    </div>
  )
}
