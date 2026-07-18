import { useLangStore, Lang } from '../langStore'

type UiLang = Exclude<Lang, 'ru'>

const FLAGS: Record<UiLang, string> = {
  uk: '🇺🇦',
  en: '🇬🇧',
  de: '🇩🇪',
}
const LABELS: Record<UiLang, string> = { uk: 'UA', en: 'EN', de: 'DE' }

export default function LanguageSwitcher({ light }: { light?: boolean }) {
  const { lang, setLang } = useLangStore()
  const bg = light ? 'rgba(255,255,255,0.15)' : '#F5F5F5'
  return (
    <div style={{ display: 'inline-flex', borderRadius: 20, background: bg, padding: 3, gap: 2 }}>
      {(['uk', 'en', 'de'] as const).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding: '5px 8px', borderRadius: 17, border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
          background: lang === l ? '#F5A623' : 'transparent',
          color: lang === l ? '#fff' : (light ? 'rgba(255,255,255,0.7)' : '#999'),
        }}>
          <span style={{ fontSize: 13 }}>{FLAGS[l]}</span>{LABELS[l]}
        </button>
      ))}
    </div>
  )
}
