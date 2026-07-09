import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, Globe } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBookingStore } from '../store'
import { useDisplayPrice } from '../currency'

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const Gray = '#8A8A8A'

function platformSuffix() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return /iphone|ipad|ipod/i.test(ua) ? 'API' : 'PAG'
}

// Один рядок таблиці "Дата/Відправлення/Прибуття/Місце/Тариф/Знижка/Оплата/Доплата"
function LegRow({ leg, place, fare, discount, paid, rest, currency, format }: any) {
  return (
    <tr>
      <td style={td}>{leg.date}</td>
      <td style={td}>
        <div style={{ fontWeight: 700 }}>{leg.fromCity} {leg.fromTime}</div>
        <div style={{ fontSize: 10.5, color: Gray }}>{leg.fromStation}</div>
      </td>
      <td style={td}>
        <div style={{ fontWeight: 700 }}>{leg.toCity} {leg.toTime}***</div>
        <div style={{ fontSize: 10.5, color: Gray }}>{leg.toStation}</div>
      </td>
      <td style={{ ...td, textAlign: 'center' }}>{place || '—'}</td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fare != null ? format(fare, currency) : ''}</td>
      <td style={{ ...td, fontSize: 11 }}>{discount || ''}</td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{paid != null ? format(paid, currency) : ''}</td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{rest != null ? format(rest, currency) : ''}</td>
    </tr>
  )
}

const td: React.CSSProperties = { padding: '8px 6px', fontSize: 12.5, borderBottom: '1px solid #F0F0F0', verticalAlign: 'top' }
const th: React.CSSProperties = { padding: '6px', fontSize: 10.5, color: Gray, textAlign: 'left', borderBottom: '2px solid #E5E5E5', fontWeight: 700 }

export default function TicketDetails() {
  const nav = useNavigate()
  const { orderHash, orderData, selectedTrip, selectedTrip2, selectedSeats, selectedSeats2, passengerNames, passengerDiscounts } = useBookingStore()
  const trip = selectedTrip as any
  const trip2 = selectedTrip2 as any
  const data = orderData as any
  const hash = orderHash || data?.hash || ''
  const { format } = useDisplayPrice()
  const suffix = platformSuffix()

  const orderNo = (() => {
    const src = String(data?.ticket || data?.link1 || data?.link2 || '')
    const m = src.match(/\/orders?\/(\d+)/)
    if (m) return '000' + m[1]
    return hash ? '000' + hash.slice(-6).toUpperCase() : '000000000'
  })()

  const currency = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? 'EUR' : 'UAH'
  const paxCount = Math.max(selectedSeats.length, Object.keys(passengerNames).length, 1)
  const passengers = (data?.passangers && data.passangers.length)
    ? data.passangers.map((p: any) => ({ name: p.name, place: p.place, place2: p.place2, ticket: p.ticket, price: p.price }))
    : Array.from({ length: paxCount }).map((_, i) => ({ name: passengerNames[i] || '—', place: selectedSeats[i], place2: selectedSeats2[i], ticket: undefined, price: data?.price }))

  const mainTicketNo = passengers[0]?.ticket ? `${passengers[0].ticket}${suffix}` : orderNo
  const isRoundTrip = !!trip2

  const legOut = trip ? {
    date: (data?.ftime || trip.departure?.[0]?.time || '').split(' ')[0],
    fromCity: data?.from_city || trip.departure?.[0]?.city_ua || trip.departure?.[0]?.city || '',
    fromTime: (data?.ftime || trip.departure?.[0]?.time || '').split(' ')[1] || '',
    fromStation: data?.fstation || trip.departure?.[0]?.name || '',
    toCity: data?.to_city || trip.arrival?.[0]?.city_ua || trip.arrival?.[0]?.city || '',
    toTime: (data?.ttime || trip.arrival?.[0]?.time || '').split(' ')[1] || '',
    toStation: data?.tstation || trip.arrival?.[0]?.name || '',
  } : null

  const legReturn = trip2 ? {
    date: (trip2.departure?.[0]?.time || '').split(' ')[0],
    fromCity: trip2.departure?.[0]?.city_ua || trip2.departure?.[0]?.city || '',
    fromTime: (trip2.departure?.[0]?.time || '').split(' ')[1] || '',
    fromStation: trip2.departure?.[0]?.name || '',
    toCity: trip2.arrival?.[0]?.city_ua || trip2.arrival?.[0]?.city || '',
    toTime: (trip2.arrival?.[0]?.time || '').split(' ')[1] || '',
    toStation: trip2.arrival?.[0]?.name || '',
  } : null

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', padding: '0 0 40px' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top) + 18px) 16px 12px', background: Navy }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Електронний квиток</span>
      </div>

      <div style={{ background: '#fff', margin: 16, borderRadius: 16, padding: 20 }}>
        {/* Шапка з контактами */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Ticket {mainTicketNo}</div>
            <div style={{ fontSize: 12, color: Gray }}>Order #{orderNo}</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 8 }}>Euro<span style={{ color: ORange }}>Club</span></div>
          </div>
          <div style={{ padding: 6, background: '#fff', border: '1px solid #EEE', borderRadius: 10 }}>
            <QRCodeSVG value={hash || orderNo} size={70} level="M" />
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: Gray, lineHeight: 1.7, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={12} /> +49 (0) 221-82-82-9171 · +43-7-208-80-045</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={12} /> +38 (067) 291-87-63 · +48-223-97-91-08</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={12} /> +38 (093) 153-82-25</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={12} /> euroclubbus@gmail.com</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe size={12} /> https://eclub.com.ua</div>
        </div>

        {/* Попередження */}
        <div style={{ background: '#FFF9EF', borderRadius: 10, padding: 12, fontSize: 11.5, lineHeight: 1.6, color: '#5A4416', marginBottom: 16 }}>
          <div>Будь ласка, пред'явіть цей квиток водію / Bitte geben Sie dieses Ticket an Busfahrer</div>
          <div style={{ color: '#C0392B' }}>Уважно перевірте дані про оплату! / Bitte prüfen Sie die Daten im Ticket aufmerksam!</div>
          <div style={{ color: '#C0392B' }}>***Час прибуття прогнозований / ***Arrival time is estimated</div>
          <div style={{ color: '#C0392B' }}>Даний квиток не підлягає поверненню. / Dieses Ticket ist nicht erstattungsfähig.</div>
        </div>

        <div style={{ fontSize: 11, color: Gray, lineHeight: 1.6, marginBottom: 20 }}>
          Шановний пасажир, номер Вашого автобуса можна дізнатись за 16 годин до виїзду за посиланням: <span style={{ color: ORange }}>eclub.com.ua/ua/user/ticket/{mainTicketNo.replace(suffix, '')}/</span>
        </div>

        {/* Пасажир + таблиця по кожному з квитків */}
        {passengers.map((p: any, i: number) => (
          <div key={i} style={{ marginBottom: 24, paddingBottom: i < passengers.length - 1 ? 20 : 0, borderBottom: i < passengers.length - 1 ? '1px dashed #E0E0E0' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: Gray }}>Пасажир/Passagier</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name || '—'}</div>
              </div>
              {p.ticket && <div style={{ fontSize: 12, fontWeight: 700, color: ORange }}>{p.ticket}{suffix}</div>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={th}>Дата</th>
                    <th style={th}>Відправлення</th>
                    <th style={th}>Прибуття</th>
                    <th style={{ ...th, textAlign: 'center' }}>Місце</th>
                    <th style={{ ...th, textAlign: 'right' }}>Тариф</th>
                    <th style={th}>Знижка</th>
                    <th style={{ ...th, textAlign: 'right' }}>Оплата</th>
                    <th style={{ ...th, textAlign: 'right' }}>Доплата</th>
                  </tr>
                </thead>
                <tbody>
                  {legOut && (
                    <LegRow leg={legOut} place={p.place} fare={p.price} discount="" paid={p.price} rest={0} currency={currency} format={format} />
                  )}
                  {isRoundTrip && legReturn && (
                    <LegRow leg={legReturn} place={p.place2} fare={null} discount="" paid={null} rest={null} currency={currency} format={format} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Правила */}
      <div style={{ background: '#fff', margin: '0 16px 16px', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>СТРАХУВАННЯ</div>
        <div style={{ fontSize: 12, color: Gray, marginBottom: 20 }}>ПрАТ "СК Арсенал Страхування" · 0 800 60 44 53</div>

        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>ПРАВИЛА ПЕРЕВЕЗЕННЯ ПАСАЖИРІВ (UA)</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: '#333', marginBottom: 24 }}>
          <p>У зв'язку з форс-мажорними обставинами, які виникли в умовах військового стану та/або карантину внаслідок пандемії COVID-19, що призвело до скасування або перенесення рейсу, підприємство не повертає гроші за квитки, а тільки обмінює квитки на ваучери, сертифікати чи квитки з відкритою датою на один рік з моменту відмови чи скасування рейсу. Правила діють до кінця пандемії та/або військового стану.</p>
          <p>Пасажири зобов'язані підтвердити підставу для знижки в квитку (окрім категорії — online знижка) документом, що засвідчує вік чи пільгу. Або пред'явити відповідний купон на знижку. Якщо такого документу чи купону немає — пасажир зобов'язаний доплатити суму до повного тарифу квитка на вибраному маршруті в день реалізації послуги.</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            <li>при бажанні особисто припинити поїздку або вийти на іншій зупинці вартість квитка не відшкодовується;</li>
            <li>перевізник не несе відповідальності за збереження цінних речей під час поїздки;</li>
            <li>дозволяється безкоштовне перевезення багажу (2 місця) розмірами 80×50×40 см, загальною вагою до 40 кг на одного пасажира;</li>
            <li>гарантією поїздки є завчасне придбання квитка;</li>
            <li>пасажир має прибути на посадку не пізніше, ніж за 30 хвилин до відправлення автобуса;</li>
            <li>квиток з відкритою датою дійсний протягом 6 місяців з першої дати, зазначеної у квитку;</li>
            <li>втрачений квиток може бути поновлено після написання пасажиром заяви про втрату квитка шляхом виписування дублікату — послуга платна (дублікат з фіксованими датами — гривневий еквівалент 10 євро, дублікат з відкритою датою — 20 євро на дату оплати);</li>
            <li>компанія залишає за собою право вносити зміни та доповнення до графіку руху автобусів.</li>
          </ul>
          <p>У період пандемії та/або військового стану чи закриття кордонів квитки поверненню не підлягають. Але пасажир може написати звернення та:</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            <li>перенести квиток на фіксовану або відкриту дату (відкрита дата — до 180 днів, вартість послуги — 10 євро або еквівалент в гривні на день реалізації послуги, не пізніше ніж за 48 годин до відправлення);</li>
            <li>для перенесення квитків зі знижкою (5–30%) — доплатити різницю до повного тарифу в день реалізації послуги;</li>
            <li>змінити прізвище та/або ім'я (платна послуга, 20 євро або еквівалент в гривні, незалежно від напрямку поїздки). Зміна можлива не пізніше ніж за 72 год до виїзду, письмово на euroclubbus@gmail.com або в офісах компанії. В разі зміни ПІБ на зворотну поїздку новий пасажир має надати квиток, по якому були здійснені зміни;</li>
            <li>для пасажирів з відкритою датою реєстрація зворотної поїздки здійснюється письмово на euroclubbus@gmail.com або в офісах компанії;</li>
            <li>водій має право відмовити в перевезенні пасажиру, який не оформив належним чином документи (прострочена віза, відсутність коштів, зворотного квитка тощо);</li>
            <li>якщо пасажир не дотримується митних та прикордонних правил і буде затриманий на кордоні, екіпаж має право продовжити рейс без пасажира згідно з графіком, гроші за квиток не відшкодовуються;</li>
            <li>компанія не несе відповідальності за затримки на кордонах;</li>
            <li>у випадках непередбачуваних обставин (ДТП, поломка, затори тощо) компанія вживає заходів для продовження руху, не більше ніж протягом 24 годин;</li>
            <li>перевезення тварин можливе лише за наявності окремого місця (−20% від повної вартості), всіх необхідних документів та застави — еквівалент 30 євро на дату оплати.</li>
          </ul>
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>BEFÖRDERUNGSREGELN FÜR FAHRGÄSTE (DE)</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: '#333' }}>
          <p>Aufgrund höherer Gewalt während des Krieges und/oder Quarantäne und Pandemie COVID-19 wird kein Geld für Tickets vom Unternehmen rückerstattet. Tickets können nur gegen Gutscheine, Zertifikate oder Tickets mit offenem Datum für ein Jahr ab dem Tag der Reisestornierung getauscht werden. Diese Regeln gelten bis Ende der Pandemie.</p>
          <p>Der Fahrgast ist verpflichtet, den Grund für die Ermäßigung im Ticket (außer Online-Rabatt) durch einen Nachweis zu bestätigen oder den entsprechenden Rabattcoupon vorzulegen. Liegt kein Dokument bzw. Coupon vor, muss der Fahrgast am Tag der Leistung einen Zuschlag bis zum vollen Fahrpreis zahlen.</p>
          <p>Dieses Ticket ist individuell und darf von keiner anderen Person außer dem Inhaber benutzt werden. Nur der Veranstalter ist berechtigt, Änderungen in diesem Reisedokument nach Vereinbarung mit dem Passagier vorzunehmen. Mit dem Ticketkauf stimmt der Passagier der Reiseordnung von TOV „Euroclub" zu.</p>
          <p>*Die Platznummerierung im Bus kann von der im Ticket angegebenen abweichen. **Wird der Passagier vom Zollbeamten an der Grenze in der weiteren Reise abgesagt, gibt es keine Geldrückerstattung, der Bus fährt planmäßig weiter. ***Bei Verspätung zur Busabreise gilt das Ticket als storniert, ohne Geldrückerstattung.</p>
          <p style={{ fontWeight: 700, marginTop: 8 }}>Stornogebühren:</p>
          <p>Bis 7 Tagen — 15% vom Reisetarif, ab 7 Tagen — 30%, ab 3 bis 1 Tag — 70%, vor 1 Tag — 100%. Umbuchungen nur schriftlich, spätestens 24 Stunden vor Abfahrt, per Post oder E-Mail. Beim Rücktritt nur Hin- oder nur Rückfahrt: % werden vom Halbtarif berechnet.</p>
          <p style={{ fontWeight: 700, marginTop: 8 }}>Allgemeine Bedingungen der Personenbeförderung:</p>
          <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
            <li>Pro Person werden 2 Gepäckstücke, Größe 80×50×40 cm, Gewicht bis 40 kg kostenlos befördert;</li>
            <li>der Fahrgast muss spätestens 30 Minuten vor Abfahrt am Einstiegsort eintreffen;</li>
            <li>das Rückticket mit Open-Datum ist 6 Monate ab Hinreisedatum gültig;</li>
            <li>das Ticket kann 24 Stunden vor Abfahrt nicht mehr verschoben oder storniert werden;</li>
            <li>wird ein Passagier an der Grenze entfernt, wird das Ticket nicht zurückerstattet;</li>
            <li>bei persönlichem Reiseabbruch oder Ausstieg an anderer Haltestelle wird der Preis nicht erstattet;</li>
            <li>Namensänderung nur schriftlich, spätestens 72 Stunden vor Abfahrt, kostenpflichtig unabhängig von der Reiserichtung;</li>
            <li>bei Namensänderung auf der Rückreise muss der neue Passagier das geänderte Original-Ticket vorlegen;</li>
            <li>bei Umbuchung von Rabatt-Tickets (5–30%) ist die Differenz zum vollen Preis am Tag der Leistung zu zahlen.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
