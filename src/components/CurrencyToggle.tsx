import { useDisplayPrice } from '../currency'

const ORange = '#F5A623'

export default function CurrencyToggle({ light }: { light?: boolean }) {
  const { displayCurrency, setDisplayCurrency } = useDisplayPrice()
  const bg = light ? 'rgba(255,255,255,0.15)' : '#F5F5F5'
  const activeColor = light ? '#fff' : '#fff'
  return (
    <div style={{ display: 'inline-flex', borderRadius: 20, background: bg, padding: 3 }}>
      {(['UAH', 'EUR'] as const).map(c => (
        <button key={c} onClick={() => setDisplayCurrency(c)} style={{
          padding: '5px 14px', borderRadius: 17, border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700,
          background: displayCurrency === c ? ORange : 'transparent',
          color: displayCurrency === c ? activeColor : (light ? 'rgba(255,255,255,0.7)' : '#999'),
          transition: 'all 0.15s',
        }}>
          {c === 'UAH' ? '₴ UAH' : '€ EUR'}
        </button>
      ))}
    </div>
  )
}
