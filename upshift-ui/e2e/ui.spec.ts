import { expect, test, type Page } from '@playwright/test'

// Functional end-to-end tests in a real browser (installed Chrome).
// "stubbed" tests fake the API to check UI behaviour exactly; "live" tests use the real backend + Claude.

type Json = Record<string, any>

const QUIZ = {
  quizId: '11111111-2222-3333-4444-555555555555',
  profession: 'Software Engineer (mix of core job skills and using AI well at work)',
  count: 2,
  expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
  webSearch: true,
  sources: [
    { title: 'Big-O cheat sheet', url: 'https://example.com/big-o' },
    { title: 'SQL HAVING explained', url: 'https://www.example.org/having' },
  ],
  questions: [
    {
      id: 1,
      question: 'What is the time complexity of binary search?',
      options: [
        { id: 'A', text: 'O(n)' },
        { id: 'B', text: 'O(log n)' },
        { id: 'C', text: 'O(1)' },
        { id: 'D', text: 'O(n log n)' },
      ],
      topic: 'Algorithms',
      difficulty: 'medium',
    },
    {
      id: 2,
      question: 'Which SQL clause filters aggregated groups?',
      options: [
        { id: 'A', text: 'WHERE' },
        { id: 'B', text: 'ORDER BY' },
        { id: 'C', text: 'HAVING' },
        { id: 'D', text: 'LIMIT' },
      ],
      topic: 'SQL',
      difficulty: 'medium',
    },
  ],
}
const KEY: Record<number, string> = { 1: 'B', 2: 'C' }

function grade(body: Json) {
  const picks = Object.fromEntries(body.answers.map((a: Json) => [a.questionId, a.selectedOption]))
  const results = QUIZ.questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    options: q.options,
    selectedOption: picks[q.id] ?? null,
    correctAnswer: KEY[q.id],
    correct: picks[q.id] === KEY[q.id],
    explanation: `Explanation for question ${q.id}.`,
  }))
  const correct = results.filter((r) => r.correct).length
  return {
    quizId: QUIZ.quizId,
    profession: QUIZ.profession,
    totalQuestions: 2,
    answered: body.answers.length,
    correct,
    scorePercent: Math.round((correct * 100) / 2),
    results,
    sources: QUIZ.sources,
  }
}

/** Fakes both endpoints and records what the UI sent. */
async function stubApi(page: Page) {
  const sent: { generate: Json[]; evaluate: Json[] } = { generate: [], evaluate: [] }
  await page.route('**/api/questions/generate', async (route) => {
    sent.generate.push(route.request().postDataJSON())
    await route.fulfill({ json: QUIZ })
  })
  await page.route('**/api/questions/evaluate', async (route) => {
    const body = route.request().postDataJSON()
    sent.evaluate.push(body)
    await route.fulfill({ json: grade(body) })
  })
  return sent
}

async function freshSetup(page: Page, opts: { web?: boolean } = {}) {
  await page.addInitScript((web) => {
    if (sessionStorage.getItem('e2e-init')) return // keep state across reloads within a test
    sessionStorage.setItem('e2e-init', '1')
    localStorage.clear()
    localStorage.setItem('upshift.voice', 'off') // no speech during tests
    if (web !== undefined) localStorage.setItem('upshift.web', web ? 'on' : 'off')
  }, opts.web)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start ride' })).toBeVisible()
}

async function setRideMinutes(page: Page, minutes: number) {
  await page.locator('#eta').fill(String(minutes))
  await expect(page.locator('.eta b')).toHaveText(`${minutes} min`)
}

const options = (page: Page) => page.getByRole('group', { name: 'Choose one answer' }).getByRole('button')
const option = (page: Page, id: string) => options(page).filter({ hasText: new RegExp(`^${id}`) })

test.describe('stubbed API', () => {
  test('setup screen: defaults, controls and the passenger safety gate', async ({ page }) => {
    await freshSetup(page)
    await expect(page.locator('h1.who')).toHaveText('Software Engineer')
    await expect(page.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Mid' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('group', { name: 'Rounds' }).getByRole('button', { name: 'Mixed' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Pull in the latest from the web')).not.toBeChecked() // opt-in

    // Ride time drives the number of rounds (3.3 min per round, 1-12).
    await setRideMinutes(page, 5)
    await expect(page.locator('.eta span')).toHaveText('1 round')
    await setRideMinutes(page, 60)
    await expect(page.locator('.eta span')).toHaveText('12 rounds')

    // Can't start unless the user confirms they're not driving.
    const start = page.getByRole('button', { name: 'Start ride' })
    await page.getByLabel(/passenger, not driving/).uncheck()
    await expect(start).toBeDisabled()
    await page.getByLabel(/passenger, not driving/).check()
    await expect(start).toBeEnabled()
  })

  test('full ride: pick answers, change a pick by keyboard, arrive and see graded results', async ({ page }) => {
    const sent = await stubApi(page)
    await freshSetup(page, { web: true })
    await page.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Leader' }).click()
    await setRideMinutes(page, 7)
    await page.getByRole('button', { name: 'Start ride' }).click()

    // What the UI asked for
    await expect(page.locator('.kind').first()).toHaveText('Round 1 of 2 · Algorithms')
    expect(sent.generate[0]).toEqual({
      profession: 'Software Engineer (mix of core job skills and using AI well at work)',
      count: 2,
      difficulty: 'hard',
      webSearch: true,
    })

    // Round 1: four options, Next disabled until a pick, sources are cited
    await expect(page.locator('.q')).toHaveText(/What is the time complexity of binary search\?/)
    await expect(options(page)).toHaveCount(4)
    const next = page.getByRole('button', { name: 'Next round' })
    await expect(next).toBeDisabled()
    await option(page, 'A').click()
    await expect(option(page, 'A')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('You picked A. You can still change it.')).toBeVisible()
    await page.keyboard.press('b') // change the pick with the keyboard
    await expect(option(page, 'B')).toHaveAttribute('aria-pressed', 'true')
    await expect(option(page, 'A')).toHaveAttribute('aria-pressed', 'false')

    const sources = page.locator('details.sources')
    await expect(sources.locator('summary')).toHaveText('Based on 2 web sources')
    await sources.locator('summary').click()
    const link = sources.getByRole('link', { name: 'Big-O cheat sheet' })
    await expect(link).toHaveAttribute('href', 'https://example.com/big-o')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(sources.getByText('example.org')).toBeVisible() // www. stripped from host
    await next.click()

    // Round 2: pick the wrong answer via number key, then arrive
    await expect(page.locator('.kind').first()).toHaveText('Round 2 of 2 · SQL')
    await page.keyboard.press('1')
    await expect(option(page, 'A')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Arrive' }).click()

    // Exactly one submission with the picks
    await expect(page.getByText('You arrived')).toBeVisible()
    expect(sent.evaluate).toEqual([
      {
        quizId: QUIZ.quizId,
        answers: [
          { questionId: 1, selectedOption: 'B' },
          { questionId: 2, selectedOption: 'A' },
        ],
      },
    ])

    // Gear Card: score, coach line by level, per-round review, sources
    await expect(page.locator('.score')).toHaveText('1 / 2')
    await expect(page.locator('.summary')).toContainText('Partly there. You got 50% right.') // Leader, 50% = "ok" tone
    const rounds = page.locator('ol.review > li')
    await expect(rounds).toHaveCount(2)
    await expect(rounds.nth(0)).toHaveClass(/right/)
    await expect(rounds.nth(0)).toContainText('You picked B: O(log n)')
    await expect(rounds.nth(1)).toHaveClass(/wrong/)
    await expect(rounds.nth(1)).toContainText('You picked A: WHERE')
    await expect(rounds.nth(1)).toContainText('Answer C: HAVING')
    await expect(rounds.nth(1)).toContainText('Explanation for question 2.')
    await expect(page.locator('.gcard')).toContainText('Explanation for question 1.') // best insight
    await expect(page.locator('details.sources summary')).toHaveText('Based on 2 web sources')

    // Ride again starts a new quiz; Change profession goes back to setup
    await page.getByRole('button', { name: 'Ride again' }).click()
    await expect(page.locator('.kind').first()).toHaveText('Round 1 of 2 · Algorithms')
    expect(sent.generate).toHaveLength(2)
  })

  test('web search toggle is sent and remembered across reloads', async ({ page }) => {
    const sent = await stubApi(page)
    await freshSetup(page)
    await page.getByLabel('Pull in the latest from the web').check()
    await page.reload()
    await expect(page.getByLabel('Pull in the latest from the web')).toBeChecked()
    await setRideMinutes(page, 5)
    await page.getByRole('button', { name: 'Start ride' }).click()
    await expect(page.locator('.q')).toBeVisible()
    expect(sent.generate[0].webSearch).toBe(true)
  })

  test('no sources section when the quiz did not use the web', async ({ page }) => {
    await page.route('**/api/questions/generate', (r) => r.fulfill({ json: { ...QUIZ, webSearch: false, sources: [] } }))
    await freshSetup(page, { web: false })
    await page.getByRole('button', { name: 'Start ride' }).click()
    await expect(page.locator('.q')).toBeVisible()
    await expect(page.locator('details.sources')).toHaveCount(0)
  })

  test('loading state mentions the web search', async ({ page }) => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    await page.route('**/api/questions/generate', async (r) => {
      await gate
      await r.fulfill({ json: QUIZ })
    })
    await freshSetup(page, { web: true })
    await page.getByRole('button', { name: 'Start ride' }).click()
    await expect(page.getByText(/Checking the web for the latest, then picking/)).toBeVisible()
    await expect(page.locator('[aria-busy="true"]')).toBeVisible()
    release()
    await expect(page.locator('.q')).toBeVisible()
  })

  test('generate errors: busy AI, validation message, offline — with working retry', async ({ page }) => {
    const replies: ((r: any) => Promise<void>)[] = [
      (r) => r.fulfill({ status: 503, json: { status: 503, error: 'Service Unavailable', message: 'upstream detail' } }),
      (r) => r.fulfill({ status: 422, json: { status: 422, error: 'Unprocessable Entity', message: 'That does not look like a profession.' } }),
      (r) => r.abort('internetdisconnected'),
      (r) => r.fulfill({ json: QUIZ }),
    ]
    await page.route('**/api/questions/generate', (r) => replies.shift()!(r))
    await freshSetup(page)
    await page.getByRole('button', { name: 'Start ride' }).click()

    const alert = page.getByRole('alert')
    const retry = page.getByRole('button', { name: 'Try again' })
    await expect(alert).toContainText('Couldn’t load your rounds')
    await expect(alert).toContainText('The coach is busy right now. Try again in a moment.')
    await expect(alert).not.toContainText('upstream detail') // backend detail not shown for 5xx
    await retry.click()
    await expect(alert).toContainText('That does not look like a profession.')
    await retry.click()
    await expect(alert).toContainText('Can’t reach the Upshift server')
    await retry.click()
    await expect(page.locator('.q')).toHaveText(/binary search/)
  })

  test('evaluate error keeps the picks and retrying submits them', async ({ page }) => {
    let calls = 0
    const bodies: Json[] = []
    await page.route('**/api/questions/generate', (r) => r.fulfill({ json: { ...QUIZ, questions: [QUIZ.questions[0]], count: 1 } }))
    await page.route('**/api/questions/evaluate', async (r) => {
      bodies.push(r.request().postDataJSON())
      if (calls++ === 0) return r.fulfill({ status: 504, json: { status: 504, error: 'Gateway Timeout', message: 'x' } })
      return r.fulfill({ json: { ...grade(r.request().postDataJSON()), totalQuestions: 1, results: grade(r.request().postDataJSON()).results.slice(0, 1) } })
    })
    await freshSetup(page)
    await setRideMinutes(page, 5)
    await page.getByRole('button', { name: 'Start ride' }).click()
    await option(page, 'B').click()
    await page.getByRole('button', { name: 'Arrive' }).click()
    await expect(page.getByRole('alert')).toContainText('The coach is busy right now.')
    await expect(option(page, 'B')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('You arrived')).toBeVisible()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toEqual(bodies[0])
  })

  test('changing profession mid-ride loads a new quiz for it', async ({ page }) => {
    const sent = await stubApi(page)
    await freshSetup(page)
    await setRideMinutes(page, 5)
    await page.getByRole('button', { name: 'Start ride' }).click()
    await expect(page.locator('.q')).toBeVisible()
    await page.getByRole('button', { name: /Change profession: Software Engineer/ }).click()
    await page.getByRole('option', { name: /Data Analyst/ }).click()
    await expect.poll(() => sent.generate.length).toBe(2)
    expect(sent.generate[1].profession).toContain('Data Analyst')
  })
})

test.describe('live backend + Claude', () => {
  async function playRide(page: Page, { web, minutes }: { web: boolean; minutes: number }) {
    const generated: Json[] = []
    const graded: Json[] = []
    page.on('response', async (res) => {
      if (res.url().endsWith('/api/questions/generate') && res.ok()) generated.push(await res.json())
      if (res.url().endsWith('/api/questions/evaluate') && res.ok()) graded.push(await res.json())
    })
    const consoleErrors: string[] = []
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))

    await freshSetup(page, { web })
    await setRideMinutes(page, minutes)
    const rounds = Math.max(1, Math.min(12, Math.floor(minutes / 3.3)))
    const started = Date.now()
    await page.getByRole('button', { name: 'Start ride' }).click()
    await expect(page.locator('.q')).toBeVisible({ timeout: 120_000 })
    const loadMs = Date.now() - started

    const quiz = generated[0]
    expect(quiz.count).toBe(rounds)
    expect(JSON.stringify(quiz)).not.toContain('correctAnswer') // answer key not in the browser

    for (let i = 0; i < quiz.count; i++) {
      await expect(page.locator('.kind').first()).toContainText(`Round ${i + 1} of ${quiz.count}`)
      await expect(page.locator('.q')).toContainText(quiz.questions[i].question.split(' ')[0])
      await expect(options(page)).toHaveCount(4)
      await option(page, ['A', 'B', 'C', 'D'][i % 4]).click()
      await page.getByRole('button', { name: i === quiz.count - 1 ? 'Arrive' : 'Next round' }).click()
    }

    await expect(page.getByText('You arrived')).toBeVisible({ timeout: 60_000 })
    const result = graded[0]
    await expect(page.locator('.score')).toHaveText(`${result.correct} / ${result.totalQuestions}`)
    await expect(page.locator('ol.review > li')).toHaveCount(quiz.count)
    for (let i = 0; i < quiz.count; i++) {
      await expect(page.locator('ol.review > li').nth(i)).toHaveClass(result.results[i].correct ? /right/ : /wrong/)
    }
    expect(consoleErrors, 'browser console errors').toEqual([])
    return { quiz, result, loadMs }
  }

  test('real ride without web search (2 rounds)', async ({ page }) => {
    const { quiz, loadMs } = await playRide(page, { web: false, minutes: 7 })
    expect(quiz.webSearch).toBe(false)
    await expect(page.locator('details.sources')).toHaveCount(0)
    test.info().annotations.push({ type: 'latency', description: `UI load of 2 rounds, no web: ${loadMs} ms` })
  })

  test('real ride with web search shows real sources (1 round)', async ({ page }) => {
    const { quiz, loadMs } = await playRide(page, { web: true, minutes: 5 })
    expect(quiz.webSearch).toBe(true)
    await expect(page.locator('details.sources summary')).toHaveText(
      `Based on ${quiz.sources.length} web ${quiz.sources.length === 1 ? 'source' : 'sources'}`,
    )
    await page.locator('details.sources summary').click()
    await expect(page.locator('details.sources a').first()).toHaveAttribute('href', quiz.sources[0].url)
    test.info().annotations.push({ type: 'latency', description: `UI load of 1 round with web: ${loadMs} ms` })
  })
})
