import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const ORange = '#F5A623'
const Navy = '#0B2E5E'

// Реквізити для доплати переказом на рахунок — фіксовані, не з бекенду.
// Сума і номер замовлення підставляються динамічно.
export default function BankTransferBox({ oid, amount, currencyLabel }: { oid: string; amount: number; currencyLabel: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '12px', background: 'none', border: `1.5px solid ${ORange}`, color: ORange, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        Оплатити на рахунок {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: '14px 16px', background: '#FFF8EC', borderRadius: 12, fontSize: 13.5, lineHeight: 1.7, color: Navy }}>
          <div>Ліцензія Міністерства інфраструктури України № 153 741</div>
          <div style={{ marginTop: 6 }}>Розрахунковий рахунок ТОВ «Євроклуб» для оплати квитка в банку:</div>
          <div>IBAN: UA923052990000026001015014599 в ПАТ «Приватбанк» м. Києва</div>
          <div>МФО: 305299</div>
          <div>код ЄДРПОУ: 30368828</div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Сума оплати: {amount} {currencyLabel}</div>
          <div>Призначення платежу: Оплата заказа № {oid}</div>
        </div>
      )}
    </div>
  )
}
