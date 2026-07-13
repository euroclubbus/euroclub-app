const WORKER = 'https://curly-voice-8a71.eclubbus21.workers.dev'

export async function submitScore(uid: string, name: string, delta: number) {
  const res = await fetch(`${WORKER}/game/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, name, delta }),
  })
  return res.json()
}

export async function getLeaderboard(month?: string) {
  const q = month ? `?month=${encodeURIComponent(month)}` : ''
  const res = await fetch(`${WORKER}/game/leaderboard${q}`)
  return res.json()
}

export async function getMyScore(uid: string, month?: string) {
  const q = new URLSearchParams({ uid, ...(month ? { month } : {}) })
  const res = await fetch(`${WORKER}/game/my-score?${q.toString()}`)
  return res.json()
}

export async function validatePromo(code: string): Promise<{ valid: boolean; pct?: number }> {
  const res = await fetch(`${WORKER}/game/validate-promo?code=${encodeURIComponent(code)}`)
  return res.json()
}

export async function redeemPromo(code: string, orderHash: string) {
  const res = await fetch(`${WORKER}/game/redeem-promo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, orderHash }),
  })
  return res.json()
}
