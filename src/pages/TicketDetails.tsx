import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, Globe, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBookingStore } from '../store'
import { useDisplayPrice } from '../currency'
import { payInfo } from '../orderStatus'

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const NavyDeep = '#082349'
const Gray = '#8A8A8A'
const Line = '#EEF0F3'

function platformSuffix() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return /iphone|ipad|ipod/i.test(ua) ? 'API' : 'PAG'
}

function splitDT(s: any) {
  const [d, t] = String(s || '').split(' ')
  return { date: d || '', time: t || '' }
}

export default function TicketDetails() {
  const nav = useNavigate()
  const { orderHash, orderData } = useBookingStore()
  const data = (orderData || {}) as any
  const hash = orderHash || data?.hash || ''
  const { format } = useDisplayPrice()
  const suffix = platformSuffix()
  const currency = data?.crc || 'uah'

  const orderNo = hash ? hash.slice(-9).toUpperCase() : '000000000'
  const passengers: any[] = (data?.passangers && data.passangers.length)
    ? data.passangers
    : [{ name: data?.mainname || '—', place: '', price: data?.price ?? data?.summ }]

  const dep = splitDT(data?.ftime)
  const arr = splitDT(data?.ttime)
  const mainTicketNo = passengers[0]?.ticket ? `${passengers[0].ticket}${suffix}` : orderNo
  const pi = payInfo(data)

  return (
    <div style={{ minHeight: '100vh', background: '#F2F4F7', padding: '0 0 48px' }}>
      {/* Шапка */}
      <div style={{ background: `linear-gradient(160deg, ${Navy}, ${NavyDeep})`, padding: 'calc(env(safe-area-inset-top) + 18px) 18px 26px', borderRadius: '0 0 28px 28px' }}>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={20} color="#fff" />
          </button>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: 0.2 }}>Електронний квиток</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Ticket</div>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: 0.3 }}>{mainTicketNo}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginTop: 2 }}>Order #{orderNo}</div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>Euro<span style={{ color: ORange }}>Club</span></div>
        </div>
      </div>

      {/* Маршрут + QR картка (внахлест на шапку) */}
      <div style={{ margin: '-18px 16px 0', background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 12px 30px rgba(11,46,94,0.12)', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: Gray, fontWeight: 600 }}>{dep.date}</div>
                <div style={{ fontSize: 21, fontWeight: 800 }}>{dep.time}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>{data?.from_city || '—'}</div>
                <div style={{ fontSize: 10.5, color: Gray, lineHeight: 1.35, marginTop: 1 }}>{data?.fstation}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#C9CFD8', paddingTop: 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ORange }} />
                <div style={{ width: 1, height: 22, background: '#DDE2E8' }} />
                <span style={{ fontSize: 15 }}>🚌</span>
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: Gray, fontWeight: 600 }}>{arr.date}<span style={{ color: '#C0392B' }}>***</span></div>
                <div style={{ fontSize: 21, fontWeight: 800 }}>{arr.time}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>{data?.to_city || '—'}</div>
                <div style={{ fontSize: 10.5, color: Gray, lineHeight: 1.35, marginTop: 1 }}>{data?.tstation}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 4px' }}>
          <div style={{ padding: 10, background: '#fff', border: `1px solid ${Line}`, borderRadius: 14 }}>
            <QRCodeSVG value={hash || orderNo} size={132} level="M" />
          </div>
        </div>
      </div>

      {/* Статус оплати */}
      <div style={{ margin: '12px 16px 0', display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ fontSize: 10.5, color: Gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Вартість</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{format(data?.summ ?? data?.price, currency)}</div>
        </div>
        <div style={{ flex: 1, background: pi.remainder > 0 ? '#FFF5E6' : '#EAF7ED', borderRadius: 16, padding: '12px 14px' }}>
          <div style={{ fontSize: 10.5, color: Gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{pi.remainder > 0 ? 'Доплата' : 'Статус'}</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, color: pi.remainder > 0 ? '#B8860B' : '#2E7D32' }}>
            {pi.remainder > 0 ? format(pi.remainder, currency) : 'Оплачено'}
          </div>
        </div>
      </div>

      {/* Попередження */}
      <div style={{ margin: '12px 16px 0', background: '#FFF9EF', borderRadius: 16, padding: 14, fontSize: 12, lineHeight: 1.6, color: '#7A5A16' }}>
        <div>Будь ласка, пред'явіть цей квиток водію / Bitte geben Sie dieses Ticket an Busfahrer</div>
        <div style={{ color: '#C0392B', marginTop: 4 }}>Уважно перевірте дані про оплату! Час прибуття прогнозований (***). Квиток поверненню не підлягає.</div>
      </div>

      <div style={{ margin: '10px 16px 0', fontSize: 11, color: Gray, lineHeight: 1.6 }}>
        Номер автобуса можна дізнатись за 16 годин до виїзду: <span style={{ color: ORange }}>eclub.com.ua/ua/user/ticket/{mainTicketNo.replace(suffix, '')}/</span>
      </div>

      {/* Пасажири */}
      <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: Gray, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>Пасажири</div>
        {passengers.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? `1px solid ${Line}` : 'none' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name || '—'}</div>
              <div style={{ fontSize: 11.5, color: Gray, marginTop: 2 }}>
                {p.ticket && <>№ {p.ticket}{suffix} · </>}Місце {p.place && p.place !== '0' ? p.place : '—'}
              </div>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{format(p.price ?? data?.price, currency)}</div>
          </div>
        ))}
      </div>

      {/* Страхування */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 20, padding: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EAF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={20} color="#2E7D32" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Страхування</div>
          <div style={{ fontSize: 12, color: Gray, marginTop: 1 }}>ПрАТ «СК Арсенал Страхування» · 0 800 60 44 53</div>
        </div>
      </div>

      {/* Контакти */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 20, padding: 18, fontSize: 12.5, color: Gray, lineHeight: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={13} /> +49 (0) 221-82-82-9171 · +43-7-208-80-045</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={13} /> +38 (067) 291-87-63 · +48-223-97-91-08</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={13} /> euroclubbus@gmail.com</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={13} /> eclub.com.ua</div>
      </div>

      {/* Правила */}
      <div style={{ margin: '12px 16px 0', background: '#fff', borderRadius: 20, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Правила перевезення пасажирів (UA)</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: '#333' }}>
          <p>У зв'язку з форс-мажорними обставинами, які виникли в умовах військового стану та/або карантину внаслідок пандемії COVID-19, що призвело до скасування або перенесення рейсу, підприємство не повертає гроші за квитки, а тільки обмінює квитки на ваучери, сертифікати чи квитки з відкритою датою на один рік з моменту відмови чи скасування рейсу.</p>
          <p>Пасажири зобов'язані підтвердити підставу для знижки в квитку (окрім категорії — online знижка) документом, що засвідчує вік чи пільгу, або пред'явити відповідний купон. Якщо такого документу чи купону немає — пасажир зобов'язаний доплатити суму до повного тарифу в день реалізації послуги.</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            <li>перевізник не несе відповідальності за збереження цінних речей під час поїздки;</li>
            <li>дозволяється безкоштовне перевезення багажу (2 місця) 80×50×40 см, загальною вагою до 40 кг на одного пасажира;</li>
            <li>пасажир має прибути на посадку не пізніше, ніж за 30 хвилин до відправлення автобуса;</li>
            <li>квиток з відкритою датою дійсний протягом 6 місяців з першої дати, зазначеної у квитку;</li>
            <li>компанія залишає за собою право вносити зміни та доповнення до графіку руху автобусів;</li>
            <li>перевезення тварин можливе лише за наявності окремого місця (−20% від повної вартості) та застави — еквівалент 30 євро на дату оплати.</li>
          </ul>
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Beförderungsregeln (DE)</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: '#333' }}>
          <p>Aufgrund höherer Gewalt während des Krieges und/oder Quarantäne und Pandemie COVID-19 wird kein Geld für Tickets vom Unternehmen rückerstattet. Tickets können nur gegen Gutscheine, Zertifikate oder Tickets mit offenem Datum für ein Jahr ab dem Tag der Reisestornierung getauscht werden.</p>
          <p>Dieses Ticket ist individuell und darf von keiner anderen Person außer dem Inhaber benutzt werden. ***Bei Verspätung zur Busabreise gilt das Ticket als storniert, ohne Geldrückerstattung.</p>
          <p style={{ fontWeight: 700, marginTop: 8 }}>Stornogebühren:</p>
          <p>Bis 7 Tagen — 15% vom Reisetarif, ab 7 Tagen — 30%, ab 3 bis 1 Tag — 70%, vor 1 Tag — 100%.</p>
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  )
}
