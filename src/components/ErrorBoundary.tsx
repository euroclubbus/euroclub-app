import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

// Без цього одна помилка рендеру (наприклад некоректний порядок хуків у
// якомусь компоненті) валила ВЕСЬ застосунок у порожній білий екран
// назавжди — React не показує навіть заголовок/кнопку "Назад", просто
// зупиняється. Тепер таку помилку ловимо тут і даємо користувачу кнопку
// перезавантаження замість мертвого білого екрану без жодної підказки.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary] Caught render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0B2E5E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Щось пішло не так</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5, marginBottom: 24, maxWidth: 300 }}>
            Сталася технічна помилка. Спробуйте перезавантажити сторінку.
          </div>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            style={{ padding: '14px 28px', background: '#F5A623', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            На головну
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
