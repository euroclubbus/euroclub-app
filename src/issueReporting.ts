import { getFirebaseApp } from './firebaseApp'

// Кеп (18.09): ЗАГАЛЬНИЙ механізм — коли застосунок натикається на ситуацію "не знаю, що
// з цим робити" (бракує даних для виконання задачі), пише запис сюди, замість того щоб
// мовчки показати щось приблизне чи зламатись. Адмінка (нова вкладка) показує список —
// видно прогалини одразу, по факту, а не чекаючи скарги користувача. Використовується для
// БУДЬ-ЯКОЇ майбутньої ситуації такого типу, не тільки для знижок — тому `type` довільний
// рядок-категорія (напр. 'unknown_discount_id'), а `data` — довільний об'єкт з деталями.

export interface AppIssue {
  type: string // категорія ситуації, напр. 'unknown_discount_id'
  context: string // людською мовою, що сталось
  data?: Record<string, any> // довільні деталі (id, orderNo, route тощо)
}

// Не спамимо однаковими записами — один тип+ключ (напр. конкретний невідомий id) пишеться
// не частіше разу на сесію вкладки (застосунок відкритий довго, той самий гап трапляється
// багато разів поспіль, поки не виправлять).
const reportedThisSession = new Set<string>()

export async function reportIssue(issue: AppIssue, dedupeKey?: string) {
  try {
    const key = dedupeKey ? `${issue.type}:${dedupeKey}` : null
    if (key && reportedThisSession.has(key)) return
    if (key) reportedThisSession.add(key)

    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore')
    const db = getFirestore(app)
    await addDoc(collection(db, 'app_issues'), {
      type: issue.type,
      context: issue.context,
      data: issue.data || {},
      createdAt: serverTimestamp(),
      resolved: false,
    })
  } catch (e) {
    // Сам механізм звітування НЕ повинен ламати застосунок, якщо сам провалився.
    console.error('[IssueReporting] failed to report issue', e)
  }
}
