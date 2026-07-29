import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'

interface TransferCity {
  id: string
  name: string
  fromText: string
  toText: string
}

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const Gray = '#8A8A8A'

export default function AdminTransferCities() {
  const nav = useNavigate()
  const [cities, setCities] = useState<TransferCity[]>([])
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [loading, setLoading] = useState(true)

  const availableCities = ['Дніпро', 'Львів', 'Ліпськ', 'Вроцлав', 'Варшава', 'Прага', 'Братислава']

  useEffect(() => {
    // Завантажуємо міста з Firebase/Backend
    const fetchCities = async () => {
      try {
        // Тимчасово - просто пуста полиця
        setCities([])
      } catch (e) {
        console.error('Error loading cities:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchCities()
  }, [])

  const handleAddCity = () => {
    if (!selectedCity) return
    const newCity: TransferCity = {
      id: Date.now().toString(),
      name: selectedCity,
      fromText: '',
      toText: ''
    }
    setCities([...cities, newCity])
    setSelectedCity('')
  }

  const handleSave = async (cityId: string) => {
    const city = cities.find(c => c.id === cityId)
    if (!city) return

    try {
      // Зберігаємо в Firebase/Backend
      console.log('Saving city:', city)
      // await saveTransferCityData(city)
    } catch (e) {
      console.error('Error saving city:', e)
    }
  }

  const handleDelete = (cityId: string) => {
    setCities(cities.filter(c => c.id !== cityId))
  }

  const handleUpdateCity = (cityId: string, field: 'fromText' | 'toText', value: string) => {
    setCities(cities.map(c =>
      c.id === cityId ? { ...c, [field]: value } : c
    ))
  }

  const usedCities = cities.map(c => c.name)
  const unusedCities = availableCities.filter(c => !usedCities.includes(c))

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: Navy }}>
        <button onClick={() => nav(-1)} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Міста з пересадкою</span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Додавання міста */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E0E0E0', padding: '16px', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: Gray, marginBottom: 6 }}>Виберіть місто</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                style={{ width: '100%', padding: '8px', border: `1px solid ${Gray}`, borderRadius: 8, fontSize: 13, background: '#fff', color: Navy }}
              >
                <option value="">Виберіть...</option>
                {unusedCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleAddCity}
                disabled={!selectedCity}
                style={{ width: '100%', padding: '8px', background: selectedCity ? ORange : Gray, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selectedCity ? 'pointer' : 'not-allowed', opacity: selectedCity ? 1 : 0.5 }}
              >
                Додати місто
              </button>
            </div>
          </div>
        </div>

        {/* Список міст */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: Gray }}>Завантаження...</div>
        ) : cities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: Gray }}>Немає доданих міст</div>
        ) : (
          cities.map(city => (
            <div key={city.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E0E0E0', padding: '16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{city.name}</h3>
                <button
                  onClick={() => handleDelete(city.id)}
                  style={{ background: 'none', border: 'none', color: '#E74C3C', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={14} /> Видалити
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: Gray, marginBottom: 4 }}>Рейси з {city.name} (напр. інформація про зупинки)</label>
                <textarea
                  value={city.fromText}
                  onChange={(e) => handleUpdateCity(city.id, 'fromText', e.target.value)}
                  placeholder={`Виїзд о 14:00 з вокзалу. Час у дорозі 8 годин. Зупинка в Запоріжжі на 15 хв.`}
                  style={{ width: '100%', height: 60, padding: '8px', border: `1px solid ${Gray}`, borderRadius: 8, fontSize: 12, resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: Gray, marginBottom: 4 }}>Рейси до {city.name} (напр. інформація про зупинки)</label>
                <textarea
                  value={city.toText}
                  onChange={(e) => handleUpdateCity(city.id, 'toText', e.target.value)}
                  placeholder={`Прибуття о 22:30 на вокзал. Час у дорозі 8 годин. Пересадка в Запоріжжі.`}
                  style={{ width: '100%', height: 60, padding: '8px', border: `1px solid ${Gray}`, borderRadius: 8, fontSize: 12, resize: 'none', fontFamily: 'inherit', marginBottom: 12 }}
                />
              </div>

              <button
                onClick={() => handleSave(city.id)}
                style={{ width: '100%', padding: '8px', background: ORange, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Зберегти зміни
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
