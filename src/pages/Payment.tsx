import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useBookingStore } from '../store'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

const METHODS = [
  { id: 'ua', label: 'Оплата в Українському банку', needsAddress: false },
  { id: 'de', label: 'Оплата в Німецькому банку', needsAddress: true },
  { id: 'at', label: 'Оплата в Австрійському банку', needsAddress: false },
  { id: 'uah_card', label: 'Оплата гривневою картою', needsAddress: false },
  { id: 'eur_card', label: 'Оплата євровою картою', needsAddress: false },
]

export default function Payment() {
  const nav = useNavigate()
  const { orderData, selectedTrip, orderHash } = useBookingStore()
  const [selected, setSelected] = useState<string>('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [street, setStreet] = useState('')
  const [house, setHouse] = useState('')

  const trip = selectedTrip as any
  const data = orderData as any
  const price = data?.price ?? trip?.price ?? 0
  const total = data?.summ ?? price
  const currencySign = (data?.crc || trip?.currency || 'uah').toLowerCase() === 'eur' ? '€' : '₴'
  const method = METHODS.find(m => m.id === selected)

  const handlePay = () => {
    alert('Оплата буде доступна найближчим часом. Ваше замовлення збережено.')
    nav('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A1A', paddingBottom: 40 }}>
      <div style={{ background: '#1A1A1A', padding: '16px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Оплата</span>
      </div>

      <div style={{ background: '#fff', margin: 16, borderRadius: 20, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>Банківський переказ</div>

        {METHODS.slice(0,3).map(m => (
          <div key={m.id}>
            <button onClick={() => setSelected(m.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px', background: selected===m.id ? '#FFF8EE' : '#F9F9F9',
              border: selected===m.id ? `2px solid ${ORange}` : '2px solid #EEE',
              borderRadius: 14, cursor: 'pointer', marginBottom: 10, textAlign: 'left'
            }}>
              <span style={{ fontSize: 20 }}>💳</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{m.label}</span>
            </button>

            {selected === m.id && m.needsAddress && (
              <div style={{ padding: '0 4px 16px' }}>
                <p style={{ fontSize: 12, color: Gray, marginBottom: 12, lineHeight: 1.5 }}>
                  Будь ласка, вкажіть адресу проживання платника - це обов'язкова умова для формування інвойсу при оплаті на німецький рахунок
                </p>
                {[
                  { label: "Прізвище та ім'я", val: name, set: setName, placeholder: 'Олександр Олійник' },
                  { label: 'Місто', val: city, set: setCity, placeholder: 'Мюнхен', half: true },
                  { label: 'індекс', val: zip, set: setZip, placeholder: '123', half: true },
                  { label: 'Вулиця', val: street, set: setStreet, placeholder: 'Мюнхен', half: true },
                  { label: 'Будинок', val: house, set: setHouse, placeholder: '123', half: true },
                ].reduce((rows: any[], field, i, arr) => {
                  if (field.half) {
                    if (i % 2 === 1 || !arr[i+1]?.half) rows.push([field])
                    else if (arr[i+1]?.half) rows.push([field, arr[i+1]])
                  } else rows.push([field])
                  return rows
                }, []).filter((r,i,a) => {
                  // dedupe pairs
                  if (r.length === 2) return !a.slice(0,i).some((prev:any[]) => prev.includes(r[1]))
                  return true
                }).map((rowFields: any[], ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    {rowFields.map((f: any) => (
                      <div key={f.label} style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: Gray, display: 'block', marginBottom: 5 }}>{f.label}</label>
                        <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                          style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #EEE', borderRadius: 12, fontSize: 14, outline: 'none' }} />
                      </div>
                    ))}
                  </div>
                ))}
                <button onClick={handlePay} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                  Запросити рахунок
                </button>
              </div>
            )}
          </div>
        ))}

        <div style={{ fontWeight: 700, fontSize: 17, margin: '8px 0 16px' }}>Оплата карткою</div>
        {METHODS.slice(3).map(m => (
          <button key={m.id} onClick={() => setSelected(m.id)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px', background: selected===m.id ? '#FFF8EE' : '#F9F9F9',
            border: selected===m.id ? `2px solid ${ORange}` : '2px solid #EEE',
            borderRadius: 14, cursor: 'pointer', marginBottom: 10, textAlign: 'left'
          }}>
            <span style={{ fontSize: 20 }}>💳</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{m.label}</span>
          </button>
        ))}

        <div style={{ borderTop: '1px solid #F5F5F5', paddingTop: 16, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18 }}>
            <span>Усього до сплати</span><span>{total} {currencySign}</span>
          </div>
        </div>

        {selected && !method?.needsAddress && (
          <button onClick={handlePay} style={{ width: '100%', marginTop: 20, padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Оплатити {total} {currencySign}
          </button>
        )}
      </div>
    </div>
  )
}
