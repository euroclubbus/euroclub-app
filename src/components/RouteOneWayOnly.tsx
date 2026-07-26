// Повідомлення для маршрутів, які існують тільки в один бік (немає round-trip у таблиці цін).
// Телефони менеджера — залежно від країни призначення (Кеп, 26.07).
const PHONES_DE = ['+380674875878', '+491622503600']
const PHONES_AT_HU_SK = ['+380674875878', '+4366910286200', '+421944819220']
const PHONES_MD = ['+380674875878']
const PHONES_ALL = Array.from(new Set([...PHONES_DE, ...PHONES_AT_HU_SK, ...PHONES_MD]))

export function phonesForCountry(i2?: string): string[] {
  switch (i2) {
    case 'de': return PHONES_DE
    case 'at': case 'hu': case 'sk': return PHONES_AT_HU_SK
    case 'md': return PHONES_MD
    default: return PHONES_ALL
  }
}

const ORange = '#F5A623'
const Gray = '#9E9E9E'

export default function RouteOneWayOnly({ fromName, toName, destCountry, onPickOtherCity }: {
  fromName?: string
  toName?: string
  destCountry?: string
  onPickOtherCity?: () => void
}) {
  const phones = phonesForCountry(destCountry)
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 24, marginBottom: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚌</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 8, lineHeight: 1.5 }}>
        Цей рейс є тільки в напрямку за маршрутом {fromName} — {toName}.
      </div>
      <div style={{ fontSize: 14, color: Gray, marginBottom: 20, lineHeight: 1.5 }}>
        Рейсу в 2 сторони або з {toName} до {fromName} немає.
        Але ви можете обрати інше місто прибуття або звернутися за допомогою до менеджера за телефоном:
      </div>
      <div style={{ marginBottom: 20 }}>
        {phones.map(p => (
          <div key={p} style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>{p}</div>
        ))}
      </div>
      {onPickOtherCity && (
        <button onClick={onPickOtherCity} style={{ padding: '12px 24px', background: 'none', border: `2px solid ${ORange}`, borderRadius: 12, color: ORange, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Обрати інше місто
        </button>
      )}
    </div>
  )
}
