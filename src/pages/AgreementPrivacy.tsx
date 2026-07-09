import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const Navy = '#0B2E5E'

export default function AgreementPrivacy() {
  const nav = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', padding: '0 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top) + 18px) 16px 12px', background: Navy }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Політика конфіденційності</span>
      </div>

      <div style={{ background: '#fff', margin: 16, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>ЗГОДА НА ЗБІР ТА ОБРОБКУ ПЕРСОНАЛЬНИХ ДАНИХ</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: '#333' }}>
          <p>Відповідно до Закону України «Про захист персональних даних» від 01.06.2010 № 2297-VI я, надаю згоду ТОВ «Євроклуб» на збір та обробку моїх персональних даних, з метою бронювання, купівлі квитків на автобусні перевезення та укладання договору добровільного комплексного страхування подорожуючих за кордоном.</p>
          <p>Обсяг моїх персональних даних, що оброблятимуться: ПІБ, адреса, телефон, електронна адреса, паспортні дані, ідентифікаційний номер.</p>
          <p>Передача моїх персональних даних третім особам здійснюється ТОВ «Євроклуб» лише у випадках, передбачених чинним законодавством України, в інших випадках — лише за моєю згодою.</p>
          <p>Посвідчую, що отримав/ла повідомлення про включення моїх персональних даних до системи продажу квитків ТОВ «Євроклуб», про мої права, передбачені ст. 8 ЗУ «Про захист персональних даних», мету збору та обробки моїх персональних даних, про осіб, яким мої дані надаються для виконання зазначеної мети. Зауважень та заперечень не маю.</p>
        </div>
      </div>
    </div>
  )
}
