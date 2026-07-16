import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Gauge } from 'lucide-react'
import { useAuthStore } from '../authStore'
import {
  GAME_ROUTES, GAME_BUSES, GameRoute, GameBus, routeDurationSec, effectiveAccel, generateSegments, scoreForTap,
  FUEL_MAX, CANISTER_COST_POINTS, CANISTER_TIME_PENALTY_SEC, REFUEL_MAX_SEC,
  fuelBurnRate, generateGasStations, ZONE_BY_SIGN,
} from '../game/gameData'
import { submitScore, getLeaderboard, getMyScore } from '../game/gameApi'

const ORange = '#F5A623'
const Navy = '#0B2E5E'
const NICK_KEY = 'eclub_game_nick'

function useUid() {
  const { user } = useAuthStore()
  return (user?.email || 'guest').toLowerCase().trim()
}

type Step = 'nickname' | 'menu' | 'route' | 'bus' | 'passengers' | 'playing' | 'result' | 'leaderboard'

// Поки що гра доступна тільки для тестування — один акаунт
const ALLOWED_EMAILS = ['eclubbus21@gmail.com']

export default function Game() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const allowed = ALLOWED_EMAILS.includes((user?.email || '').toLowerCase())
  if (!allowed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B2E5E', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Гра ще тестується</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 24 }}>Скоро буде доступна всім</div>
        <button onClick={() => nav(-1)} style={{ padding: '12px 24px', background: '#F5A623', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Назад</button>
      </div>
    )
  }
  const uid = useUid()
  const [nick, setNick] = useState(() => { try { return localStorage.getItem(NICK_KEY) || '' } catch { return '' } })
  const [step, setStep] = useState<Step>(nick ? 'menu' : 'nickname')
  const [nickInput, setNickInput] = useState(nick)

  const [route, setRoute] = useState<GameRoute | null>(null)
  const [bus, setBus] = useState<GameBus | null>(null)
  const [passengers, setPassengers] = useState(1)

  const [myScore, setMyScore] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<{ uid: string; name: string; score: number }[]>([])
  const [loadingBoard, setLoadingBoard] = useState(false)

  const [lastRunScore, setLastRunScore] = useState(0)

  useEffect(() => {
    if (nick) getMyScore(uid).then(r => setMyScore(r.score ?? 0)).catch(() => {})
  }, [nick, uid])

  const saveNick = () => {
    const clean = nickInput.trim().slice(0, 20)
    if (!clean) return
    setNick(clean)
    try { localStorage.setItem(NICK_KEY, clean) } catch {}
    setStep('menu')
  }

  const openLeaderboard = () => {
    setLoadingBoard(true)
    getLeaderboard().then(r => setLeaderboard(r.top || [])).catch(() => setLeaderboard([])).finally(() => setLoadingBoard(false))
    setStep('leaderboard')
  }

  const finishRun = (score: number) => {
    setLastRunScore(score)
    submitScore(uid, nick, score).then(r => setMyScore(r.score ?? null)).catch(() => {})
    setStep('result')
  }

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(160deg, ${Navy}, #082349)`, color: '#fff', paddingBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top) + 18px) 16px 12px' }}>
        <button onClick={() => (step === 'menu' ? nav(-1) : setStep('menu'))} aria-label="Назад" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={{ fontSize: 20, fontWeight: 800 }}>🚌 EuroClub Racer</span>
      </div>

      {step === 'nickname' && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Як тебе звати?</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 20 }}>Цей нік бачитимуть у рейтингу</div>
          <input value={nickInput} onChange={e => setNickInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNick()}
            placeholder="Твій нік" maxLength={20}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 16, textAlign: 'center', marginBottom: 16 }} />
          <button onClick={saveNick} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
            Почати
          </button>
        </div>
      )}

      {step === 'menu' && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Твій нік</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{nick}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Бали за цей місяць</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: ORange }}>{myScore ?? '—'}</div>
              </div>
              <button onClick={openLeaderboard} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12, padding: '10px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                <Trophy size={16} /> Рейтинг
              </button>
            </div>
          </div>

          <div style={{ background: '#FFF9EF', color: '#7A5A16', borderRadius: 14, padding: 14, fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
            🏆 Топ-5 гравців місяця отримують знижку на квиток: 50% / 40% / 30% / 20% / 10%.
          </div>

          <button onClick={() => setStep('route')} style={{ width: '100%', padding: 18, background: ORange, color: '#fff', border: 'none', borderRadius: 16, fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
            🚦 Почати заїзд
          </button>
        </div>
      )}

      {step === 'route' && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Оберіть маршрут</div>
          {GAME_ROUTES.map(r => (
            <button key={r.id} onClick={() => { setRoute(r); setStep('bus') }} style={{
              width: '100%', textAlign: 'left', padding: 16, marginBottom: 10, background: 'rgba(255,255,255,0.08)',
              border: 'none', borderRadius: 14, color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.from} → {r.to}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>~{Math.round(routeDurationSec(r) / 60)} хв</span>
            </button>
          ))}
        </div>
      )}

      {step === 'bus' && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Оберіть автобус</div>
          {GAME_BUSES.map(b => (
            <button key={b.id} onClick={() => { setBus(b); setPassengers(1); setStep('passengers') }} style={{
              width: '100%', textAlign: 'left', padding: 16, marginBottom: 10, background: 'rgba(255,255,255,0.08)',
              border: 'none', borderRadius: 14, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 26 }}>🚌</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{b.capacity} місць</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 'passengers' && bus && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Кількість пасажирів</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>Більше пасажирів — важче розганяти, більше треба тапати</div>
          <div style={{ textAlign: 'center', fontSize: 48, fontWeight: 900, marginBottom: 16 }}>{passengers}</div>
          <input type="range" min={1} max={bus.capacity} value={passengers} onChange={e => setPassengers(Number(e.target.value))}
            style={{ width: '100%', marginBottom: 24 }} />
          <button onClick={() => setStep('playing')} style={{ width: '100%', padding: 18, background: ORange, color: '#fff', border: 'none', borderRadius: 16, fontWeight: 800, fontSize: 17, cursor: 'pointer' }}>
            Поїхали!
          </button>
        </div>
      )}

      {step === 'playing' && route && bus && (
        <Gameplay route={route} bus={bus} passengers={passengers} onFinish={finishRun} />
      )}

      {step === 'result' && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🏁</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Заїзд завершено!</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: lastRunScore < 0 ? '#E53935' : ORange, marginBottom: 20 }}>{lastRunScore >= 0 ? `+${lastRunScore}` : lastRunScore} балів</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>Загалом за місяць: <strong style={{ color: '#fff' }}>{myScore ?? '—'}</strong></div>
          <button onClick={() => setStep('route')} style={{ width: '100%', padding: 16, background: ORange, color: '#fff', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
            Ще раз
          </button>
          <button onClick={openLeaderboard} style={{ width: '100%', padding: 16, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Подивитись рейтинг
          </button>
        </div>
      )}

      {step === 'leaderboard' && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Рейтинг цього місяця</div>
          {loadingBoard && <div style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: 30 }}>Завантаження...</div>}
          {!loadingBoard && leaderboard.length === 0 && <div style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: 30 }}>Поки нікого немає — будь першим!</div>}
          {leaderboard.map((entry, i) => (
            <div key={entry.uid} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 8,
              background: entry.name === nick ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.08)',
              border: i < 5 ? `1.5px solid ${ORange}` : 'none', borderRadius: 12,
            }}>
              <span style={{ fontWeight: 800, fontSize: 15, width: 24, textAlign: 'center' }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{entry.name}</span>
              {i < 5 && <span style={{ fontSize: 11, color: ORange, fontWeight: 700 }}>🏆</span>}
              <span style={{ fontWeight: 800, fontSize: 15 }}>{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ігровий процес ─────────────────────────────────────────────────────────
type Phase = 'driving' | 'refueling' | 'outOfFuel'

function Gameplay({ route, bus, passengers, onFinish }: { route: GameRoute; bus: GameBus; passengers: number; onFinish: (score: number) => void }) {
  const durationSec = routeDurationSec(route)
  const segmentsRef = useRef(generateSegments(durationSec))
  const stationsRef = useRef(generateGasStations())
  const visitedRef = useRef<Set<number>>(new Set())

  const [timeLeft, setTimeLeft] = useState(durationSec)
  const [speed, setSpeed] = useState(0)
  const [score, setScore] = useState(0)
  const [fuel, setFuel] = useState(FUEL_MAX)
  const [phase, setPhase] = useState<Phase>('driving')
  const [refuelStation, setRefuelStation] = useState<{ name: string; pricePerFill: number } | null>(null)
  const [refuelPct, setRefuelPct] = useState(0)
  const [flash, setFlash] = useState<{ id: number; val: number } | null>(null)

  const speedRef = useRef(0)
  const scoreRef = useRef(0)
  const fuelRef = useRef(FUEL_MAX)
  const elapsedRef = useRef(0)
  const phaseRef = useRef<Phase>('driving')
  const refuelPctRef = useRef(0)
  const accel = effectiveAccel(bus, passengers)

  const currentSegment = () => {
    let acc = 0
    for (const seg of segmentsRef.current) {
      acc += seg.len
      if (elapsedRef.current < acc) return seg
    }
    return segmentsRef.current[segmentsRef.current.length - 1]
  }
  const [limit, setLimit] = useState(currentSegment().limit)
  const zone = ZONE_BY_SIGN[currentSegment().type]

  const finish = () => onFinish(Math.round(scoreRef.current))
  const finishWithoutCanister = () => onFinish(Math.round(scoreRef.current) - 3000)

  useEffect(() => {
    let raf: number
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      if (phaseRef.current === 'driving') {
        elapsedRef.current += dt
        speedRef.current = Math.max(0, speedRef.current - bus.decay * dt)
        setSpeed(speedRef.current)
        const seg = currentSegment()
        setLimit(seg.limit)

        // Витрата палива — гірше тримаєш швидкість, швидше витрачається
        fuelRef.current = Math.max(0, fuelRef.current - fuelBurnRate(seg.limit, speedRef.current) * dt)
        setFuel(fuelRef.current)
        if (fuelRef.current <= 0) { phaseRef.current = 'outOfFuel'; setPhase('outOfFuel') }

        // Заправка на маршруті
        const frac = elapsedRef.current / durationSec
        stationsRef.current.forEach((st, i) => {
          if (!visitedRef.current.has(i) && frac >= st.atFraction) {
            visitedRef.current.add(i)
            phaseRef.current = 'refueling'
            setPhase('refueling')
            setRefuelStation({ name: st.name, pricePerFill: st.pricePerFill })
            refuelPctRef.current = 0
            setRefuelPct(0)
          }
        })
      } else if (phaseRef.current === 'refueling') {
        // Часу на маршруті йде своя лічба навіть під час заправки (це витрата часу поїздки)
        elapsedRef.current += dt
        // Пасивне заповнення — якщо не тапати, заправка завершиться рівно за REFUEL_MAX_SEC
        refuelPctRef.current = Math.min(100, refuelPctRef.current + (100 / REFUEL_MAX_SEC) * dt)
        setRefuelPct(refuelPctRef.current)
        if (refuelPctRef.current >= 100) {
          fuelRef.current = FUEL_MAX
          setFuel(FUEL_MAX)
          scoreRef.current = Math.max(0, scoreRef.current - (refuelStation?.pricePerFill || 0))
          setScore(Math.round(scoreRef.current))
          phaseRef.current = 'driving'
          setPhase('driving')
          setRefuelStation(null)
        }
      }
      // 'outOfFuel' — таймер паузиться, чекаємо рішення гравця (модалка)

      const remaining = Math.max(0, durationSec - elapsedRef.current)
      setTimeLeft(Math.ceil(remaining))
      if (remaining <= 0) { finish(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTap = () => {
    if (phase === 'driving') {
      const seg = currentSegment()
      const gained = scoreForTap(seg.limit, speedRef.current)
      scoreRef.current += gained
      setScore(Math.round(scoreRef.current))
      speedRef.current = Math.min(140, speedRef.current + accel)
      setSpeed(speedRef.current)
      setFlash({ id: Date.now(), val: gained })
      setTimeout(() => setFlash(f => (f && Date.now() - f.id > 400 ? null : f)), 500)
    } else if (phase === 'refueling') {
      refuelPctRef.current = Math.min(100, refuelPctRef.current + 12)
      setRefuelPct(refuelPctRef.current)
    }
  }

  const buyCanister = () => {
    if (scoreRef.current < CANISTER_COST_POINTS) return
    scoreRef.current -= CANISTER_COST_POINTS
    setScore(Math.round(scoreRef.current))
    fuelRef.current = FUEL_MAX
    setFuel(FUEL_MAX)
    elapsedRef.current += CANISTER_TIME_PENALTY_SEC // втрата часу на маршруті
    phaseRef.current = 'driving'
    setPhase('driving')
  }

  const diff = limit - speed
  const zoneColor = speed > limit ? '#E53935' : diff <= 10 ? '#2E7D32' : diff <= 29 ? '#F5A623' : '#8A8A8A'
  const fuelColor = fuel > 40 ? '#4CAF50' : fuel > 15 ? '#F5A623' : '#E53935'
  // Швидкість прокрутки дороги/пейзажу пропорційна поточній швидкості (стоїш — все стоїть)
  const scrollDur = speed > 2 ? Math.max(0.25, 6 / speed) : 0

  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
      {/* Живий фон — міняється разом з типом дороги */}
      <div style={{ position: 'absolute', inset: 0, background: zone.bg, transition: 'background 1.2s ease', zIndex: 0 }} />
      <div style={{
        position: 'absolute', top: '18%', left: 0, right: 0, height: 40, fontSize: 26, whiteSpace: 'nowrap',
        animation: scrollDur ? `scenery-scroll ${scrollDur * 4}s linear infinite` : 'none', opacity: 0.55, zIndex: 0,
      }}>
        {Array(20).fill(zone.emoji).join('  ')}
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '6px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 6, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
          <span>{route.from} → {route.to}</span>
          <span>⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#fff', marginBottom: 8, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Бали: <strong style={{ color: ORange }}>{score}</strong></div>

        {/* Паливо */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>⛽</span>
          <div style={{ flex: 1, height: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${fuel}%`, height: '100%', background: fuelColor, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, width: 32, textAlign: 'right' }}>{Math.round(fuel)}%</span>
        </div>

        {phase === 'driving' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6, marginBottom: 12 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', border: '6px solid #E53935', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#1A1A1A' }}>{limit}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: zoneColor, lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>{Math.round(speed)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>км/год</div>
            </div>

            {/* Автобус на дорозі */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10 }}>
              <div style={{ fontSize: 54, animation: speed > 2 ? 'bus-bounce 0.5s ease-in-out infinite' : 'none' }}>🚌</div>
            </div>
            <div style={{
              height: 14, borderRadius: 4, marginBottom: 14,
              backgroundImage: 'repeating-linear-gradient(90deg, #fff 0 24px, transparent 24px 48px)',
              backgroundColor: '#555', backgroundPosition: '0 0',
              animation: scrollDur ? `road-scroll ${scrollDur}s linear infinite` : 'none',
            }} />

            <button onClick={onTap} style={{
              width: '100%', padding: '26px 0', background: `linear-gradient(180deg, ${ORange}, #D9860F)`,
              border: 'none', borderRadius: 24, color: '#fff', fontWeight: 900, fontSize: 22, cursor: 'pointer',
              boxShadow: '0 8px 0 #B5700A', position: 'relative', userSelect: 'none', touchAction: 'manipulation',
            }}>
              <Gauge size={26} style={{ verticalAlign: 'middle', marginRight: 8 }} />ГАЗ
              {flash && (
                <span style={{ position: 'absolute', top: -10, right: 20, fontSize: 20, fontWeight: 900, color: flash.val > 0 ? '#4CAF50' : '#E53935' }}>
                  {flash.val > 0 ? `+${flash.val}` : flash.val}
                </span>
              )}
            </button>
          </>
        )}

        {phase === 'refueling' && refuelStation && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⛽</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Заправка {refuelStation.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 20 }}>Тапай, щоб заправитись швидше</div>
            <div style={{ width: '100%', maxWidth: 280, height: 18, background: 'rgba(0,0,0,0.3)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ width: `${refuelPct}%`, height: '100%', background: '#4CAF50', transition: 'width 0.15s' }} />
            </div>
            <button onClick={onTap} style={{
              width: '100%', maxWidth: 280, padding: '22px 0', background: `linear-gradient(180deg, ${ORange}, #D9860F)`,
              border: 'none', borderRadius: 20, color: '#fff', fontWeight: 900, fontSize: 18, cursor: 'pointer',
              boxShadow: '0 6px 0 #B5700A', userSelect: 'none', touchAction: 'manipulation',
            }}>
              ⛽ ЗАПРАВЛЯТИ
            </button>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 10 }}>Ціна: {refuelStation.pricePerFill} балів за повний бак</div>
          </div>
        )}

        {phase === 'outOfFuel' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 10px' }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🛑</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Паливо закінчилось!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 24 }}>Купи каністру, щоб продовжити заїзд</div>
            <button onClick={buyCanister} disabled={score < CANISTER_COST_POINTS} style={{
              width: '100%', maxWidth: 300, padding: 16, background: score < CANISTER_COST_POINTS ? '#8A8A8A' : ORange, color: '#fff',
              border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: score < CANISTER_COST_POINTS ? 'default' : 'pointer', marginBottom: 10,
            }}>
              🛢️ Купити каністру — {CANISTER_COST_POINTS} балів (+{CANISTER_TIME_PENALTY_SEC}с)
            </button>
            <button onClick={finishWithoutCanister} style={{
              width: '100%', maxWidth: 300, padding: 16, background: 'rgba(255,255,255,0.12)', color: '#fff',
              border: '1.5px solid #E53935', borderRadius: 14, fontWeight: 700, fontSize: 16, cursor: 'pointer',
            }}>
              Завершити заїзд (−3000 балів)
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes road-scroll { from { background-position: 0 0; } to { background-position: -48px 0; } }
        @keyframes scenery-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes bus-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </div>
  )
}
