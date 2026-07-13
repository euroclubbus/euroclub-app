import { useState } from 'react'
import { authLogin, authRegister, authRepass1, authRepass2, authRepass3 } from '../api/auth'
import { useAuthStore } from '../authStore'
import { useT } from '../i18n'

const ORange = '#F5A623'
const Gray = '#9E9E9E'

type Mode = 'login' | 'register' | 'forgot'

export default function Auth({ onAuthed }: { onAuthed?: () => void }) {
  const t = useT()
  const { setUser } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState(1) // для forgot
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [header, setHeader] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = (m: Mode) => { setMode(m); setStep(1); setErr(''); setOk(''); setPass(''); setCode('') }

  const field = (val: string, set: (v: string) => void, placeholder: string, type = 'text', autoFocus = false) => (
    <input value={val} onChange={e => { set(e.target.value); setErr('') }} placeholder={placeholder} type={type} autoFocus={autoFocus}
      style={{ width: '100%', padding: '14px 16px', fontSize: 16, borderRadius: 12, border: '1.5px solid #E6E6E6', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
  )

  const doLogin = async () => {
    if (!email.trim() || !pass) { setErr(t('auth.errNoEmailPass')); return }
    setLoading(true); setErr('')
    try {
      const r: any = await authLogin(email.trim(), pass)
      if (r.db && r.db.id) {
        setUser({ id: r.db.id, header: r.db.header || '', email: r.db.email || email, phone: r.db.phone || '', key: r.db.key || '' })
        onAuthed?.()
      } else {
        setErr(r.err || t('auth.errWrongCreds'))
      }
    } catch { setErr(t('auth.networkError')) }
    finally { setLoading(false) }
  }

  const doRegister = async () => {
    if (!email.trim() || !pass || !header.trim()) { setErr(t('auth.errFillAll')); return }
    setLoading(true); setErr('')
    try {
      const r: any = await authRegister(email.trim(), pass, header.trim())
      if (r.ok === 'reg_complete') {
        // одразу входимо
        const l: any = await authLogin(email.trim(), pass)
        if (l.db?.id) { setUser({ id: l.db.id, header: l.db.header || header, email: l.db.email || email, phone: l.db.phone || '', key: l.db.key || '' }); onAuthed?.() }
        else { setOk(t('auth.accountCreated')); reset('login'); setEmail(email) }
      } else {
        setErr(r.err || t('auth.errRegisterFailed'))
      }
    } catch { setErr(t('auth.networkError')) }
    finally { setLoading(false) }
  }

  const doForgot = async () => {
    setLoading(true); setErr('')
    try {
      if (step === 1) {
        if (!email.trim()) { setErr(t('auth.errEnterEmail')); setLoading(false); return }
        const r: any = await authRepass1(email.trim())
        if (r.go === 'repass_2') { setStep(2); setOk(t('auth.codeSent')) }
        else setErr(r.err || t('auth.errEmailNotFound'))
      } else if (step === 2) {
        if (!code.trim()) { setErr(t('auth.errEnterCode')); setLoading(false); return }
        const r: any = await authRepass2(email.trim(), code.trim())
        if (r.go === 'repass_3') { setStep(3); setOk('') }
        else setErr(r.err || t('auth.errWrongCode'))
      } else {
        if (!pass) { setErr(t('auth.errEnterNewPassword')); setLoading(false); return }
        const r: any = await authRepass3(email.trim(), pass, code.trim())
        if (r.ok === 'repass_complete') { setOk(t('auth.passwordChanged')); reset('login'); setEmail(email) }
        else setErr(r.err || t('auth.errChangePassword'))
      }
    } catch { setErr(t('auth.networkError')) }
    finally { setLoading(false) }
  }

  const btn = (label: string, onClick: () => void) => (
    <button onClick={onClick} disabled={loading} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: loading ? 'default' : 'pointer', marginTop: 4 }}>
      {loading ? '...' : label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 20px' }}>
      <img src="/app-icon.png" alt="EuroClub" style={{ width: 76, height: 76, borderRadius: 18, display: 'block', margin: '0 auto 14px' }} />
      <div style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', marginBottom: 4 }}>Euro<span style={{ color: ORange }}>Club</span></div>
      <div style={{ textAlign: 'center', color: Gray, fontSize: 14, marginBottom: 28 }}>
        {mode === 'login' && t('auth.loginTitle')}
        {mode === 'register' && t('auth.registerTitle')}
        {mode === 'forgot' && t('auth.forgotTitle')}
      </div>

      <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
        {ok && <div style={{ background: '#E8F5E9', color: '#2E7D32', fontSize: 13, padding: '10px 14px', borderRadius: 10, marginBottom: 12 }}>{ok}</div>}
        {err && <div style={{ background: '#FDECEA', color: '#E53935', fontSize: 13, padding: '10px 14px', borderRadius: 10, marginBottom: 12 }}>{err}</div>}

        {mode === 'login' && (<>
          {field(email, setEmail, t('auth.emailPlaceholder'), 'email', true)}
          {field(pass, setPass, t('auth.passwordPlaceholder'), 'password')}
          {btn(t('auth.login'), doLogin)}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 14 }}>
            <button onClick={() => reset('forgot')} style={{ background: 'none', border: 'none', color: Gray, cursor: 'pointer' }}>{t('auth.forgotPassword')}</button>
            <button onClick={() => reset('register')} style={{ background: 'none', border: 'none', color: ORange, fontWeight: 700, cursor: 'pointer' }}>{t('auth.registration')}</button>
          </div>
        </>)}

        {mode === 'register' && (<>
          {field(header, setHeader, t('auth.namePlaceholder'), 'text', true)}
          {field(email, setEmail, t('auth.emailPlaceholder'), 'email')}
          {field(pass, setPass, t('auth.passwordPlaceholder'), 'password')}
          {btn(t('auth.registerBtn'), doRegister)}
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
            <button onClick={() => reset('login')} style={{ background: 'none', border: 'none', color: ORange, fontWeight: 700, cursor: 'pointer' }}>{t('auth.alreadyHaveAccount')}</button>
          </div>
        </>)}

        {mode === 'forgot' && (<>
          {step === 1 && <>{field(email, setEmail, t('auth.emailPlaceholder'), 'email', true)}{btn(t('auth.sendCode'), doForgot)}</>}
          {step === 2 && <>{field(code, setCode, t('auth.codePlaceholder'), 'text', true)}{btn(t('auth.confirmCode'), doForgot)}</>}
          {step === 3 && <>{field(pass, setPass, t('auth.newPasswordPlaceholder'), 'password', true)}{btn(t('auth.savePassword'), doForgot)}</>}
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
            <button onClick={() => reset('login')} style={{ background: 'none', border: 'none', color: Gray, cursor: 'pointer' }}>{t('auth.backToLogin')}</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
